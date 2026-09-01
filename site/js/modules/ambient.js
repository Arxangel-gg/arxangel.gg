/* ============================================================================
   ARXANGEL — modules/ambient.js
   ONE canvas, ONE rAF loop: rising gold embers + drifting dust + the rare
   comet, with gentle pointer parallax. Replaces the original site's three
   separate particle systems. Built for performance:
     • sprites are pre-rendered once (no per-frame shadowBlur)
     • DPR capped at 2, density scales to viewport area & device
     • "lighter" compositing at low opacity → soft bloom, cheap
     • pauses when the tab is hidden, throttles if FPS drops
   Only loaded when motion is allowed, data-saver is off, and not embedded.
   ========================================================================== */

import { clamp, rand } from "../env.js?v=3";

export function init() {
  const host = document.getElementById("ax-fx");
  if (!host) return;
  const canvas = document.createElement("canvas");
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const GOLD = [
    [255, 246, 218], // ivory-gold
    [229, 189, 109], // gold
    [188, 130, 61],  // amber
  ];

  // ---- Pre-rendered radial sprite (soft disc) ----------------------------
  const sprite = (rgb, r) => {
    const c = document.createElement("canvas");
    c.width = c.height = Math.ceil(r * 2);
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.9)`);
    grd.addColorStop(0.4, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.35)`);
    grd.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    g.fillStyle = grd; g.beginPath(); g.arc(r, r, r, 0, 6.283); g.fill();
    return c;
  };
  const sprites = GOLD.map((rgb) => sprite(rgb, 12 * DPR));

  let W = 0, H = 0, embers = [], target = 0;
  let mx = 0.5, my = 0.5, paused = false, raf = 0, last = performance.now(), fps = 60;

  const resize = () => {
    W = canvas.width = Math.floor(innerWidth * DPR);
    H = canvas.height = Math.floor(innerHeight * DPR);
    canvas.style.width = "100%"; canvas.style.height = "100%";
    const area = innerWidth * innerHeight;
    const mobile = Math.min(innerWidth, innerHeight) < 768;
    target = Math.round(clamp(area / 26000, 22, mobile ? 38 : 72));
  };

  const make = () => ({
    x: rand(0, W), y: rand(0, H + 40),
    vx: rand(-0.12, 0.12) * DPR,
    vy: rand(-0.5, -0.12) * DPR,       // rise
    r: rand(0.5, 2.4) * DPR,
    a: rand(0.3, 0.95),
    spr: (Math.random() * sprites.length) | 0,   // which gold tone
    tw: rand(0.004, 0.02),             // twinkle speed
    t: rand(0, 6.28),
  });

  // ---- Comets (rare diagonal streaks) ------------------------------------
  let comets = [], cometTimer = 0;
  const makeComet = () => {
    const speed = rand(380, 620) * DPR;
    return { x: rand(W * 0.3, W + 50), y: rand(-40, H * 0.4), vx: -speed, vy: speed * 0.55, life: rand(0.5, 0.9), t: 0 };
  };

  const step = (now) => {
    if (paused) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    fps = fps * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1;
    const skip = fps < 30 ? 2 : 1;

    while (embers.length < target) embers.push(make());

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    const parX = (mx - 0.5) * 18 * DPR, parY = (my - 0.5) * 10 * DPR;

    for (let i = 0; i < embers.length; i += skip) {
      const p = embers[i];
      p.t += p.tw;
      p.x += p.vx + Math.sin(p.t) * 0.15 * DPR;
      p.y += p.vy;
      if (p.y < -30) { p.y = H + rand(10, 60); p.x = rand(0, W); }
      if (p.x < -30) p.x = W + 20; else if (p.x > W + 30) p.x = -20;

      const s = sprites[p.spr];
      const sz = s.width * (p.r / (2.0 * DPR)) * 1.6;
      const tw = 0.55 + Math.sin(p.t) * 0.35;
      ctx.globalAlpha = 0.16 * p.a * tw;
      const dx = p.x + parX * (0.3 + p.a), dy = p.y + parY * (0.2 + p.a);
      ctx.drawImage(s, dx - sz / 2, dy - sz / 2, sz, sz);
    }

    // comets
    cometTimer += dt;
    if (cometTimer > rand(4, 9) && comets.length < 2) { comets.push(makeComet()); cometTimer = 0; }
    ctx.globalAlpha = 1;
    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];
      c.t += dt; if (c.t > c.life) { comets.splice(i, 1); continue; }
      c.x += c.vx * dt; c.y += c.vy * dt;
      const fade = 1 - c.t / c.life;
      const len = 120 * DPR;
      const grd = ctx.createLinearGradient(c.x, c.y, c.x + len, c.y - len * 0.55);
      grd.addColorStop(0, `rgba(255,246,218,${0.5 * fade})`);
      grd.addColorStop(1, "rgba(255,246,218,0)");
      ctx.strokeStyle = grd; ctx.lineWidth = 1.6 * DPR; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + len, c.y - len * 0.55); ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    raf = requestAnimationFrame(step);
  };

  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } };
  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

  resize();
  addEventListener("resize", resize, { passive: true });
  addEventListener("pointermove", (e) => { mx = e.clientX / innerWidth; my = e.clientY / innerHeight; }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    paused = document.hidden;
    if (paused) stop(); else start();
  }, { passive: true });

  start();
}
