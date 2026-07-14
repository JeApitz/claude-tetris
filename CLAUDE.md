# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris implementation using HTML5 Canvas. No dependencies, no build process, no package.json.

## Running

No install or build step needed. Either:

```bash
xdg-open index.html          # open directly
python3 -m http.server 8000  # or serve locally, then visit http://localhost:8000
```

There are no automated tests or linters configured — verify changes by opening the page in a browser and playing.

## Architecture

Three files, no modules/bundler — `game.js` is loaded directly via `<script src="game.js">` and relies on globals.

- `index.html` — DOM structure: main `#board` canvas (300×600, 10×20 grid at `BLOCK=30`px/cell), a `#next-canvas` preview (120×120), HUD spans (`#score`, `#lines`, `#level`), and a shared `#overlay` used for both pause and game-over states.
- `style.css` — dark/retro arcade visual theme.
- `game.js` — all game logic, organized around a small set of cooperating pieces:
  - **Board state**: `board` is a `ROWS × COLS` matrix where each cell is `0` (empty) or a color index `1–7` identifying which piece type is locked there. `COLORS[]` and `PIECES[]` are parallel arrays indexed by piece type.
  - **Piece shapes**: each of the 7 pieces is a square matrix; `rotateCW()` rotates via transpose + row-reverse. `tryRotate()` applies `rotateCW()` then attempts wall kicks (`[0, -1, 1, -2, 2]` column offsets) until one doesn't collide.
  - **Collision**: `collide(shape, ox, oy)` is the single source of truth for whether a shape at a given offset is legal (out of bounds or overlapping locked cells). Used by movement, rotation, ghost-piece projection, and spawn-collision (game over) checks.
  - **Game loop**: `loop(ts)` runs via `requestAnimationFrame`, accumulates elapsed time in `dropAccum`, and advances the piece one row (or calls `lockPiece()`) once `dropAccum >= dropInterval`.
  - **Locking/scoring**: `lockPiece()` → `merge()` writes the piece into `board`, then `clearLines()` removes full rows (scanning bottom-up, re-checking the same row index after a splice), updates `score`/`lines`/`level`, and recomputes `dropInterval = max(100, 1000 - (level-1)*90)`. Hard drop scores 2pts/row dropped, soft drop 1pt/row.
  - **Rendering**: `draw()` clears and redraws the grid, locked board, ghost piece (`ghostY()` projects straight down via repeated `collide` checks, drawn at `globalAlpha=0.2`), and the current piece, every frame.
  - Tunable constants live at the top of `game.js`: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS×BLOCK` by `ROWS×BLOCK`).

## Notes

- README.md is written in Spanish and is the more detailed source of truth for game mechanics/controls if this file and the code diverge.
