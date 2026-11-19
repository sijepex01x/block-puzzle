// input.js — pointer input for BLOCKBURST (Worker 3).
// Pure helpers are node-testable; attachInput wires Pointer Events on a canvas.
// No DOM access at module top level (safe to import in node).

// Cell under a point, or null when outside the 8x8 board.
export function pointerToCell(x, y, layout) {
  if (!layout || !layout.cell) return null;
  const r = Math.floor((y - layout.boardY) / layout.cell);
  const c = Math.floor((x - layout.boardX) / layout.cell);
  if (r < 0 || r > 7 || c < 0 || c > 7) return null;
  return { r, c };
}

// Tray slot index under a point, or null.
export function trayHit(x, y, layout) {
  if (!layout || !Array.isArray(layout.traySlots)) return null;
  for (let i = 0; i < layout.traySlots.length; i++) {
    const s = layout.traySlots[i];
    if (!s) continue;
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return i;
  }
  return null;
}

// Button id under a point, or null. Rects come from layout.buttons and are
// shared with hud.js (drawHUD draws exactly these rects).
export function buttonHit(x, y, layout) {
  if (!layout || !layout.buttons) return null;
  for (const id of Object.keys(layout.buttons)) {
    const b = layout.buttons[id];
    if (!b) continue;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return id;
  }
  return null;
}

// Anchor (top-left) cell for a dragged piece so the pointer sits over the
// piece centre. piece = { cells: [[r,c],...] }.
export function cellForDrag(x, y, piece, layout) {
  const under = pointerToCell(x, y, layout);
  if (!under || !piece || !Array.isArray(piece.cells)) return under;
  let rows = 0;
  let cols = 0;
  for (const [r, c] of piece.cells) {
    if (r + 1 > rows) rows = r + 1;
    if (c + 1 > cols) cols = c + 1;
  }
  return { r: under.r - Math.floor(rows / 2), c: under.c - Math.floor(cols / 2) };
}

const TAP_SLOP_PX = 10;

function toLocal(e, canvas, layout) {
  const rect = canvas.getBoundingClientRect();
  const sx = layout && layout.width ? layout.width / Math.max(1, rect.width) : 1;
  const sy = layout && layout.height ? layout.height / Math.max(1, rect.height) : 1;
  return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
}

// handlers: onPick(pieceIndex), onDrag(pieceIndex, x, y),
//   onDrop(pieceIndex, cell|null), onTapCell(r, c), onButton(id), onCancel()
// Returns a detach() function.
export function attachInput(canvas, layout, handlers) {
  const h = handlers || {};
  let drag = null; // { pieceIndex, pointerId, x0, y0, moved }
  let tap = null; // { x, y } pointerdown point for tap detection on the board

  function onDown(e) {
    if (e.cancelable && e.pointerType === 'touch') e.preventDefault();
    const p = toLocal(e, canvas, layout);
    const btn = buttonHit(p.x, p.y, layout);
    if (btn) {
      if (h.onButton) h.onButton(btn);
      return;
    }
    const tray = trayHit(p.x, p.y, layout);
    if (tray !== null && tray !== undefined) {
      drag = { pieceIndex: tray, pointerId: e.pointerId, x0: p.x, y0: p.y, moved: false };
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
      }
      return;
    }
    tap = { x: p.x, y: p.y };
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const p = toLocal(e, canvas, layout);
    if (!drag.moved && Math.hypot(p.x - drag.x0, p.y - drag.y0) > TAP_SLOP_PX) {
      drag.moved = true;
    }
    if (drag.moved && h.onDrag) h.onDrag(drag.pieceIndex, p.x, p.y);
  }

  function onUp(e) {
    const p = toLocal(e, canvas, layout);
    if (drag && e.pointerId === drag.pointerId) {
      const d = drag;
      drag = null;
      if (d.moved) {
        const cell = pointerToCell(p.x, p.y, layout);
        if (h.onDrop) h.onDrop(d.pieceIndex, cell);
      } else if (h.onPick) {
        h.onPick(d.pieceIndex); // tap on a tray piece: select / deselect
      }
      return;
    }
    if (tap) {
      const t = tap;
      tap = null;
      if (Math.hypot(p.x - t.x, p.y - t.y) <= TAP_SLOP_PX) {
        const cell = pointerToCell(p.x, p.y, layout);
        if (cell) {
          if (h.onTapCell) h.onTapCell(cell.r, cell.c);
        } else if (h.onCancel) {
          h.onCancel(); // tap on empty space: deselect / dismiss
        }
      }
    }
  }

  function onCancelPointer(e) {
    if (drag && e.pointerId === drag.pointerId) {
      drag = null;
      if (h.onCancel) h.onCancel();
    }
    tap = null;
  }

  function onKey(e) {
    const k = e.key;
    if (k === 'm' || k === 'M') {
      if (h.onButton) h.onButton('mute');
    } else if (k === 'h' || k === 'H' || k === '?') {
      if (h.onButton) h.onButton('howto');
    } else if (k === 'Escape') {
      if (h.onCancel) h.onCancel();
    }
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancelPointer);
  if (canvas.style) canvas.style.touchAction = 'none';
  const win = typeof window !== 'undefined' ? window : null;
  if (win) win.addEventListener('keydown', onKey);

  return function detach() {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancelPointer);
    if (win) win.removeEventListener('keydown', onKey);
  };
}
