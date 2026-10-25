import { Game, decode } from './game.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
// Shapes are drawn upright in a 40×80 box and placed side by side on a landscape card.
const SHAPE_PATHS = {
  diamond: 'M20 3 L37 40 L20 77 L3 40 Z',
  oval: 'M20 3 C32 3 37 11 37 22 L37 58 C37 69 32 77 20 77 C8 77 3 69 3 58 L3 22 C3 11 8 3 20 3 Z',
  squiggle: 'M27 3 C38 6 39 20 34 31 C30 40 37 48 37 59 C37 72 26 79 16 76 C5 73 2 62 6 50 C10 40 3 32 3 21 C3 9 15 0 27 3 Z',
};

const $ = (id) => document.getElementById(id);
const boardEl = $('board');
const BEST_KEY = 'set-best-time';

let game;
let selected = [];
let startTime;
let timerId;
let busy = false;

function cardElement(id) {
  const card = decode(id);
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'card';
  el.setAttribute('aria-label', `${card.number} ${card.color} ${card.shading} ${card.shape}${card.number > 1 ? 's' : ''}`);
  const color = `var(--${card.color})`;
  const fill = { solid: color, striped: `url(#stripes-${card.color})`, open: 'none' }[card.shading];
  for (let i = 0; i < card.number; i++) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 40 80');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', SHAPE_PATHS[card.shape]);
    path.style.fill = fill;
    path.style.stroke = color;
    path.style.strokeWidth = '3';
    path.style.strokeLinejoin = 'round';
    svg.append(path);
    el.append(svg);
  }
  return el;
}

// Re-render the board, animating only cards that weren't there before.
function render() {
  const previous = new Map([...boardEl.children].map((el) => [Number(el.dataset.card), el]));
  const els = game.board.map((id, position) => {
    let el = previous.get(id);
    if (!el) {
      el = cardElement(id);
      el.dataset.card = id;
      el.classList.add('enter');
    } else {
      el.classList.remove('enter');
    }
    el.dataset.position = position;
    el.classList.toggle('selected', selected.includes(position));
    return el;
  });
  boardEl.replaceChildren(...els);
  $('found').textContent = game.found;
  $('deck').textContent = game.deck.length;
}

function cardAt(position) {
  return boardEl.children[position];
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 1400);
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function tick() {
  $('time').textContent = formatTime(Date.now() - startTime);
}

function clearHint() {
  for (const el of boardEl.children) el.classList.remove('hinted');
}

function onCardClick(event) {
  const el = event.target.closest('.card');
  if (!el || busy || game.over) return;
  const position = Number(el.dataset.position);
  if (selected.includes(position)) {
    selected = selected.filter((p) => p !== position);
    el.classList.remove('selected');
    return;
  }
  selected.push(position);
  el.classList.add('selected');
  if (selected.length === 3) checkSelection();
}

function checkSelection() {
  const positions = selected;
  const els = positions.map(cardAt);
  busy = true;
  if (game.claim(positions)) {
    els.forEach((el) => el.classList.add('good'));
    toast('SET!');
    setTimeout(() => {
      selected = [];
      busy = false;
      clearHint();
      render();
      if (game.over) finish();
    }, 350);
  } else {
    els.forEach((el) => el.classList.add('bad'));
    toast('Not a set');
    setTimeout(() => {
      els.forEach((el) => el.classList.remove('bad', 'selected'));
      selected = [];
      busy = false;
    }, 450);
  }
}

// First hint reveals one card of a set, the next reveals a second card.
function showHint() {
  if (busy || game.over) return;
  const set = game.hint();
  if (!set) return;
  const shown = set.filter((p) => cardAt(p).classList.contains('hinted')).length;
  const next = set.find((p) => !cardAt(p).classList.contains('hinted'));
  if (shown < 2) cardAt(next).classList.add('hinted');
  else toast('Two cards are shown — find the third!');
}

function finish() {
  clearInterval(timerId);
  const elapsed = Date.now() - startTime;
  let best = null;
  try {
    best = Number(localStorage.getItem(BEST_KEY)) || null;
    if (game.hints === 0 && (!best || elapsed < best)) {
      localStorage.setItem(BEST_KEY, elapsed);
      best = elapsed;
    }
  } catch { /* storage unavailable (e.g. private mode) */ }
  const parts = [
    `You found ${game.found} sets in ${formatTime(elapsed)}.`,
    `Mistakes: ${game.mistakes}. Hints: ${game.hints}.`,
  ];
  if (best) parts.push(`Best time without hints: ${formatTime(best)}.`);
  $('summary').textContent = parts.join(' ');
  $('gameover').showModal();
}

function newGame() {
  game = new Game();
  selected = [];
  busy = false;
  boardEl.replaceChildren();
  render();
  startTime = Date.now();
  clearInterval(timerId);
  timerId = setInterval(tick, 500);
  tick();
}

boardEl.addEventListener('click', onCardClick);
$('hint').addEventListener('click', showHint);
$('new').addEventListener('click', newGame);
$('again').addEventListener('click', newGame);
$('rules-btn').addEventListener('click', () => $('rules').showModal());

newGame();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}
