// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, decode, findMatch, isFullSpark, isMatch } from '../public/game.js';

const ATTRS = ['number', 'shape', 'color', 'shading'];

function bruteForceIsMatch(a, b, c) {
  const [x, y, z] = [a, b, c].map(decode);
  return ATTRS.every((k) => new Set([x[k], y[k], z[k]]).size !== 2);
}

test('decode yields 81 distinct cards', () => {
  const keys = new Set([...Array(81).keys()].map((id) => ATTRS.map((k) => decode(id)[k]).join()));
  assert.equal(keys.size, 81);
});

test('isMatch matches the rules for every triple', () => {
  let matches = 0;
  for (let a = 0; a < 81; a++) {
    for (let b = a + 1; b < 81; b++) {
      for (let c = b + 1; c < 81; c++) {
        assert.equal(isMatch(a, b, c), bruteForceIsMatch(a, b, c));
        if (isMatch(a, b, c)) matches++;
      }
    }
  }
  assert.equal(matches, 1080);
});

test('isFullSpark is a match where every feature differs', () => {
  let sparks = 0;
  for (let a = 0; a < 81; a++) {
    for (let b = a + 1; b < 81; b++) {
      for (let c = b + 1; c < 81; c++) {
        const [x, y, z] = [a, b, c].map(decode);
        const expected = ATTRS.every((k) => new Set([x[k], y[k], z[k]]).size === 3);
        assert.equal(isFullSpark(a, b, c), expected);
        if (expected) sparks++;
      }
    }
  }
  assert.equal(sparks, 216);
});

test('claim scores 2 for a full spark, 1 for a match and 0 otherwise', () => {
  const game = new Game();
  game.board = [0, 40, 80, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // 0, 40, 80 differ in every feature
  assert.equal(game.claim([0, 1, 2]), 2);
  game.board = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // 0, 1, 2 differ only in number
  assert.equal(game.claim([0, 1, 2]), 1);
  game.board = [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  assert.equal(game.claim([0, 1, 2]), 0);
  assert.equal(game.points, 3);
});

test('findMatch returns a valid match or null', () => {
  for (let n = 0; n < 2000; n++) {
    const board = [...Array(81).keys()].sort(() => Math.random() - 0.5).slice(0, 12);
    const found = findMatch(board);
    if (found) assert.ok(isMatch(...found.map((p) => board[p])));
    else {
      for (let i = 0; i < 12; i++)
        for (let j = i + 1; j < 12; j++)
          for (let k = j + 1; k < 12; k++) assert.ok(!isMatch(board[i], board[j], board[k]));
    }
  }
});

test('random full games conserve cards and end with no match', () => {
  for (let n = 0; n < 300; n++) {
    const game = new Game();
    while (!game.over) {
      assert.equal(game.found * 3 + game.board.length + game.deck.length, 81);
      assert.equal(new Set(game.board).size, game.board.length);
      assert.ok(game.board.length >= 12 || game.deck.length === 0);
      assert.ok(game.claim(game.hint()) > 0);
    }
    assert.equal(game.deck.length, 0);
    assert.equal(findMatch(game.board), null);
  }
});
