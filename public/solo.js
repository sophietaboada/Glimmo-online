import { Game } from './game.js';
import { formatTime, renderBoard, toast } from './cards.js';

const $ = (id) => document.getElementById(id);
const boardEl = $('solo-board');
const BEST_KEY = 'glimmo-best-time';

let game;
let selected = [];
let startTime;
let timerId;
let busy = false;

function render() {
  renderBoard(boardEl, game.board, (el, position) => {
    el.classList.toggle('selected', selected.includes(position));
  });
  $('found').textContent = game.points;
  $('deck').textContent = game.deck.length;
}

function cardAt(position) {
  return boardEl.children[position];
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
  const points = game.claim(positions);
  if (points) {
    els.forEach((el) => el.classList.add('good'));
    toast(points === 2 ? 'Full spark! +2' : 'Match!');
    setTimeout(() => {
      selected = [];
      busy = false;
      clearHint();
      render();
      if (game.over) finish();
    }, 350);
  } else {
    els.forEach((el) => el.classList.add('bad'));
    toast('Not a match');
    setTimeout(() => {
      els.forEach((el) => el.classList.remove('bad', 'selected'));
      selected = [];
      busy = false;
    }, 450);
  }
}

// First hint reveals one card of a match, the next reveals a second card.
function showHint() {
  if (busy || game.over) return;
  const match = game.hint();
  if (!match) return;
  const shown = match.filter((p) => cardAt(p).classList.contains('hinted')).length;
  const next = match.find((p) => !cardAt(p).classList.contains('hinted'));
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
    `You scored ${game.points} points (${game.found} matches, ${game.points - game.found} full sparks) in ${formatTime(elapsed)}.`,
    `Mistakes: ${game.mistakes}. Hints: ${game.hints}.`,
  ];
  if (best) parts.push(`Best time without hints: ${formatTime(best)}.`);
  $('summary').textContent = parts.join(' ');
  $('gameover').showModal();
}

export function startSolo() {
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

export function stopSolo() {
  clearInterval(timerId);
}

boardEl.addEventListener('click', onCardClick);
$('hint').addEventListener('click', showHint);
$('new').addEventListener('click', startSolo);
$('again').addEventListener('click', startSolo);
