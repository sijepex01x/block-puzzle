// BLOCKBURST — pieces.js
// Shape table. No rotation — every orientation is its own shape, faithful
// to Block Blast. Pure data + random picker. No DOM, no canvas.

import { PIECE_COLORS } from './config.js';

// Each shape: { id, name, cells: [[row, col], ...] (relative, min r/c = 0), color }
export const SHAPES = [
  // Singles / lines
  { id: 'single', name: 'Single', cells: [[0, 0]] },
  { id: 'line2h', name: 'Line 2', cells: [[0, 0], [0, 1]] },
  { id: 'line2v', name: 'Line 2', cells: [[0, 0], [1, 0]] },
  { id: 'line3h', name: 'Line 3', cells: [[0, 0], [0, 1], [0, 2]] },
  { id: 'line3v', name: 'Line 3', cells: [[0, 0], [1, 0], [2, 0]] },
  { id: 'line4h', name: 'Line 4', cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { id: 'line4v', name: 'Line 4', cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: 'line5h', name: 'Line 5', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { id: 'line5v', name: 'Line 5', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },

  // Squares
  { id: 'square2', name: 'Square 2x2', cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  {
    id: 'square3', name: 'Square 3x3',
    cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  },

  // Rectangles
  {
    id: 'rect2x3', name: 'Rect 2x3',
    cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]],
  },
  {
    id: 'rect3x2', name: 'Rect 3x2',
    cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]],
  },

  // L corners, 2x2 (4 rotations)
  { id: 'l2a', name: 'Corner', cells: [[0, 0], [0, 1], [1, 0]] },
  { id: 'l2b', name: 'Corner', cells: [[0, 0], [0, 1], [1, 1]] },
  { id: 'l2c', name: 'Corner', cells: [[0, 1], [1, 0], [1, 1]] },
  { id: 'l2d', name: 'Corner', cells: [[0, 0], [1, 0], [1, 1]] },

  // L corners, 3x3 (4 rotations)
  { id: 'l3a', name: 'Big Corner', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]] },
  { id: 'l3b', name: 'Big Corner', cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]] },
  { id: 'l3c', name: 'Big Corner', cells: [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]] },
  { id: 'l3d', name: 'Big Corner', cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] },

  // Small T (4 rotations)
  { id: 'tUp', name: 'T', cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { id: 'tDown', name: 'T', cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
  { id: 'tLeft', name: 'T', cells: [[0, 0], [1, 0], [1, 1], [2, 0]] },
  { id: 'tRight', name: 'T', cells: [[0, 1], [1, 0], [1, 1], [2, 1]] },

  // S / Z zigzags, 2x3
  { id: 'sShape', name: 'S', cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  { id: 'zShape', name: 'Z', cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
].map((shape) => ({
  ...shape,
  color: PIECE_COLORS[shape.id],
}));

// Bounding box of a shape's cells: { rows, cols }.
export function shapeSize(shape) {
  let rows = 0;
  let cols = 0;
  for (const [r, c] of shape.cells) {
    if (r + 1 > rows) rows = r + 1;
    if (c + 1 > cols) cols = c + 1;
  }
  return { rows, cols };
}

// Return a fresh piece instance (deep-copied cells) of a random shape.
// rng: () => [0, 1) — defaults to Math.random; inject a seeded rng for tests.
export function randomPiece(rng = Math.random) {
  const shape = SHAPES[Math.floor(rng() * SHAPES.length)];
  return {
    id: shape.id,
    name: shape.name,
    cells: shape.cells.map(([r, c]) => [r, c]),
    color: shape.color,
  };
}

// Look up a shape by id and return a fresh piece instance.
export function pieceById(id) {
  const shape = SHAPES.find((s) => s.id === id);
  if (!shape) return null;
  return {
    id: shape.id,
    name: shape.name,
    cells: shape.cells.map(([r, c]) => [r, c]),
    color: shape.color,
  };
}
