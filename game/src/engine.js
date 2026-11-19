// BLOCKBURST — engine.js
// Pure game logic. No DOM, no canvas, no imports with side effects.
// Testable in node: `node --check` + the smoke test in /tmp.

import { BOARD, CELL_SCORE, LINE_BONUS_BASE, TRAY_SIZE } from './config.js';
import { randomPiece } from './pieces.js';

// Create a fresh game state and deal the opening tray.
export function createGame(rng = Math.random) {
  const state = {
    board: emptyBoard(),
    tray: [null, null, null],
    score: 0,
    best: 0,
    combo: 0,
    gameOver: false,
    moves: 0,
  };
  newGame(state, rng);
  return state;
}

export function emptyBoard() {
  return Array.from({ length: BOARD }, () => Array(BOARD).fill(null));
}

// Reset board / score / combo and deal a fresh tray.
export function newGame(state, rng = Math.random) {
  state.board = emptyBoard();
  state.tray = [null, null, null];
  state.score = 0;
  state.combo = 0;
  state.gameOver = false;
  state.moves = 0;
  dealTray(state, rng);
  return state;
}

// True if `piece` can be placed with its top-left cell at (r, c):
// fully in bounds and no overlap with occupied cells.
export function canPlace(state, piece, r, c) {
  if (!piece) return false;
  for (const [dr, dc] of piece.cells) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr < 0 || rr >= BOARD || cc < 0 || cc >= BOARD) return false;
    if (state.board[rr][cc] !== null) return false;
  }
  return true;
}

// Lines that WOULD clear if `piece` were placed at (r, c).
// Assumes canPlace(state, piece, r, c) is true.
// Returns { rows: [row indices], cols: [col indices] }.
export function wouldClear(state, piece, r, c) {
  const rows = [];
  const cols = [];
  if (!piece) return { rows, cols };

  const placed = new Set(piece.cells.map(([dr, dc]) => `${r + dr},${c + dc}`));
  const occupied = (rr, cc) =>
    state.board[rr][cc] !== null || placed.has(`${rr},${cc}`);

  for (let rr = 0; rr < BOARD; rr++) {
    let full = true;
    for (let cc = 0; cc < BOARD; cc++) {
      if (!occupied(rr, cc)) { full = false; break; }
    }
    if (full) rows.push(rr);
  }
  for (let cc = 0; cc < BOARD; cc++) {
    let full = true;
    for (let rr = 0; rr < BOARD; rr++) {
      if (!occupied(rr, cc)) { full = false; break; }
    }
    if (full) cols.push(cc);
  }
  return { rows, cols };
}

// Full rows / columns currently on the board (after a placement).
function findClears(state) {
  const rows = [];
  const cols = [];
  for (let rr = 0; rr < BOARD; rr++) {
    if (state.board[rr].every((cell) => cell !== null)) rows.push(rr);
  }
  for (let cc = 0; cc < BOARD; cc++) {
    let full = true;
    for (let rr = 0; rr < BOARD; rr++) {
      if (state.board[rr][cc] === null) { full = false; break; }
    }
    if (full) cols.push(cc);
  }
  return { rows, cols };
}

// Place tray piece `trayIndex` with its top-left cell at (r, c).
// Returns { ok, placedCells, cleared: {rows, cols}, gained, combo,
//           linesCleared, trayEmpty, gameOver }.
// - ok false if the game is over, the tray slot is empty, or placement is illegal.
// - gained = placed cells * CELL_SCORE + line bonus (10*n^2 * combo).
// - combo increments on consecutive clearing placements, resets to 0 when a
//   placement clears nothing. First clearing placement = combo 1.
// - Tray refill (with mercy re-deal) happens inside when the tray empties.
// - gameOver set when no remaining tray piece fits anywhere.
export function place(state, trayIndex, r, c) {
  const fail = (reason) => ({
    ok: false, reason, placedCells: 0, cleared: { rows: [], cols: [] },
    gained: 0, combo: state.combo, linesCleared: 0, trayEmpty: false,
    gameOver: state.gameOver,
  });

  if (state.gameOver) return fail('game-over');
  const piece = state.tray[trayIndex];
  if (!piece) return fail('empty-slot');
  if (!canPlace(state, piece, r, c)) return fail('illegal');

  // Lock the cells in.
  for (const [dr, dc] of piece.cells) {
    state.board[r + dr][c + dc] = { color: piece.color, shapeId: piece.id };
  }
  const placedCells = piece.cells.length;
  let gained = placedCells * CELL_SCORE;

  // Clear full rows + columns simultaneously.
  const cleared = findClears(state);
  const linesCleared = cleared.rows.length + cleared.cols.length;
  if (linesCleared > 0) {
    state.combo += 1;
    gained += LINE_BONUS_BASE * linesCleared * linesCleared * state.combo;
    for (const rr of cleared.rows) {
      for (let cc = 0; cc < BOARD; cc++) state.board[rr][cc] = null;
    }
    for (const cc of cleared.cols) {
      for (let rr = 0; rr < BOARD; rr++) state.board[rr][cc] = null;
    }
  } else {
    state.combo = 0;
  }

  state.score += gained;
  state.moves += 1;
  state.tray[trayIndex] = null;

  const trayEmpty = state.tray.every((p) => p === null);
  if (trayEmpty) dealTray(state);

  state.gameOver = !anyTrayFits(state);

  return {
    ok: true,
    placedCells,
    cleared,
    gained,
    combo: state.combo,
    linesCleared,
    trayEmpty,
    gameOver: state.gameOver,
  };
}

// True if `piece` fits anywhere on the current board.
export function fitsAnywhere(state, piece) {
  if (!piece) return false;
  for (let r = 0; r < BOARD; r++) {
    for (let c = 0; c < BOARD; c++) {
      if (canPlace(state, piece, r, c)) return true;
    }
  }
  return false;
}

// True if any remaining tray piece fits anywhere.
export function anyTrayFits(state) {
  return state.tray.some((piece) => piece !== null && fitsAnywhere(state, piece));
}

// Deal TRAY_SIZE fresh random pieces into the tray.
// Mercy rule: if literally zero of the 3 dealt pieces fits anywhere on the
// current board, re-deal once (the second deal stands, even if still stuck).
export function dealTray(state, rng = Math.random) {
  const deal = () => {
    state.tray = Array.from({ length: TRAY_SIZE }, () => randomPiece(rng));
  };
  deal();
  if (!anyTrayFits(state)) deal();
  return state.tray;
}
