'use strict';

/* =========================================================================
 *  קרב טנקים – Tank Duel
 *  Two tanks, random maze every round, cannon + homing missiles,
 *  vs computer or online (WebRTC via PeerJS), 8-bit soundtrack.
 * ========================================================================= */

// ---------------------------------------------------------------- constants
const CELL = 64, COLS = 13, ROWS = 9, WALL = 6;
const W = COLS * CELL, H = ROWS * CELL, HUD_H = 56;

const TANK_R = 17, TANK_SPEED = 140, TANK_REV = 0.65, TANK_ROT = 3.2;
const MAX_HP = 100;

const SHELL_SPEED = 430, SHELL_R = 3, SHELL_DMG = 20, FIRE_CD = 0.35, SHELL_LIFE = 4;

const MISSILES_PER_ROUND = 2;
const MISSILE_SPEED = 220, MISSILE_MIN_SPEED = 45, MISSILE_TURN = 8;
const MISSILE_R = 5, MISSILE_DMG = 40;
const MISSILE_RANGE = W / 2;           // flight distance: half the maze, then it vanishes

const ROUNDS = 3;
const COUNTDOWN = 3, ROUND_END_TIME = 3;

const COLORS = [
  { main: '#e8453c', dark: '#8f1f19', light: '#ff9a90', name: 'האדום' },
  { main: '#3d8bfd', dark: '#1a4597', light: '#a6caff', name: 'הכחול' },
];

const AI_LEVELS = {
  easy:   { react: 0.55, jitter: 0.16, aimTol: 0.07, missileEvery: 9, dodge: false },
  normal: { react: 0.30, jitter: 0.08, aimTol: 0.10, missileEvery: 6, dodge: true },
  hard:   { react: 0.12, jitter: 0.03, aimTol: 0.12, missileEvery: 4, dodge: true },
};

// ---------------------------------------------------------------- helpers
const rnd = (n) => Math.floor(Math.random() * n);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function angDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- maze
// h[y][x] = wall on the top edge of cell (x,y)   (y: 0..ROWS)
// v[y][x] = wall on the left edge of cell (x,y)  (x: 0..COLS)
function generateMaze() {
  const h = [], v = [];
  for (let y = 0; y <= ROWS; y++) h.push(new Array(COLS).fill(1));
  for (let y = 0; y < ROWS; y++) v.push(new Array(COLS + 1).fill(1));

  const seen = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
  const sx = rnd(COLS), sy = rnd(ROWS);
  const stack = [[sx, sy]];
  seen[sy][sx] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const nb = [];
    if (y > 0 && !seen[y - 1][x]) nb.push([x, y - 1, 'n']);
    if (y < ROWS - 1 && !seen[y + 1][x]) nb.push([x, y + 1, 's']);
    if (x > 0 && !seen[y][x - 1]) nb.push([x - 1, y, 'w']);
    if (x < COLS - 1 && !seen[y][x + 1]) nb.push([x + 1, y, 'e']);
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny, d] = nb[rnd(nb.length)];
    if (d === 'n') h[y][x] = 0;
    if (d === 's') h[y + 1][x] = 0;
    if (d === 'w') v[y][x] = 0;
    if (d === 'e') v[y][x + 1] = 0;
    seen[ny][nx] = true;
    stack.push([nx, ny]);
  }

  // knock out extra walls so the maze has loops and open fights
  const interior = [];
  for (let y = 1; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (h[y][x]) interior.push(['h', x, y]);
  for (let y = 0; y < ROWS; y++) for (let x = 1; x < COLS; x++) if (v[y][x]) interior.push(['v', x, y]);
  const removeCount = Math.floor(interior.length * (0.22 + Math.random() * 0.12));
  for (let i = 0; i < removeCount; i++) {
    const j = rnd(interior.length);
    const [k, x, y] = interior.splice(j, 1)[0];
    if (k === 'h') h[y][x] = 0; else v[y][x] = 0;
  }
  return { h, v };
}

function buildWalls(m) {
  const rects = [];
  for (let y = 0; y <= ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (m.h[y][x]) rects.push({ x: x * CELL - WALL / 2, y: y * CELL - WALL / 2, w: CELL + WALL, h: WALL });
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x <= COLS; x++)
      if (m.v[y][x]) rects.push({ x: x * CELL - WALL / 2, y: y * CELL - WALL / 2, w: WALL, h: CELL + WALL });

  // spatial index: every cell keeps the walls within reach (pad <= 24px)
  const PAD = 24;
  const grid = Array.from({ length: COLS * ROWS }, () => []);
  for (const r of rects) {
    const x0 = clamp(Math.floor((r.x - PAD) / CELL), 0, COLS - 1);
    const x1 = clamp(Math.floor((r.x + r.w + PAD) / CELL), 0, COLS - 1);
    const y0 = clamp(Math.floor((r.y - PAD) / CELL), 0, ROWS - 1);
    const y1 = clamp(Math.floor((r.y + r.h + PAD) / CELL), 0, ROWS - 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y * COLS + x].push(r);
  }
  return { rects, grid };
}

function wallsNear(x, y) {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return null;
  return G.walls.grid[cy * COLS + cx];
}

function pointInWalls(x, y, pad) {
  const list = wallsNear(x, y);
  if (!list) return true;
  for (const r of list)
    if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return true;
  return false;
}

function lineOfSight(x1, y1, x2, y2, pad) {
  const dx = x2 - x1, dy = y2 - y1;
  const n = Math.ceil(Math.hypot(dx, dy) / 4);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (pointInWalls(x1 + dx * t, y1 + dy * t, pad)) return false;
  }
  return true;
}

function collideCircle(o, r) {
  for (let iter = 0; iter < 2; iter++) {
    const list = wallsNear(o.x, o.y);
    if (!list) { o.x = clamp(o.x, r, W - r); o.y = clamp(o.y, r, H - r); return; }
    for (const w of list) {
      const cx = clamp(o.x, w.x, w.x + w.w), cy = clamp(o.y, w.y, w.y + w.h);
      const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        o.x += (dx / d) * (r - d);
        o.y += (dy / d) * (r - d);
      } else {
        // centre inside the rect – push out along the shortest axis
        const l = o.x - w.x, rr = w.x + w.w - o.x, t = o.y - w.y, b = w.y + w.h - o.y;
        const m = Math.min(l, rr, t, b);
        if (m === l) o.x = w.x - r; else if (m === rr) o.x = w.x + w.w + r;
        else if (m === t) o.y = w.y - r; else o.y = w.y + w.h + r;
      }
    }
  }
}

const cellOf = (o) => [clamp(Math.floor(o.x / CELL), 0, COLS - 1), clamp(Math.floor(o.y / CELL), 0, ROWS - 1)];
const cellCenter = ([x, y]) => ({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 });

// BFS through open passages – returns list of cells from start to goal
function findPath(from, to) {
  const m = G.maze;
  const idx = (x, y) => y * COLS + x;
  const prev = new Int16Array(COLS * ROWS).fill(-1);
  const start = idx(from[0], from[1]), goal = idx(to[0], to[1]);
  prev[start] = start;
  const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    if (c === goal) break;
    const x = c % COLS, y = (c / COLS) | 0;
    const tryN = (nx, ny, open) => {
      if (!open) return;
      const n = idx(nx, ny);
      if (prev[n] !== -1) return;
      prev[n] = c;
      q.push(n);
    };
    tryN(x, y - 1, y > 0 && !m.h[y][x]);
    tryN(x, y + 1, y < ROWS - 1 && !m.h[y + 1][x]);
    tryN(x - 1, y, x > 0 && !m.v[y][x]);
    tryN(x + 1, y, x < COLS - 1 && !m.v[y][x + 1]);
  }
  if (prev[goal] === -1) return null;
  const path = [];
  for (let c = goal; ; c = prev[c]) {
    path.push([c % COLS, (c / COLS) | 0]);
    if (c === start) break;
  }
  return path.reverse();
}

// ---------------------------------------------------------------- sound (WebAudio chiptune)
const Sound = {
  ctx: null, master: null, music: null, sfx: null,
  muted: false, step: 0, nextTime: 0, timer: null,
  BPM: 152,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = this.muted ? 0 : 0.55; this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);

    this.pulse25 = this.makePulse(0.25);
    this.pulse125 = this.makePulse(0.125);
    const len = c.sampleRate;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.buildSong();
    this.startMusic();
  },

  makePulse(duty) {
    const n = 64, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(Math.PI * k * duty);
    return this.ctx.createPeriodicWave(re, im);
  },

  buildSong() {
    const N = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    const midi = (s) => {
      if (s === '_') return null;
      const m = s.match(/^([A-G]#?)(\d)$/);
      return 12 * (+m[2] + 1) + N[m[1]];
    };
    const parse = (str) => str.trim().split(/\s+/).map(midi);
    // Section A – Am F C G
    const A = parse(`
      A4 _ C5 E5 A5 _ E5 C5   B4 _ C5 _ E5 _ D5 C5
      F4 _ A4 C5 F5 _ C5 A4   G4 _ A4 _ C5 _ E5 _
      E5 _ G5 _ C6 _ G5 E5    D5 _ E5 _ G5 _ E5 D5
      D5 _ B4 _ G4 _ B4 D5    G5 _ F5 _ E5 _ D5 _`);
    // Section B – higher, driving
    const B = parse(`
      A5 A5 _ A5 G5 _ E5 _    A5 _ C6 _ B5 A5 G5 E5
      F5 F5 _ F5 E5 _ C5 _    F5 _ A5 _ G5 F5 E5 C5
      G5 G5 _ G5 E5 _ C5 _    E5 _ G5 _ C6 _ B5 _
      B5 _ A5 _ G5 _ D5 _     G5 _ F5 E5 D5 _ B4 _`);
    this.lead = A.concat(B);
    this.roots = [45, 41, 48, 43];                        // A2 F2 C3 G2
    this.chords = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
  },

  startMusic() {
    if (!this.ctx || this.timer) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  },

  schedule() {
    const c = this.ctx, stepDur = 60 / this.BPM / 4;
    while (this.nextTime < c.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 128;
    }
  },

  playStep(i, t, sd) {
    const s = i % 16, bar = Math.floor((i % 64) / 16), sectionB = i >= 64;
    const f = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const note = this.lead[i];
    if (note != null) this.tone(this.pulse25, f(note), t, sd * 0.9, 0.10, this.music);
    // arpeggio
    const ch = this.chords[bar];
    this.tone(this.pulse125, f(ch[s % 3] + 12), t, sd * 0.5, sectionB ? 0.035 : 0.025, this.music);
    // bass: octave-jumping eighths
    if (s % 2 === 0) this.tone('triangle', f(this.roots[bar] + (s % 4 === 2 ? 12 : 0)), t, sd * 1.7, 0.32, this.music);
    // drums
    if (s === 0 || s === 8 || (sectionB && (s === 6 || s === 14)) || s === 10) this.kick(t, this.music);
    if (s === 4 || s === 12) this.noise(t, 0.12, 0.22, 'bandpass', 1800, this.music);
    if (s % 2 === 0 || sectionB) this.noise(t, 0.03, 0.06, 'highpass', 7000, this.music);
  },

  tone(wave, freq, t, dur, vol, dest, slideTo) {
    const c = this.ctx;
    const o = c.createOscillator();
    if (typeof wave === 'string') o.type = wave; else o.setPeriodicWave(wave);
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  noise(t, dur, vol, type, freq, dest) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl).connect(g).connect(dest);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  },

  kick(t, dest) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + 0.17);
  },

  play(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, d = this.sfx;
    switch (name) {
      case 'shot':
        this.tone('square', 900, t, 0.09, 0.10, d, 160);
        this.noise(t, 0.06, 0.12, 'highpass', 2000, d);
        break;
      case 'wall':
        this.tone('triangle', 1400, t, 0.03, 0.05, d, 900);
        break;
      case 'hit':
        this.tone('square', 260, t, 0.2, 0.16, d, 60);
        this.noise(t, 0.18, 0.25, 'lowpass', 2500, d);
        break;
      case 'mlaunch':
        this.tone('sawtooth', 180, t, 0.35, 0.07, d, 900);
        this.noise(t, 0.35, 0.10, 'highpass', 3000, d);
        break;
      case 'mfizzle':
        this.tone('square', 500, t, 0.15, 0.05, d, 120);
        break;
      case 'mboom':
        this.noise(t, 0.4, 0.4, 'lowpass', 1400, d);
        this.tone('sine', 110, t, 0.3, 0.3, d, 35);
        break;
      case 'boom':
        this.noise(t, 0.9, 0.6, 'lowpass', 900, d);
        this.tone('sine', 90, t, 0.7, 0.45, d, 25);
        this.tone('square', 220, t, 0.4, 0.08, d, 40);
        break;
      case 'count':
        this.tone(this.pulse25, 660, t, 0.12, 0.12, d);
        break;
      case 'go':
        this.tone(this.pulse25, 990, t, 0.3, 0.14, d);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((fq, k) => this.tone(this.pulse25, fq, t + k * 0.1, 0.12, 0.12, d));
        break;
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.music) this.music.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    $('#btn-mute').textContent = this.muted ? '🔇' : '🔊';
  },
};

// ---------------------------------------------------------------- game state
const G = {
  mode: 'menu',            // menu | local | host | guest
  me: 0,                   // which tank this screen controls
  names: ['', ''],
  maze: null, walls: null, mazeId: 0,
  tanks: [], shells: [], missiles: [],
  phase: 'idle',           // idle | countdown | playing | roundEnd | gameover
  timer: 0, round: 0, score: [0, 0], winner: -1,
  events: [],
  ai: null,
};

function setMaze(maze, id) {
  G.maze = maze;
  G.walls = buildWalls(maze);
  G.mazeId = id;
}

function makeTank(i, row) {
  const col = i === 0 ? 0 : COLS - 1;
  return {
    x: col * CELL + CELL / 2, y: row * CELL + CELL / 2,
    a: i === 0 ? 0 : Math.PI,
    hp: MAX_HP, missiles: MISSILES_PER_ROUND, alive: true,
    cd: 0, prevMissile: false,
  };
}

function newGame() {
  G.score = [0, 0];
  G.round = 0;
  nextRound();
}

function nextRound() {
  G.round++;
  if (G.round > ROUNDS) {
    G.round = ROUNDS;
    G.phase = 'gameover';
    ev({ k: 'over' });
    return;
  }
  setMaze(generateMaze(), G.mazeId + 1);
  G.tanks = [makeTank(0, rnd(ROWS)), makeTank(1, rnd(ROWS))];
  G.shells = [];
  G.missiles = [];
  G.winner = -1;
  G.phase = 'countdown';
  G.timer = COUNTDOWN;
  G.lastCount = COUNTDOWN + 1;
  if (G.ai) G.ai.reset();
  if (G.mode === 'host') Net.send({ t: 'maze', maze: G.maze, id: G.mazeId });
}

function ev(e) { G.events.push(e); }

function step(dt, inputs) {
  if (G.phase === 'countdown') {
    G.timer -= dt;
    const c = Math.ceil(G.timer);
    if (c !== G.lastCount && c > 0) { G.lastCount = c; ev({ k: 'count' }); }
    if (G.timer <= 0) { G.phase = 'playing'; ev({ k: 'go' }); }
    return;
  }
  if (G.phase === 'roundEnd') {
    G.timer -= dt;
    if (G.timer <= 0) nextRound();
    return;
  }
  if (G.phase !== 'playing') return;

  // ---- tanks
  G.tanks.forEach((t, i) => {
    t.cd -= dt;
    if (!t.alive) return;
    const inp = inputs[i] || {};
    const rot = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const mv = (inp.up ? 1 : 0) - (inp.down ? 1 : 0);
    t.a += rot * TANK_ROT * dt;
    const sp = mv > 0 ? TANK_SPEED : mv < 0 ? -TANK_SPEED * TANK_REV : 0;
    t.x += Math.cos(t.a) * sp * dt;
    t.y += Math.sin(t.a) * sp * dt;
    collideCircle(t, TANK_R);

    if (inp.fire && t.cd <= 0) {
      t.cd = FIRE_CD;
      const tx = t.x + Math.cos(t.a) * (TANK_R + 8), ty = t.y + Math.sin(t.a) * (TANK_R + 8);
      if (lineOfSight(t.x, t.y, tx, ty, SHELL_R - 1)) {
        G.shells.push({ x: tx, y: ty, vx: Math.cos(t.a) * SHELL_SPEED, vy: Math.sin(t.a) * SHELL_SPEED, o: i, life: SHELL_LIFE });
      } else ev({ k: 'wall', x: r1(tx), y: r1(ty) });
      ev({ k: 'shot', x: r1(tx), y: r1(ty), a: r2(t.a), o: i });
    }
    if (inp.missile && !t.prevMissile && t.missiles > 0) {
      t.missiles--;
      // the missile pops out of the turret already pointed at its first waypoint
      const m = { x: t.x, y: t.y, a: t.a, o: i, d: 0, sp: MISSILE_MIN_SPEED * 2 };
      const foe = G.tanks[1 - i];
      if (foe.alive) { const wp = missileWaypoint(m, foe); m.a = Math.atan2(wp.y - m.y, wp.x - m.x); }
      G.missiles.push(m);
      ev({ k: 'mlaunch', x: r1(t.x), y: r1(t.y), o: i });
    }
    t.prevMissile = !!inp.missile;
  });

  // tank vs tank
  const [a, b] = G.tanks;
  if (a.alive && b.alive) {
    const d = dist(a, b);
    if (d < TANK_R * 2 && d > 0.001) {
      const push = (TANK_R * 2 - d) / 2, nx = (a.x - b.x) / d, ny = (a.y - b.y) / d;
      a.x += nx * push; a.y += ny * push;
      b.x -= nx * push; b.y -= ny * push;
      collideCircle(a, TANK_R); collideCircle(b, TANK_R);
    }
  }

  // ---- shells (straight line, vanish on walls – walls take no damage)
  for (let si = G.shells.length - 1; si >= 0; si--) {
    const s = G.shells[si];
    s.life -= dt;
    let dead = s.life <= 0;
    const n = Math.max(1, Math.ceil((SHELL_SPEED * dt) / 3));
    for (let k = 0; k < n && !dead; k++) {
      s.x += (s.vx * dt) / n;
      s.y += (s.vy * dt) / n;
      if (pointInWalls(s.x, s.y, SHELL_R)) { dead = true; ev({ k: 'wall', x: r1(s.x), y: r1(s.y) }); break; }
      for (let ti = 0; ti < 2; ti++) {
        const t = G.tanks[ti];
        if (ti === s.o || !t.alive) continue;
        if (dist(s, t) < TANK_R + SHELL_R) {
          damage(ti, SHELL_DMG, s.x, s.y);
          dead = true;
          break;
        }
      }
      if (dead) break;
      // shells can shoot down enemy missiles
      for (let mi = G.missiles.length - 1; mi >= 0; mi--) {
        const m = G.missiles[mi];
        if (m.o !== s.o && dist(s, m) < MISSILE_R + SHELL_R + 3) {
          G.missiles.splice(mi, 1);
          ev({ k: 'mboom', x: r1(m.x), y: r1(m.y) });
          dead = true;
          break;
        }
      }
    }
    if (dead) G.shells.splice(si, 1);
  }

  // ---- missiles (homing through the maze, limited range)
  for (let mi = G.missiles.length - 1; mi >= 0; mi--) {
    const m = G.missiles[mi];
    const target = G.tanks[1 - m.o];
    let dead = false;
    if (target.alive) {
      const tp = missileWaypoint(m, target);
      const want = Math.atan2(tp.y - m.y, tp.x - m.x);
      const d = angDiff(want, m.a);
      const maxTurn = MISSILE_TURN * dt;
      m.a += clamp(d, -maxTurn, maxTurn);
      // slow down in tight turns so it can corner inside corridors
      let goal = Math.max(MISSILE_MIN_SPEED, MISSILE_SPEED * (1 - Math.abs(d) / 1.1));
      // brake hard if a wall is right ahead
      if (pointInWalls(m.x + Math.cos(m.a) * 14, m.y + Math.sin(m.a) * 14, 2)) goal = MISSILE_MIN_SPEED;
      m.sp += clamp(goal - m.sp, -1200 * dt, 300 * dt);
    }
    const n = Math.max(1, Math.ceil((m.sp * dt) / 3));
    for (let k = 0; k < n; k++) {
      const stepLen = (m.sp * dt) / n;
      m.x += Math.cos(m.a) * stepLen;
      m.y += Math.sin(m.a) * stepLen;
      m.d += stepLen;
      if (target.alive && dist(m, target) < TANK_R + MISSILE_R) {
        damage(1 - m.o, MISSILE_DMG, m.x, m.y);
        ev({ k: 'mboom', x: r1(m.x), y: r1(m.y) });
        dead = true; break;
      }
      if (pointInWalls(m.x, m.y, 1)) { ev({ k: 'mboom', x: r1(m.x), y: r1(m.y) }); dead = true; break; }
      if (m.d >= MISSILE_RANGE) { ev({ k: 'mfizzle', x: r1(m.x), y: r1(m.y) }); dead = true; break; }
    }
    if (dead) G.missiles.splice(mi, 1);
  }

  // ---- round end
  const dead = G.tanks.map((t) => !t.alive);
  if (dead[0] || dead[1]) {
    G.winner = dead[0] && dead[1] ? -1 : dead[0] ? 1 : 0;
    if (G.winner >= 0) G.score[G.winner]++;
    G.phase = 'roundEnd';
    G.timer = ROUND_END_TIME;
    G.shells = [];
    G.missiles = [];
  }
}

function damage(ti, amount, x, y) {
  const t = G.tanks[ti];
  t.hp = Math.max(0, t.hp - amount);
  ev({ k: 'hit', t: ti, x: r1(x), y: r1(y) });
  if (t.hp <= 0 && t.alive) {
    t.alive = false;
    ev({ k: 'boom', t: ti, x: r1(t.x), y: r1(t.y) });
  }
}

function missileWaypoint(m, target) {
  if (lineOfSight(m.x, m.y, target.x, target.y, MISSILE_R + 2)) return target;
  const path = findPath(cellOf(m), cellOf(target));
  if (!path || path.length < 2) return target;
  // farthest path cell centre it can fly to directly
  for (let i = Math.min(path.length - 1, 5); i >= 1; i--) {
    const c = cellCenter(path[i]);
    if (lineOfSight(m.x, m.y, c.x, c.y, MISSILE_R + 3)) return c;
  }
  return cellCenter(path[0]);
}

// ---------------------------------------------------------------- computer opponent
class AI {
  constructor(idx, level) {
    this.idx = idx;
    this.cfg = AI_LEVELS[level] || AI_LEVELS.normal;
    this.reset();
  }

  reset() {
    this.path = null; this.repath = 0;
    this.seeT = 0; this.jitter = 0; this.jitterT = 0;
    this.stuckT = 0; this.reverseT = 0; this.turnDir = 1;
    this.lastX = 0; this.lastY = 0;
    this.missileCd = 2 + Math.random() * this.cfg.missileEvery;
  }

  think(dt) {
    const me = G.tanks[this.idx], foe = G.tanks[1 - this.idx];
    const inp = {};
    if (G.phase !== 'playing' || !me.alive || !foe.alive) return inp;

    this.missileCd -= dt;
    this.jitterT -= dt;
    if (this.jitterT <= 0) { this.jitterT = 0.4 + Math.random() * 0.4; this.jitter = (Math.random() * 2 - 1) * this.cfg.jitter; }

    // unstick: back up and turn
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      inp.down = true;
      if (this.turnDir > 0) inp.right = true; else inp.left = true;
      return inp;
    }

    // incoming missile – try to shoot it down
    let aim = null;
    if (this.cfg.dodge) {
      for (const m of G.missiles)
        if (m.o !== this.idx && dist(m, me) < 230 && lineOfSight(me.x, me.y, m.x, m.y, SHELL_R)) { aim = m; break; }
    }
    const seesFoe = lineOfSight(me.x, me.y, foe.x, foe.y, SHELL_R + 1);
    if (!aim && seesFoe) aim = foe;

    let wantMove = false;
    if (aim) {
      this.seeT += dt;
      const ang = Math.atan2(aim.y - me.y, aim.x - me.x) + (aim === foe ? this.jitter : 0);
      const d = angDiff(ang, me.a);
      if (d > 0.04) inp.right = true; else if (d < -0.04) inp.left = true;
      if (Math.abs(d) < this.cfg.aimTol && this.seeT > this.cfg.react) inp.fire = true;
      if (aim === foe) {
        const dd = dist(me, foe);
        if (dd > 300 && Math.abs(d) < 0.5) { inp.up = true; wantMove = true; }
        else if (dd < 90) inp.down = true;
        // a missile at short range in the open is hard to dodge
        if (dd < MISSILE_RANGE * 0.6 && this.missileCd <= 0 && me.missiles > 0 && Math.random() < 0.02) this.launch(inp);
      }
    } else {
      this.seeT = 0;
      this.repath -= dt;
      if (this.repath <= 0 || !this.path) { this.path = findPath(cellOf(me), cellOf(foe)); this.repath = 0.3; }
      const path = this.path;
      if (path && path.length > 1) {
        let wp = cellCenter(path[0]);
        for (let i = Math.min(path.length - 1, 3); i >= 1; i--) {
          const c = cellCenter(path[i]);
          if (lineOfSight(me.x, me.y, c.x, c.y, TANK_R * 0.7)) { wp = c; break; }
        }
        const d = angDiff(Math.atan2(wp.y - me.y, wp.x - me.x), me.a);
        if (d > 0.06) inp.right = true; else if (d < -0.06) inp.left = true;
        if (Math.abs(d) < 0.6) { inp.up = true; wantMove = true; }
        // foe is hidden but within missile reach along the maze – send a missile
        if ((path.length - 1) * CELL < MISSILE_RANGE * 0.85 && this.missileCd <= 0 && me.missiles > 0) this.launch(inp);
      }
    }

    // stuck detection
    const moved = Math.hypot(me.x - this.lastX, me.y - this.lastY);
    this.lastX = me.x; this.lastY = me.y;
    if (wantMove && moved < 0.4) {
      this.stuckT += dt;
      if (this.stuckT > 0.5) { this.stuckT = 0; this.reverseT = 0.35; this.turnDir = Math.random() < 0.5 ? 1 : -1; }
    } else this.stuckT = 0;

    return inp;
  }

  launch(inp) {
    inp.missile = true;
    this.missileCd = this.cfg.missileEvery * (0.7 + Math.random() * 0.6);
  }
}

// ---------------------------------------------------------------- input
const keys = new Set();
const KEYMAP = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  fire: ['Space'],
  missile: ['KeyF', 'Enter', 'NumpadEnter', 'ShiftRight'],
};
function readInput() {
  const o = {};
  for (const k in KEYMAP) o[k] = KEYMAP[k].some((c) => keys.has(c));
  return o;
}
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'KeyM' && !e.repeat) Sound.toggleMute();
  if (G.mode !== 'menu') {
    keys.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Enter') e.preventDefault();
  }
  Sound.init();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// ---------------------------------------------------------------- networking (PeerJS / WebRTC)
const PEER_PREFIX = 'tankduel8bit-';
const Net = {
  peer: null, conn: null,
  remoteInput: {}, lastSentInput: '', inputT: 0,
  sendT: 0, pendingEvents: [],

  send(msg) {
    if (this.conn && this.conn.open) this.conn.send(msg);
  },

  close() {
    try { this.conn && this.conn.close(); } catch (e) { /* ignore */ }
    try { this.peer && this.peer.destroy(); } catch (e) { /* ignore */ }
    this.peer = this.conn = null;
    this.remoteInput = {};
    this.pendingEvents = [];
  },

  available() {
    if (typeof Peer === 'undefined') {
      toast('ספריית הרשת לא נטענה – בדוק חיבור לאינטרנט');
      return false;
    }
    return true;
  },

  host() {
    if (!this.available()) return;
    this.close();
    const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[rnd(32)]).join('');
    const status = $('#host-status');
    status.className = 'status';
    status.textContent = 'מתחבר לשרת…';
    $('#host-code').textContent = code;
    const peer = this.peer = new Peer(PEER_PREFIX + code);
    peer.on('open', () => { status.textContent = 'ממתין ליריב שיצטרף… ⏳'; });
    peer.on('connection', (c) => {
      if (this.conn) { c.on('open', () => c.close()); return; }
      this.conn = c;
      c.on('open', () => {
        status.textContent = 'היריב התחבר!';
        startGame('host');
      });
      c.on('data', (d) => {
        if (d && d.t === 'in') this.remoteInput = d.i || {};
      });
      c.on('close', () => this.lost());
      c.on('error', () => this.lost());
    });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id') return this.host();
      status.className = 'status err';
      status.textContent = 'שגיאת רשת: ' + e.type;
    });
    peer.on('disconnected', () => {
      if (!this.conn) setTimeout(() => { if (this.peer === peer && !peer.destroyed) peer.reconnect(); }, 2000);
    });
    this.code = code;
  },

  join(code) {
    if (!this.available()) return;
    this.close();
    code = code.trim().toUpperCase();
    const status = $('#join-status');
    status.className = 'status';
    if (code.length < 5) { status.className = 'status err'; status.textContent = 'קוד צריך להכיל 5 תווים'; return; }
    status.textContent = 'מתחבר…';
    const peer = this.peer = new Peer();
    peer.on('open', () => {
      const c = this.conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
      c.on('open', () => startGame('guest'));
      c.on('data', (d) => this.onGuestData(d));
      c.on('close', () => this.lost());
      c.on('error', () => this.lost());
    });
    peer.on('error', (e) => {
      status.className = 'status err';
      status.textContent = e.type === 'peer-unavailable' ? 'לא נמצא משחק עם הקוד הזה' : 'שגיאת רשת: ' + e.type;
      this.conn = null;
    });
  },

  lost() {
    if (G.mode === 'host' || G.mode === 'guest') {
      toast('החיבור ליריב נותק');
      toMenu();
    }
  },

  // host → guest: compact snapshot
  sendState(dt) {
    this.pendingEvents.push(...G.events);
    this.sendT -= dt;
    if (this.sendT > 0) return;
    this.sendT = 1 / 40;
    this.send({
      t: 's',
      p: G.phase, tm: r2(G.timer), r: G.round, sc: G.score, w: G.winner, mid: G.mazeId,
      k: G.tanks.map((t) => [r1(t.x), r1(t.y), r2(t.a), t.hp, t.missiles, t.alive ? 1 : 0]),
      sh: G.shells.map((s) => [r1(s.x), r1(s.y), s.o]),
      ms: G.missiles.map((m) => [r1(m.x), r1(m.y), r2(m.a), Math.round(m.d), m.o]),
      e: this.pendingEvents,
    });
    this.pendingEvents = [];
  },

  onGuestData(d) {
    if (!d) return;
    if (d.t === 'maze') { setMaze(d.maze, d.id); return; }
    if (d.t !== 's') return;
    if (d.mid !== G.mazeId) return;          // wait for the matching maze
    G.phase = d.p; G.timer = d.tm; G.round = d.r; G.score = d.sc; G.winner = d.w;
    G.tanks = d.k.map((k) => ({ x: k[0], y: k[1], a: k[2], hp: k[3], missiles: k[4], alive: !!k[5] }));
    G.shells = d.sh.map((s) => ({ x: s[0], y: s[1], o: s[2] }));
    G.missiles = d.ms.map((m) => ({ x: m[0], y: m[1], a: m[2], d: m[3], o: m[4] }));
    handleEvents(d.e);
  },

  // guest → host: keyboard state
  sendInput(dt) {
    const inp = readInput();
    const s = JSON.stringify(inp);
    this.inputT -= dt;
    if (s !== this.lastSentInput || this.inputT <= 0) {
      this.lastSentInput = s;
      this.inputT = 0.25;
      this.send({ t: 'in', i: inp });
    }
  },
};

// ---------------------------------------------------------------- effects
const particles = [];
const flash = [0, 0];
let shake = 0;

function burst(x, y, n, colors, speed, life, size) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: life * (0.5 + Math.random() * 0.5), max: life,
      c: colors[rnd(colors.length)], s: size * (0.6 + Math.random() * 0.8),
    });
  }
}

function handleEvents(list) {
  for (const e of list) {
    switch (e.k) {
      case 'shot':
        Sound.play('shot');
        burst(e.x, e.y, 6, ['#fff6c2', '#ffd23f', '#ff9f1c'], 120, 0.18, 3);
        break;
      case 'wall':
        Sound.play('wall');
        burst(e.x, e.y, 5, ['#ffffff', '#c9d1e0'], 90, 0.2, 2);
        break;
      case 'hit':
        Sound.play('hit');
        flash[e.t] = 0.18;
        shake = Math.max(shake, 5);
        burst(e.x, e.y, 14, [COLORS[e.t].light, '#ffd23f', '#ffffff'], 180, 0.35, 3);
        break;
      case 'mlaunch':
        Sound.play('mlaunch');
        break;
      case 'mfizzle':
        Sound.play('mfizzle');
        burst(e.x, e.y, 10, ['#777', '#999', '#555'], 50, 0.6, 4);
        break;
      case 'mboom':
        Sound.play('mboom');
        shake = Math.max(shake, 6);
        burst(e.x, e.y, 22, ['#ffd23f', '#ff9f1c', '#ff5c39', '#fff'], 200, 0.45, 4);
        break;
      case 'boom':
        Sound.play('boom');
        shake = 14;
        burst(e.x, e.y, 60, ['#ffd23f', '#ff9f1c', '#ff5c39', '#fff', COLORS[e.t].main, '#444'], 280, 0.9, 5);
        break;
      case 'count': Sound.play('count'); break;
      case 'go': Sound.play('go'); break;
      case 'over': Sound.play('win'); break;
    }
  }
}

function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt;
  }
  // missile exhaust
  for (const m of G.missiles) {
    if (Math.random() < 0.8) {
      particles.push({
        x: m.x - Math.cos(m.a) * 7, y: m.y - Math.sin(m.a) * 7,
        vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20,
        life: 0.45, max: 0.45, c: Math.random() < 0.3 ? '#ffb347' : '#8892a6', s: 3 + Math.random() * 2,
      });
    }
  }
  flash[0] = Math.max(0, flash[0] - dt);
  flash[1] = Math.max(0, flash[1] - dt);
  shake = Math.max(0, shake - dt * 40);
}

// ---------------------------------------------------------------- rendering
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let dpr = 1;

function resize() {
  const maxW = innerWidth - 16, maxH = innerHeight - 16;
  const scale = Math.min(maxW / W, maxH / (H + HUD_H), 1.6);
  const cw = Math.floor(W * scale), ch = Math.floor((H + HUD_H) * scale);
  dpr = Math.min(window.devicePixelRatio || 1, 2) * scale;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round((H + HUD_H) * dpr);
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  $('#stage').style.width = cw + 'px';
  $('#stage').style.height = ch + 'px';
}
addEventListener('resize', resize);

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0e1118';
  ctx.fillRect(0, 0, W, H + HUD_H);

  drawHud();

  ctx.save();
  ctx.translate(0, HUD_H);
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  // floor
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#1c2230' : '#1f2635';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }

  // walls
  if (G.walls) {
    ctx.fillStyle = '#0a0c12';
    for (const r of G.walls.rects) ctx.fillRect(r.x + 2, r.y + 3, r.w, r.h);
    ctx.fillStyle = '#7d879c';
    for (const r of G.walls.rects) ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#b4bdd0';
    for (const r of G.walls.rects) ctx.fillRect(r.x, r.y, r.w, 2);
  }

  // shells
  for (const s of G.shells) {
    ctx.fillStyle = COLORS[s.o].light;
    ctx.beginPath(); ctx.arc(s.x, s.y, SHELL_R + 2, 0, Math.PI * 2); ctx.globalAlpha = 0.35; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s.x, s.y, SHELL_R, 0, Math.PI * 2); ctx.fill();
  }

  // particles below tanks (smoke) and above (sparks) – keep simple: all here
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
  }
  ctx.globalAlpha = 1;

  // tanks
  G.tanks.forEach((t, i) => drawTank(t, i));

  // missiles
  for (const m of G.missiles) drawMissile(m);

  ctx.restore();

  drawBanner();
}

function drawTank(t, i) {
  const col = COLORS[i];
  ctx.save();
  ctx.translate(t.x, t.y);
  if (!t.alive) {
    // wreck
    ctx.rotate(t.a);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-15, -12, 30, 24);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(t.a);
  // shadow
  ctx.fillStyle = '#0006';
  ctx.fillRect(-17, -14, 36, 31);
  // treads
  ctx.fillStyle = '#222';
  ctx.fillRect(-18, -16, 36, 8);
  ctx.fillRect(-18, 8, 36, 8);
  ctx.fillStyle = '#444';
  for (let k = -16; k < 18; k += 6) { ctx.fillRect(k, -16, 3, 8); ctx.fillRect(k, 8, 3, 8); }
  // hull
  const hit = flash[i] > 0;
  ctx.fillStyle = hit ? '#ffffff' : col.main;
  ctx.fillRect(-15, -10, 30, 20);
  ctx.fillStyle = hit ? '#ffffff' : col.dark;
  ctx.fillRect(-15, 6, 30, 4);
  // barrel
  ctx.fillStyle = col.dark;
  ctx.fillRect(0, -3, TANK_R + 9, 6);
  ctx.fillStyle = '#222';
  ctx.fillRect(TANK_R + 5, -4, 4, 8);
  // turret
  ctx.fillStyle = hit ? '#ffffff' : col.light;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col.dark;
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // floating health bar
  const w = 34, pct = t.hp / MAX_HP;
  ctx.fillStyle = '#000a';
  ctx.fillRect(t.x - w / 2 - 1, t.y - 30, w + 2, 6);
  ctx.fillStyle = pct > 0.5 ? '#4cd964' : pct > 0.2 ? '#ffd23f' : '#ff4d4d';
  ctx.fillRect(t.x - w / 2, t.y - 29, w * pct, 4);

  if (i === G.me && G.mode !== 'menu' && G.phase === 'countdown') {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(t.x, t.y, 26 + Math.sin(performance.now() / 120) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawMissile(m) {
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.a);
  // flame
  ctx.fillStyle = Math.random() < 0.5 ? '#ffd23f' : '#ff7b1c';
  ctx.beginPath(); ctx.moveTo(-6, -2.5); ctx.lineTo(-12 - Math.random() * 5, 0); ctx.lineTo(-6, 2.5); ctx.fill();
  // body
  ctx.fillStyle = '#e9edf5';
  ctx.fillRect(-7, -3, 12, 6);
  ctx.fillStyle = COLORS[m.o].main;
  ctx.beginPath(); ctx.moveTo(5, -3); ctx.lineTo(10, 0); ctx.lineTo(5, 3); ctx.fill();
  ctx.fillRect(-7, -5, 3, 10);
  ctx.restore();
  // fuel ring (remaining range)
  const left = 1 - m.d / MISSILE_RANGE;
  ctx.strokeStyle = COLORS[m.o].light;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(m.x, m.y, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawHud() {
  ctx.fillStyle = '#141925';
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = '#2a3142';
  ctx.fillRect(0, HUD_H - 3, W, 3);
  if (G.mode === 'menu' || !G.tanks.length) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TANK DUEL', W / 2, HUD_H / 2);
    return;
  }
  for (let i = 0; i < 2; i++) {
    const t = G.tanks[i], col = COLORS[i];
    const left = i === 0;
    const x0 = left ? 14 : W - 14;
    const dir = left ? 1 : -1;
    // name
    ctx.textBaseline = 'top';
    ctx.font = '700 15px Rubik, sans-serif';
    ctx.fillStyle = col.main;
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillText(G.names[i], left ? x0 + ctx.measureText(G.names[i]).width : x0, 7);
    ctx.direction = 'ltr';
    // 5 health segments (each = 20%)
    const segs = Math.ceil(t.hp / SHELL_DMG);
    for (let k = 0; k < 5; k++) {
      const sx = left ? x0 + k * 26 : x0 - (k + 1) * 26 + 4;
      ctx.fillStyle = k < segs ? col.main : '#2a3142';
      ctx.fillRect(sx, 30, 22, 14);
      if (k < segs) { ctx.fillStyle = col.light; ctx.fillRect(sx, 30, 22, 3); }
    }
    // missiles left
    for (let k = 0; k < MISSILES_PER_ROUND; k++) {
      const mx = x0 + dir * (5 * 26 + 14 + k * 22);
      ctx.save();
      ctx.translate(mx, 37);
      ctx.rotate(-Math.PI / 2);
      ctx.globalAlpha = k < t.missiles ? 1 : 0.2;
      ctx.fillStyle = '#e9edf5';
      ctx.fillRect(-8, -3, 12, 6);
      ctx.fillStyle = col.main;
      ctx.beginPath(); ctx.moveTo(4, -3); ctx.lineTo(9, 0); ctx.lineTo(4, 3); ctx.fill();
      ctx.restore();
    }
  }
  // score & round
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '20px "Press Start 2P", monospace';
  ctx.fillStyle = COLORS[0].main;
  ctx.fillText(String(G.score[0]), W / 2 - 34, 22);
  ctx.fillStyle = '#e9edf5';
  ctx.fillText(':', W / 2, 22);
  ctx.fillStyle = COLORS[1].main;
  ctx.fillText(String(G.score[1]), W / 2 + 34, 22);
  ctx.font = '700 13px Rubik, sans-serif';
  ctx.fillStyle = '#9aa3b5';
  ctx.direction = 'rtl';
  ctx.fillText(`סיבוב ${G.round} מתוך ${ROUNDS}`, W / 2, 44);
  ctx.direction = 'ltr';
}

function drawBanner() {
  let big = null, small = null;
  if (G.phase === 'countdown') {
    small = `סיבוב ${G.round}`;
    big = String(Math.max(1, Math.ceil(G.timer)));
  } else if (G.phase === 'roundEnd') {
    big = G.winner < 0 ? 'תיקו!' : `${COLORS[G.winner].name} ניצח בסיבוב!`;
    small = G.round < ROUNDS ? 'מבוך חדש בדרך…' : '';
  }
  if (!big) return;
  const cy = HUD_H + H / 2;
  ctx.fillStyle = '#0009';
  ctx.fillRect(0, cy - 60, W, 120);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  if (small) {
    ctx.font = '700 22px Rubik, sans-serif';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(small, W / 2, cy - 30);
  }
  ctx.font = '900 44px Rubik, sans-serif';
  ctx.fillStyle = G.phase === 'roundEnd' && G.winner >= 0 ? COLORS[G.winner].main : '#ffffff';
  ctx.fillText(big, W / 2, cy + 14);
  ctx.direction = 'ltr';
}

// ---------------------------------------------------------------- UI
function $(s) { return document.querySelector(s); }

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

function showMenuPage(id) {
  document.querySelectorAll('.menu-page').forEach((p) => p.classList.toggle('hidden', p.id !== id));
}

function startGame(mode) {
  Sound.init();
  G.mode = mode;
  keys.clear();
  particles.length = 0;
  $('#menu').classList.add('hidden');
  $('#gameover').classList.add('hidden');
  if (mode === 'local') {
    G.me = 0;
    G.names = ['אתה (אדום)', 'המחשב (כחול)'];
    G.ai = new AI(1, $('#difficulty').value);
    newGame();
  } else if (mode === 'host') {
    G.me = 0;
    G.names = ['אתה (אדום)', 'היריב (כחול)'];
    G.ai = null;
    newGame();
  } else if (mode === 'guest') {
    G.me = 1;
    G.names = ['היריב (אדום)', 'אתה (כחול)'];
    G.ai = null;
    G.tanks = []; G.shells = []; G.missiles = [];
    G.phase = 'idle';
    G.mazeId = -1;
    toast('התחברת! אתה הטנק הכחול 🔵');
  }
}

function toMenu() {
  Net.close();
  G.mode = 'menu';
  G.ai = null;
  G.tanks = []; G.shells = []; G.missiles = [];
  G.phase = 'idle';
  setMaze(generateMaze(), 0);
  $('#gameover').classList.add('hidden');
  $('#menu').classList.remove('hidden');
  showMenuPage('menu-main');
}

let shownOver = false;
function syncOverlay() {
  const over = G.phase === 'gameover' && G.mode !== 'menu';
  if (over && !shownOver) {
    const [a, b] = G.score;
    $('#go-score').innerHTML = `<span class="r">${a}</span> : <span class="b">${b}</span>`;
    const w = a === b ? -1 : a > b ? 0 : 1;
    $('#go-title').textContent = w < 0 ? 'תיקו!' : `הטנק ${COLORS[w].name} ניצח במשחק!`;
    $('#go-title').style.color = w < 0 ? '#fff' : COLORS[w].main;
    $('#go-sub').textContent = w < 0 ? '' : w === G.me ? 'כל הכבוד, ניצחת! 🏆' : 'הפסדת הפעם… נסה שוב!';
    const canRestart = G.mode !== 'guest';
    $('#btn-again').classList.toggle('hidden', !canRestart);
    if (!canRestart) $('#go-sub').textContent += ' (ממתין למארח שיתחיל משחק חוזר)';
    $('#gameover').classList.remove('hidden');
  }
  if (!over && shownOver) $('#gameover').classList.add('hidden');
  shownOver = over;
}

$('#btn-ai').onclick = () => startGame('local');
$('#btn-host').onclick = () => { Sound.init(); showMenuPage('menu-host'); Net.host(); };
$('#btn-join').onclick = () => { Sound.init(); showMenuPage('menu-join'); $('#join-code').focus(); };
$('#btn-join-go').onclick = () => Net.join($('#join-code').value);
$('#join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') Net.join($('#join-code').value); });
document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => { Net.close(); showMenuPage('menu-main'); }));
$('#btn-copy').onclick = () => {
  const url = location.origin + location.pathname + '?join=' + Net.code;
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
    .then(() => toast('הקישור הועתק!'))
    .catch(() => prompt('העתק את הקישור:', url));
};
$('#btn-again').onclick = () => {
  $('#gameover').classList.add('hidden');
  newGame();
};
$('#btn-menu').onclick = toMenu;
$('#btn-exit').onclick = toMenu;
$('#btn-mute').onclick = () => { Sound.init(); Sound.toggleMute(); };

// ---------------------------------------------------------------- main loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (G.mode === 'local' || G.mode === 'host') {
    G.events = [];
    const mine = readInput();
    const other = G.mode === 'local' ? G.ai.think(dt) : Net.remoteInput;
    step(dt, [mine, other]);
    handleEvents(G.events);
    if (G.mode === 'host') Net.sendState(dt);
  } else if (G.mode === 'guest') {
    Net.sendInput(dt);
  }

  updateEffects(dt);
  render();
  syncOverlay();
  requestAnimationFrame(frame);
}

// boot
setMaze(generateMaze(), 0);
resize();
const joinParam = new URLSearchParams(location.search).get('join');
if (joinParam) {
  showMenuPage('menu-join');
  $('#join-code').value = joinParam.toUpperCase();
}
requestAnimationFrame(frame);
