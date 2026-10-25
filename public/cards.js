import { decode } from './game.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
// Shapes are drawn upright in a 40×80 box and placed side by side on a landscape card.
const SHAPE_PATHS = {
  diamond: 'M20 3 L37 40 L20 77 L3 40 Z',
  oval: 'M20 3 C32 3 37 11 37 22 L37 58 C37 69 32 77 20 77 C8 77 3 69 3 58 L3 22 C3 11 8 3 20 3 Z',
  squiggle: 'M27 3 C38 6 39 20 34 31 C30 40 37 48 37 59 C37 72 26 79 16 76 C5 73 2 62 6 50 C10 40 3 32 3 21 C3 9 15 0 27 3 Z',
};

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

// Re-render a board, animating only cards that weren't there before.
// `decorate(el, position)` sets per-card classes such as "selected".
export function renderBoard(boardEl, cards, decorate) {
  const previous = new Map([...boardEl.children].map((el) => [Number(el.dataset.card), el]));
  const els = cards.map((id, position) => {
    let el = previous.get(id);
    if (!el) {
      el = cardElement(id);
      el.dataset.card = id;
      el.classList.add('enter');
    } else {
      el.classList.remove('enter');
    }
    el.dataset.position = position;
    decorate?.(el, position);
    return el;
  });
  boardEl.replaceChildren(...els);
}

export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 1600);
}

export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
