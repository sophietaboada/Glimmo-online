import { DurableObject } from 'cloudflare:workers';
import { Game } from '../public/game.js';

const BUZZ_MS = 10_000;
const MAX_PLAYERS = 12;
const ROOM_PATH = /^\/api\/rooms\/([A-Z]{4})$/;
const REPLACED = 4001; // close code telling a phone its seat was taken by a newer connection

export default {
  async fetch(request, env) {
    const match = new URL(request.url).pathname.match(ROOM_PATH);
    if (!match) return env.ASSETS.fetch(request);
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket connection', { status: 426 });
    }
    return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
  },
};

function cleanName(name) {
  return (name ?? '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Player';
}

// A group game. State lives in memory only: nothing about players is stored once the room empties.
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.players = new Map(); // id → { id, name, score, lockedOut, socket }
    this.phase = 'lobby'; // 'lobby' | 'playing' | 'over'
    this.game = null;
    this.buzz = null; // { playerId, picks, deadline, timer } while someone is picking cards
    this.event = null; // last match found / missed, so phones can announce it
    this.seq = 0;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const id = (url.searchParams.get('id') ?? '').slice(0, 64);
    if (!id) return new Response('Missing player id', { status: 400 });
    let player = this.players.get(id);
    const connected = [...this.players.values()].filter((p) => p.socket).length;
    if (!player && connected >= MAX_PLAYERS) return new Response('Room is full', { status: 403 });

    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    if (player) {
      // Same phone reconnecting (or a second tab): the newest connection wins.
      player.socket?.close(REPLACED, 'Replaced by a newer connection');
      player.name = cleanName(url.searchParams.get('name'));
    } else {
      player = { id, name: cleanName(url.searchParams.get('name')), score: 0, lockedOut: false, socket: null };
      this.players.set(id, player);
    }
    player.socket = server;

    server.addEventListener('message', (event) => this.onMessage(player, event.data));
    const onGone = () => {
      if (player.socket !== server) return;
      player.socket = null;
      if (this.buzz?.playerId === player.id) this.cancelBuzz();
      this.broadcast();
    };
    server.addEventListener('close', onGone);
    server.addEventListener('error', onGone);

    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  onMessage(player, raw) {
    if (typeof raw !== 'string' || raw.length > 200) return;
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message.type === 'start') this.start();
    else if (message.type === 'buzz') this.onBuzz(player);
    else if (message.type === 'pick') this.onPick(player, message.position);
  }

  start() {
    if (this.buzz) this.cancelBuzz();
    for (const [id, player] of this.players) {
      if (!player.socket) this.players.delete(id);
      player.score = 0;
      player.lockedOut = false;
    }
    this.game = new Game();
    this.phase = 'playing';
    this.event = null;
    this.broadcast();
  }

  onBuzz(player) {
    if (this.phase !== 'playing' || this.buzz || player.lockedOut) return;
    this.buzz = {
      playerId: player.id,
      picks: [],
      deadline: Date.now() + BUZZ_MS,
      timer: setTimeout(() => this.finishBuzz('timeout'), BUZZ_MS),
    };
    this.broadcast();
  }

  onPick(player, position) {
    const buzz = this.buzz;
    if (buzz?.playerId !== player.id) return;
    if (!Number.isInteger(position) || position < 0 || position >= this.game.board.length) return;
    buzz.picks = buzz.picks.includes(position)
      ? buzz.picks.filter((p) => p !== position)
      : [...buzz.picks, position];
    if (buzz.picks.length < 3) {
      this.broadcast();
      return;
    }
    const cards = buzz.picks.map((p) => this.game.board[p]);
    const points = this.game.claim(buzz.picks);
    this.finishBuzz(points ? 'match' : 'miss', cards, points);
  }

  // Right: +1 (+2 for a full spark) and everyone may buzz again. Wrong or out of time: −1 and sit out until the next match.
  finishBuzz(kind, cards = [], points = 0) {
    const player = this.players.get(this.buzz.playerId);
    clearTimeout(this.buzz.timer);
    this.buzz = null;
    if (kind === 'match') {
      player.score += points;
      for (const p of this.players.values()) p.lockedOut = false;
      if (this.game.over) this.phase = 'over';
    } else {
      player.score--;
      player.lockedOut = true;
      const active = [...this.players.values()].filter((p) => p.socket);
      if (active.every((p) => p.lockedOut)) for (const p of active) p.lockedOut = false;
    }
    this.event = { seq: ++this.seq, kind, playerId: player.id, name: player.name, cards, points };
    this.broadcast();
  }

  // The picking player left: no penalty, the table is open again.
  cancelBuzz() {
    clearTimeout(this.buzz.timer);
    this.buzz = null;
  }

  broadcast() {
    const state = JSON.stringify({
      type: 'state',
      phase: this.phase,
      board: this.game?.board ?? [],
      deck: this.game?.deck.length ?? 0,
      players: [...this.players.values()].map(({ id, name, score, lockedOut, socket }) => ({
        id, name, score, lockedOut, connected: Boolean(socket),
      })),
      buzz: this.buzz && {
        playerId: this.buzz.playerId,
        picks: this.buzz.picks,
        msLeft: this.buzz.deadline - Date.now(),
      },
      event: this.event,
    });
    for (const player of this.players.values()) {
      try {
        player.socket?.send(state);
      } catch {
        // The socket closed mid-send; its close handler cleans up.
      }
    }
  }
}
