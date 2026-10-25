// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, decode, findSet, isSet } from '../public/game.js';

const ATTRS = ['number', 'shape', 'color', 'shading'];

function bruteForceIsSet(a, b, c) {
  const [x, y, z] = [a, b, c].map(decode);
  return ATTRS.every((k) => new Set([x[k], y[k], z[k]]).size !== 2);
}

test('decode yields 81 distinct cards', () => {
  const keys = new Set([...Array(81).keys()].map((id) => ATTRS.map((k) => decode(id)[k]).join()));
  assert.equal(keys.size, 81);
});

test('isSet matches the rules for every triple', () => {
  let sets = 0;
  for (let a = 0; a < 81; a++) {
    for (let b = a + 1; b < 81; b++) {
      for (let c = b + 1; c < 81; c++) {
        assert.equal(isSet(a, b, c), bruteForceIsSet(a, b, c));
        if (isSet(a, b, c)) sets++;
      }
    }
  }
  assert.equal(sets, 1080);
});

test('findSet returns a valid set or null', () => {
  for (let n = 0; n < 2000; n++) {
    const board = [...Array(81).keys()].sort(() => Math.random() - 0.5).slice(0, 12);
    const found = findSet(board);
    if (found) assert.ok(isSet(...found.map((p) => board[p])));
    else {
      for (let i = 0; i < 12; i++)
        for (let j = i + 1; j < 12; j++)
          for (let k = j + 1; k < 12; k++) assert.ok(!isSet(board[i], board[j], board[k]));
    }
  }
});

test('random full games conserve cards and end with no set', () => {
  for (let n = 0; n < 300; n++) {
    const game = new Game();
    while (!game.over) {
      assert.equal(game.found * 3 + game.board.length + game.deck.length, 81);
      assert.equal(new Set(game.board).size, game.board.length);
      assert.ok(game.board.length >= 12 || game.deck.length === 0);
      assert.equal(game.claim(game.hint()), true);
    }
    assert.equal(game.deck.length, 0);
    assert.equal(findSet(game.board), null);
  }
});
