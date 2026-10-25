// End-to-end test of a group game against a running server.
// Start one with `npm run dev`, then: ROOM_URL=ws://127.0.0.1:8787 node --test tests/room.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSet, isSet } from '../public/game.js';

const BASE = process.env.ROOM_URL;
const HTTP = BASE?.replace(/^ws/, 'http');

// A simulated phone: keeps the latest room state and lets a test wait for a condition.
class Phone {
  constructor(room, id, name) {
    this.state = null;
    this.waiters = [];
    this.closeCode = null;
    this.ws = new WebSocket(`${BASE}/api/rooms/${room}?${new URLSearchParams({ id, name })}`);
    this.id = id;
    this.ws.addEventListener('message', (event) => {
      this.state = JSON.parse(event.data);
      this.check();
    });
    this.ws.addEventListener('close', (event) => {
      this.closeCode = event.code;
      this.check();
    });
  }

  check() {
    this.waiters = this.waiters.filter(({ predicate, resolve }) => !(predicate(this) && (resolve(), true)));
  }

  until(predicate, ms = 3000) {
    if (predicate(this)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out; last state ${JSON.stringify(this.state)}`)), ms);
      this.waiters.push({ predicate, resolve: () => { clearTimeout(timer); resolve(); } });
    });
  }

  send(message) {
    this.ws.send(typeof message === 'string' ? message : JSON.stringify(message));
  }

  me() {
    return this.state.players.find((p) => p.id === this.id);
  }

  close() {
    this.ws.close();
  }
}

function roomCode() {
  return Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
}

function wrongTriple(board) {
  for (let i = 0; i < board.length; i++)
    for (let j = i + 1; j < board.length; j++)
      for (let k = j + 1; k < board.length; k++) if (!isSet(board[i], board[j], board[k])) return [i, j, k];
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('group game', { skip: !BASE && 'set ROOM_URL to run against a server' }, async (t) => {
  const code = roomCode();
  const a = new Phone(code, 'a', 'Ana');
  const b = new Phone(code, 'b', ' Ben  ');
  const c = new Phone(code, 'c', 'Cleo');
  const phones = [a, b, c];
  const everyone = (predicate) => Promise.all(phones.map((p) => p.until(predicate)));

  await t.test('players join a lobby', async () => {
    await everyone((p) => p.state?.players.length === 3);
    assert.equal(a.state.phase, 'lobby');
    assert.deepEqual(a.state.players.map((p) => p.name).sort(), ['Ana', 'Ben', 'Cleo']);
  });

  await t.test('anyone can start; everyone sees the same table', async () => {
    c.send({ type: 'start' });
    await everyone((p) => p.state.phase === 'playing');
    assert.ok(a.state.board.length >= 12);
    assert.deepEqual(a.state.board, c.state.board);
    assert.equal(a.state.board.length + a.state.deck, 81);
  });

  await t.test('first to buzz gets the turn; others are ignored', async () => {
    // Separate connections can arrive in any order, so only buzz again once Ben's turn is confirmed.
    b.send({ type: 'buzz' });
    await everyone((p) => p.state.buzz?.playerId === 'b');
    a.send({ type: 'buzz' });
    a.send({ type: 'pick', position: 0 });
    b.send({ type: 'pick', position: 99 });
    b.send('not json');
    await pause(200);
    assert.equal(a.state.buzz.playerId, 'b');
    assert.deepEqual(a.state.buzz.picks, []);
    assert.ok(a.state.buzz.msLeft > 8000 && a.state.buzz.msLeft <= 10000);
  });

  await t.test('a correct set scores +1 and deals new cards', async () => {
    const board = b.state.board;
    const set = findSet(board);
    b.send({ type: 'pick', position: set[0] });
    await everyone((p) => p.state.buzz?.picks.length === 1); // others see picks live
    b.send({ type: 'pick', position: set[1] });
    b.send({ type: 'pick', position: set[2] });
    await everyone((p) => p.state.event?.kind === 'set');
    assert.equal(b.me().score, 1);
    assert.equal(a.state.buzz, null);
    assert.ok(set.every((pos) => !a.state.board.includes(board[pos])));
    assert.deepEqual(a.state.event.cards.sort(), set.map((pos) => board[pos]).sort());
  });

  await t.test('a wrong set scores −1 and sits that player out', async () => {
    c.send({ type: 'buzz' });
    await c.until((p) => p.state.buzz?.playerId === 'c');
    for (const position of wrongTriple(c.state.board)) c.send({ type: 'pick', position });
    await everyone((p) => p.state.event?.kind === 'miss');
    assert.equal(c.me().score, -1);
    assert.equal(c.me().lockedOut, true);
    c.send({ type: 'buzz' });
    await pause(200);
    assert.equal(a.state.buzz, null);
  });

  await t.test('running out of time scores −1', { timeout: 15000 }, async () => {
    a.send({ type: 'buzz' });
    await a.until((p) => p.state.event?.kind === 'timeout', 12000);
    assert.equal(a.me().score, -1);
    assert.equal(a.me().lockedOut, true);
    assert.equal(b.me().lockedOut, false);
  });

  await t.test('the next set lets everyone play again', async () => {
    b.send({ type: 'buzz' });
    await b.until((p) => p.state.buzz?.playerId === 'b');
    for (const position of findSet(b.state.board)) b.send({ type: 'pick', position });
    await everyone((p) => p.state.event?.kind === 'set' && p.state.players.every((q) => !q.lockedOut));
    assert.equal(b.me().score, 2);
  });

  await t.test('leaving mid-turn frees the table without a penalty; rejoining keeps the score', async () => {
    b.send({ type: 'buzz' });
    await a.until((p) => p.state.buzz?.playerId === 'b');
    b.close();
    await a.until((p) => p.state.buzz === null && !p.state.players.find((q) => q.id === 'b').connected);
    const back = new Phone(code, 'b', 'Ben');
    phones[1] = back;
    await back.until((p) => p.state?.players.find((q) => q.id === 'b').connected);
    assert.equal(back.me().score, 2);
  });

  await t.test('opening the same player twice hands the seat to the newest connection', async () => {
    const again = new Phone(code, 'a', 'Ana');
    await a.until((p) => p.closeCode !== null);
    assert.equal(a.closeCode, 4001);
    await again.until((p) => p.state?.players.length === 3);
    phones[0] = again;
  });

  await t.test('a whole game plays through to the end', { timeout: 30000 }, async () => {
    let turn = 0;
    while (phones[0].state.phase === 'playing') {
      const phone = phones[turn++ % 3];
      const seq = phone.state.event?.seq;
      phone.send({ type: 'buzz' });
      await phone.until((p) => p.state.buzz?.playerId === phone.id);
      for (const position of findSet(phone.state.board)) phone.send({ type: 'pick', position });
      await phone.until((p) => p.state.event?.seq !== seq && p.state.buzz === null);
      // Over the internet the other phones hear about it a moment later; wait so the loop sees game over.
      const done = phone.state.event.seq;
      await everyone((p) => p.state.event?.seq === done);
    }
    const { state } = phones[0];
    assert.equal(state.phase, 'over');
    assert.equal(state.deck, 0);
    assert.equal(findSet(state.board), null);
  });

  await t.test('a new game resets the scores', async () => {
    phones[2].send({ type: 'start' });
    await everyone((p) => p.state.phase === 'playing' && p.state.players.every((q) => q.score === 0));
  });

  phones.forEach((p) => p.close());
});

test('room address only accepts WebSocket connections', { skip: !BASE && 'set ROOM_URL' }, async () => {
  assert.equal((await fetch(`${HTTP}/api/rooms/ABCD`)).status, 426);
  assert.equal((await fetch(`${HTTP}/`)).status, 200);
  assert.equal((await fetch(`${HTTP}/package.json`)).status, 404);
});
