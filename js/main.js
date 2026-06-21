/* ============================================================
   Contraption Lab — main.js
   Game loop, modes, custom forces, win detection, input, UI.
   ============================================================ */
(function () {
  "use strict";
  const { Engine, Composite, Body } = Matter;
  const PI2 = Math.PI * 2;
  const W = BOARD_W, H = BOARD_H;

  // tuning
  const WIND_LEN = 230, WIND_GAP = 18, WIND_ACCEL = 0.0024; // fan updraft (~2.4x gravity)
  const BUOY = 0.0017;        // balloon lift (slightly > gravity)
  const BELT_SPEED = 4.2;     // conveyor surface speed (px/step)
  const CANNON_SPEED = 15;    // launch velocity (px/step)
  const CANNON_REACH = 48;    // muzzle capture depth
  const SPIN_SPEED = 0.06;    // spinner angular velocity (rad/step)

  // ---------- DOM ----------
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const stage = document.getElementById("stage");
  const editbar = document.getElementById("editbar");
  const winOverlay = document.getElementById("winOverlay");
  const runBtn = document.getElementById("runBtn");
  const resetBtn = document.getElementById("resetBtn");
  const levelNameEl = document.getElementById("levelName");
  const levelHintEl = document.getElementById("levelHint");
  const levelSelect = document.getElementById("levelSelect");
  const binItemsEl = document.getElementById("binItems");
  const binTip = document.getElementById("binTip");

  // ---------- state ----------
  let engine = Engine.create();
  engine.gravity.y = 1;
  engine.positionIterations = 8;
  engine.velocityIterations = 8;

  let levelIndex = 0;
  let parts = [];            // descriptors; each may carry .body when simulating
  let inventory = {};        // type -> remaining count
  let mode = "build";        // 'build' | 'run' | 'won'
  let selectedId = null;
  let idCounter = 1;
  let drag = null;           // {mode:'bin',type} | {mode:'move',part,ox,oy}
  let pointer = { lx: 0, ly: 0, onCanvas: false };
  let winFrames = 0;
  let timeSec = 0, lastT = 0;
  let dpr = 1;
  const binItemEls = {};

  // ---------- canvas sizing ----------
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const availW = stage.clientWidth - 22, availH = stage.clientHeight - 22;
    const ar = W / H;
    let cssW = availW, cssH = cssW / ar;
    if (cssH > availH) { cssH = availH; cssW = cssH * ar; }
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    document.body.classList.toggle(
      "show-rotate",
      window.innerHeight > window.innerWidth && window.innerWidth < 600
    );
  }
  window.addEventListener("resize", resize);

  // ---------- level management ----------
  function clonePart(p) {
    const c = Object.assign({}, p);
    c.id = idCounter++;
    if (c.editable === undefined) c.editable = false;
    if (c.angle === undefined) c.angle = 0;
    if (c.type === "conveyor" && c.dir === undefined) c.dir = 1;
    delete c.body;
    return c;
  }

  function loadLevel(idx) {
    stopRun();
    levelIndex = (idx + LEVELS.length) % LEVELS.length;
    const lv = LEVELS[levelIndex];
    parts = lv.parts.map(clonePart);
    inventory = Object.assign({}, lv.inventory);
    selectedId = null;
    winFrames = 0;
    levelNameEl.textContent = lv.name;
    levelHintEl.textContent = lv.hint;
    levelSelect.value = String(levelIndex);
    binTip.textContent = lv.goal
      ? "Drag a part onto the board, click it to rotate/delete, then press Run."
      : "Free build — no goal. Drop balls and watch the chaos!";
    buildBin();
    hideEditbar();
    hideWin();
  }

  function currentGoal() { return LEVELS[levelIndex].goal; }

  // ---------- parts bin ----------
  function buildBin() {
    binItemsEl.innerHTML = "";
    for (const type in binItemEls) delete binItemEls[type];
    const order = ["ball", "ramp", "seesaw", "fan", "balloon", "conveyor", "trampoline",
      "cannon", "spinner", "domino", "crate", "bumper", "block"];
    const types = Object.keys(inventory).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    for (const type of types) {
      const item = document.createElement("div");
      item.className = "bin-item";
      const ic = document.createElement("canvas");
      ic.width = 46; ic.height = 40;
      drawBinIcon(ic.getContext("2d"), type);
      const name = document.createElement("div");
      name.className = "bin-name";
      name.textContent = PART_DEFS[type].label;
      const count = document.createElement("div");
      count.className = "count";
      item.appendChild(count);
      item.appendChild(ic);
      item.appendChild(name);
      item.addEventListener("pointerdown", (e) => onBinDown(e, type));
      binItemsEl.appendChild(item);
      binItemEls[type] = { el: item, count };
    }
    refreshBin();
  }

  function refreshBin() {
    for (const type in binItemEls) {
      const n = inventory[type] || 0;
      binItemEls[type].count.textContent = n;
      binItemEls[type].el.classList.toggle("depleted", n <= 0);
    }
  }

  // ---------- physics bodies ----------
  function buildBodies() {
    Composite.clear(engine.world, false);
    for (const p of parts) {
      if (p.type === "cannon") p._fired = new Set(); // re-arm each run
      const made = createBodies(p);
      if (made.bodies.length) Composite.add(engine.world, made.bodies);
      if (made.constraints.length) Composite.add(engine.world, made.constraints);
    }
  }
  function clearBodies() {
    Composite.clear(engine.world, false);
    for (const p of parts) delete p.body;
  }

  // ---------- run control ----------
  function startRun() {
    if (mode !== "build") return;
    selectedId = null;
    hideEditbar();
    buildBodies();
    mode = "run";
    winFrames = 0;
    runBtn.textContent = "■ Stop";
    runBtn.classList.add("running");
    hideWin();
  }
  function stopRun() {
    clearBodies();
    mode = "build";
    winFrames = 0;
    runBtn.textContent = "▶ Run";
    runBtn.classList.remove("running");
    hideWin();
  }
  function toggleRun() { if (mode === "build") startRun(); else stopRun(); }

  // ---------- custom forces ----------
  function applyForces() {
    const dyn = [];
    for (const p of parts) if (p.body && !p.body.isStatic) dyn.push(p.body);

    for (const p of parts) {
      if (!p.body) continue;
      const d = dims(p);

      if (p.type === "fan") {
        const dir = fanDir(p.body.angle);
        for (const b of dyn) {
          const lp = worldToLocal(p.body.position.x, p.body.position.y, p.body.angle, b.position.x, b.position.y);
          if (Math.abs(lp.x) < d.w * 0.55 && lp.y < -WIND_GAP && lp.y > -WIND_LEN) {
            const t = 1 - (-lp.y - WIND_GAP) / (WIND_LEN - WIND_GAP); // 1 near fan -> 0 far
            const F = WIND_ACCEL * b.mass * (0.45 + 0.55 * t);
            Body.applyForce(b, b.position, { x: dir.x * F, y: dir.y * F });
          }
        }
      } else if (p.type === "conveyor") {
        const sign = p.dir || 1;
        const ax = Math.cos(p.body.angle) * sign, ay = Math.sin(p.body.angle) * sign;
        for (const b of dyn) {
          const lp = worldToLocal(p.body.position.x, p.body.position.y, p.body.angle, b.position.x, b.position.y);
          if (Math.abs(lp.x) < d.w / 2 + 4 && lp.y < 2 && lp.y > -(d.h / 2 + 26)) {
            const along = b.velocity.x * ax + b.velocity.y * ay;
            const dv = BELT_SPEED - along;
            Body.setVelocity(b, { x: b.velocity.x + ax * dv, y: b.velocity.y + ay * dv });
          }
        }
      } else if (p.type === "balloon") {
        Body.applyForce(p.body, p.body.position, { x: 0, y: -BUOY * p.body.mass });
      } else if (p.type === "cannon") {
        if (!p._fired) p._fired = new Set();
        const dir = fanDir(p.body.angle); // barrel faces local "up"
        for (const b of dyn) {
          const lp = worldToLocal(p.body.position.x, p.body.position.y, p.body.angle, b.position.x, b.position.y);
          if (Math.abs(lp.x) < d.w * 0.4 && lp.y < -(d.h / 2 - 6) && lp.y > -(d.h / 2 + CANNON_REACH)) {
            if (!p._fired.has(b.id)) { p._fired.add(b.id); Body.setVelocity(b, { x: dir.x * CANNON_SPEED, y: dir.y * CANNON_SPEED }); }
          }
        }
      } else if (p.type === "spinner") {
        Body.setAngularVelocity(p.body, (p.spin || 1) * SPIN_SPEED);
      }
    }
  }

  // ---------- win detection ----------
  function goalPartBody() {
    const g = currentGoal();
    if (!g) return null;
    const gp = parts.find((p) => p.role === g.role);
    return gp ? gp.body : null;
  }
  function checkWin() {
    const g = currentGoal();
    if (!g) return;
    const b = goalPartBody();
    if (!b) return;
    const z = g.zone;
    const inside = b.position.x > z.x && b.position.x < z.x + z.w &&
                   b.position.y > z.y && b.position.y < z.y + z.h;
    const need = g.kind === "ring" ? 6 : 12;
    if (inside) { if (++winFrames >= need) doWin(); }
    else winFrames = 0;
  }
  function doWin() {
    mode = "won";
    runBtn.textContent = "▶ Run";
    runBtn.classList.remove("running");
    document.getElementById("winTitle").textContent =
      levelIndex >= LEVELS.length - 2 ? "Brilliant!" : "Solved!";
    document.getElementById("winSub").textContent =
      "Your contraption works. " + (currentGoal().kind === "ring" ? "Right on target." : "Nothing but net.");
    const nextBtn = document.getElementById("winNextBtn");
    nextBtn.style.display = levelIndex >= LEVELS.length - 1 ? "none" : "";
    winOverlay.classList.remove("hidden");
  }

  // ---------- main loop ----------
  function frame(now) {
    if (!lastT) lastT = now;
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    timeSec += dt;

    if (mode === "run") {
      applyForces();
      Engine.update(engine, 1000 / 60);
      checkWin();
    }
    render();
    requestAnimationFrame(frame);
  }

  // ---------- rendering ----------
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();

    const g = currentGoal();
    if (g) { if (g.kind === "ring") drawRingGoal(g.zone); else drawBasketGoal(g.zone); }

    for (const p of parts) {
      if (p.hidden) continue;
      let x, y, ang;
      if (mode !== "build" && p.body) { x = p.body.position.x; y = p.body.position.y; ang = p.body.angle; }
      else { x = p.x; y = p.y; ang = p.angle || 0; }
      drawPart(ctx, p, x, y, ang, timeSec, p.id === selectedId && mode === "build");
    }

    // ghost while dragging a new part from the bin
    if (drag && drag.mode === "bin" && pointer.onCanvas) {
      ctx.globalAlpha = 0.6;
      const ghost = { type: drag.type, dir: 1 };
      drawPart(ctx, ghost, pointer.lx, pointer.ly, 0, timeSec, false);
      ctx.globalAlpha = 1;
    }

    updateEditbar();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#f7ecd2"); g.addColorStop(1, "#e9d6ad");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // pegboard holes
    ctx.fillStyle = "rgba(120,85,45,.08)";
    for (let y = 26; y < H - 40; y += 34) {
      for (let x = 26; x < W; x += 34) {
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, PI2); ctx.fill();
      }
    }
    // vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(60,39,19,.18)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  function drawBasketGoal(z) {
    const cx = z.x + z.w / 2, top = z.y, floor = z.y + z.h + 2;
    // posts
    ctx.fillStyle = "#9c3a16";
    ctx.beginPath(); ctx.roundRect(z.x - 6, top, 8, floor - top, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(z.x + z.w - 2, top, 8, floor - top, 3); ctx.fill();
    // net
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.4;
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      ctx.beginPath();
      ctx.moveTo(z.x + t * z.w, top + 4);
      ctx.lineTo(cx + (t - 0.5) * z.w * 0.45, floor - 2);
      ctx.stroke();
    }
    for (let r = 0; r < 3; r++) {
      const yy = top + 4 + (floor - top - 6) * (r / 3);
      const ww = z.w * (1 - r * 0.16);
      ctx.beginPath(); ctx.moveTo(cx - ww / 2, yy); ctx.lineTo(cx + ww / 2, yy); ctx.stroke();
    }
    // rim
    ctx.strokeStyle = "#e8632c"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(cx, top, z.w / 2 + 4, 7, 0, 0, PI2); ctx.stroke();
    ctx.strokeStyle = "#ffae7a"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(cx, top - 1.5, z.w / 2 + 4, 6, 0, 0, PI2); ctx.stroke();
  }

  function drawRingGoal(z) {
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2, r = z.w / 2;
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3);
    const hot = winFrames > 0;
    ctx.save();
    ctx.lineWidth = 6;
    ctx.shadowColor = "#f2a93b";
    ctx.shadowBlur = 12 + 10 * pulse;
    ctx.strokeStyle = hot ? "#ffe08a" : `rgba(242,169,59,${0.55 + 0.4 * pulse})`;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r - 6, 0, PI2); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = hot ? "rgba(255,224,138,.9)" : "rgba(242,169,59,.85)";
    ctx.font = "bold 11px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TARGET", cx, cy + r + 16);
    ctx.textAlign = "left";
  }

  // ---------- editbar ----------
  function selectedPart() {
    return mode === "build" ? parts.find((p) => p.id === selectedId && p.editable) : null;
  }
  function updateEditbar() {
    const sel = selectedPart();
    if (!sel) { hideEditbar(); return; }
    const cr = canvas.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    const px = cr.left - sr.left + (sel.x / W) * cr.width;
    const py = cr.top - sr.top + (sel.y / H) * cr.height;
    editbar.style.left = px + "px";
    editbar.style.top = py + "px";
    editbar.classList.remove("hidden");
  }
  function hideEditbar() { editbar.classList.add("hidden"); }

  // ---------- win overlay ----------
  function hideWin() { winOverlay.classList.add("hidden"); }

  // ---------- hit testing ----------
  function pointInPart(p, lx, ly) {
    const d = dims(p);
    if (p.type === "ball" || p.type === "balloon" || p.type === "bumper") {
      return Math.hypot(lx - p.x, ly - p.y) <= d.r + 6;
    }
    const lp = worldToLocal(p.x, p.y, p.angle || 0, lx, ly);
    return Math.abs(lp.x) <= d.w / 2 + 6 && Math.abs(lp.y) <= d.h / 2 + 8;
  }
  function pickPart(lx, ly) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (!p.editable || p.hidden) continue;
      if (pointInPart(p, lx, ly)) return p;
    }
    return null;
  }

  // ---------- pointer input ----------
  function setPointer(e) {
    const r = canvas.getBoundingClientRect();
    pointer.lx = ((e.clientX - r.left) / r.width) * W;
    pointer.ly = ((e.clientY - r.top) / r.height) * H;
    pointer.onCanvas = pointer.lx >= 0 && pointer.lx <= W && pointer.ly >= 0 && pointer.ly <= H;
  }
  const clampX = (x) => Math.max(16, Math.min(W - 16, x));
  const clampY = (y) => Math.max(16, Math.min(H - 16, y));

  function onBinDown(e, type) {
    if (mode !== "build") return;
    if ((inventory[type] || 0) <= 0) return;
    drag = { mode: "bin", type };
    setPointer(e);
    e.preventDefault();
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (mode !== "build") return;
    setPointer(e);
    const hit = pickPart(pointer.lx, pointer.ly);
    if (hit) {
      selectedId = hit.id;
      drag = { mode: "move", part: hit, ox: pointer.lx - hit.x, oy: pointer.ly - hit.y };
    } else {
      selectedId = null;
    }
    e.preventDefault();
  });

  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    setPointer(e);
    if (drag.mode === "move") {
      drag.part.x = clampX(pointer.lx - drag.ox);
      drag.part.y = clampY(pointer.ly - drag.oy);
    }
  });

  window.addEventListener("pointerup", (e) => {
    if (!drag) return;
    setPointer(e);
    if (drag.mode === "bin" && pointer.onCanvas && (inventory[drag.type] || 0) > 0) {
      const p = clonePart({ type: drag.type, x: clampX(pointer.lx), y: clampY(pointer.ly), editable: true });
      parts.push(p);
      inventory[drag.type]--;
      selectedId = p.id;
      refreshBin();
    }
    drag = null;
  });

  // ---------- edit actions ----------
  function rotateSelected(dir) {
    const sel = selectedPart();
    if (!sel) return;
    sel.angle = (sel.angle || 0) + dir * 0.13;
  }
  function deleteSelected() {
    const sel = selectedPart();
    if (!sel) return;
    parts = parts.filter((p) => p.id !== sel.id);
    if (inventory[sel.type] !== undefined) inventory[sel.type]++;
    selectedId = null;
    refreshBin();
    hideEditbar();
  }
  editbar.addEventListener("pointerdown", (e) => {
    const act = e.target.getAttribute("data-act");
    if (!act) return;
    if (act === "rotL") rotateSelected(-1);
    else if (act === "rotR") rotateSelected(1);
    else if (act === "del") deleteSelected();
    e.preventDefault();
    e.stopPropagation();
  });

  // ---------- keyboard ----------
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "SELECT") return;
    if (e.code === "Space") { e.preventDefault(); toggleRun(); }
    else if (e.key === "q" || e.key === "Q") rotateSelected(-1);
    else if (e.key === "e" || e.key === "E" || e.key === "r" || e.key === "R") rotateSelected(1);
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); }
    else if (e.key === "Escape") { selectedId = null; hideEditbar(); }
  });

  // ---------- button wiring ----------
  runBtn.addEventListener("click", toggleRun);
  resetBtn.addEventListener("click", () => loadLevel(levelIndex));
  document.getElementById("prevLevel").addEventListener("click", () => loadLevel(levelIndex - 1));
  document.getElementById("nextLevel").addEventListener("click", () => loadLevel(levelIndex + 1));
  document.getElementById("replayBtn").addEventListener("click", () => stopRun());
  document.getElementById("winNextBtn").addEventListener("click", () => loadLevel(levelIndex + 1));
  levelSelect.addEventListener("change", () => loadLevel(parseInt(levelSelect.value, 10)));

  // ---------- init ----------
  function init() {
    LEVELS.forEach((lv, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = lv.name;
      levelSelect.appendChild(opt);
    });
    resize();
    loadLevel(0);
    requestAnimationFrame(frame);
  }
  init();
})();
