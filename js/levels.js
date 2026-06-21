/* ============================================================
   Contraption Lab — levels.js
   Board is 960 x 600 logical units. (0,0) top-left.
   A level is fixed geometry + a fixed goal part + a parts-bin inventory.
   ============================================================ */

const BOARD_W = 960, BOARD_H = 600, FLOOR_TOP = 566;

(function () {
  // ---- geometry helpers ----
  const wall = (x, y, w, h) => ({ type: "block", x, y, w, h, editable: false });

  function bounds(ceiling) {
    const b = [
      wall(BOARD_W / 2, FLOOR_TOP + 60, BOARD_W + 200, 120), // floor: top edge at FLOOR_TOP
      wall(-30, BOARD_H / 2, 60, BOARD_H + 200),             // left: inner edge at x=0
      wall(BOARD_W + 30, BOARD_H / 2, 60, BOARD_H + 200),    // right: inner edge at x=960
    ];
    if (ceiling) b.push(wall(BOARD_W / 2, -30, BOARD_W + 200, 60)); // ceiling: inner edge y=0
    return b;
  }

  // open-top "cup" the ball drops into; side posts are hidden (the basket art stands in)
  function basket(cx, topY = FLOOR_TOP) {
    return {
      walls: [
        { type: "block", x: cx - 36, y: topY - 28, w: 12, h: 56, editable: false, hidden: true },
        { type: "block", x: cx + 36, y: topY - 28, w: 12, h: 56, editable: false, hidden: true },
      ],
      zone: { x: cx - 30, y: topY - 52, w: 60, h: 50 },
    };
  }

  // ---- Level 1: First Drop ----
  const b1 = basket(480);
  const L1 = {
    name: "1 · First Drop",
    hint: "Drop the basketball into the hoop. Drag a Plank under the ball and angle it so the ball rolls right and drops in.",
    goal: { kind: "basket", role: "goalBall", zone: b1.zone },
    parts: [
      ...bounds(false),
      ...b1.walls,
      { type: "ball", x: 168, y: 108, role: "goalBall", editable: false },
    ],
    inventory: { ramp: 3 },
  };

  // ---- Level 2: Mind the Gap ----
  const b2 = basket(792);
  const L2 = {
    name: "2 · Mind the Gap",
    hint: "The ball rolls off the shelf into thin air. Bridge the gap with Planks so it reaches the hoop.",
    goal: { kind: "basket", role: "goalBall", zone: b2.zone },
    parts: [
      ...bounds(false),
      ...b2.walls,
      // starting shelf, tilted so the ball rolls off to the right
      { type: "ramp", x: 165, y: 230, w: 240, h: 18, angle: 0.16, editable: false },
      { type: "ball", x: 95, y: 188, role: "goalBall", editable: false },
      // a pillar in the way to make placement matter
      { type: "block", x: 470, y: 470, w: 40, h: 200, editable: false },
    ],
    inventory: { ramp: 3, trampoline: 1 },
  };

  // ---- Level 3: Catch the Wind ----
  const b3 = basket(150);
  const L3 = {
    name: "3 · Catch the Wind",
    hint: "The hoop is back to the LEFT and up high. Use the Fan's updraft (and Planks) to push the ball up and over.",
    goal: { kind: "basket", role: "goalBall", zone: { x: b3.zone.x, y: 250, w: 60, h: 50 } },
    parts: [
      ...bounds(true),
      // raised basket on a shelf, top-left
      { type: "block", x: 150, y: 330, w: 200, h: 24, editable: false },
      { type: "block", x: 114, y: 300, w: 12, h: 56, editable: false, hidden: true },
      { type: "block", x: 186, y: 300, w: 12, h: 56, editable: false, hidden: true },
      // ball starts mid-right, will fall straight down
      { type: "ball", x: 640, y: 120, role: "goalBall", editable: false },
    ],
    inventory: { fan: 1, ramp: 3 },
  };
  L3.goal.zone = { x: 120, y: 248, w: 60, h: 52 };

  // ---- Level 4: Light as Air ----  (goal part is the balloon; steer it into a floating ring)
  const L4 = {
    name: "4 · Light as Air",
    hint: "This time the BALLOON is your prize — it floats up on its own. Angle Planks to steer it right and up into the glowing ring.",
    goal: { kind: "ring", role: "goalBall", zone: { x: 698, y: 12, w: 88, h: 104 } },
    parts: [
      ...bounds(true),
      { type: "balloon", x: 250, y: 500, role: "goalBall", editable: false },
      // a divider that makes the balloon drift the wrong way unless guided
      { type: "block", x: 540, y: 220, w: 40, h: 300, editable: false },
    ],
    inventory: { ramp: 4, fan: 1 },
  };

  // ---- Level 5: Conveyor Caper ----
  const b5 = basket(820);
  const L5 = {
    name: "5 · Conveyor Caper",
    hint: "Bounce the ball off a Trampoline onto a Conveyor and ride it to the hoop. Combine everything you've learned!",
    goal: { kind: "basket", role: "goalBall", zone: b5.zone },
    parts: [
      ...bounds(false),
      ...b5.walls,
      { type: "ball", x: 130, y: 100, role: "goalBall", editable: false },
      // a low wall the ball must get over
      { type: "block", x: 470, y: 506, w: 40, h: 130, editable: false },
    ],
    inventory: { trampoline: 1, conveyor: 2, ramp: 2, fan: 1 },
  };

  // ---- Level 6: Pinball Drop (bumper) ----
  const b6 = basket(480);
  const L6 = {
    name: "6 · Pinball Drop",
    hint: "Pinball time! The ball drops from up top. Place Bumpers (bouncy!) and Planks to ricochet it into the hoop.",
    goal: { kind: "basket", role: "goalBall", zone: b6.zone },
    parts: [
      ...bounds(true),
      ...b6.walls,
      { type: "ball", x: 150, y: 86, role: "goalBall", editable: false },
      // a shelf right over the hoop, so a straight drop won't work
      { type: "block", x: 480, y: 250, w: 150, h: 20, editable: false },
    ],
    inventory: { bumper: 3, ramp: 3 },
  };

  // ---- Level 7: Cannonball (cannon) ----
  const b7 = basket(824);
  const L7 = {
    name: "7 · Cannonball",
    hint: "A tall wall guards the hoop. Roll the ball into a Cannon and aim it (rotate!) so it arcs over the wall.",
    goal: { kind: "basket", role: "goalBall", zone: b7.zone },
    parts: [
      ...bounds(false),
      ...b7.walls,
      { type: "ball", x: 120, y: 90, role: "goalBall", editable: false },
      { type: "block", x: 560, y: 436, w: 40, h: 280, editable: false }, // wall, top ~y296
    ],
    inventory: { cannon: 1, ramp: 3 },
  };

  // ---- Level 8: Battering Ram (crate) ----
  const b8 = basket(626);
  const L8 = {
    name: "8 · Battering Ram",
    hint: "The ball is stuck on the shelf. Build a ramp so a dropped Crate slides down and rams it off the edge into the hoop.",
    goal: { kind: "basket", role: "goalBall", zone: b8.zone },
    parts: [
      ...bounds(false),
      ...b8.walls,
      // shelf (top ~y320) holding the ball near its right edge
      { type: "block", x: 322, y: 332, w: 384, h: 24, editable: false }, // x130..514
      { type: "ball", x: 486, y: 300, role: "goalBall", editable: false },
    ],
    inventory: { crate: 1, ramp: 3 },
  };

  // ---- Level 9: The Mixer (spinner) ----
  const b9 = basket(810);
  const L9 = {
    name: "9 · The Mixer",
    hint: "That motorized paddle never stops spinning. Feed the ball into it with Planks and let it bat the ball across.",
    goal: { kind: "basket", role: "goalBall", zone: b9.zone },
    parts: [
      ...bounds(false),
      ...b9.walls,
      { type: "ball", x: 120, y: 88, role: "goalBall", editable: false },
      { type: "spinner", x: 430, y: 360, editable: false },
      { type: "block", x: 630, y: 476, w: 40, h: 190, editable: false },
    ],
    inventory: { ramp: 4, bumper: 1 },
  };

  // ---- Level 10: Grand Contraption (capstone) ----
  const b10 = basket(842);
  const L10 = {
    name: "10 · Grand Contraption",
    hint: "The big one. Everything's on the table — chain it all together and sink the ball.",
    goal: { kind: "basket", role: "goalBall", zone: b10.zone },
    parts: [
      ...bounds(true),
      ...b10.walls,
      { type: "ball", x: 108, y: 88, role: "goalBall", editable: false },
      { type: "block", x: 460, y: 304, w: 40, h: 240, editable: false },
      { type: "block", x: 690, y: 480, w: 40, h: 180, editable: false },
    ],
    inventory: { ramp: 4, cannon: 1, conveyor: 1, fan: 1, bumper: 2, trampoline: 1, seesaw: 1 },
  };

  // ============================================================
  //  HARDER LEVELS (11-15) — multi-step chains, obstacles, tight parts
  // ============================================================

  // ---- Level 11: Over the Top (launch over a tall wall) ----
  const b11 = basket(806);
  const L11 = {
    name: "11 · Over the Top",
    hint: "That wall is too tall to roll around. Feed the ball into a Cannon and aim it up and over — then land it in the hoop on the far side.",
    goal: { kind: "basket", role: "goalBall", zone: b11.zone },
    parts: [
      ...bounds(true),
      ...b11.walls,
      { type: "ball", x: 120, y: 120, role: "goalBall", editable: false },
      { type: "block", x: 470, y: 440, w: 46, h: 260, editable: false }, // wall, top ~y310 (clearable by a flat cannon arc, too tall to roll over)
    ],
    inventory: { cannon: 1, ramp: 3, trampoline: 1 },
  };

  // ---- Level 12: Bank Shot (roll under a wall, bank into a low ring) ----
  const L12 = {
    name: "12 · Bank Shot",
    hint: "A wall guards the ring with no straight line in. Roll the ball under the wall, then bank it off Bumpers to steer it into the ring.",
    goal: { kind: "ring", role: "goalBall", zone: { x: 772, y: 424, w: 86, h: 86 } }, // low-right, open
    parts: [
      ...bounds(true),
      { type: "ball", x: 120, y: 104, role: "goalBall", editable: false },
      // tall wall with a gap UNDER it (top y105 down to y465; floor gap below)
      { type: "block", x: 566, y: 285, w: 40, h: 360, editable: false },
    ],
    inventory: { bumper: 3, ramp: 3 },
  };

  // ---- Level 13: Sky Hook (trampoline bounce up to a high ring) ----
  const L13 = {
    name: "13 · Sky Hook",
    hint: "The ring floats up high with clear air beneath it. Drop the ball onto a Trampoline placed right below the ring and launch it straight up through — the higher the drop, the higher the bounce.",
    goal: { kind: "ring", role: "goalBall", zone: { x: 556, y: 190, w: 92, h: 98 } }, // center ~(602,239)
    parts: [
      ...bounds(true),
      { type: "ball", x: 110, y: 90, role: "goalBall", editable: false },
    ],
    inventory: { trampoline: 1, ramp: 3, bumper: 1 },
  };

  // ---- Level 14: Relay (launch + bounce + carry, 3-stage chain) ----
  const b14 = basket(852);
  const L14 = {
    name: "14 · Relay",
    hint: "A real relay: launch the ball over the wall, then catch and carry it the rest of the way. One Cannon, one Trampoline, one Conveyor — chain them.",
    goal: { kind: "basket", role: "goalBall", zone: b14.zone },
    parts: [
      ...bounds(true),
      ...b14.walls,
      { type: "ball", x: 110, y: 110, role: "goalBall", editable: false },
      { type: "block", x: 470, y: 440, w: 44, h: 260, editable: false }, // divider, top ~y310
      // a pit lip so the ball can't just roll along the floor on the far side
      { type: "block", x: 690, y: 506, w: 40, h: 130, editable: false },
    ],
    inventory: { cannon: 1, trampoline: 1, conveyor: 1, ramp: 2 },
  };

  // ---- Level 15: The Long Haul (hardest — build a long slide past a wall to a far hoop) ----
  const b15 = basket(872);
  const L15 = {
    name: "15 · The Long Haul",
    hint: "The hoop's all the way over there, with a wall in the way. Build one long slide of Planks — weave the ball down, under the wall, and all the way across into the hoop. It takes the whole bin.",
    goal: { kind: "basket", role: "goalBall", zone: b15.zone },
    parts: [
      ...bounds(true),
      ...b15.walls,
      { type: "ball", x: 80, y: 70, role: "goalBall", editable: false },
      { type: "block", x: 620, y: 205, w: 40, h: 360, editable: false },  // wall x600..640, y25..385 (floor gap below)
    ],
    inventory: { ramp: 8, trampoline: 1, conveyor: 1, bumper: 1 },
  };

  // ---- Level 16: Threading the Needle (brutal — over-constrained precision bounce) ----
  const b16 = basket(800);
  const L16 = {
    name: "16 · Threading the Needle",
    hint: "Two narrow slots stand between the ball and the hoop. With ONE Trampoline, tilt and place it so a single bounce threads BOTH slots and drops in. Tilt sets the aim; height sets the reach. Millimeters matter.",
    goal: { kind: "basket", role: "goalBall", zone: b16.zone },
    parts: [
      ...bounds(true),
      ...b16.walls,
      { type: "ball", x: 150, y: 60, role: "goalBall", editable: false },
      // slot 1 (threaded on the way down) at x350
      { type: "block", x: 350, y: 90, w: 34, h: 192, editable: false },   // top x333..367, y-6..186
      { type: "block", x: 350, y: 417, w: 34, h: 346, editable: false },  // bottom y244..590; slot 1 y186..244 (58px)
      // slot 2 (threaded on the way down) at x520
      { type: "block", x: 520, y: 100, w: 36, h: 212, editable: false },  // top  x502..538, y-6..206
      { type: "block", x: 520, y: 421, w: 36, h: 330, editable: false },  // bottom y256..586; slot 2 y206..256 (50px)
    ],
    inventory: { trampoline: 1 },
  };

  // ---- Level 17: Relay Race (multi-step: slide -> drop onto trampoline -> bounce over wall -> slide in) ----
  const L17 = {
    name: "17 · Relay Race",
    hint: "Three legs: slide the ball off the shelf onto a Trampoline, bounce it over the wall, then ramp it the rest of the way into the ring. Plan the whole machine before you press Run.",
    goal: { kind: "ring", role: "goalBall", zone: { x: 778, y: 496, w: 84, h: 72 } }, // floor-level ring, right
    parts: [
      ...bounds(true),
      { type: "ball", x: 110, y: 80, role: "goalBall", editable: false },
      { type: "block", x: 175, y: 250, w: 250, h: 18, editable: false }, // start shelf: x50..300, top y241
      { type: "block", x: 520, y: 486, w: 40, h: 180, editable: false }, // low wall: x500..540, top y396
    ],
    inventory: { trampoline: 1, ramp: 5 },
  };

  // ---- Level 18: Switchback Relay (multi-step: slide -> bounce over wall -> long slide to far ring) ----
  const L18 = {
    name: "18 · Switchback Relay",
    hint: "Same plan, longer machine, tighter budget. Slide off the shelf onto a Trampoline, bounce over the wall, then build a ramp run all the way across to the ring in the far corner.",
    goal: { kind: "ring", role: "goalBall", zone: { x: 820, y: 496, w: 84, h: 72 } },
    parts: [
      ...bounds(true),
      { type: "ball", x: 110, y: 80, role: "goalBall", editable: false },
      { type: "block", x: 175, y: 250, w: 250, h: 18, editable: false }, // start shelf x50..300 top y241
      { type: "block", x: 470, y: 486, w: 40, h: 180, editable: false }, // wall x450..490 top y396
    ],
    inventory: { trampoline: 1, ramp: 5 },
  };

  // ---- Sandbox ----
  const SB = {
    name: "★ Sandbox",
    hint: "Free build — no goal, just tinker. Everything is unlimited-ish. Drop balls and watch the chaos.",
    goal: null,
    parts: [...bounds(true)],
    inventory: { ball: 6, ramp: 8, seesaw: 4, fan: 4, balloon: 4, conveyor: 4, trampoline: 4,
      cannon: 3, spinner: 3, domino: 8, crate: 5, bumper: 5, block: 6 },
  };

  window.LEVELS = [L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, L11, L12, L13, L14, L15, L16, L17, L18, SB];
})();
