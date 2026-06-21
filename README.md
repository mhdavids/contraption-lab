# Contraption Lab ⚙️

A physics contraption puzzler in the spirit of the classic **The Incredible Machine**.
Drag parts from the bin onto the board, press **Run**, and watch your machine play out —
solve each level by getting the basketball into the hoop (or the balloon into the ring).

▶️ **Play:** _(deployed on Vercel)_

## How to play
- **Drag** a part from the Parts Bin onto the board.
- **Click** a placed part to **rotate** (↺ ↻, or `Q`/`E`) or **delete** (🗑, or `Del`) it.
- Press **Run** (or `Space`) to start the simulation; **Stop** returns to building.
- **Reset** restores the level so you can try a fresh contraption.

## Parts
Ball · Plank · Seesaw · Fan (updraft) · Balloon (buoyancy) · Conveyor · Trampoline ·
Cannon (launcher) · Spinner (motor) · Domino · Crate (heavy) · Bumper (bouncy)

## Levels
10 hand-built puzzles that introduce mechanics one at a time, plus a free-build **Sandbox**.

## Tech
Vanilla HTML / Canvas / JavaScript — no build step. Physics by
[Matter.js](https://brm.io/matter-js/) (vendored locally in `js/lib/`). Custom cartoon
rendering for the workshop aesthetic.

```
index.html        # shell + UI
style.css         # workshop theme
js/levels.js      # level data (960×600 board)
js/parts.js       # part definitions, rendering, physics factories
js/main.js        # game loop, modes, custom forces, input, win detection
js/lib/matter.min.js
```

Run locally with any static server, e.g. `python3 -m http.server` then open the page.
