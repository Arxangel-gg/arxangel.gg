/* ============================================================
   ARXAIM — Precision Aim Trainer
   Plain JS, no dependencies. Runs from file:// or any static host.
   ============================================================ */
'use strict';

/* ============ helpers ============ */

const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
const easeOut = t => 1 - Math.pow(1 - t, 3);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/* ============ persistence ============ */

const SAVE_KEY = 'arxaim_v1';

function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; }
  catch (e) { return {}; }
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ settings, bests, history })); }
  catch (e) { /* storage unavailable (private mode etc.) — play on without saving */ }
}

const saveData = loadSave();
const settings = Object.assign(
  { duration: 60, targetScale: 1, volume: 0.6, xhair: 'cross', xhairColor: '#22d3ee' },
  saveData.settings || {}
);
const bests = saveData.bests || {};
let history = saveData.history || [];

/* ============ modes ============ */

const MODES = {
  gridshot:  { name: 'GRIDSHOT',  desc: 'Three targets up at all times. Clear them fast.',      color: '#a855f7', r: 42 },
  flick:     { name: 'FLICK',     desc: 'One target, always far away. Snap to it.',             color: '#22d3ee', r: 34 },
  precision: { name: 'PRECISION', desc: 'Tiny targets. Zero room for error.',                   color: '#f472b6', r: 14 },
  tracking:  { name: 'TRACKING',  desc: 'Keep your crosshair glued to a moving target.',        color: '#4ade80', r: 46 },
  reflex:    { name: 'REFLEX',    desc: 'Wait for it… then strike instantly.',             color: '#facc15', r: 38 },
};
const MODE_KEYS = Object.keys(MODES);

/* ============ audio (synthesized, zero asset files) ============ */

const audio = {
  ctx: null, gain: null,
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
      this.setVolume(settings.volume);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  setVolume(v) { if (this.gain) this.gain.gain.value = v * v; },
  tone(freq, dur = 0.08, type = 'sine', vol = 0.5, slide = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.gain);
    o.start(t); o.stop(t + dur + 0.02);
  },
  hit(streak) { this.tone(480 * Math.pow(2, Math.min(streak, 24) / 26), 0.07, 'triangle', 0.5); },
  miss()  { this.tone(130, 0.1, 'sawtooth', 0.25, -60); },
  early() { this.tone(220, 0.18, 'square', 0.3, -140); },
  count() { this.tone(560, 0.06, 'square', 0.35); },
  go()    { this.tone(920, 0.12, 'square', 0.4); },
  end()   { [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, 'triangle', 0.4), i * 90)); },
  best()  { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'triangle', 0.45), i * 110)); },
};

/* ============ canvas ============ */

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const MARGIN = 26;   // playfield edge margin
const TOP = 96;      // keep targets clear of the HUD
let W = 0, H = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const t of game.targets) {
    t.x = clamp(t.x, MARGIN + t.r, W - MARGIN - t.r);
    t.y = clamp(t.y, TOP + t.r, H - MARGIN - t.r);
  }
}

/* ============ game state ============ */

const game = {
  state: 'menu',          // menu | countdown | playing | paused | results
  mode: null,
  targets: [],
  fx: [],                 // particles, rings, floating texts
  elapsed: 0,             // seconds of actual play time (pause-safe clock)
  duration: 60,
  countT: 0,
  score: 0, scoreF: 0,
  hits: 0, misses: 0, streak: 0, bestStreak: 0,
  ttks: [],               // time-to-kill samples, ms (flick / precision / gridshot)
  reactions: [],          // reaction samples, ms (reflex)
  early: 0,
  trackOn: 0, trackTotal: 0,
  reflexPhase: 'wait', reflexAt: 0, reflexSpawned: 0,
  lastHit: null,
  mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
};

const bestKey = () => `${game.mode}_${game.duration}`;

/* ============ DOM refs ============ */

const el = {
  menu: $('#menu'), gameScreen: $('#game'),
  modeGrid: $('#modeGrid'), historyList: $('#historyList'),
  durSeg: $('#durSeg'), sizeSeg: $('#sizeSeg'), xhairSeg: $('#xhairSeg'),
  xhairColor: $('#xhairColor'), volRange: $('#volRange'), volVal: $('#volVal'),
  hudScore: $('#hudScore'), hudStreak: $('#hudStreak'), hudStreakWrap: $('#hudStreakWrap'),
  hudTime: $('#hudTime'), hudMode: $('#hudMode'),
  hudAcc: $('#hudAcc'), hudAccLabel: $('#hudAccLabel'),
  countdown: $('#countdown'), countNum: $('#countNum'),
  pause: $('#pause'), results: $('#results'),
  resMode: $('#resMode'), resBest: $('#resBest'), resScore: $('#resScore'), resStats: $('#resStats'),
};

/* ============ targets ============ */

function targetRadius() { return MODES[game.mode].r * settings.targetScale; }

function makeTarget(x, y, r) {
  return { x, y, r, born: game.elapsed };
}

// Random position inside the playfield, at least `minDist` away from `others`
// (array of {x,y}) and optionally from point `far` by `farDist`.
function randomPos(r, others = [], minDist = 0, far = null, farDist = 0) {
  let x = W / 2, y = H / 2;
  for (let i = 0; i < 50; i++) {
    x = rand(MARGIN + r, W - MARGIN - r);
    y = rand(TOP + r, H - MARGIN - r);
    let ok = true;
    for (const o of others) {
      if (dist2(x, y, o.x, o.y) < minDist * minDist) { ok = false; break; }
    }
    if (ok && far && dist2(x, y, far.x, far.y) < farDist * farDist) ok = false;
    if (ok) break;
  }
  return { x, y };
}

function spawnGridTarget() {
  const r = targetRadius();
  const p = randomPos(r, game.targets, r * 2.6);
  game.targets.push(makeTarget(p.x, p.y, r));
}

function spawnFlickTarget() {
  const r = targetRadius();
  const farDist = Math.min(W, H) * 0.33;
  const p = randomPos(r, [], 0, game.lastHit, farDist);
  game.targets.push(makeTarget(p.x, p.y, r));
}

function spawnPrecisionTarget() {
  const r = targetRadius();
  const p = randomPos(r, [], 0, game.lastHit, 70);
  game.targets.push(makeTarget(p.x, p.y, r));
}

function spawnTrackingTarget() {
  const r = targetRadius();
  const p = randomPos(r, [], 0);
  const t = makeTarget(p.x, p.y, r);
  t.wp = null;
  t.phase = rand(0, Math.PI * 2);
  t.lockT = 0;
  game.targets.push(t);
}

function spawnReflexTarget() {
  const r = targetRadius();
  const p = randomPos(r, [], 0);
  game.targets.push(makeTarget(p.x, p.y, r));
  game.reflexPhase = 'go';
  game.reflexSpawned = game.elapsed;
}

/* ============ fx ============ */

function fxBurst(x, y, color) {
  for (let i = 0; i < 14; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(90, 340);
    game.fx.push({
      kind: 'dot', x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      t: 0, life: rand(0.3, 0.55), size: rand(1.5, 3.5), color,
    });
  }
  game.fx.push({ kind: 'ring', x, y, r: 6, t: 0, life: 0.35, color });
}

function fxFloat(x, y, text, color, size = 17) {
  game.fx.push({ kind: 'text', x, y, text, color, size, t: 0, life: 0.8 });
}

function updateFx(dt) {
  for (let i = game.fx.length - 1; i >= 0; i--) {
    const f = game.fx[i];
    f.t += dt;
    if (f.t >= f.life) { game.fx.splice(i, 1); continue; }
    if (f.kind === 'dot') {
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.vx *= 1 - 4 * dt; f.vy *= 1 - 4 * dt;
    } else if (f.kind === 'ring') {
      f.r += 240 * dt;
    } else if (f.kind === 'text') {
      f.y -= 52 * dt;
    }
  }
}

/* ============ flow ============ */

function showScreen(name) {
  el.menu.classList.toggle('active', name === 'menu');
  el.gameScreen.classList.toggle('active', name === 'game');
}

function startGame(key) {
  audio.ensure();
  const m = MODES[key];
  game.mode = key;
  game.duration = settings.duration;
  game.state = 'countdown';
  game.countT = 3;
  game.targets = [];
  game.fx = [];
  game.elapsed = 0;
  game.score = 0; game.scoreF = 0;
  game.hits = 0; game.misses = 0; game.streak = 0; game.bestStreak = 0;
  game.ttks = []; game.reactions = []; game.early = 0;
  game.trackOn = 0; game.trackTotal = 0;
  game.reflexPhase = 'wait'; game.reflexAt = 0;
  game.lastHit = null;

  el.hudMode.textContent = m.name;
  el.hudAccLabel.textContent = key === 'tracking' ? 'ON TARGET' : 'ACCURACY';
  el.hudStreakWrap.style.visibility = key === 'tracking' ? 'hidden' : 'visible';
  el.hudScore.textContent = '0';
  el.hudStreak.textContent = '0';
  el.hudAcc.textContent = '—';
  el.hudTime.textContent = game.duration.toFixed(1);
  el.countNum.textContent = '3';

  el.pause.classList.add('hidden');
  el.results.classList.add('hidden');
  el.countdown.classList.remove('hidden');
  el.gameScreen.classList.remove('playing');
  showScreen('game');
  resize();
}

function beginPlay() {
  game.state = 'playing';
  game.elapsed = 0;
  el.countdown.classList.add('hidden');
  el.gameScreen.classList.add('playing');
  audio.go();
  switch (game.mode) {
    case 'gridshot': spawnGridTarget(); spawnGridTarget(); spawnGridTarget(); break;
    case 'flick': spawnFlickTarget(); break;
    case 'precision': spawnPrecisionTarget(); break;
    case 'tracking': spawnTrackingTarget(); break;
    case 'reflex': game.reflexPhase = 'wait'; game.reflexAt = game.elapsed + rand(0.9, 2.2); break;
  }
}

function togglePause() {
  if (game.state === 'playing') {
    game.state = 'paused';
    el.pause.classList.remove('hidden');
    el.gameScreen.classList.remove('playing');
  } else if (game.state === 'paused') {
    game.state = 'playing';
    el.pause.classList.add('hidden');
    el.gameScreen.classList.add('playing');
  }
}

function quitToMenu() {
  game.state = 'menu';
  game.mode = null;
  el.pause.classList.add('hidden');
  el.results.classList.add('hidden');
  el.countdown.classList.add('hidden');
  el.gameScreen.classList.remove('playing');
  buildModeCards();
  buildHistory();
  showScreen('menu');
}

/* ============ scoring / shooting ============ */

function addScore(pts) {
  game.score = Math.max(0, game.score + pts);
  game.scoreF = game.score;
}

function onHit(t, pts) {
  game.hits++;
  game.streak++;
  game.bestStreak = Math.max(game.bestStreak, game.streak);
  addScore(pts);
  game.lastHit = { x: t.x, y: t.y };
  fxBurst(t.x, t.y, MODES[game.mode].color);
  fxFloat(t.x, t.y - t.r - 8, `+${pts}`, MODES[game.mode].color);
  audio.hit(game.streak);
}

function onMiss(x, y, pts = 25) {
  game.misses++;
  game.streak = 0;
  addScore(-pts);
  fxFloat(x, y - 14, `-${pts}`, '#8b90a6', 14);
  audio.miss();
}

function handleShot(x, y) {
  if (game.state !== 'playing') return;
  audio.ensure();
  const mode = game.mode;

  if (mode === 'tracking') return; // tracking is hover-based; clicks are free

  if (mode === 'reflex') {
    if (game.reflexPhase === 'wait') {
      game.early++;
      game.misses++;
      game.streak = 0;
      addScore(-50);
      fxFloat(x, y - 14, 'TOO EARLY', '#f87171', 18);
      audio.early();
      game.reflexAt = game.elapsed + rand(1.0, 2.4); // reset the wait
      return;
    }
    const t = game.targets[0];
    if (t && dist2(x, y, t.x, t.y) <= t.r * t.r) {
      const reaction = Math.round((game.elapsed - game.reflexSpawned) * 1000);
      game.reactions.push(reaction);
      const pts = clamp(Math.round(900 - reaction * 1.6), 50, 900);
      onHit(t, pts);
      fxFloat(t.x, t.y + t.r + 16, `${reaction} ms`, '#facc15', 14);
      game.targets = [];
      game.reflexPhase = 'wait';
      game.reflexAt = game.elapsed + rand(1.0, 2.4);
    } else {
      onMiss(x, y);
    }
    return;
  }

  // click modes: gridshot / flick / precision
  for (let i = game.targets.length - 1; i >= 0; i--) {
    const t = game.targets[i];
    if (dist2(x, y, t.x, t.y) <= t.r * t.r) {
      const ttk = Math.round((game.elapsed - t.born) * 1000);
      game.ttks.push(ttk);
      let pts;
      if (mode === 'gridshot') pts = 100 + Math.min(50, game.streak * 2);
      else if (mode === 'flick') pts = clamp(Math.round(1000 - ttk * 0.55), 120, 1000);
      else pts = clamp(Math.round(1200 - ttk * 0.5), 150, 1200); // precision
      game.targets.splice(i, 1);
      onHit(t, pts);
      if (mode === 'gridshot') spawnGridTarget();
      else if (mode === 'flick') spawnFlickTarget();
      else spawnPrecisionTarget();
      return;
    }
  }
  onMiss(x, y);
}

/* ============ update ============ */

function updateTracking(dt) {
  const t = game.targets[0];
  if (!t) return;

  // wander between random waypoints, speed pulses over time
  if (!t.wp || dist2(t.x, t.y, t.wp.x, t.wp.y) < 26 * 26 || game.elapsed > t.wpUntil) {
    t.wp = randomPos(t.r, [], 0);
    t.wpUntil = game.elapsed + rand(1.0, 2.0);
  }
  const base = clamp(Math.min(W, H) * 0.42, 200, 420);
  const speed = base * (0.75 + 0.45 * Math.sin(game.elapsed * 1.9 + t.phase));
  const dx = t.wp.x - t.x, dy = t.wp.y - t.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  t.x = clamp(t.x + (dx / d) * speed * dt, MARGIN + t.r, W - MARGIN - t.r);
  t.y = clamp(t.y + (dy / d) * speed * dt, TOP + t.r, H - MARGIN - t.r);

  // hover scoring
  game.trackTotal += dt;
  const on = dist2(game.mouse.x, game.mouse.y, t.x, t.y) <= t.r * t.r;
  t.hover = on;
  if (on) {
    t.lockT += dt;
    game.trackOn += dt;
    game.scoreF += 100 * dt;
    game.score = Math.round(game.scoreF);
  } else {
    t.lockT = 0;
  }
}

function update(dt) {
  if (game.state === 'countdown') {
    const prev = Math.ceil(game.countT);
    game.countT -= dt;
    const cur = Math.ceil(game.countT);
    if (cur !== prev && cur > 0) { el.countNum.textContent = String(cur); audio.count(); }
    if (game.countT <= 0) beginPlay();
    updateFx(dt);
    return;
  }

  if (game.state !== 'playing') { updateFx(dt); return; }

  game.elapsed += dt;
  if (game.elapsed >= game.duration) { finish(); return; }

  if (game.mode === 'tracking') updateTracking(dt);

  if (game.mode === 'reflex' && game.reflexPhase === 'wait' && game.elapsed >= game.reflexAt) {
    spawnReflexTarget();
  }

  updateFx(dt);

  // HUD
  el.hudScore.textContent = String(game.score);
  el.hudStreak.textContent = String(game.streak);
  el.hudTime.textContent = Math.max(0, game.duration - game.elapsed).toFixed(1);
  if (game.mode === 'tracking') {
    el.hudAcc.textContent = game.trackTotal > 0.2
      ? Math.round(100 * game.trackOn / game.trackTotal) + '%' : '—';
  } else {
    const shots = game.hits + game.misses;
    el.hudAcc.textContent = shots > 0 ? Math.round(100 * game.hits / shots) + '%' : '—';
  }
}

/* ============ finish / results ============ */

const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

function finish() {
  game.state = 'results';
  el.gameScreen.classList.remove('playing');

  const m = MODES[game.mode];
  const shots = game.hits + game.misses;
  const acc = shots > 0 ? Math.round(100 * game.hits / shots) : 0;
  const tot = game.trackTotal > 0 ? Math.round(100 * game.trackOn / game.trackTotal) : 0;
  const avgTtk = avg(game.ttks);
  const avgReact = avg(game.reactions);
  const fastest = game.reactions.length ? Math.min(...game.reactions) : null;

  const key = bestKey();
  const prevBest = bests[key] || 0;
  const isBest = game.score > prevBest;
  if (isBest) bests[key] = game.score;

  let extra;
  if (game.mode === 'tracking') extra = `${tot}% on target`;
  else if (game.mode === 'reflex') extra = avgReact != null ? `${avgReact} ms avg` : 'no hits';
  else if (game.mode === 'gridshot') extra = `${acc}% acc`;
  else extra = avgTtk != null ? `${avgTtk} ms ttk` : 'no hits';

  history.unshift({ m: game.mode, d: game.duration, s: game.score, x: extra, t: Date.now() });
  history = history.slice(0, 30);
  persist();

  // build results card
  el.resMode.textContent = `${m.name} · ${game.duration}s`;
  el.resMode.style.color = m.color;
  el.resScore.textContent = String(game.score);
  el.resBest.classList.toggle('hidden', !isBest);

  const rows = [];
  if (game.mode === 'tracking') {
    rows.push(['Time on target', `${tot}%`]);
    rows.push(['Locked time', `${game.trackOn.toFixed(1)}s`]);
  } else {
    rows.push(['Accuracy', `${acc}%`]);
    rows.push(['Hits', String(game.hits)]);
    rows.push(['Misses', String(game.misses)]);
    rows.push(['Best streak', String(game.bestStreak)]);
    if (game.mode === 'flick' || game.mode === 'precision' || game.mode === 'gridshot') {
      if (avgTtk != null) rows.push(['Avg time-to-kill', `${avgTtk} ms`]);
      if (game.duration > 0) rows.push(['Kills / sec', (game.hits / game.duration).toFixed(2)]);
    }
    if (game.mode === 'reflex') {
      if (avgReact != null) rows.push(['Avg reaction', `${avgReact} ms`]);
      if (fastest != null) rows.push(['Fastest', `${fastest} ms`]);
      rows.push(['Too early', String(game.early)]);
    }
  }
  if (!isBest && prevBest > 0) rows.push(['Personal best', String(prevBest)]);

  el.resStats.innerHTML = rows.map(([l, v]) =>
    `<div class="res-stat"><span class="rs-label">${l}</span><span class="rs-value">${v}</span></div>`
  ).join('');

  el.results.classList.remove('hidden');
  if (isBest) audio.best(); else audio.end();
}

/* ============ render ============ */

function drawTarget(t) {
  const m = MODES[game.mode];
  const grow = easeOut(clamp((game.elapsed - t.born) / 0.14, 0, 1));
  const r = t.r * grow;
  if (r < 1) return;

  const hot = t.hover; // tracking hover state
  const col = m.color;

  ctx.save();
  // soft fill
  ctx.beginPath();
  ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
  ctx.fillStyle = rgba(col, hot ? 0.28 : 0.12);
  ctx.fill();
  // outer ring with glow
  ctx.shadowColor = col;
  ctx.shadowBlur = hot ? 26 : 16;
  ctx.lineWidth = hot ? 4 : 3;
  ctx.strokeStyle = col;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // mid ring
  if (r > 18) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, r * 0.62, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(col, 0.5);
    ctx.stroke();
  }
  // core
  ctx.beginPath();
  ctx.arc(t.x, t.y, Math.max(2.5, r * 0.28), 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.restore();
}

function drawCrosshair() {
  const { x, y } = game.mouse;
  const c = settings.xhairColor;
  ctx.save();
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 2;
  ctx.shadowColor = c;
  ctx.shadowBlur = 6;
  if (settings.xhair === 'dot') {
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  } else if (settings.xhair === 'circle') {
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
  } else { // cross
    const gap = 4, len = 9;
    ctx.beginPath();
    ctx.moveTo(x - gap - len, y); ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y); ctx.lineTo(x + gap + len, y);
    ctx.moveTo(x, y - gap - len); ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap); ctx.lineTo(x, y + gap + len);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawFx() {
  for (const f of game.fx) {
    const k = 1 - f.t / f.life;
    if (f.kind === 'dot') {
      ctx.globalAlpha = k;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * k + 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.kind === 'ring') {
      ctx.globalAlpha = k * 0.8;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2.5 * k + 0.5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.kind === 'text') {
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = f.color;
      ctx.font = `700 ${f.size}px Rajdhani, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    }
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.clearRect(0, 0, W, H);
  if (game.state === 'menu') return;

  for (const t of game.targets) drawTarget(t);

  // reflex "wait" cue
  if (game.state === 'playing' && game.mode === 'reflex' && game.reflexPhase === 'wait') {
    const pulse = 0.35 + 0.2 * Math.sin(game.elapsed * 5);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#e9eaf2';
    ctx.font = '700 30px Orbitron, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WAIT…', W / 2, H / 2);
    ctx.restore();
  }

  drawFx();

  if (game.state === 'playing' || game.state === 'countdown') drawCrosshair();
}

/* ============ main loop ============ */

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

/* ============ menu UI ============ */

function buildModeCards() {
  el.modeGrid.innerHTML = '';
  MODE_KEYS.forEach((key, i) => {
    const m = MODES[key];
    const pb = bests[`${key}_${settings.duration}`];
    const card = document.createElement('button');
    card.className = 'mode-card';
    card.style.setProperty('--accent', m.color);
    card.style.setProperty('--accent-glow', rgba(m.color, 0.45));
    card.innerHTML =
      `<span class="mc-key">${i + 1}</span>` +
      `<div class="mc-name">${m.name}</div>` +
      `<div class="mc-desc">${m.desc}</div>` +
      `<div class="mc-pb">${pb ? `BEST <b>${pb}</b> · ${settings.duration}s` : `No best yet · ${settings.duration}s`}</div>`;
    card.addEventListener('click', () => startGame(key));
    el.modeGrid.appendChild(card);
  });
}

function buildHistory() {
  if (!history.length) {
    el.historyList.innerHTML = '<li class="empty">No runs yet — pick a mode above.</li>';
    return;
  }
  el.historyList.innerHTML = history.slice(0, 8).map(h => {
    const m = MODES[h.m];
    if (!m) return '';
    const when = new Date(h.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `<li>` +
      `<span class="h-mode" style="color:${m.color}">${m.name}</span>` +
      `<span class="h-score">${h.s}</span>` +
      `<span class="h-extra">${h.x} · ${h.d}s</span>` +
      `<span class="h-when">${when}</span>` +
      `</li>`;
  }).join('');
}

function initSeg(seg, value, onChange) {
  const btns = [...seg.querySelectorAll('button')];
  const apply = v => btns.forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
  apply(value);
  btns.forEach(b => b.addEventListener('click', () => {
    apply(b.dataset.v);
    onChange(b.dataset.v);
  }));
}

function initSettings() {
  initSeg(el.durSeg, settings.duration, v => {
    settings.duration = parseInt(v, 10);
    persist();
    buildModeCards(); // refresh PBs shown for this duration
  });
  initSeg(el.sizeSeg, settings.targetScale, v => {
    settings.targetScale = parseFloat(v);
    persist();
  });
  initSeg(el.xhairSeg, settings.xhair, v => {
    settings.xhair = v;
    persist();
  });
  el.xhairColor.value = settings.xhairColor;
  el.xhairColor.addEventListener('input', () => {
    settings.xhairColor = el.xhairColor.value;
    persist();
  });
  el.volRange.value = Math.round(settings.volume * 100);
  el.volVal.textContent = `${Math.round(settings.volume * 100)}%`;
  el.volRange.addEventListener('input', () => {
    settings.volume = el.volRange.value / 100;
    el.volVal.textContent = `${el.volRange.value}%`;
    audio.ensure();
    audio.setVolume(settings.volume);
    audio.tone(660, 0.05, 'triangle', 0.4);
    persist();
  });
}

/* ============ input ============ */

canvas.addEventListener('pointermove', e => {
  const rect = canvas.getBoundingClientRect();
  game.mouse.x = e.clientX - rect.left;
  game.mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  game.mouse.x = x;
  game.mouse.y = y;
  handleShot(x, y);
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (game.state === 'playing' || game.state === 'paused') togglePause();
    else if (game.state === 'results') quitToMenu();
    return;
  }
  if (e.key === 'r' || e.key === 'R') {
    if (game.mode && (game.state === 'playing' || game.state === 'paused' || game.state === 'results')) {
      startGame(game.mode);
    }
    return;
  }
  if (game.state === 'menu') {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= MODE_KEYS.length) startGame(MODE_KEYS[n - 1]);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') togglePause();
});

window.addEventListener('resize', resize);

$('#btnResume').addEventListener('click', togglePause);
$('#btnRestart').addEventListener('click', () => startGame(game.mode));
$('#btnQuit').addEventListener('click', quitToMenu);
$('#btnAgain').addEventListener('click', () => startGame(game.mode));
$('#btnMenu').addEventListener('click', quitToMenu);

/* ============ boot ============ */

buildModeCards();
buildHistory();
initSettings();
resize();
requestAnimationFrame(frame);

// small scripting surface for embedding on arxangel.gg
window.ARXAIM = { startGame, quitToMenu, game, settings, MODES };
