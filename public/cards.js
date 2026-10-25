import { decode } from './game.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
// Shapes are drawn upright in a 40×80 box and placed side by side on a landscape card.
const SHAPE_PATHS = {
  diamond: 'M20 3 L37 40 L20 77 L3 40 Z',
  oval: 'M20 3 C32 3 37 11 37 22 L37 58 C37 69 32 77 20 77 C8 77 3 69 3 58 L3 22 C3 11 8 3 20 3 Z',
  // An S-bend, leaning right at the top and left at the bottom, so it can't be mistaken for an oval.
  squiggle: 'M26 2 C28.7 2.7 32 3.5 34 6 C36 8.5 37.8 13 38 17 C38.2 21 36.8 25.8 35 30 C33.2 34.2 29.3 38 27 42 C24.7 46 21.8 50 21 54 C20.2 58 21 62.7 22 66 C23 69.3 27.5 71.8 27 74 C26.5 76.2 22 78.7 19 79 C16 79.3 11.7 78.2 9 76 C6.3 73.8 3.8 70 3 66 C2.2 62 2.7 56.5 4 52 C5.3 47.5 8.7 43 11 39 C13.3 35 17 32 18 28 C19 24 17.8 18.5 17 15 C16.2 11.5 12.8 9.2 13 7 C13.2 4.8 15.8 2.8 18 2 C20.2 1.2 23.3 1.3 26 2 Z',
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
