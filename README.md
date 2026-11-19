# BLOCKBURST

A relaxing Block Blast-style block puzzle. Drag pieces from the tray onto the
8×8 board, fill whole rows or columns to clear them, and chase your best
score. Endless, no timer. Vanilla JS + Canvas 2D, zero libraries, zero
network — all art procedural, all sound synthesized WebAudio.

## How to run

Serve the `game/` folder from any static server, then open it in a browser:

```sh
cd game
python3 -m http.server 8080
# open http://localhost:8080/
```

Or use any static host (GitHub Pages works). ES modules are used, so opening
`index.html` directly from `file://` works in Firefox but is blocked by
Chrome's module CORS rules — use the server command above for Chrome.

## How to play

- **Drag** a piece from the tray onto the board to place it (mouse or finger).
  While dragging, the ghost preview is green when the piece fits, red when it
  doesn't, and any rows/columns that would clear are highlighted.
- **Tap to place** (fallback): tap a tray piece to select it, then tap a
  board cell to place it there. Tap empty space to deselect.
- When all 3 tray pieces are placed, 3 new ones appear.
- Fill a whole row or column to clear it. **Game over** when no tray piece
  fits anywhere on the board — tap PLAY AGAIN to restart.
- **NEW GAME** restarts (asks "SURE?" first if a game is in progress).
- **MUTE** toggles sound. **?** shows How to Play (also shown on first run).
- Keyboard: `M` mute, `H` or `?` help, `Esc` cancel/deselect.

## Scoring

| Action | Points |
|---|---|
| Each placed cell | 1 |
| Clearing lines in one placement | 10 × n² × combo, where n = lines cleared at once |
| Combo | Clearing lines on consecutive placements builds a combo (×2, ×3, …) applied to the line bonus. The first clearing placement is combo ×1. A placement that clears nothing resets the combo to 0. |

Examples:

- Place a single cell to complete 1 row: 1 + 10 × 1 × 1 = **11**
- One piece completes a row *and* a column at once: 1 + 10 × 4 × 1 = **41**
- Two clears in a row, then a non-clear: 11 + 21 + 1 = **33**

Best score is saved in the browser (`localStorage` key `blockburst-best`).

## Files

```
game/
  index.html        minimal page, <canvas id="game">, loads src/main.js
  package.json      {"type": "module"} so node --check works on the ES modules
  src/
    config.js       shared constants, colors, storage keys (W1)
    pieces.js       27 shapes, no rotation (W1)
    engine.js       pure game logic: place / clears / combo / game over (W1)
    render.js       board, voxel blocks, ghost, clear anims, particles (W2)
    audio.js        WebAudio synth: thock, pops, combo chime, jingle (W2)
    input.js        Pointer Events drag + tap-to-place + pure helpers (W3)
    hud.js          SCORE/BEST/combo meter, buttons, How to Play, Game Over (W3)
    main.js         wiring, DPR-aware canvas, layout, rAF loop, persistence (W3)
screenshots/
  01-start.png          fresh board
  02-about-to-clear.png mid-game, ghost about to complete a row
  03-game-over.png      game-over screen with new best
```

## QA

Harness in `/tmp/blockburst-verify/` (not shipped): `node qa.mjs`
(78 checks), `node boot.mjs` (boots the real `main.js` wiring headlessly),
`node shots.mjs` (renders the screenshots with node-canvas).

- 127+ headless placements with per-move invariants; placement validation
  cross-checked against brute force on 2,000 random samples; game-over
  detection cross-checked against brute force on 600 sampled boards
  (0 false positives, 0 false negatives); tray refill + mercy re-deal
  verified with a deterministic RNG stub; 3 hand-verified score scenarios
  (11 / 41 / 33 — see the scoring table above).
- Mobile 390×844: board + tray fully visible, no overflow; drag and
  tap-to-place verified through a simulated pointer pipeline.
- `place()` averages ~0.01 ms; a full render frame ~3.6 ms
  (60 fps budget is 16.6 ms). `node --check` clean on all sources,
  0 console errors.
