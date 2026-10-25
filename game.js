// Pure game logic for SET — no DOM access here.

export const NUMBERS = [1, 2, 3];
export const SHAPES = ['diamond', 'squiggle', 'oval'];
export const COLORS = ['red', 'green', 'purple'];
export const SHADINGS = ['solid', 'striped', 'open'];

// A card is encoded as an integer 0..80; each attribute is one base-3 digit.
export function decode(id) {
  return {
    id,
    number: NUMBERS[id % 3],
    shape: SHAPES[Math.floor(id / 3) % 3],
    color: COLORS[Math.floor(id / 9) % 3],
    shading: SHADINGS[Math.floor(id / 27) % 3],
  };
}

function digits(id) {
  return [id % 3, Math.floor(id / 3) % 3, Math.floor(id / 9) % 3, Math.floor(id / 27) % 3];
}

// Three cards form a set when, for every attribute, they are all the same or all different.
// With values 0..2 that is exactly when the digits sum to a multiple of 3.
export function isSet(a, b, c) {
  const da = digits(a), db = digits(b), dc = digits(c);
  return da.every((_, i) => (da[i] + db[i] + dc[i]) % 3 === 0);
}

// The unique card that completes a set with a and b.
function thirdCard(a, b) {
  const da = digits(a), db = digits(b);
  return da.reduce((id, _, i) => id + ((6 - da[i] - db[i]) % 3) * 3 ** i, 0);
}

export function findSet(board) {
  const present = new Map(board.map((card, index) => [card, index]));
  for (let i = 0; i < board.length; i++) {
    for (let j = i + 1; j < board.length; j++) {
      const k = present.get(thirdCard(board[i], board[j]));
      if (k !== undefined && k > j) return [i, j, k];
    }
  }
  return null;
}

function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export class Game {
  constructor() {
    this.deck = shuffle([...Array(81).keys()]);
    this.board = this.deck.splice(0, 12);
    this.found = 0;
    this.mistakes = 0;
    this.hints = 0;
    this.over = false;
    this.ensurePlayable();
  }

  // Deal 3 more cards while the board has no set; end the game once the deck can't help.
  ensurePlayable() {
    while (!findSet(this.board) && this.deck.length > 0) {
      this.board.push(...this.deck.splice(0, 3));
    }
    this.over = !findSet(this.board);
  }

  // Returns true if the three board positions form a set (and applies it).
  claim(positions) {
    const [a, b, c] = positions.map((p) => this.board[p]);
    if (!isSet(a, b, c)) {
      this.mistakes++;
      return false;
    }
    this.found++;
    if (this.board.length > 12 || this.deck.length === 0) {
      // Shrink the board instead of refilling: move cards from the last row into the gaps
      // so the rest of the layout stays put.
      const newLength = this.board.length - 3;
      const gaps = positions.filter((p) => p < newLength);
      const movers = this.board.slice(newLength).filter((_, i) => !positions.includes(newLength + i));
      gaps.forEach((p, i) => { this.board[p] = movers[i]; });
      this.board.length = newLength;
    } else {
      for (const p of positions) this.board[p] = this.deck.pop();
    }
    this.ensurePlayable();
    return true;
  }

  hint() {
    this.hints++;
    return findSet(this.board);
  }
}
