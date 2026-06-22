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

## Level Designer
Pick **✎ Make a level…** from the level menu to build your own puzzles:
- **Drag walls & parts** onto the board as fixed obstacles, and set the **Ball start** and the **Goal**.
- Toggle the goal between a **Ring** (enter from any side) and a **Basket** (drop in from the top).
- **🎒 Tools** — choose exactly which parts, and how many, the solver gets.
- **▶ Test** — play your level yourself to confirm it can be beaten, then **✎ Edit** to keep tweaking.
- **💾 Save** — stores it in your browser under **My Levels**.
- **⤴ Share** — export a code to back up or share a level, or paste one in to import it.

## Parts
Ball · Plank · Seesaw · Fan (updraft) · Balloon (buoyancy) · Conveyor · Trampoline ·
Cannon (launcher) · Spinner (motor) · Domino · Crate (heavy) · Bumper (bouncy)

## Levels
19 hand-built puzzles that ramp from one-mechanic teaching levels to multi-step
contraptions, plus a free-build **Sandbox** and a full **Level Designer** for your own puzzles.

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
