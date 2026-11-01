// Pure game logic for Glimmo — no DOM access here.

export const NUMBERS = [1, 2, 3];
export const SHAPES = ['bolt', 'moon', 'star'];
export const COLORS = ['blue', 'orange', 'teal'];
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

// Three cards form a match when, for every attribute, they are all the same or all different.
// With values 0..2 that is exactly when the digits sum to a multiple of 3.
export function isMatch(a, b, c) {
  const da = digits(a), db = digits(b), dc = digits(c);
  return da.every((_, i) => (da[i] + db[i] + dc[i]) % 3 === 0);
}

// A full spark is a match where every feature is different across the three cards. It scores 2.
export function isFullSpark(a, b, c) {
  const da = digits(a), db = digits(b), dc = digits(c);
  return da.every((_, i) => da[i] !== db[i] && db[i] !== dc[i] && da[i] !== dc[i]);
}

// The unique card that completes a match with a and b.
function thirdCard(a, b) {
  const da = digits(a), db = digits(b);
  return da.reduce((id, _, i) => id + ((6 - da[i] - db[i]) % 3) * 3 ** i, 0);
}

export function findMatch(board) {
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
    this.points = 0;
    this.mistakes = 0;
    this.hints = 0;
    this.over = false;
    this.ensurePlayable();
  }

  // Deal 3 more cards while the board has no match; end the game once the deck can't help.
  ensurePlayable() {
    while (!findMatch(this.board) && this.deck.length > 0) {
      this.board.push(...this.deck.splice(0, 3));
    }
    this.over = !findMatch(this.board);
  }

  // Returns the points scored by claiming three board positions: 0 if they are not a match
  // (the board is unchanged), 2 for a full spark, otherwise 1.
  claim(positions) {
    const [a, b, c] = positions.map((p) => this.board[p]);
    if (!isMatch(a, b, c)) {
      this.mistakes++;
      return 0;
    }
    const points = isFullSpark(a, b, c) ? 2 : 1;
    this.found++;
    this.points += points;
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
    return points;
  }

  hint() {
    this.hints++;
    return findMatch(this.board);
  }
}
