// BLOCKBURST — render.js (Worker 2)
// All canvas drawing of the board, pieces and animations.
// Vanilla Canvas 2D, no libraries, no network. Fresh code.
// State shape (from engine.js): game = { board: 8x8 of null | {color},
//   tray: [piece|null x3], score, best, combo, gameOver }.
// A piece is { id, name, cells: [[r,c],...], color }.
// Layout (from main.js): { boardX, boardY, cell, trayY,
//   traySlots: [{x,y,w,h} x3], buttons: {...} } — positions come from
// layout, never hardcoded here.
// Drag state (from main.js): { pieceIndex, x, y, cell: {r,c}|null,
//   valid: bool, wouldClear: { rows: [...], cols: [...] }|null,
//   selected: bool } or null.

// Font stack: plain families only — node-canvas (used for QA screenshots)
// rejects the whole declaration if it contains `system-ui`, silently
// falling back to 10px; browsers fall through to sans-serif on mobile.
const FONT_FAMILY = 'Arial, Helvetica, sans-serif';
const BOARD = 8;
const TAU = Math.PI * 2;

// ---- palette: calm dark board so the bright pieces pop ----
const BOARD_BG = '#202839';
const BOARD_EDGE = '#39465f';
const BOARD_SHADOW = 'rgba(0,0,0,0.35)';
const CELL_MARK = 'rgba(255,255,255,0.07)';
const SLOT_BG = 'rgba(255,255,255,0.05)';
const SLOT_EDGE = 'rgba(255,255,255,0.10)';
const GHOST_OK = 'rgba(74,222,128,0.45)';
const GHOST_BAD = 'rgba(248,113,113,0.45)';
const CLEAR_HIGHLIGHT = 'rgba(250,204,21,0.22)';
const CLEAR_EDGE = 'rgba(250,204,21,0.55)';

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function hexToRgb(hex) {
  if (typeof hex !== 'string') return { r: 136, g: 136, b: 136 };
  let h = hex.trim();
  if (h[0] === '#') h = h.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return { r: 136, g: 136, b: 136 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// amt > 0 lightens, amt < 0 darkens; amt in [-1, 1].
function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const mix = (v) => Math.round(v + (t - v) * p);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// Rounded-rect path (works even where ctx.roundRect is unavailable).
function rr(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// Normalise a cell to {r, c}; accepts {r,c} objects or [r,c] arrays.
function normCell(cell) {
  if (Array.isArray(cell)) return { r: cell[0] | 0, c: cell[1] | 0 };
  return { r: (cell && cell.r) | 0, c: (cell && cell.c) | 0 };
}

function pieceBounds(piece) {
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const [r, c] of piece.cells) {
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  return { rows: maxR - minR + 1, cols: maxC - minC + 1, minR, minC };
}

export function createRenderer() {
  // ---- animation state (internal; main.js drives it via start*/update) ----
  let clears = [];   // { cells:[{r,c}], t, dur, particles:[...], spawned }
  let floats = [];   // { text, x, y, t, dur }
  let comboPop = null; // { level, t, dur }
  let shakeT = 0, shakeDur = 0, shakeMag = 0;
  let lastLayout = null;

  function spawnParticles(clear, layout) {
    const cell = layout.cell;
    const parts = [];
    const perCell = 5;
    for (const { r, c } of clear.cells) {
      const cx = layout.boardX + c * cell + cell / 2;
      const cy = layout.boardY + r * cell + cell / 2;
      for (let i = 0; i < perCell; i++) {
        const ang = Math.random() * TAU;
        const speed = (0.6 + Math.random() * 1.6) * cell * 3.2;
        parts.push({
          x: cx + (Math.random() - 0.5) * cell * 0.5,
          y: cy + (Math.random() - 0.5) * cell * 0.5,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed - cell * 1.2,
          size: cell * (0.10 + Math.random() * 0.14),
          color: clear.color || '#ffffff',
          rot: Math.random() * TAU,
          vr: (Math.random() - 0.5) * 12,
          life: 0.45 + Math.random() * 0.3,
          t: 0,
        });
      }
    }
    clear.particles = parts.slice(0, 160);
    clear.spawned = true;
  }

  function startClear(cells, color) {
    if (!cells || !cells.length) return;
    const list = cells.map(normCell).filter(({ r, c }) =>
      r >= 0 && r < BOARD && c >= 0 && c < BOARD);
    if (!list.length) return;
    const clear = { cells: list, color: color || '#ffffff', t: 0, dur: 0.34, particles: [], spawned: false };
    if (lastLayout) spawnParticles(clear, lastLayout);
    clears.push(clear);
    // Tiny screen shake on multi-line clears (a full line is 8 cells).
    if (list.length >= 16) {
      shakeMag = list.length >= 24 ? 7 : 5;
      shakeDur = 0.28;
      shakeT = shakeDur;
    }
  }

  function startFloat(text, x, y) {
    floats.push({ text: String(text), x, y, t: 0, dur: 0.85 });
  }

  function startComboPopup(level) {
    comboPop = { level: Math.max(2, level | 0), t: 0, dur: 1.0 };
  }

  function startShake(mag) {
    shakeMag = mag || 5;
    shakeDur = 0.25;
    shakeT = shakeDur;
  }

  function update(dt) {
    const step = clamp(dt || 0, 0, 0.05);
    if (shakeT > 0) shakeT = Math.max(0, shakeT - step);
    for (const clear of clears) {
      clear.t += step;
      if (!clear.spawned && lastLayout) spawnParticles(clear, lastLayout);
      for (const p of clear.particles) {
        p.t += step;
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.vy += 900 * step; // gravity, px/s^2
        p.vx *= (1 - 1.6 * step);
        p.rot += p.vr * step;
      }
    }
    clears = clears.filter((c) => c.t < c.dur || c.particles.some((p) => p.t < p.life));
    for (const f of floats) f.t += step;
    floats = floats.filter((f) => f.t < f.dur);
    if (comboPop) {
      comboPop.t += step;
      if (comboPop.t >= comboPop.dur) comboPop = null;
    }
    return animating();
  }

  // True while a clear or floating text is running; main.js locks input
  // while a clear anim runs (~300ms). The combo popup does NOT lock input.
  function animating() {
    return clears.length > 0 || floats.length > 0;
  }

  // ---- drawing helpers ----

  // One chunky blocky voxel block: soft shadow, bright base, lighter top
  // face, darker bottom/side, crisp edge — Minecraft x sandbox look.
  function drawBlock(ctx, x, y, size, color, opts) {
    const o = opts || {};
    const alpha = o.alpha == null ? 1 : o.alpha;
    const inset = o.inset == null ? Math.max(1, size * 0.045) : o.inset;
    const r = Math.max(2, size * 0.16);
    const bx = x + inset, by = y + inset, bs = size - inset * 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (!o.noShadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      rr(ctx, bx + 1, by + Math.max(1.5, size * 0.07), bs, bs, r);
      ctx.fill();
    }
    // Base.
    ctx.fillStyle = color;
    rr(ctx, bx, by, bs, bs, r);
    ctx.fill();
    // Lighter top face (~top third) — the voxel highlight.
    ctx.fillStyle = shade(color, 0.38);
    rr(ctx, bx + 1, by + 1, bs - 2, bs * 0.34, Math.max(1, r - 1));
    ctx.fill();
    // Darker bottom/side strip.
    ctx.fillStyle = shade(color, -0.28);
    rr(ctx, bx + 1, by + bs * 0.72, bs - 2, bs * 0.28 - 1, Math.max(1, r - 1));
    ctx.fill();
    // Thin bright edge along the top, dark edge along the bottom.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(bx + 3, by + 2, bs - 6, Math.max(1, size * 0.03));
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(bx + 3, by + bs - 3, bs - 6, Math.max(1, size * 0.03));
    // Crisp outline.
    ctx.strokeStyle = shade(color, -0.35);
    ctx.lineWidth = Math.max(1, size * 0.035);
    rr(ctx, bx, by, bs, bs, r);
    ctx.stroke();
    ctx.restore();
  }

  function drawPieceCells(ctx, piece, originX, originY, cellSize, opts) {
    const b = pieceBounds(piece);
    for (const [pr, pc] of piece.cells) {
      const x = originX + (pc - b.minC) * cellSize;
      const y = originY + (pr - b.minR) * cellSize;
      drawBlock(ctx, x, y, cellSize, piece.color, opts);
    }
  }

  function drawBoard(ctx, game, layout) {
    const { boardX, boardY, cell } = layout;
    const size = cell * BOARD;
    const pad = Math.max(6, cell * 0.22);
    // Panel + soft drop shadow.
    ctx.save();
    ctx.fillStyle = BOARD_SHADOW;
    rr(ctx, boardX - pad + 2, boardY - pad + 4, size + pad * 2, size + pad * 2, pad + 8);
    ctx.fill();
    ctx.fillStyle = BOARD_BG;
    rr(ctx, boardX - pad, boardY - pad, size + pad * 2, size + pad * 2, pad + 8);
    ctx.fill();
    ctx.strokeStyle = BOARD_EDGE;
    ctx.lineWidth = 1.5;
    rr(ctx, boardX - pad, boardY - pad, size + pad * 2, size + pad * 2, pad + 8);
    ctx.stroke();
    // Subtle cell marks.
    ctx.fillStyle = CELL_MARK;
    const mark = Math.max(2, cell * 0.16);
    for (let r = 0; r < BOARD; r++) {
      for (let c = 0; c < BOARD; c++) {
        const mx = boardX + c * cell + cell / 2 - mark / 2;
        const my = boardY + r * cell + cell / 2 - mark / 2;
        rr(ctx, mx, my, mark, mark, mark * 0.35);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPlacedBlocks(ctx, game, layout) {
    const clearing = new Set();
    for (const clear of clears) {
      for (const { r, c } of clear.cells) clearing.add(r * BOARD + c);
    }
    const { boardX, boardY, cell } = layout;
    for (let r = 0; r < BOARD; r++) {
      for (let c = 0; c < BOARD; c++) {
        const slot = game.board && game.board[r] && game.board[r][c];
        if (!slot || clearing.has(r * BOARD + c)) continue;
        drawBlock(ctx, boardX + c * cell, boardY + r * cell, cell, slot.color || '#888888');
      }
    }
  }

  function drawWouldClear(ctx, layout, wouldClear) {
    if (!wouldClear) return;
    const { boardX, boardY, cell } = layout;
    const size = cell * BOARD;
    ctx.save();
    ctx.fillStyle = CLEAR_HIGHLIGHT;
    ctx.strokeStyle = CLEAR_EDGE;
    ctx.lineWidth = 1.5;
    for (const r of wouldClear.rows || []) {
      if (r < 0 || r >= BOARD) continue;
      ctx.fillRect(boardX, boardY + r * cell, size, cell);
      ctx.strokeRect(boardX + 0.5, boardY + r * cell + 0.5, size - 1, cell - 1);
    }
    for (const c of wouldClear.cols || []) {
      if (c < 0 || c >= BOARD) continue;
      ctx.fillRect(boardX + c * cell, boardY, cell, size);
      ctx.strokeRect(boardX + c * cell + 0.5, boardY + 0.5, cell - 1, size - 1);
    }
    ctx.restore();
  }

  function drawClearAnims(ctx, layout) {
    const { boardX, boardY, cell } = layout;
    for (const clear of clears) {
      const p = clamp(clear.t / clear.dur, 0, 1);
      // Flash white, popping (shrinking) as it fades.
      const shrink = 1 - easeOutCubic(p) * 0.25;
      const alpha = 1 - p;
      ctx.save();
      ctx.globalAlpha = alpha;
      for (const { r, c } of clear.cells) {
        const cx = boardX + c * cell + cell / 2;
        const cy = boardY + r * cell + cell / 2;
        const s = cell * shrink;
        ctx.fillStyle = '#ffffff';
        rr(ctx, cx - s / 2, cy - s / 2, s, s, Math.max(2, s * 0.16));
        ctx.fill();
      }
      ctx.restore();
      // Particles.
      for (const pt of clear.particles) {
        const lp = clamp(pt.t / pt.life, 0, 1);
        if (lp >= 1) continue;
        ctx.save();
        ctx.globalAlpha = 1 - lp;
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        ctx.fillStyle = pt.color;
        const s = pt.size * (1 - lp * 0.5);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
  }

  function drawTray(ctx, game, layout, drag) {
    if (!layout.traySlots) return;
    const draggedIndex = drag && drag.pieceIndex != null ? drag.pieceIndex : -1;
    const selectedIndex = drag && drag.selected && drag.pieceIndex != null ? drag.pieceIndex : -1;
    game.tray.forEach((piece, i) => {
      const slot = layout.traySlots[i];
      if (!slot) return;
      ctx.save();
      // Slot well.
      ctx.fillStyle = SLOT_BG;
      rr(ctx, slot.x, slot.y, slot.w, slot.h, 10);
      ctx.fill();
      ctx.strokeStyle = i === selectedIndex ? '#facc15' : SLOT_EDGE;
      ctx.lineWidth = i === selectedIndex ? 2.5 : 1;
      rr(ctx, slot.x, slot.y, slot.w, slot.h, 10);
      ctx.stroke();
      if (!piece) { ctx.restore(); return; }
      const b = pieceBounds(piece);
      const fit = Math.min(slot.w / b.cols, slot.h / b.rows, layout.cell * 0.92);
      const pw = b.cols * fit, ph = b.rows * fit;
      const ox = slot.x + (slot.w - pw) / 2;
      const oy = slot.y + (slot.h - ph) / 2;
      const isDragged = i === draggedIndex && drag && !drag.selected;
      drawPieceCells(ctx, piece, ox, oy, fit, { alpha: isDragged ? 0.22 : 1 });
      ctx.restore();
    });
  }

  function drawDrag(ctx, game, layout, drag) {
    if (!drag || drag.pieceIndex == null) return;
    const piece = game.tray && game.tray[drag.pieceIndex];
    if (!piece) return;
    const { boardX, boardY, cell } = layout;
    const b = pieceBounds(piece);
    // Ghost on the board at the hovered anchor cell.
    if (drag.cell && typeof drag.cell.r === 'number' && typeof drag.cell.c === 'number') {
      const tint = drag.valid ? GHOST_OK : GHOST_BAD;
      for (const [pr, pc] of piece.cells) {
        const r = drag.cell.r + (pr - b.minR);
        const c = drag.cell.c + (pc - b.minC);
        if (r < 0 || r >= BOARD || c < 0 || c >= BOARD) continue;
        const x = boardX + c * cell, y = boardY + r * cell;
        drawBlock(ctx, x, y, cell, piece.color, { alpha: 0.62, noShadow: true });
        ctx.save();
        ctx.fillStyle = tint;
        rr(ctx, x + 2, y + 2, cell - 4, cell - 4, Math.max(2, cell * 0.14));
        ctx.fill();
        ctx.strokeStyle = drag.valid ? '#4ade80' : '#f87171';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        rr(ctx, x + 2, y + 2, cell - 4, cell - 4, Math.max(2, cell * 0.14));
        ctx.stroke();
        ctx.restore();
      }
    }
    // Piece itself follows the pointer (lifted above the finger a touch so
    // it stays visible under a thumb).
    if (typeof drag.x === 'number' && typeof drag.y === 'number') {
      const pw = b.cols * cell, ph = b.rows * cell;
      const ox = drag.x - pw / 2;
      const oy = drag.y - ph / 2 - cell * 0.55;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      drawPieceCells(ctx, piece, ox, oy, cell, { alpha: 0.94, noShadow: true });
      ctx.restore();
    }
  }

  function drawFloats(ctx) {
    for (const f of floats) {
      const p = clamp(f.t / f.dur, 0, 1);
      const rise = easeOutCubic(p) * 44;
      const alpha = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45;
      const scale = p < 0.18 ? easeOutBack(p / 0.18) : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(f.x, f.y - rise);
      ctx.scale(scale, scale);
      ctx.font = `800 ${Math.round(22)}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
  }

  function drawComboPopup(ctx, layout) {
    if (!comboPop) return;
    const p = clamp(comboPop.t / comboPop.dur, 0, 1);
    const popIn = p < 0.22 ? easeOutBack(p / 0.22) : 1;
    const alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    const cx = layout.boardX + (layout.cell * BOARD) / 2;
    const cy = layout.boardY + (layout.cell * BOARD) / 2;
    const size = Math.round(layout.cell * 0.95);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(popIn, popIn);
    ctx.rotate(Math.sin(p * 6) * 0.02 * (1 - p));
    ctx.font = `900 ${size}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const grad = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    grad.addColorStop(0, '#fde047');
    grad.addColorStop(0.55, '#f59e0b');
    grad.addColorStop(1, '#ea580c');
    ctx.lineWidth = Math.max(4, size * 0.14);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(60,20,0,0.85)';
    ctx.strokeText(`COMBO x${comboPop.level}!`, 0, 0);
    ctx.fillStyle = grad;
    ctx.fillText(`COMBO x${comboPop.level}!`, 0, 0);
    ctx.restore();
  }

  function draw(ctx, game, layout, drag, anims) {
    if (!ctx || !game || !layout) return;
    lastLayout = layout;
    // Lazily spawn particles for clears started before a layout was seen.
    for (const clear of clears) {
      if (!clear.spawned) spawnParticles(clear, layout);
    }
    ctx.save();
    // Tiny screen shake (multi-line clears only; decays fast).
    if (shakeT > 0 && shakeDur > 0) {
      const k = (shakeT / shakeDur) * shakeMag;
      ctx.translate((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k);
    }
    drawBoard(ctx, game, layout);
    drawWouldClear(ctx, layout, drag && drag.wouldClear);
    drawPlacedBlocks(ctx, game, layout);
    drawClearAnims(ctx, layout);
    drawTray(ctx, game, layout, drag);
    drawDrag(ctx, game, layout, drag);
    ctx.restore();
    // Floats + combo popup sit above the shake so text stays readable.
    drawFloats(ctx);
    drawComboPopup(ctx, layout);
  }

  return { draw, startClear, startFloat, startComboPopup, startShake, update, animating };
}
