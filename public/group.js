import { renderBoard, toast } from './cards.js';
import qrcode from './vendor/qrcode.mjs';

const $ = (id) => document.getElementById(id);
const boardEl = $('group-board');
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O, which look like 1 and 0
const ID_KEY = 'set-player-id';
const REPLACED = 4001; // close code the room sends when this player connected again elsewhere

let roomCode;
let playerName;
let me;
let socket;
let active = false;
let state = null;
let lastSeq = null;
let deadline = 0;
let retries = 0;
let countdownId;
let pingId;
let wakeLock = null;

export function newRoomCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
}

// A random id per phone, so a dropped connection rejoins as the same player with the same score.
function playerId() {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) localStorage.setItem(ID_KEY, (id = crypto.randomUUID()));
    return id;
  } catch {
    return (playerId.fallback ??= crypto.randomUUID());
  }
}

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function connect() {
  if (!active || socket?.readyState === WebSocket.CONNECTING || socket?.readyState === WebSocket.OPEN) return;
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const params = new URLSearchParams({ id: me, name: playerName });
  const ws = (socket = new WebSocket(`${protocol}://${location.host}/api/rooms/${roomCode}?${params}`));
  ws.addEventListener('open', () => { retries = 0; });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (ws === socket && message.type === 'state') update(message);
  });
  ws.addEventListener('close', (event) => {
    if (!active || ws !== socket) return;
    if (event.code === REPLACED) {
      // Opened again in another tab or window; let that one play instead of fighting over the seat.
      toast('This game is open somewhere else');
      return;
    }
    toast(retries < 3 ? 'Reconnecting…' : 'Can’t reach the room. Still trying…');
    setTimeout(connect, Math.min(1000 * 2 ** retries++, 8000));
  });
}

function inviteUrl() {
  return `${location.origin}${location.pathname}?room=${roomCode}`;
}

// Square SVG QR code, black on white with the standard 4-module quiet zone so phone cameras pick it up.
function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const size = count + 8;
  let modules = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) modules += `M${col + 4} ${row + 4}h1v1h-1z`;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code that opens the invite link">`
    + `<rect width="${size}" height="${size}" fill="#fff"/><path d="${modules}" fill="#000"/></svg>`;
}

export function joinRoom(code, name) {
  roomCode = code;
  playerName = name;
  me = playerId();
  active = true;
  state = null;
  lastSeq = null;
  retries = 0;
  $('room-label').textContent = code;
  $('lobby-code').textContent = code;
  $('invite-code').textContent = code;
  $('lobby-qr').innerHTML = $('invite-qr').innerHTML = qrSvg(inviteUrl());
  $('scores').replaceChildren();
  boardEl.replaceChildren();
  $('lobby').hidden = false;
  boardEl.hidden = true;
  renderButton();
  history.replaceState(null, '', `?room=${code}`);
  connect();
  // Cloudflare drops silent connections, so say something every so often.
  pingId = setInterval(() => send({ type: 'ping' }), 30_000);
  countdownId = setInterval(() => state?.buzz && renderButton(), 250);
  keepAwake();
}

export function leaveRoom() {
  active = false;
  socket?.close();
  clearInterval(pingId);
  clearInterval(countdownId);
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  history.replaceState(null, '', location.pathname);
}

// Stop phones dimming mid-game (supported on recent iOS and most browsers).
async function keepAwake() {
  try {
    if (active && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock?.request('screen');
  } catch { /* not supported or not allowed — the game still works */ }
}

document.addEventListener('visibilitychange', () => {
  if (!active || document.visibilityState !== 'visible') return;
  keepAwake();
  // iOS may have silently dropped the connection while the phone was locked.
  connect();
});

function update(next) {
  const first = state === null;
  state = next;
  if (next.event && next.event.seq !== lastSeq) {
    if (!first) announce(next.event);
    lastSeq = next.event.seq;
  }
  deadline = next.buzz ? Date.now() + next.buzz.msLeft : 0;
  render();
}

function announce({ kind, playerId: who, name }) {
  const mine = who === me;
  const messages = {
    set: mine ? 'SET! +1' : `${name} found a SET`,
    miss: mine ? 'Not a set −1' : `${name} missed −1`,
    timeout: mine ? 'Time’s up −1' : `${name} ran out of time −1`,
  };
  toast(messages[kind]);
}

function nameOf(id) {
  return state.players.find((p) => p.id === id)?.name ?? 'Someone';
}

function render() {
  const { phase, players, buzz } = state;
  const playing = phase === 'playing';

  const ordered = phase === 'over' ? [...players].sort((a, b) => b.score - a.score) : players;
  $('scores').replaceChildren(...ordered.map((p) => {
    const li = document.createElement('li');
    const score = document.createElement('b');
    score.textContent = p.score;
    li.append(p.id === me ? `${p.name} (you)` : p.name, score);
    li.classList.toggle('me', p.id === me);
    li.classList.toggle('picking', buzz?.playerId === p.id);
    li.classList.toggle('out', p.lockedOut);
    li.classList.toggle('away', !p.connected);
    return li;
  }));

  $('lobby').hidden = playing;
  boardEl.hidden = !playing;
  $('lobby-waiting').hidden = phase !== 'lobby';
  $('lobby-results').hidden = phase !== 'over';
  if (phase === 'over') {
    const top = Math.max(...players.map((p) => p.score));
    const winners = players.filter((p) => p.score === top).map((p) => p.name);
    $('winner').textContent = winners.length > 1 ? `It’s a tie: ${winners.join(' and ')}` : `${winners[0]} wins!`;
  }
  $('group-deck').textContent = playing ? `${state.deck} left` : '';

  if (playing) {
    const myTurn = buzz?.playerId === me;
    renderBoard(boardEl, state.board, (el, position) => {
      el.classList.toggle('selected', buzz?.picks.includes(position) ?? false);
      el.classList.toggle('waiting', !myTurn);
    });
  }
  renderButton();
}

function renderButton() {
  const button = $('buzz');
  let label = 'Connecting…';
  let action = null;
  if (state) {
    const { phase, buzz } = state;
    const meNow = state.players.find((p) => p.id === me);
    const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (phase === 'lobby') [label, action] = ['Start game', 'start'];
    else if (phase === 'over') [label, action] = ['New game', 'start'];
    else if (buzz?.playerId === me) label = `Pick 3 cards · ${seconds}`;
    else if (buzz) label = `${nameOf(buzz.playerId)} is picking · ${seconds}`;
    else if (meNow?.lockedOut) label = 'Wait for the next set';
    else [label, action] = ['SET!', 'buzz'];
    button.classList.toggle('mine', buzz?.playerId === me);
  }
  button.textContent = label;
  button.disabled = !action;
  button.dataset.action = action ?? '';
}

boardEl.addEventListener('click', (event) => {
  const el = event.target.closest('.card');
  if (!el || state?.buzz?.playerId !== me) return;
  el.classList.toggle('selected'); // shown right away; the room's reply confirms it
  send({ type: 'pick', position: Number(el.dataset.position) });
});

$('buzz').addEventListener('click', (event) => {
  const { action } = event.currentTarget.dataset;
  if (action) send({ type: action });
});

$('invite').addEventListener('click', () => $('invite-dialog').showModal());

$('share-link').addEventListener('click', async () => {
  const url = inviteUrl();
  try {
    if (navigator.share) {
      await navigator.share({ title: 'SET', text: `Join my SET game (room ${roomCode})`, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast('Invite link copied');
  } catch (error) {
    if (error.name !== 'AbortError') toast(`Room code: ${roomCode}`);
  }
});
