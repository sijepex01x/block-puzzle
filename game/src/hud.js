// hud.js — HUD + overlays for BLOCKBURST (Worker 3). Canvas only, no DOM.
// Button rects drawn here MUST match layout.buttons (shared with input.js).

export function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawButton(ctx, b, label, opts) {
  const o = opts || {};
  ctx.save();
  rr(ctx, b.x, b.y, b.w, b.h, 9);
  ctx.fillStyle = o.armed ? '#b91c1c' : o.active ? '#1d4ed8' : '#263449';
  ctx.fill();
  ctx.strokeStyle = o.armed ? '#f87171' : '#3b4a63';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#f1f5f9';
  ctx.font = `700 ${o.fontSize || 13}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 0.5);
  ctx.restore();
}

// ui (optional): { confirmNewGame, muted }
export function drawHUD(ctx, game, layout, ui) {
  const u = ui || {};
  const W = layout.width;
  const b = layout.buttons || {};

  // Buttons (top-left row).
  if (b.newGame) drawButton(ctx, b.newGame, u.confirmNewGame ? 'SURE?' : 'NEW GAME', { armed: !!u.confirmNewGame });
  if (b.mute) drawButton(ctx, b.mute, u.muted ? 'MUTED' : 'MUTE', { active: !!u.muted });
  if (b.howto) drawButton(ctx, b.howto, '?', { fontSize: 16 });

  // Score (top-right).
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 11px system-ui, -apple-system, sans-serif';
  ctx.fillText('SCORE', W - 12, 24);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 30px system-ui, -apple-system, sans-serif';
  ctx.fillText(String(game.score || 0), W - 12, 54);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('BEST ' + String(game.best || 0), W - 12, 72);
  ctx.restore();

  // Combo meter when a combo is live (combo >= 2).
  if (game.combo && game.combo >= 2) {
    const cx = W / 2;
    const cy = layout.boardY - 16;
    const label = 'COMBO x' + game.combo;
    ctx.save();
    ctx.font = '800 15px system-ui, -apple-system, sans-serif';
    const tw = ctx.measureText(label).width;
    const pw = tw + 28;
    rr(ctx, cx - pw / 2, cy - 13, pw, 26, 13);
    ctx.fillStyle = '#7c3aed';
    ctx.fill();
    ctx.fillStyle = '#f5f3ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 0.5);
    // Meter bar: combo progress toward x5.
    const frac = Math.min(1, game.combo / 5);
    rr(ctx, cx - pw / 2, cy + 15, pw, 4, 2);
    ctx.fillStyle = '#312e81';
    ctx.fill();
    rr(ctx, cx - pw / 2, cy + 15, pw * frac, 4, 2);
    ctx.fillStyle = '#a78bfa';
    ctx.fill();
    ctx.restore();
  }

  // Footer title.
  if (layout.footerY) {
    ctx.save();
    ctx.fillStyle = '#64748b';
    ctx.font = '700 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('B L O C K B U R S T  ·  drag pieces, fill lines', W / 2, layout.footerY);
    ctx.restore();
  }
}

export function drawHowTo(ctx, layout) {
  const W = layout.width;
  const H = layout.height;
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
  ctx.fillRect(0, 0, W, H);
  const pw = Math.min(W - 40, 340);
  const ph = 372;
  const px = (W - pw) / 2;
  const py = (H - ph) / 2;
  rr(ctx, px, py, pw, ph, 16);
  ctx.fillStyle = '#16233a';
  ctx.fill();
  ctx.strokeStyle = '#3b4a63';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('HOW TO PLAY', W / 2, py + 40);
  ctx.font = '400 14px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  const lines = [
    'Drag a piece from the tray',
    'onto the board to place it.',
    '',
    'Fill a whole row or column',
    'to clear it and score.',
    '',
    'Clear lines on consecutive',
    'moves to build a COMBO.',
    '',
    'Game over when no tray piece',
    'fits anywhere. Good luck!',
    '',
    'Drag · or tap piece, tap cell',
    'M mute · H help',
  ];
  let y = py + 72;
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += 19;
  }
  ctx.fillStyle = '#a78bfa';
  ctx.font = '700 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('Tap anywhere to start', W / 2, py + ph - 18);
  ctx.restore();
}

export function drawGameOver(ctx, game, layout) {
  const W = layout.width;
  const H = layout.height;
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
  ctx.fillRect(0, 0, W, H);
  const pw = Math.min(W - 48, 320);
  const ph = 252;
  const px = (W - pw) / 2;
  const py = (H - ph) / 2 - 10;
  rr(ctx, px, py, pw, ph, 16);
  ctx.fillStyle = '#16233a';
  ctx.fill();
  ctx.strokeStyle = '#3b4a63';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 26px system-ui, -apple-system, sans-serif';
  ctx.fillText('GAME OVER', W / 2, py + 46);
  const isBest = game.score > 0 && game.score >= (game.best || 0);
  ctx.font = '400 15px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('SCORE  ' + String(game.score || 0), W / 2, py + 84);
  ctx.fillText('BEST  ' + String(game.best || 0), W / 2, py + 110);
  if (isBest) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = '800 15px system-ui, -apple-system, sans-serif';
    ctx.fillText('★ NEW BEST! ★', W / 2, py + 138);
  }
  // PLAY AGAIN button — rect is layout.buttons.again (shared with input.js).
  const again = layout.buttons && layout.buttons.again;
  if (again) drawButton(ctx, again, 'PLAY AGAIN', { active: true, fontSize: 16 });
  ctx.restore();
}
