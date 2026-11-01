import { decode } from './game.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
// Shapes are drawn upright in a 40×80 box and placed side by side on a landscape card.
const SHAPE_PATHS = {
  // A lightning bolt: wide at the top, zig-zagging down to a sharp point.
  bolt: 'M23 3 L37 3 L27 31 L36 31 L11 77 L17 45 L5 45 Z',
  // A crescent moon opening to the right.
  moon: 'M32 4 C12 8 3 24 3 40 C3 56 12 72 32 76 C21 67 17 54 17 40 C17 26 21 13 32 4 Z',
  // A four-point sparkle with curved, pinched sides.
  star: 'M20 3 C22 26 25 36 38 40 C25 44 22 54 20 77 C18 54 15 44 2 40 C15 36 18 26 20 3 Z',
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
