// ---- Boot, input and the main loop ----
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let CW=0, CH=0;

// The canvas is stretched to the window by CSS; its own resolution is capped to a pixel budget
// (about 1080p x 1.2) so sharp 4K / 150-200 % displays don't draw up to 4x the pixels every frame.
const PIXEL_BUDGET = 2.5e6;
function resize(){
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio||1, 2, Math.sqrt(PIXEL_BUDGET/(w*h)));
  CW = Math.floor(w*dpr); CH = Math.floor(h*dpr);
  cv.width = CW; cv.height = CH;
}
window.addEventListener('resize', resize); resize();

const GAME_KEYS = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyS','KeyX','KeyB','KeyZ'];
// S pressed twice within 0.3 s: air brake
let lastS = 0;
function tapS(){
  const now = performance.now();
  if(now - lastS < 300 && G && G.player){ G.player.brakeReq = true; lastS = 0; } else lastS = now;
}
// one-shot actions on the moment a key (or gamepad button) goes down
function pressAction(code){
  if(code==='KeyS') tapS();
  if(!G) return;
  if(code==='Escape' || code==='KeyP'){ if(G.paused){ G.paused=false; UI.hide(); } else UI.pause(); }
  if(code==='KeyM') say(SFX.toggleMute() ? 'צליל כבוי' : 'צליל פועל', 1.5);
  if(code==='KeyC') toggleWingMode();
  if(code==='Enter' && G.state==='rearm') UI.act('takeoff');
}
const kbHeld = {};                                     // keys held on the keyboard (the gamepad must not release them)
window.addEventListener('keydown', e=>{
  SFX.init();
  if(GAME_KEYS.includes(e.code) && G && !UI.open()) e.preventDefault();
  keys[e.code] = kbHeld[e.code] = true;
  if(e.repeat) return;
  pressAction(e.code);
});
window.addEventListener('keyup', e=>{ kbHeld[e.code] = false; if(!padHeld[e.code]) keys[e.code]=false; });
// leaving the window (Alt+Tab, another app on top, a hidden tab) releases every key and pauses the flight,
// so the aircraft is never left flying with nobody at the controls
function autoPause(){
  for(const k in keys) keys[k] = false;
  for(const k in kbHeld) kbHeld[k] = false;
  if(G && !G.paused && !window.__noLoop) UI.pause();      // tests.html drives the game itself
}
window.addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) autoPause(); });

// ---- Gamepad (standard mapping: Xbox / PlayStation / most USB pads) ----
// The pad presses the same keys as the keyboard, so everything in the game works with it unchanged:
// left stick or D-pad = arrows · A / RT = guns · B = ordnance · X = barrel roll · Y = wingmen order ·
// RB = more throttle · LB / LT = less throttle (twice quickly = air brake) · Start = pause · Back = mute.
// On the carrier deck A launches. The left stick has a round dead zone so diagonals are not clipped.
const PAD_BUTTONS = {0:'Space', 7:'Space', 1:'KeyX', 2:'KeyZ', 3:'KeyC', 5:'KeyW', 4:'KeyS', 6:'KeyS', 9:'Escape', 8:'KeyM',
                     12:'ArrowUp', 13:'ArrowDown', 14:'ArrowLeft', 15:'ArrowRight'};
const PAD_DEAD = 0.3;
const padHeld = {};
let padWasMenu = true, padBlocked = {};
function pollGamepad(){
  let pads = [];
  try{ if(navigator.getGamepads) pads = navigator.getGamepads() || []; }catch(e){}   // blocked on some insecure pages
  if(!pads.length || ![...pads].some(Boolean)){          // no pad (or it was unplugged): let go of whatever it held
    for(const code in padHeld) if(padHeld[code]){ padHeld[code] = false; if(!kbHeld[code]) keys[code] = false; }
    return;
  }
  const want = {};
  for(const gp of pads){
    if(!gp || !gp.connected || gp.mapping !== 'standard') continue;
    for(const [i, code] of Object.entries(PAD_BUTTONS)){ const b = gp.buttons[i]; if(b && (b.pressed || b.value > 0.5)) want[code] = true; }
    const x = gp.axes[0] || 0, y = gp.axes[1] || 0, mag = Math.hypot(x, y);
    if(mag > PAD_DEAD){
      const nx = x/mag, ny = y/mag;                   // direction only; any push past the dead zone counts in full
      if(ny < -0.38) want.ArrowUp = true;
      if(ny >  0.38) want.ArrowDown = true;
      if(nx < -0.38) want.ArrowLeft = true;
      if(nx >  0.38) want.ArrowRight = true;
    }
  }
  // menus, the title, the pause screen and the carrier deck are HTML: there the pad moves the focus instead (padMenu)
  const menu = !G || UI.open() || !!document.getElementById('title');
  if(menu){
    for(const code in padHeld) if(padHeld[code]){ padHeld[code] = false; if(!kbHeld[code]) keys[code] = false; }
    if(!padWasMenu){ padWasMenu = true; padMenu.held = {...want}; }      // Start that opened the pause screen is not a press there
    padMenuInput(want);
    return;
  }
  // back in flight: a button still held from the menu (A that pressed "take off") stays ignored until released
  if(padWasMenu){ padWasMenu = false; padBlocked = {...want}; }
  for(const c in padBlocked){ if(want[c]) delete want[c]; else delete padBlocked[c]; }
  for(const code in padHeld) if(padHeld[code] && !want[code]){ padHeld[code] = false; if(!kbHeld[code]) keys[code] = false; }
  for(const code in want) if(!padHeld[code]){
    padHeld[code] = keys[code] = true; SFX.init();
    pressAction(code);
  }
}
// ---- Gamepad in the HTML menus ----
// D-pad / stick move the focus to the nearest button in that direction (works for lists, grids and the side menu
// alike, left-to-right or right-to-left); holding repeats. A presses the focused button (on the title screen:
// continue), B goes back (pause: resume · home: close the open panel · briefing/hangar: "back"), Start resumes a
// paused flight. On a volume slider left/right change the value. A gold ring shows the focus while the pad is used.
const padMenu = {held:{}, rep:{}};
function padMenuInput(want){
  const now = performance.now();
  for(const code of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyX','Escape','KeyM']){
    if(!want[code]){ padMenu.held[code] = false; continue; }
    const arrow = code.startsWith('Arrow');
    if(!padMenu.held[code]){ padMenu.held[code] = true; padMenu.rep[code] = now + 380; padMenuPress(code); }
    else if(arrow && now >= padMenu.rep[code]){ padMenu.rep[code] = now + 110; padMenuPress(code); }
  }
}
function menuFocusables(){
  const root = document.getElementById('title') || UI.root;
  return [...root.querySelectorAll('button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null || el.getClientRects().length);
}
function focusDefault(){
  const list = menuFocusables(); if(!list.length) return null;
  const el = list.find(e => e.classList.contains('primary')) || list.find(e => e.classList.contains('next'))
          || list.find(e => e.classList.contains('navbtn')) || list[0];   // home screen: the first menu entry
  el.focus(); el.scrollIntoView({block:'nearest'}); return el;
}
function menuMove(dx, dy){
  const list = menuFocusables(), cur = document.activeElement;
  if(!list.includes(cur)){ focusDefault(); return; }
  if(cur.matches('input[type=range]') && dx){             // a slider: left/right change the value
    const rtl = getComputedStyle(cur).direction === 'rtl', step = +cur.step || 1;
    cur.value = clamp(+cur.value + dx*(rtl ? -1 : 1)*step, +cur.min, +cur.max);
    cur.dispatchEvent(new Event('input', {bubbles:true})); cur.dispatchEvent(new Event('change', {bubbles:true}));
    return;
  }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height/2;
  let best = null, bs = Infinity;
  for(const el of list){
    if(el === cur) continue;
    const q = el.getBoundingClientRect(), x = q.left + q.width/2 - cx, y = q.top + q.height/2 - cy;
    const along = dx ? x*dx : y*dy; if(along <= 4) continue;  // must lie in the pressed direction
    const s = along + (dx ? Math.abs(y) : Math.abs(x))*2.5;    // prefer the one most nearly straight ahead
    if(s < bs){ bs = s; best = el; }
  }
  if(best){ best.focus(); best.scrollIntoView({block:'nearest'}); }
}
function menuBack(){
  if(G && G.paused){ pressAction('Escape'); return; }
  if(!G && UI.homePanel){ const k = UI.homePanel; UI.act('home', k); const b = UI.root.querySelector(`[data-act="home"][data-v="${k}"]`); if(b) b.focus(); return; }
  if(!G || G.state === 'over'){ const b = UI.root.querySelector('[data-act="menu"]'); if(b) b.click(); }
}
function padMenuPress(code){
  document.body.classList.add('pad'); SFX.init();
  const title = document.getElementById('title');
  const prev = document.activeElement && document.activeElement.dataset ? {...document.activeElement.dataset} : {};
  if(code === 'ArrowUp') menuMove(0, -1);
  else if(code === 'ArrowDown') menuMove(0, 1);
  else if(code === 'ArrowLeft') menuMove(-1, 0);
  else if(code === 'ArrowRight') menuMove(1, 0);
  else if(code === 'Space' || (code === 'Escape' && title)){       // A (or Start on the title screen)
    const el = document.activeElement;
    if(title) title.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
    else if(menuFocusables().includes(el)){ if(!el.matches('input')) el.click(); }
    else focusDefault();
  }
  else if(code === 'KeyX') menuBack();                              // B
  else if(code === 'Escape'){ if(G && G.paused) pressAction('Escape'); }   // Start: resume
  else if(code === 'KeyM') pressAction('KeyM');
  // after a click the screen may have been rebuilt: keep a focused button for the next press - inside a panel
  // that was just opened, else on the same button as before (a toggle, a tab), else the screen's main button
  setTimeout(() => {
    const list = menuFocusables();
    if(list.includes(document.activeElement) || (G && !UI.open())) return;
    const panel = (prev.act === 'home' && UI.homePanel) ? UI.root.querySelector('.home-panel') : null;
    const same = list.find(e => e.dataset.act && e.dataset.act === prev.act && e.dataset.v === prev.v && e.dataset.vol === prev.vol);
    const el = (panel && list.find(e => panel.contains(e))) || same;
    if(el){ el.focus(); el.scrollIntoView({block:'nearest'}); } else focusDefault();
  }, 0);
}
window.addEventListener('mousemove', () => document.body.classList.remove('pad'), {passive:true});
window.addEventListener('gamepadconnected', e=>{ if(G && e.gamepad.mapping==='standard') say('בקר משחק חובר', 2); });

function toggleWingMode(){
  if(!G || !G.wingmen.length) return;
  // C cycles the wingmen's orders: escort -> free attack -> defend the carrier
  G.wingMode = {escort:'attack', attack:'defend', defend:'escort'}[G.wingMode] || 'escort';
  say({escort:'כנפיים: ליווי וחיפוי צמוד', attack:'כנפיים: תקיפה חופשית – כל אחד בוחר יריב משלו', defend:'כנפיים: הגנה קרובה על נושאת המטוסים'}[G.wingMode], 2.5);
}

// touch pad
document.querySelectorAll('#touch button').forEach(b=>{
  const k = b.dataset.k;
  const down = e=>{ e.preventDefault(); SFX.init(); if(!G) return;
    if(k==='Escape'){ UI.pause(); return; } if(k==='KeyC'){ toggleWingMode(); return; } keys[k]=true; if(k==='KeyS') tapS(); };
  const up = e=>{ e.preventDefault(); keys[k]=false; };
  b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
});

function update(dt, vw){
  const P = G.player;
  G.time += dt;
  updateWeather(dt);
  updatePlayer(dt);
  // the player's wheels-on-deck drawing offset follows its target smoothly once airborne (no jumps at the deck edge)
  { const tl = deckLift(G.stats.type, P.x, P.y, P.gear); P.liftV = (P.onDeck || P.liftV == null) ? tl : P.liftV + (tl - P.liftV)*Math.min(1, dt*8); }
  updateWingmen(dt);
  updateEnemies(dt);
  updateGround(dt);
  updateCarrierAA(dt);
  updateProjectiles(dt);
  updateFx(dt);
  updateSpawns(dt, vw);
  if(G.defense) defenseUpdate(dt);
  if(G.ground){ groundUpdate(dt); if(G.state==='over') return; }
  if(G.tutorial){ tutorialUpdate(dt); if(G.state==='over') return; }
  if(G.special){ specialUpdate(dt); if(!G || G.state==='over') return; }
  SFX.setEngine(!P.dead && (P.speed>5 || P.throttle>0), P.speed);

  // all targets down: campaign missions end with a counter-attack on the carrier (extras.js)
  if(!G.complete && !G.tutorial && !G.ground && !G.special && primariesLeft()===0) campaignEndgame();
  repairCrews();
  if(G.carrier.hp<=0){ boom(G.carrier.x+G.carrier.len/2, DECK_Y, 120, true); UI.result(false, 'נושאת המטוסים הוטבעה.'); return; }
  if(P.dead){
    G.endT -= dt;
    if(G.endT<=0){
      if(G.lives>0){ if(G.tutorial) tutorialRespawn(); else { G.state='rearm'; UI.openDeck(true); } }
      else UI.result(false, 'כל המטוסים אבדו.');
    }
  }
  // vertical framing: zoom out as the player climbs above the normal view
  const wantTop = clamp(P.dead ? 0 : Math.min(0, P.y - 280), CEIL-280, 0);
  G.cam.top += (wantTop - G.cam.top)*Math.min(1, dt*2);
  // camera leads in the direction of flight
  const target = P.x - vw*(P.f>0 ? 0.35 : 0.65);
  G.cam.x += (target - G.cam.x)*Math.min(1, dt*2.2);
  G.cam.x = clamp(G.cam.x, -500, G.L+500-vw);
}

// Game clock: the real time since the last frame is simulated in steps of at most 1/60 s, so a slow frame
// is caught up instead of making the whole game slow down and lurch. Tiny frame-to-frame jitter in the
// browser's timestamps is smoothed out; a long gap (tab switched away) is limited to 0.1 s.
let last = performance.now(), smoothDt = 1/60;
const STEP = 1/60;
// ---- F3: frame-time meter ----
// Shows how long the game's own work takes per frame (simulation + drawing, in ms: average, 95th percentile and
// worst of the last 2 seconds) against the 16.7 ms budget of a 60 Hz screen, plus the screen's real frame rate and
// the number of live effects. Measure here before optimizing anything.
const PERF = {on:false, work:new Float32Array(120), gap:new Float32Array(120), i:0, n:0};
function perfRecord(work, gap){ PERF.work[PERF.i] = work; PERF.gap[PERF.i] = gap; PERF.i = (PERF.i+1) % 120; PERF.n = Math.min(120, PERF.n+1); }
function drawPerf(){
  if(!PERF.on || !PERF.n) return;
  const w = Array.from(PERF.work.subarray(0, PERF.n)).sort((a,b)=>a-b), g = PERF.gap.subarray(0, PERF.n);
  const avg = w.reduce((s,v)=>s+v, 0)/w.length, p95 = w[Math.floor(w.length*0.95)], max = w[w.length-1];
  const fps = 1000/(g.reduce((s,v)=>s+v, 0)/g.length);
  const lines = [`work ${avg.toFixed(1)} ms · p95 ${p95.toFixed(1)} · max ${max.toFixed(1)} (budget 16.7)`,
    `${fps.toFixed(0)} fps · ${CW}×${CH}` + (G ? ` · fx ${G.fx.length} · debris ${G.debris.length} · shots ${G.shots.length} · enemies ${G.enemies.length}` : '')];
  ctx.save();                                          // the HUD's text settings must be untouched next frame
  ctx.setTransform(1,0,0,1,0,0); ctx.font = '13px monospace'; ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  const wd = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16;
  ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(8, 8, wd, 44);
  ctx.fillStyle = p95 > 16.7 ? '#ff8f6b' : '#9be59b'; lines.forEach((l, i) => ctx.fillText(l, 16, 26 + i*18));
  ctx.restore();
}
window.addEventListener('keydown', e=>{ if(e.code==='F3'){ e.preventDefault(); PERF.on = !PERF.on; PERF.n = 0; } });

function frame(now){
  if(window.__noLoop) return;                          // tests.html drives update() itself
  requestAnimationFrame(frame);                        // scheduled first, so one bad frame can never stop the game loop
  const gapMs = now - last, w0 = performance.now();
  try{ frameWork(now); } finally { if(PERF.on){ perfRecord(performance.now() - w0, gapMs); drawPerf(); } }
}
function frameWork(now){
  let real = Math.min(0.1, Math.max(0, (now-last)/1000)); last = now;
  if(!CW || !CH){ if(window.innerWidth && window.innerHeight) resize(); return; }   // minimised / zero-size window: nothing to draw
  if(Math.abs(real - smoothDt) < smoothDt*0.25) real = smoothDt = smoothDt*0.9 + real*0.1;   // de-jitter normal frames
  pollGamepad();
  if(G){
    const vw = viewMetrics(CW, CH).vw;
    const steps = Math.min(6, Math.ceil(real/STEP - 0.01));
    const ts = timeScale();                              // < 1 during a hit-stop (entities.js)
    for(let i=0;i<steps;i++){
      const running = G && !G.paused && G.state!=='rearm' && G.state!=='over';
      if(!running) break;
      update(real/steps * GAME_SPEED * ts, vw);
    }
    feelTick(real);                                      // shake and hit-stop run on real time
    if(!G) { drawTitleBackdrop(now/1000); return; }
    render(ctx, CW, CH);
  } else drawTitleBackdrop(now/1000);
}

// the air battle at sunset behind the menus (menuscene.js)
function drawTitleBackdrop(t){ drawMenuScene(ctx, CW, CH, t); }

UI.init();
// Title screen: any key, click or tap continues to the main menu
(function(){
  const t = document.getElementById('title');
  document.getElementById('ver').textContent = 'גרסה ' + GAME_VERSION;
  t.focus();
  const go = e => {
    if(!t.isConnected) return;
    e.preventDefault(); e.stopImmediatePropagation();
    SFX.init(); SFX.tone(220, 440, 0.25, 0.08, 'triangle');
    t.remove(); UI.mainMenu();
    window.removeEventListener('keydown', go, true);
  };
  window.addEventListener('keydown', go, true);
  t.addEventListener('pointerdown', go);
  // the music button starts the theme without leaving the title screen
  const mb = document.getElementById('musicBtn');
  mb.addEventListener('pointerdown', e=>{ e.stopPropagation(); SFX.init(); Music.start(); mb.hidden = true; });
  // browsers only allow sound after an interaction; start now in case this one already allows it
  Music.start();
  if(SFX.ctx && SFX.ctx.state==='running') mb.hidden = true;
})();
requestAnimationFrame(frame);
