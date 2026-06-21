/* ============================================================
   Contraption Lab — parts.js
   Part definitions: metadata, cartoon rendering, physics factories.
   ============================================================ */

const { Bodies, Body, Constraint } = Matter;

/* roundRect polyfill — iOS Safari < 16.4 lacks it and will crash otherwise */
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (typeof r === "number") r = { tl: r, tr: r, br: r, bl: r };
    else r = { tl: r[0], tr: r[1], br: r[2], bl: r[3] };
    this.beginPath();
    this.moveTo(x + r.tl, y);
    this.arcTo(x + w, y, x + w, y + h, r.tr);
    this.arcTo(x + w, y + h, x, y + h, r.br);
    this.arcTo(x, y + h, x, y, r.bl);
    this.arcTo(x, y, x + w, y, r.tl);
    this.closePath();
    return this;
  };
}

const PAL = {
  wood: "#b5793a", woodDk: "#8a5a28", woodLt: "#d8a763", grain: "#7a4f28",
  steel: "#c2cad4", steelDk: "#7c8794", steelHi: "#eef2f6",
  paintBlue: "#5b8fb0", paintBlueDk: "#3d6c8a",
  basket: "#e8632c", basketDk: "#b8431a", basketLine: "#7a2a0e",
  balloon: "#e23b4e", balloonDk: "#a82235", balloonHi: "#ff8b96",
  belt: "#39414b", beltDk: "#22282f", beltStripe: "#f2a93b",
  tramp: "#5cc05c", trampDk: "#2f8a3a", spring: "#9aa3ad",
  bolt: "#5a4630", shadow: "rgba(0,0,0,.18)",
  accent: "#e8632c", accent2: "#f2a93b",
  domino: "#fbf3e0", dominoEdge: "#b8a273", dominoPip: "#5a4630",
};

/* type -> definition. dims are the unrotated size. */
const PART_DEFS = {
  ball:     { label: "Ball",      kind: "dynamic", r: 17 },
  ramp:     { label: "Plank",     kind: "static",  w: 150, h: 16, rotatable: true },
  seesaw:   { label: "Seesaw",    kind: "pivot",   w: 168, h: 15, rotatable: true },
  fan:      { label: "Fan",       kind: "static",  w: 64,  h: 54, rotatable: true },
  balloon:  { label: "Balloon",   kind: "dynamic", r: 20 },
  conveyor: { label: "Conveyor",  kind: "static",  w: 150, h: 26, rotatable: true },
  trampoline:{label: "Trampoline",kind: "static",  w: 120, h: 20, rotatable: true },
  cannon:   { label: "Cannon",    kind: "static",  w: 58,  h: 44, rotatable: true },
  spinner:  { label: "Spinner",   kind: "pivot",   w: 124, h: 14, rotatable: true },
  domino:   { label: "Domino",    kind: "dynamic", w: 16,  h: 72, rotatable: true },
  crate:    { label: "Crate",     kind: "dynamic", w: 46,  h: 46, rotatable: true },
  bumper:   { label: "Bumper",    kind: "static",  r: 22 },
  block:    { label: "Wall",      kind: "static",  w: 120, h: 26, rotatable: true }, // mostly level geometry
};

/* ---------- helpers ---------- */
function dims(part) {
  const d = PART_DEFS[part.type];
  return { w: part.w ?? d.w, h: part.h ?? d.h, r: part.r ?? d.r };
}

// rotate a world point into a part's local frame
function worldToLocal(cx, cy, ang, px, py) {
  const dx = px - cx, dy = py - cy, a = -ang;
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
}

// unit vector the fan blows toward, in world space (local "up" = -y)
function fanDir(ang) { return { x: Math.sin(ang), y: -Math.cos(ang) }; }
// unit vector along a belt's surface, in world space (local +x), times its direction sign
function beltDir(ang, sign) { return { x: Math.cos(ang) * sign, y: Math.sin(ang) * sign }; }

/* ============================================================
   Physics body factories
   Returns { bodies:[], constraints:[], main } and links part.body = main
   ============================================================ */
function createBodies(part) {
  const d = dims(part);
  const x = part.x, y = part.y, ang = part.angle || 0;
  let bodies = [], constraints = [], main = null;

  switch (part.type) {
    case "ball": {
      main = Bodies.circle(x, y, d.r, {
        restitution: 0.36, friction: 0.02, frictionAir: 0.001, density: 0.0017, label: "ball",
      });
      bodies = [main];
      break;
    }
    case "balloon": {
      main = Bodies.circle(x, y, d.r, {
        restitution: 0.3, friction: 0.02, frictionAir: 0.05, density: 0.00035, label: "balloon",
      });
      bodies = [main];
      break;
    }
    case "ramp":
    case "block":
    case "fan":
    case "conveyor":
    case "cannon":
    case "trampoline": {
      const opts = { isStatic: true, angle: ang, label: part.type };
      // NOTE: Matter zeroes restitution on static bodies, so the trampoline's
      // bounce is applied by hand in main.js applyForces(), not via restitution here.
      if (part.type === "trampoline") { opts.friction = 0.2; }
      else if (part.type === "ramp") opts.friction = 0.14;
      else if (part.type === "block") opts.friction = 0.5;
      else opts.friction = 0.4;
      main = Bodies.rectangle(x, y, d.w, d.h, opts);
      bodies = [main];
      break;
    }
    case "seesaw": {
      main = Bodies.rectangle(x, y, d.w, d.h, {
        angle: ang, friction: 0.5, frictionAir: 0.06, density: 0.0032, label: "seesaw",
      });
      const pivot = Constraint.create({
        pointA: { x, y }, bodyB: main, pointB: { x: 0, y: 0 },
        length: 0, stiffness: 1, damping: 0.3,
      });
      part.pivotX = x; part.pivotY = y;
      bodies = [main]; constraints = [pivot];
      break;
    }
    case "bumper": {
      main = Bodies.circle(x, y, d.r, { isStatic: true, restitution: 1.06, friction: 0, label: "bumper" });
      bodies = [main];
      break;
    }
    case "domino":
    case "crate": {
      const isCrate = part.type === "crate";
      main = Bodies.rectangle(x, y, d.w, d.h, {
        angle: ang, friction: isCrate ? 0.55 : 0.45, frictionAir: 0.001,
        density: isCrate ? 0.006 : 0.0024, label: part.type,
      });
      bodies = [main];
      break;
    }
    case "spinner": {
      main = Bodies.rectangle(x, y, d.w, d.h, {
        angle: ang, frictionAir: 0, density: 0.0022, label: "spinner",
      });
      const pivot = Constraint.create({
        pointA: { x, y }, bodyB: main, pointB: { x: 0, y: 0 }, length: 0, stiffness: 1,
      });
      part.pivotX = x; part.pivotY = y;
      bodies = [main]; constraints = [pivot];
      break;
    }
  }
  if (main) { main.plPart = part; part.body = main; }
  return { bodies, constraints, main };
}

/* ============================================================
   Rendering — each draws centered at (x,y) rotated by ang
   t = seconds (for animation), selected = highlight
   ============================================================ */
function drawPart(ctx, part, x, y, ang, t, selected) {
  const d = dims(part);
  ctx.save();
  ctx.translate(x, y);

  if (selected) {
    ctx.save();
    ctx.rotate(ang);
    ctx.strokeStyle = "rgba(232,99,44,.9)";
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    const pad = 9;
    if (part.type === "ball" || part.type === "balloon" || part.type === "bumper") {
      ctx.beginPath(); ctx.arc(0, 0, d.r + pad, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.strokeRect(-d.w / 2 - pad, -d.h / 2 - pad, d.w + pad * 2, d.h + pad * 2);
    }
    ctx.restore();
  }

  ctx.rotate(ang);
  switch (part.type) {
    case "ball": drawBall(ctx, d.r, part.role); break;
    case "balloon": drawBalloon(ctx, d.r, t); break;
    case "ramp": drawPlank(ctx, d.w, d.h, false); break;
    case "block": drawBlock(ctx, d.w, d.h); break;
    case "seesaw": drawPlank(ctx, d.w, d.h, true); break;
    case "fan": drawFan(ctx, d.w, d.h, t); break;
    case "conveyor": drawConveyor(ctx, d.w, d.h, part.dir || 1, t); break;
    case "trampoline": drawTrampoline(ctx, d.w, d.h); break;
    case "cannon": drawCannon(ctx, d.w, d.h); break;
    case "spinner": drawSpinner(ctx, d.w, d.h); break;
    case "domino": drawDomino(ctx, d.w, d.h); break;
    case "crate": drawCrate(ctx, d.w, d.h); break;
    case "bumper": drawBumper(ctx, d.r, t); break;
  }
  ctx.restore();

  // seesaw fulcrum drawn upright at pivot (center stays put while plank tilts)
  if (part.type === "seesaw") drawFulcrum(ctx, x, y, d.w);
}

function shade(ctx, w, h) {
  ctx.fillStyle = PAL.shadow;
  ctx.beginPath(); ctx.ellipse(0, h / 2 + 3, w / 2, 5, 0, 0, Math.PI * 2); ctx.fill();
}

function drawBall(ctx, r, role) {
  if (role === "goalBall") {
    // basketball
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.2, 0, 0, r);
    g.addColorStop(0, "#ff9a4d"); g.addColorStop(1, PAL.basketDk);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = PAL.basketLine; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
    ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
    ctx.beginPath(); ctx.arc(-r * 1.1, 0, r * 0.9, -0.7, 0.7); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 1.1, 0, r * 0.9, Math.PI - 0.7, Math.PI + 0.7); ctx.stroke();
  } else {
    // steel pinball
    const g = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.15, 0, 0, r);
    g.addColorStop(0, PAL.steelHi); g.addColorStop(0.5, PAL.steel); g.addColorStop(1, PAL.steelDk);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2); ctx.fill();
  }
}

function woodGrad(ctx, w, h, light) {
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  if (light) { g.addColorStop(0, PAL.paintBlue); g.addColorStop(0.5, "#6fa3c4"); g.addColorStop(1, PAL.paintBlueDk); }
  else { g.addColorStop(0, PAL.woodLt); g.addColorStop(0.45, PAL.wood); g.addColorStop(1, PAL.woodDk); }
  return g;
}

function drawPlank(ctx, w, h, painted) {
  shade(ctx, w, h);
  ctx.fillStyle = woodGrad(ctx, w, h, painted);
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2.5); ctx.fill();
  ctx.strokeStyle = painted ? PAL.paintBlueDk : PAL.grain; ctx.lineWidth = 1.4; ctx.stroke();
  // grain
  ctx.strokeStyle = painted ? "rgba(255,255,255,.18)" : "rgba(122,79,40,.5)";
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 8, i * h * 0.22);
    ctx.lineTo(w / 2 - 8, i * h * 0.22);
    ctx.stroke();
  }
  // end bolts
  ctx.fillStyle = PAL.bolt;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * (w / 2 - 9), 0, 2.6, 0, Math.PI * 2); ctx.fill(); }
}

function drawBlock(ctx, w, h) {
  shade(ctx, w, h);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, "#6e4a24"); g.addColorStop(1, "#4a3016");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 5); ctx.fill();
  ctx.strokeStyle = "#34220f"; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,.22)"; ctx.lineWidth = 1.5;
  for (let gx = -w / 2 + 26; gx < w / 2; gx += 26) {
    ctx.beginPath(); ctx.moveTo(gx, -h / 2 + 3); ctx.lineTo(gx, h / 2 - 3); ctx.stroke();
  }
}

function drawFulcrum(ctx, x, y, w) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = PAL.steelDk;
  ctx.beginPath();
  ctx.moveTo(0, -2); ctx.lineTo(w * 0.16, w * 0.16); ctx.lineTo(-w * 0.16, w * 0.16); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#4a525c"; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = PAL.bolt;
  ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFan(ctx, w, h, t) {
  shade(ctx, w, h);
  // wind hint (local up)
  ctx.fillStyle = "rgba(120,180,220,.16)";
  ctx.beginPath();
  ctx.moveTo(-w * 0.32, -h * 0.3); ctx.lineTo(w * 0.32, -h * 0.3);
  ctx.lineTo(w * 0.55, -h * 2.4); ctx.lineTo(-w * 0.55, -h * 2.4); ctx.closePath();
  ctx.fill();
  // housing
  ctx.fillStyle = PAL.steelDk;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h * 0.18, w, h * 0.7, 6); ctx.fill();
  ctx.strokeStyle = "#4a525c"; ctx.lineWidth = 2; ctx.stroke();
  // spinning blades
  ctx.save();
  ctx.translate(0, -h * 0.05);
  ctx.rotate(t * 9);
  ctx.fillStyle = PAL.steel;
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.22, h * 0.1, h * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = PAL.bolt;
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBalloon(ctx, r, t) {
  const bob = Math.sin(t * 2) * 1.5;
  ctx.save();
  ctx.translate(0, bob);
  // string
  ctx.strokeStyle = "#caa15f"; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, r);
  ctx.quadraticCurveTo(r * 0.4, r + 12, -r * 0.2, r + 24);
  ctx.stroke();
  // body
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.2, 0, 0, r * 1.1);
  g.addColorStop(0, PAL.balloonHi); g.addColorStop(0.6, PAL.balloon); g.addColorStop(1, PAL.balloonDk);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.92, r * 1.05, 0, 0, Math.PI * 2); ctx.fill();
  // knot
  ctx.fillStyle = PAL.balloonDk;
  ctx.beginPath(); ctx.moveTo(-3, r * 0.96); ctx.lineTo(3, r * 0.96); ctx.lineTo(0, r * 1.16); ctx.closePath(); ctx.fill();
  // highlight
  ctx.fillStyle = "rgba(255,255,255,.5)";
  ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.4, r * 0.16, r * 0.24, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawConveyor(ctx, w, h, dir, t) {
  shade(ctx, w, h);
  // rollers
  ctx.fillStyle = PAL.steelDk;
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.arc(sx * (w / 2 - h / 2), 0, h / 2, 0, Math.PI * 2); ctx.fill();
  }
  // belt
  ctx.fillStyle = PAL.belt;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = PAL.beltDk; ctx.lineWidth = 2; ctx.stroke();
  // scrolling chevrons
  ctx.save();
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.clip();
  ctx.strokeStyle = PAL.beltStripe; ctx.lineWidth = 3; ctx.lineCap = "round";
  const spacing = 26, off = (t * 60 * dir) % spacing;
  for (let gx = -w / 2 - spacing + off; gx < w / 2 + spacing; gx += spacing) {
    ctx.beginPath();
    ctx.moveTo(gx, -h * 0.22);
    ctx.lineTo(gx + dir * 7, 0);
    ctx.lineTo(gx, h * 0.22);
    ctx.stroke();
  }
  ctx.restore();
  // roller hubs
  ctx.fillStyle = PAL.bolt;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * (w / 2 - h / 2), 0, 3, 0, Math.PI * 2); ctx.fill(); }
}

function drawTrampoline(ctx, w, h) {
  shade(ctx, w, h);
  // legs
  ctx.strokeStyle = PAL.steelDk; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 8, 0); ctx.lineTo(-w / 2 + 2, h / 2 + 6);
  ctx.moveTo(w / 2 - 8, 0); ctx.lineTo(w / 2 - 2, h / 2 + 6);
  ctx.stroke();
  // springs
  ctx.strokeStyle = PAL.spring; ctx.lineWidth = 2;
  for (let gx = -w / 2 + 14; gx <= w / 2 - 14; gx += 16) {
    ctx.beginPath(); ctx.moveTo(gx, -h / 2 + 3); ctx.lineTo(gx, h / 2 - 3); ctx.stroke();
  }
  // mat
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, PAL.tramp); g.addColorStop(1, PAL.trampDk);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h * 0.55, h / 3); ctx.fill();
  ctx.strokeStyle = PAL.trampDk; ctx.lineWidth = 2; ctx.stroke();
}

function drawCannon(ctx, w, h) {
  shade(ctx, w, h);
  // wheeled base
  ctx.fillStyle = PAL.woodDk;
  ctx.beginPath(); ctx.arc(0, h * 0.32, h * 0.44, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#3c2713"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = PAL.bolt;
  ctx.beginPath(); ctx.arc(0, h * 0.32, 4, 0, Math.PI * 2); ctx.fill();
  // barrel (points local up = launch direction)
  const bw = w * 0.44, bl = h * 1.3;
  const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
  g.addColorStop(0, "#454d57"); g.addColorStop(0.5, PAL.steel); g.addColorStop(1, "#454d57");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(-bw / 2, -bl, bw, bl + h * 0.18, 5); ctx.fill();
  ctx.strokeStyle = "#2e343b"; ctx.lineWidth = 2; ctx.stroke();
  // muzzle
  ctx.fillStyle = "#14171a";
  ctx.beginPath(); ctx.ellipse(0, -bl, bw / 2 - 1, 5, 0, 0, Math.PI * 2); ctx.fill();
}

function drawSpinner(ctx, w, h) {
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, "#cfd6df"); g.addColorStop(0.5, PAL.steel); g.addColorStop(1, PAL.steelDk);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = "#4a525c"; ctx.lineWidth = 1.5; ctx.stroke();
  // accent paddle caps
  ctx.fillStyle = PAL.accent;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * (w / 2 - h * 0.7), 0, h * 0.6, 0, Math.PI * 2); ctx.fill(); }
  // hub
  ctx.fillStyle = PAL.steelDk;
  ctx.beginPath(); ctx.arc(0, 0, h * 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PAL.bolt;
  ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
}

function drawDomino(ctx, w, h) {
  shade(ctx, w, h);
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, PAL.domino); g.addColorStop(1, "#e3d4b3");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 4); ctx.fill();
  ctx.strokeStyle = PAL.dominoEdge; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-w / 2 + 3, 0); ctx.lineTo(w / 2 - 3, 0); ctx.stroke();
  ctx.fillStyle = PAL.dominoPip;
  ctx.beginPath(); ctx.arc(0, -h * 0.26, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, h * 0.26, 2.6, 0, Math.PI * 2); ctx.fill();
}

function drawCrate(ctx, w, h) {
  shade(ctx, w, h);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, PAL.woodLt); g.addColorStop(1, PAL.woodDk);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 4); ctx.fill();
  ctx.strokeStyle = PAL.grain; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 3, -h / 2 + 3); ctx.lineTo(w / 2 - 3, h / 2 - 3);
  ctx.moveTo(w / 2 - 3, -h / 2 + 3); ctx.lineTo(-w / 2 + 3, h / 2 - 3);
  ctx.stroke();
}

function drawBumper(ctx, r, t) {
  shade(ctx, r * 2, r * 2);
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  ctx.fillStyle = PAL.accent;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#b8431a"; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = `rgba(255,224,138,${0.4 + 0.5 * pulse})`; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, Math.PI * 2); ctx.stroke();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r * 0.55);
  g.addColorStop(0, "#ffffff"); g.addColorStop(1, PAL.accent2);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
}

/* Small icon used in the parts bin (own mini canvas, ~46x40) */
function drawBinIcon(ctx, type) {
  ctx.clearRect(0, 0, 46, 40);
  ctx.save();
  ctx.translate(23, 21);
  const fake = { type, role: type === "ball" ? null : null };
  const scale = { ball: 1, balloon: 0.8, ramp: 0.26, seesaw: 0.24, fan: 0.62,
    conveyor: 0.26, trampoline: 0.3, block: 0.3,
    cannon: 0.62, spinner: 0.3, domino: 0.5, crate: 0.7, bumper: 0.9 }[type] || 0.3;
  ctx.scale(scale, scale);
  // draw upright sample
  switch (type) {
    case "ball": drawBall(ctx, 17, null); break;
    case "balloon": drawBalloon(ctx, 20, 0); break;
    case "ramp": drawPlank(ctx, 150, 16, false); break;
    case "seesaw": drawPlank(ctx, 168, 15, true); break;
    case "fan": drawFan(ctx, 64, 54, 0); break;
    case "conveyor": drawConveyor(ctx, 150, 26, 1, 0); break;
    case "trampoline": drawTrampoline(ctx, 120, 20); break;
    case "cannon": drawCannon(ctx, 58, 44); break;
    case "spinner": drawSpinner(ctx, 124, 14); break;
    case "domino": drawDomino(ctx, 16, 72); break;
    case "crate": drawCrate(ctx, 46, 46); break;
    case "bumper": drawBumper(ctx, 22, 0); break;
    case "block": drawBlock(ctx, 120, 26); break;
  }
  ctx.restore();
}
