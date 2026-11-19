// BLOCKBURST — config.js
// Shared constants: board, scoring, colors, storage keys.
// Pure data + constants only. No DOM, no canvas.

export const BOARD = 8;

// Scoring
export const CELL_SCORE = 1; // points per placed cell
export const LINE_BONUS_BASE = 10; // line bonus = 10 * n^2 for n lines cleared in one placement
// Combo: consecutive placements that clear lines. First clearing placement
// = combo 1 (no extra multiplier); each further consecutive clearing
// placement increments combo (2, 3, ...). Line bonus is multiplied by combo.
// A placement clearing nothing resets combo to 0.

// Number of pieces dealt per tray.
export const TRAY_SIZE = 3;

// Piece colors — bright, one color family per shape id.
export const PIECE_COLORS = {
  single: '#FFD93D', // 1x1 — sunny yellow
  line2h: '#FF9F1C', // 1x2 horizontal — orange
  line2v: '#FF9F1C', // 1x2 vertical — orange
  line3h: '#FF6B6B', // 1x3 horizontal — coral red
  line3v: '#FF6B6B', // 1x3 vertical — coral red
  line4h: '#F15BB5', // 1x4 horizontal — pink
  line4v: '#F15BB5', // 1x4 vertical — pink
  line5h: '#9B5DE5', // 1x5 horizontal — purple
  line5v: '#9B5DE5', // 1x5 vertical — purple
  square2: '#4ADE80', // 2x2 — green
  square3: '#00BBF9', // 3x3 — sky blue
  rect2x3: '#4361EE', // 2 rows x 3 cols — royal blue
  rect3x2: '#4CC9F0', // 3 rows x 2 cols — cyan
  l2a: '#B5E048', // L 2x2 — lime
  l2b: '#B5E048',
  l2c: '#B5E048',
  l2d: '#B5E048',
  l3a: '#FEB60A', // L 3x3 — amber
  l3b: '#FEB60A',
  l3c: '#FEB60A',
  l3d: '#FEB60A',
  tUp: '#F72585', // small T — magenta
  tDown: '#F72585',
  tLeft: '#F72585',
  tRight: '#F72585',
  sShape: '#06D6A0', // S 2x3 — mint
  zShape: '#EF476F', // Z 2x3 — rose
};

// Board colors.
export const BOARD_COLORS = {
  background: '#1B2A4A', // board panel
  backgroundEdge: '#16223A',
  cellEmpty: '#24365E', // empty cell fill
  cellEmptyAlt: '#22345A', // subtle checker tint
  gridLine: '#2E4470',
  ghostValid: 'rgba(74, 222, 128, 0.55)',
  ghostInvalid: 'rgba(239, 71, 111, 0.55)',
  clearHighlight: 'rgba(255, 217, 61, 0.35)',
  border: '#0F1830',
};

// Calm background gradient (top -> bottom), drawn behind the board.
export const BACKGROUND = {
  top: '#0E1628',
  middle: '#13203C',
  bottom: '#0A1220',
};

// HUD / text colors.
export const TEXT_COLORS = {
  primary: '#F8FAFC',
  secondary: '#94A3B8',
  accent: '#FFD93D',
  combo: '#FF9F1C',
};

// localStorage keys.
export const STORAGE_KEYS = {
  best: 'blockburst-best',
  seenHowto: 'blockburst-seen-howto',
};
