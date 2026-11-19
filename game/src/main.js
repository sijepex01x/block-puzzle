// main.js — BLOCKBURST wiring, loop, layout (Worker 3).
// Owns: canvas setup (DPR-aware, portrait-first), layout, drag state,
// first-run HOW TO PLAY, game-over flow, best-score persistence.
// Imports engine/render/audio from teammates when their files exist;
// otherwise uses the embedded contract-conformant fallbacks below
// (W1/W2 files were absent at build time — see README / report).
// SWAP: when game/src/engine.js, render.js, audio.js land, the loader in
// loadModules() picks them up automatically; no other change needed.

import { attachInput, pointerToCell, trayHit, buttonHit, cellForDrag } from './input.js';
import { drawHUD, drawHowTo, drawGameOver, rr } from './hud.js';

// ---------------------------------------------------------------------------
// Fallback config + shapes (contract: config.js / pieces.js, W1)
// ---------------------------------------------------------------------------
export const FALLBACK_BOARD = 8;
export const FALLBACK_SHAPES = [
  { id: 's1', name: '1x1', color: '#f59e0b', cells: [[0, 0]] },
  { id: 'h2', name: '1x2', color: '#ef4444', cells: [[0, 0], [0, 1]] },
  { id: 'v2', name: '2x1', color: '#ef4444', cells: [[0, 0], [1, 0]] },
  { id: 'h3', name: '1x3', color: '#22c55e', cells: [[0, 0], [0, 1], [0, 2]] },
  { id: 'v3', name: '3x1', color: '#22c55e', cells: [[0, 0], [1, 0], [2, 0]] },
  { id: 'h4', name: '1x4', color: '#3b82f6', cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { id: 'v4', name: '4x1', color: '#3b82f6', cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: 'h5', name: '1x5', color: '#8b5cf6', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { id: 'v5', name: '5x1', color: '#8b5cf6', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  { id: 'sq2', name: '2x2', color: '#f97316', cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { id: 'sq3', name: '3x3', color: '#ec4899', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]] },
  { id: 'r23', name: '2x3', color: '#14b8a6', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },
  { id: 'r32', name: '3x2', color: '#14b8a6', cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]] },
  { id: 'l2a', name: 'L 2x2', color: '#eab308', cells: [[0, 0], [0, 1], [1, 0]] },
  { id: 'l2b', name: 'L 2x2', color: '#eab308', cells: [[0, 0], [0, 1], [1, 1]] },
  { id: 'l2c', name: 'L 2x2', color: '#eab308', cells: [[0, 0], [1, 0], [1, 1]] },
  { id: 'l2d', name: 'L 2x2', color: '#eab308', cells: [[0, 1], [1, 0], [1, 1]] },
  { id: 'l3a', name: 'L 3x3', color: '#06b6d4', cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] },
  { id: 'l3b', name: 'L 3x3', color: '#06b6d4', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]] },
  { id: 'l3c', name: 'L 3x3', color: '#06b6d4', cells: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 2]] },
  { id: 'l3d', name: 'L 3x3', color: '#06b6d4', cells: [[0, 0], [0, 2], [1, 2], [2, 0], [2, 1], [2, 2]] },
  { id: 'ta', name: 'T', color: '#a855f7', cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { id: 'tb', name: 'T', color: '#a855f7', cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
  { id: 'tc', name: 'T', color: '#a855f7', cells: [[0, 0], [1, 0], [1, 1], [2, 0]] },
  { id: 'td', name: 'T', color: '#a855f7', cells: [[0, 1], [1, 0], [1, 1], [2, 1]] },
  { id: 's1z', name: 'S', color: '#84cc16', cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  { id: 'z1s', name: 'Z', color: '#84cc16', cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
];

function fallbackRandomPiece(rng) {
  const r = rng || Math.random;
  const s = FALLBACK_SHAPES[Math.floor(r() * FALLBACK_SHAPES.length)];
  return { id: s.id, name: s.name, color: s.color, cells: s.cells.map(([a, b]) => [a, b]) };
}

// ---------------------------------------------------------------------------
// Fallback engine (contract: engine.js, W1) — pure, node-testable
// ---------------------------------------------------------------------------
function fbCanPlace(state, piece, r, c) {
  if (!piece) return false;
  for (const [dr, dc] of piece.cells) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return false;
    if (state.board[nr][nc]) return false;
  }
  return true;
}

function fbWouldClear(state, piece, r, c) {
  const rows = [];
  const cols = [];
  const placed = new Set(piece.cells.map(([dr, dc]) => (r + dr) + ',' + (c + dc)));
  const occupied = (nr, nc) => !!state.board[nr][nc] || placed.has(nr + ',' + nc);
  for (let i = 0; i < 8; i++) {
    let fullRow = true;
    let fullCol = true;
    for (let j = 0; j < 8; j++) {
      if (!occupied(i, j)) fullRow = false;
      if (!occupied(j, i)) fullCol = false;
    }
    if (fullRow) rows.push(i);
    if (fullCol) cols.push(i);
  }
  return { rows, cols };
}

function fbFitsAnywhere(state, piece) {
  if (!piece) return false;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (fbCanPlace(state, piece, r, c)) return true;
    }
  }
  return false;
}

function fbAnyTrayFits(state) {
  return state.tray.some((p) => p && fbFitsAnywhere(state, p));
}

function fbDealTray(state, rng) {
  const deal = () => [fallbackRandomPiece(rng), fallbackRandomPiece(rng), fallbackRandomPiece(rng)];
  let tray = deal();
  const probe = { board: state.board, tray };
  if (!fbAnyTrayFits(probe)) tray = deal(); // mercy re-deal, once
  state.tray = tray;
}

function fbPlace(state, trayIndexOrPiece, r, c) {
  // Accepts a tray index (real engine.js signature) or a piece object
  // (contract text) — both resolve to the tray slot being placed.
  let trayIndex = trayIndexOrPiece;
  let piece = null;
  if (typeof trayIndexOrPiece === 'number') {
    piece = state.tray[trayIndexOrPiece];
  } else if (trayIndexOrPiece) {
    piece = trayIndexOrPiece;
    trayIndex = state.tray.indexOf(piece);
  }
  const fail = { ok: false, placedCells: 0, cleared: { rows: [], cols: [] }, gained: 0, combo: state.combo, linesCleared: 0, trayEmpty: false, gameOver: state.gameOver };
  if (state.gameOver || !piece || !fbCanPlace(state, piece, r, c)) return fail;
  const wc = fbWouldClear(state, piece, r, c);
  for (const [dr, dc] of piece.cells) {
    state.board[r + dr][c + dc] = { color: piece.color, shapeId: piece.id };
  }
  const placedCells = piece.cells.length;
  const n = wc.rows.length + wc.cols.length;
  let gained = placedCells;
  if (n > 0) {
    state.combo += 1;
    gained += 10 * n * n * state.combo;
  } else {
    state.combo = 0;
  }
  for (const row of wc.rows) {
    for (let c2 = 0; c2 < 8; c2++) state.board[row][c2] = null;
  }
  for (const col of wc.cols) {
    for (let r2 = 0; r2 < 8; r2++) state.board[r2][col] = null;
  }
  state.score += gained;
  state.moves += 1;
  if (trayIndex >= 0) state.tray[trayIndex] = null;
  let trayEmpty = state.tray.every((p) => !p);
  if (trayEmpty) {
    fbDealTray(state);
    trayEmpty = false;
  }
  state.gameOver = !fbAnyTrayFits(state);
  return { ok: true, placedCells, cleared: wc, gained, combo: state.combo, linesCleared: n, trayEmpty, gameOver: state.gameOver };
}

export const fallbackEngine = {
  SHAPES: FALLBACK_SHAPES,
  randomPiece: fallbackRandomPiece,
  createGame() {
    const game = {
      board: Array.from({ length: 8 }, () => Array(8).fill(null)),
      tray: [null, null, null],
      score: 0, best: 0, combo: 0, gameOver: false, moves: 0,
    };
    this.newGame(game);
    return game;
  },
  newGame(state) {
    state.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    state.score = 0;
    state.combo = 0;
    state.gameOver = false;
    state.moves = 0;
    state.tray = [null, null, null];
    fbDealTray(state);
  },
  canPlace: fbCanPlace,
  wouldClear: fbWouldClear,
  place: fbPlace,
  fitsAnywhere: fbFitsAnywhere,
  anyTrayFits: fbAnyTrayFits,
  dealTray: fbDealTray,
};

// ---------------------------------------------------------------------------
// Fallback renderer (contract: render.js, W2)
// ---------------------------------------------------------------------------
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

function drawBlock(ctx, x, y, s, color, alpha) {
  ctx.save();
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  const pad = Math.max(1, s * 0.05);
  const bx = x + pad;
  const by = y + pad;
  const bs = s - pad * 2;
  rr(ctx, bx, by, bs, bs, Math.max(2, s * 0.12));
  ctx.fillStyle = color;
  ctx.fill();
  // Lighter top face, darker bottom/side (voxel look).
  rr(ctx, bx, by, bs, bs * 0.38, Math.max(2, s * 0.12));
  ctx.fillStyle = shade(color, 46);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(bx, by + bs * 0.78, bs, bs * 0.22);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

export function fallbackCreateRenderer() {
  let clears = []; // {cells:[[r,c]...], t}
  let floats = []; // {text,x,y,t}
  let comboPopup = null; // {level, t}
  let shakeT = 0;
  const api = {
    anims: { clears, floats },
    startClear(cells) {
      if (cells && cells.length) {
        clears.push({ cells: cells.map(([r, c]) => [r, c]), t: 0 });
        if (cells.length >= 16) shakeT = 0.25;
      }
    },
    startFloat(text, x, y) { floats.push({ text, x, y, t: 0 }); },
    startComboPopup(level) { comboPopup = { level, t: 0 }; },
    update(dt) {
      const step = dt / 1000;
      clears = clears.filter((a) => (a.t += step) < 0.32);
      floats = floats.filter((a) => (a.t += step) < 0.9);
      if (comboPopup) { comboPopup.t += step; if (comboPopup.t > 1.1) comboPopup = null; }
      if (shakeT > 0) shakeT -= step;
      api.anims = { clears, floats };
    },
    animating() { return clears.length > 0; },
    draw(ctx, game, layout, drag) {
      const W = layout.width;
      const H = layout.height;
      ctx.save();
      if (shakeT > 0) {
        ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
      }
      // Background gradient (calm dark).
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0f172a');
      bg.addColorStop(1, '#1c2942');
      ctx.fillStyle = bg;
      ctx.fillRect(-8, -8, W + 16, H + 16);
      // Board.
      const { boardX, boardY, cell } = layout;
      const boardPx = cell * 8;
      rr(ctx, boardX - 6, boardY - 6, boardPx + 12, boardPx + 12, 14);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Cell marks.
      ctx.fillStyle = 'rgba(148,163,184,0.14)';
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          ctx.fillRect(boardX + c * cell + cell / 2 - 1.5, boardY + r * cell + cell / 2 - 1.5, 3, 3);
        }
      }
      // Would-clear highlight.
      if (drag && drag.valid && drag.wouldClear) {
        ctx.fillStyle = 'rgba(250,204,21,0.20)';
        for (const row of drag.wouldClear.rows || []) ctx.fillRect(boardX, boardY + row * cell, boardPx, cell);
        for (const col of drag.wouldClear.cols || []) ctx.fillRect(boardX + col * cell, boardY, cell, boardPx);
      }
      // Placed blocks (skip cells in an active clear flash).
      const flashing = new Set();
      for (const a of clears) for (const [r, c] of a.cells) flashing.add(r + ',' + c);
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const b = game.board[r][c];
          if (!b) continue;
          if (flashing.has(r + ',' + c)) {
            ctx.save();
            ctx.globalAlpha = 0.85;
            drawBlock(ctx, boardX + c * cell, boardY + r * cell, cell, '#ffffff');
            ctx.restore();
          } else {
            drawBlock(ctx, boardX + c * cell, boardY + r * cell, cell, b.color);
          }
        }
      }
      // Clear particles (simple expanding dots).
      for (const a of clears) {
        const p = a.t / 0.32;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - p);
        ctx.fillStyle = '#ffffff';
        for (const [r, c] of a.cells) {
          const cx = boardX + c * cell + cell / 2;
          const cy = boardY + r * cell + cell / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 2 + p * 7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      // Tray.
      game.tray.forEach((piece, i) => {
        const s = layout.traySlots[i];
        if (!s) return;
        rr(ctx, s.x, s.y, s.w, s.h, 12);
        ctx.fillStyle = drag && drag.selected === i ? '#2b3f63' : '#1a2438';
        ctx.fill();
        ctx.strokeStyle = drag && drag.selected === i ? '#a78bfa' : '#2c3a55';
        ctx.lineWidth = drag && drag.selected === i ? 2 : 1;
        ctx.stroke();
        if (!piece) return;
        if (drag && drag.pieceIndex === i && !drag.selected) return; // piece is being dragged
        let rows = 0;
        let cols = 0;
        for (const [r, c] of piece.cells) { rows = Math.max(rows, r + 1); cols = Math.max(cols, c + 1); }
        const cs = Math.min(cell * 0.82, Math.min(s.w / (cols + 0.4), s.h / (rows + 0.4)));
        const ox = s.x + (s.w - cols * cs) / 2;
        const oy = s.y + (s.h - rows * cs) / 2;
        for (const [r, c] of piece.cells) drawBlock(ctx, ox + c * cs, oy + r * cs, cs, piece.color);
      });
      // Drag ghost (only while a pointer is actually dragging).
      if (drag && drag.pieceIndex !== null && drag.pieceIndex !== undefined && typeof drag.x === 'number' && typeof drag.y === 'number') {
        const piece = game.tray[drag.pieceIndex];
        if (piece) {
          let rows = 0;
          let cols = 0;
          for (const [r, c] of piece.cells) { rows = Math.max(rows, r + 1); cols = Math.max(cols, c + 1); }
          const gx = drag.x - (cols * cell) / 2;
          const gy = drag.y - (rows * cell) / 2;
          ctx.save();
          ctx.globalAlpha = 0.75;
          for (const [r, c] of piece.cells) {
            const x = gx + c * cell;
            const y = gy + r * cell;
            rr(ctx, x + 2, y + 2, cell - 4, cell - 4, 5);
            ctx.fillStyle = drag.valid ? 'rgba(34,197,94,0.55)' : 'rgba(239,68,68,0.55)';
            ctx.fill();
            ctx.strokeStyle = drag.valid ? '#22c55e' : '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.restore();
          // Also draw the piece itself semi-transparent at the anchor cell.
          if (drag.cell) {
            for (const [r, c] of piece.cells) {
              drawBlock(ctx, boardX + (drag.cell.c + c) * cell, boardY + (drag.cell.r + r) * cell, cell, piece.color, 0.85);
            }
          }
        }
      }
      // Floating +score texts.
      for (const f of floats) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - f.t / 0.9);
        ctx.fillStyle = '#fde68a';
        ctx.font = '800 20px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y - f.t * 46);
        ctx.restore();
      }
      // Combo popup.
      if (comboPopup) {
        const p = comboPopup.t;
        const scale = p < 0.15 ? 0.7 + (p / 0.15) * 0.3 : 1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, (p - 0.7) / 0.4));
        ctx.translate(W / 2, layout.boardY + boardPx / 2);
        ctx.scale(scale, scale);
        ctx.fillStyle = '#c084fc';
        ctx.font = '800 34px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('COMBO x' + comboPopup.level + '!', 0, 0);
        ctx.restore();
      }
      ctx.restore();
    },
  };
  return api;
}

// ---------------------------------------------------------------------------
// Fallback audio (contract: audio.js, W2) — WebAudio synth, lazy context
// ---------------------------------------------------------------------------
export function fallbackCreateAudio() {
  let actx = null;
  let muted = false;
  function ctx() {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!actx) actx = new AC();
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }
  function tone(freq, dur, type, vol, delay) {
    if (muted) return;
    const ac = ctx();
    if (!ac) return;
    try {
      const t0 = ac.currentTime + (delay || 0);
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(vol || 0.12, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(ac.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (_) { /* audio must never break the game */ }
  }
  return {
    get muted() { return muted; },
    setMuted(b) { muted = !!b; },
    place() { tone(180, 0.09, 'triangle', 0.16); tone(90, 0.08, 'sine', 0.12); },
    clear(n) {
      tone(523, 0.12, 'sine', 0.14);
      tone(659, 0.12, 'sine', 0.14, 0.06);
      tone(784, 0.16, 'sine', 0.14, 0.12);
      if (n >= 2) tone(1047, 0.2, 'sine', 0.14, 0.18);
    },
    combo(level) {
      const base = 523 * Math.pow(1.122, Math.min(level, 8));
      tone(base, 0.14, 'triangle', 0.15);
      tone(base * 1.5, 0.2, 'triangle', 0.13, 0.07);
    },
    gameOver() {
      tone(392, 0.18, 'sine', 0.14);
      tone(330, 0.18, 'sine', 0.14, 0.16);
      tone(262, 0.34, 'sine', 0.14, 0.32);
    },
  };
}

// ---------------------------------------------------------------------------
// Layout — portrait-first, board + tray always fully visible, no scrolling
// ---------------------------------------------------------------------------
export function computeLayout(w, h) {
  const pad = 12;
  const topH = 88; // buttons row + score block
  const trayReserve = 150; // tray + footer + gaps
  let board = Math.min(w - pad * 2, h - topH - trayReserve);
  board = Math.max(160, board);
  const cell = Math.floor(board / 8);
  board = cell * 8;
  const boardX = Math.floor((w - board) / 2);
  const boardY = Math.floor(topH + Math.max(0, (h - topH - board - trayReserve) / 2));
  const trayH = Math.floor(cell * 2 + 24);
  const trayY = boardY + board + 16;
  const slotW = Math.floor((w - pad * 2 - 16) / 3);
  const traySlots = [0, 1, 2].map((i) => ({
    x: pad + i * (slotW + 8), y: trayY, w: slotW, h: trayH,
  }));
  const footerY = trayY + trayH + 22;
  return {
    width: w, height: h,
    boardX, boardY, cell, board,
    trayY, trayH, traySlots, footerY,
    buttons: {
      newGame: { x: pad, y: 10, w: 118, h: 38 },
      mute: { x: pad + 126, y: 10, w: 62, h: 38 },
      howto: { x: pad + 196, y: 10, w: 42, h: 38 },
      again: { x: Math.floor(w / 2) - 95, y: Math.floor(h / 2) + 52, w: 190, h: 54 },
    },
  };
}

// ---------------------------------------------------------------------------
// Storage keys (contract)
// ---------------------------------------------------------------------------
const BEST_KEY = 'blockburst-best';
const SEEN_KEY = 'blockburst-seen-howto';
const MUTE_KEY = 'blockburst-muted';

function lsGet(k) {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; } catch (_) { return null; }
}
function lsSet(k, v) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch (_) { /* private mode */ }
}

// ---------------------------------------------------------------------------
// Module loading: teammate files first, embedded fallbacks second
// ---------------------------------------------------------------------------
async function loadModules() {
  let engine = null;
  let renderer = null;
  let audio = null;
  try { engine = await import('./engine.js'); } catch (_) { engine = null; }
  try { renderer = await import('./render.js'); } catch (_) { renderer = null; }
  try { audio = await import('./audio.js'); } catch (_) { audio = null; }
  return {
    engine: engine || fallbackEngine,
    createRenderer: (renderer && renderer.createRenderer) || fallbackCreateRenderer,
    createAudio: (audio && audio.createAudio) || fallbackCreateAudio,
    usedFallback: { engine: !engine, render: !renderer, audio: !audio },
  };
}

// ---------------------------------------------------------------------------
// Game wiring (browser only)
// ---------------------------------------------------------------------------
function start(mods) {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const engine = mods.engine;
  const renderer = mods.createRenderer();
  const audio = mods.createAudio();

  let game = engine.createGame();
  game.best = parseInt(lsGet(BEST_KEY) || '0', 10) || 0;
  if (lsGet(MUTE_KEY) === '1') audio.setMuted(true);

  // layout is ONE stable object, mutated in place on resize, so the
  // layout reference captured by attachInput always stays current.
  const layout = computeLayout(390, 844);
  let drag = { pieceIndex: null, x: null, y: null, cell: null, valid: false, wouldClear: null, selected: null };
  let selected = null; // tap-to-place selection (tray index)
  let showHowTo = lsGet(SEEN_KEY) !== '1';
  let gameOverShown = false;
  let pendingGameOver = false;
  let lockUntil = 0;
  let confirmArmed = false; // NEW GAME two-tap confirm: stays armed until confirmed or cancelled (no timeout)
  let lastT = performance.now();

  function resize() {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const cssW = Math.min(window.innerWidth, 520);
    const cssH = Math.min(window.innerHeight, 900);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Object.assign(layout, computeLayout(cssW, cssH));
  }
  window.addEventListener('resize', resize);
  resize();

  function saveBest() {
    if (game.score > game.best) {
      game.best = game.score;
      lsSet(BEST_KEY, String(game.best));
    }
  }

  function clearedCells(rows, cols) {
    const cells = [];
    for (const r of rows) for (let c = 0; c < 8; c++) cells.push([r, c]);
    for (const c of cols) for (let r = 0; r < 8; r++) cells.push([r, c]);
    return cells;
  }

  function tryPlace(pieceIndex, anchorR, anchorC) {
    const now = performance.now();
    if (now < lockUntil || game.gameOver || gameOverShown) return false;
    const piece = game.tray[pieceIndex];
    if (!piece) return false;
    if (!engine.canPlace(game, piece, anchorR, anchorC)) return false;
    const wc = engine.wouldClear(game, piece, anchorR, anchorC);
    // Real engine.js place() takes the TRAY INDEX (its signature deviates
    // from the contract text, which says `place(state, piece, r, c)`).
    const res = engine.place(game, pieceIndex, anchorR, anchorC);
    if (!res.ok) return false;
    selected = null;
    drag.pieceIndex = null;
    drag.selected = null;
    drag.cell = null;
    drag.valid = false;
    drag.wouldClear = null;
    audio.place();
    if (res.linesCleared > 0) {
      renderer.startClear(clearedCells(res.cleared.rows, res.cleared.cols));
      const cx = layout.boardX + layout.board * 0.5;
      renderer.startFloat('+' + res.gained, cx, layout.boardY + layout.board * 0.5);
      audio.clear(res.linesCleared);
      if (res.combo >= 2) {
        renderer.startComboPopup(res.combo);
        audio.combo(res.combo);
      }
      lockUntil = now + 300; // lock input while the clear anim runs
    }
    saveBest();
    if (res.gameOver) pendingGameOver = true;
    return true;
  }

  function doNewGame() {
    engine.newGame(game);
    game.best = parseInt(lsGet(BEST_KEY) || '0', 10) || 0;
    selected = null;
    drag = { pieceIndex: null, x: null, y: null, cell: null, valid: false, wouldClear: null, selected: null };
    showHowTo = false;
    gameOverShown = false;
    pendingGameOver = false;
    lockUntil = 0;
    confirmArmed = false;
  }

  function dismissHowTo() {
    showHowTo = false;
    lsSet(SEEN_KEY, '1');
  }

  const handlers = {
    onPick(pieceIndex) {
      confirmArmed = false; // any other action cancels a pending NEW GAME confirm
      if (showHowTo) { dismissHowTo(); return; }
      if (gameOverShown) return;
      if (!game.tray[pieceIndex]) return;
      // Tap-to-place select. Renderer contract: tap-select = pieceIndex set
      // + selected truthy + x/y null (no pointer-follow piece drawn).
      selected = selected === pieceIndex ? null : pieceIndex;
      drag.pieceIndex = selected;
      drag.selected = selected;
      drag.x = null;
      drag.y = null;
      drag.cell = null;
      drag.valid = false;
      drag.wouldClear = null;
    },
    onDrag(pieceIndex, x, y) {
      confirmArmed = false; // any other action cancels a pending NEW GAME confirm
      if (showHowTo || gameOverShown) return;
      const piece = game.tray[pieceIndex];
      if (!piece) return;
      // Drag supersedes tap-selection: selected falsy so the tray piece dims.
      selected = null;
      drag.selected = null;
      drag.pieceIndex = pieceIndex;
      drag.x = x;
      drag.y = y;
      drag.cell = cellForDrag(x, y, piece, layout);
      drag.valid = drag.cell ? engine.canPlace(game, piece, drag.cell.r, drag.cell.c) : false;
      drag.wouldClear = drag.valid ? engine.wouldClear(game, piece, drag.cell.r, drag.cell.c) : { rows: [], cols: [] };
    },
    onDrop(pieceIndex, pointerCell) {
      confirmArmed = false; // any other action cancels a pending NEW GAME confirm
      const wasDragging = drag.pieceIndex !== null;
      const piece = game.tray[pieceIndex];
      drag.pieceIndex = null;
      drag.selected = null;
      drag.x = null;
      drag.y = null;
      drag.cell = null;
      drag.valid = false;
      drag.wouldClear = null;
      if (showHowTo || gameOverShown || !wasDragging || !piece || !pointerCell) return;
      const anchor = cellForDrag(
        layout.boardX + (pointerCell.c + 0.5) * layout.cell,
        layout.boardY + (pointerCell.r + 0.5) * layout.cell,
        piece, layout,
      );
      tryPlace(pieceIndex, anchor.r, anchor.c);
    },
    onTapCell(r, c) {
      confirmArmed = false; // any other action cancels a pending NEW GAME confirm
      if (showHowTo) { dismissHowTo(); return; }
      if (gameOverShown) return;
      if (selected === null || selected === undefined) return;
      if (!tryPlace(selected, r, c)) {
        // Tapped a cell where the selected piece does not fit: keep selection.
      }
    },
    onButton(id) {
      if (id !== 'newGame') confirmArmed = false; // any other button cancels a pending NEW GAME confirm
      if (id === 'howto') {
        showHowTo = !showHowTo;
        if (!showHowTo) lsSet(SEEN_KEY, '1');
        return;
      }
      if (id === 'mute') {
        audio.setMuted(!audio.muted);
        lsSet(MUTE_KEY, audio.muted ? '1' : '0');
        return;
      }
      if (id === 'again') {
        if (gameOverShown) doNewGame();
        return;
      }
      if (id === 'newGame') {
        if (showHowTo) { dismissHowTo(); return; }
        if (gameOverShown) { doNewGame(); return; }
        const inProgress = game.score > 0 || game.moves > 0;
        if (inProgress) {
          // Persistent two-tap confirm: first tap arms "SURE?" and it stays
          // armed until the second tap confirms or anything else cancels it.
          // No time-based revert.
          if (!confirmArmed) {
            confirmArmed = true;
            return;
          }
        }
        doNewGame();
      }
    },
    onCancel() {
      confirmArmed = false; // Esc / tap on empty space cancels a pending NEW GAME confirm
      if (showHowTo) { dismissHowTo(); return; }
      selected = null;
      drag.pieceIndex = null;
      drag.selected = null;
      drag.x = null;
      drag.y = null;
      drag.cell = null;
      drag.valid = false;
      drag.wouldClear = null;
    },
  };

  attachInput(canvas, layout, handlers);

  function paintBackground() {
    // The renderer only paints the board panel / tray / pieces — it never
    // clears the canvas. Without a full repaint here, anything drawn by an
    // overlay (how-to dim, game-over dim, floating text) would ghost
    // permanently in the regions nothing else repaints. So every frame
    // starts with a full calm-dark background repaint.
    const g = ctx.createLinearGradient(0, 0, 0, layout.height);
    g.addColorStop(0, '#0e1628');
    g.addColorStop(0.55, '#13203c');
    g.addColorStop(1, '#0a1220');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, layout.width, layout.height);
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(50, now - lastT);
    lastT = now;
    if (renderer.update) renderer.update(dt);
    if (pendingGameOver && now >= lockUntil && !gameOverShown) {
      pendingGameOver = false;
      gameOverShown = true;
      saveBest();
      audio.gameOver();
    }
    // The armed confirm stays visible until confirmed or cancelled (no timeout).
    const ui = {
      confirmNewGame: confirmArmed,
      muted: !!audio.muted,
    };
    paintBackground();
    renderer.draw(ctx, game, layout, drag);
    drawHUD(ctx, game, layout, ui);
    if (showHowTo) drawHowTo(ctx, layout);
    else if (gameOverShown) drawGameOver(ctx, game, layout);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (mods.usedFallback.engine || mods.usedFallback.render || mods.usedFallback.audio) {
    // Dev note only; not an error — the game runs on embedded fallbacks.
    console.info('[blockburst] using embedded fallback for:', Object.entries(mods.usedFallback).filter(([, v]) => v).map(([k]) => k).join(', '));
  }
}

// Boot (browser only; node imports skip this entirely).
if (typeof document !== 'undefined') {
  loadModules().then(start).catch((err) => {
    console.error('[blockburst] failed to start', err);
  });
}
