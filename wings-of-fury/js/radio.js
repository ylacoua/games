// ---- In-flight music that follows the fight, and radio calls from the wingmen, the carrier and the LSO ----

// ---------- adaptive flight score ----------
// One 8-bar loop at 120 BPM in D minor, built from layers that are always playing in step and only change volume:
//   pad    - a slow, quiet chord pad: always on while flying
//   pulse  - bass eighths and soft hats: comes in as enemies get close
//   drive  - drums, a staccato ostinato and brass stabs: full combat
//   boss   - a darker chord progression and low toms while a boss is near
// The game sets an intensity 0..1 every frame (combatIntensity) and the layer gains follow it smoothly, so the
// music never restarts or jumps - it swells into a fight and settles back down afterwards.
const FlightMusic = (() => {
  const STEP = 60/120/4, STEPS = 16*8;
  const hz = m => 440*Math.pow(2, (m-69)/12);
  // chord roots (MIDI, octave 2) and their notes, two bars each
  const CALM = [[38,[50,53,57]], [46,[46,50,53]], [43,[43,46,50]], [45,[45,49,52]]];   // Dm  Bb  Gm  A
  const DARK = [[38,[50,53,57]], [39,[51,55,58]], [38,[50,53,57]], [45,[45,49,52]]];   // Dm  Eb  Dm  A
  let L = null, timer = null, step = 0, next = 0, playing = false, level = 0, boss = false, duck = 1;

  function layer(){ const g = SFX.ctx.createGain(); g.gain.value = 0; g.connect(L.bus); return g; }
  function note(dest, type, f, t, dur, vol, attack=0.005, slideTo){
    const c = SFX.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f, t); if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur*0.6)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dest, t, dur, vol, freq, type='highpass'){
    const c = SFX.ctx, s = c.createBufferSource(); s.buffer = SFX.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()*0.5); s.stop(t + dur + 0.05);
  }
  function brass(dest, f, t, dur, vol){
    // a sawtooth through a lowpass that opens and closes: a soft brass stab
    const c = SFX.ctx, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2200, t + 0.06); lp.frequency.exponentialRampToValueAtTime(500, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function play(i, t){
    const bar = Math.floor(i/16), s = i % 16, prog = boss ? DARK : CALM, [root, ch] = prog[Math.floor(bar/2)];
    // pad: the chord held for two bars, slow attack
    if(s===0 && bar%2===0) for(const m of ch) note(L.pad, 'triangle', hz(m), t, STEP*32*0.98, 0.05, 0.9);
    // pulse: bass eighths (octave jump on the off-beat), hats on eighths
    if(s%2===0) note(L.pulse, 'triangle', hz(s%4===2 ? root+12 : root), t, STEP*1.7, 0.28);
    if(s%2===0) noise(L.pulse, t, 0.03, 0.05, 7000);
    // drive: kick, snare, ostinato, brass on the first beat of each bar
    if(s===0 || s===8 || s===14) note(L.drive, 'sine', 140, t, 0.18, 0.5, 0.003, 40);
    if(s===4 || s===12) noise(L.drive, t, 0.14, 0.2, 1400);
    note(L.drive, 'square', hz([root+24, root+31, root+24, root+36][s%4]), t, STEP*0.5, 0.03);
    if(s===0 || s===10) brass(L.drive, hz(ch[0]), t, 0.45, 0.07), brass(L.drive, hz(ch[2]), t, 0.45, 0.05);
    // boss: low toms rolling into each bar
    if(s===12 || s===14 || s===15) note(L.boss, 'sine', s===12 ? 110 : s===14 ? 90 : 75, t, 0.25, 0.4, 0.003, 45);
    if(s===0 && bar%2===0) brass(L.boss, hz(root+12), t, STEP*14, 0.06);
  }
  function tick(){
    const c = SFX.ctx; if(!c || !playing) return;
    if(next < c.currentTime) next = c.currentTime + 0.05;
    while(next < c.currentTime + 0.15){ play(step, next); next += STEP; step = (step+1) % STEPS; }
  }
  // the layer volumes for an intensity and boss flag (exposed for the tests)
  function mix(k, b){
    return {pad: 0.9 - 0.3*k, pulse: clamp(k*2.2, 0, 1), drive: clamp((k - 0.35)/0.4, 0, 1), boss: b ? 1 : 0};
  }
  function apply(){
    if(!L) return;
    const t = SFX.ctx.currentTime, m = mix(level, boss);
    for(const k of ['pad','pulse','drive','boss']) L[k].gain.setTargetAtTime(m[k]*duck, t, 0.6);
  }
  return {
    get playing(){ return playing; }, get level(){ return level; }, mix,
    start(){
      SFX.init(); if(!SFX.ctx || playing) return;
      playing = true; level = 0; boss = false; duck = 1;
      L = {bus: SFX.ctx.createGain()}; L.bus.gain.value = 0.42; L.bus.connect(SFX.musicBus);
      for(const k of ['pad','pulse','drive','boss']) L[k] = layer();
      apply(); step = 0; next = SFX.ctx.currentTime + 0.1;
      timer = setInterval(tick, 25); tick();
    },
    stop(){
      if(!playing) return;
      playing = false; clearInterval(timer);
      const b = L.bus; b.gain.setTargetAtTime(0, SFX.ctx.currentTime, 0.25); setTimeout(()=>b.disconnect(), 1500); L = null;
    },
    set(k, b){ k = clamp(k, 0, 1); if(Math.abs(k - level) < 0.02 && b === boss) return; level = k; boss = b; apply(); },
    duck(on){ duck = on ? 0.3 : 1; apply(); }
  };
})();

// how hot the fight is right now, 0..1: enemy aircraft near the player, being hit, and a boss in range
function combatIntensity(){
  const P = G.player; if(!P || P.dead || P.onDeck) return {k: 0, boss: false};
  let k = 0;
  for(const e of G.enemies){
    if(e.dead || e.takeoff) continue;
    const d = Math.hypot(e.x - P.x, e.y - P.y);
    if(d < 1200) k += (e.type==='emily' ? 0.6 : e.type==='zero' ? 0.32 : 0.22) * (1 - d/1200);
  }
  for(const sh of G.ships) if(!sh.dead && Math.abs(sh.x - P.x) < 900) k += 0.15;
  if(P.hitT > 0) k += 0.3;
  if(G.counter && counterLeft()) k += 0.25;
  const boss = !!((G.boss && !G.boss.dead) || G.ships.some(s=>s.type==='battleship' && !s.dead && Math.abs(s.x - P.x) < 1600)
    || G.structures.some(s=>s.type==='core' && !s.dead && Math.abs(s.x - P.x) < 1800));
  if(boss) k = Math.max(k, 0.8);
  return {k: Math.min(1, k), boss};
}

// ---------- radio ----------
// Short calls that show up in a radio box at the top left, with a burst of static and a "roger" beep.
// Each kind of call has its own cool-down so the channel never chatters.
const RADIO_CD = {tail: 14, kill: 20, carrier: 25, fuel: 1e9, smoke: 1e9, hurt: 1e9, lso: 3.5, lsoOk: 1e9};
const KILL_CALLS = ['פגיעה יפה!', 'בול! עוד אחד למטה', 'ראיתי את זה – יפה מאוד!', 'ככה עושים את זה!'];
const wingCall = w => `כנף ${w.slot + 2}`;
function radio(who, text, kind){
  const R = G.radio || (G.radio = {list: [], cd: {}});
  if(kind && (R.cd[kind] || 0) > G.time) return false;
  if(kind) R.cd[kind] = G.time + (RADIO_CD[kind] || 10);
  R.list.push({who, text, t: 5}); if(R.list.length > 2) R.list.shift();
  if(SFX.radio) SFX.radio();
  return true;
}
const liveWing = () => G.wingmen.find(w => !w.dead && w.state !== 'launch' && w.state !== 'deck');

function radioUpdate(dt){
  if(!G) return;
  flightMusicUpdate(dt);
  const P = G.player, R = G.radio || (G.radio = {list: [], cd: {}});
  for(const m of R.list) m.t -= dt;
  R.list = R.list.filter(m => m.t > 0);
  if(G.tutorial) return;
  // a new aircraft (after a landing or a crash) starts its own one-time calls afresh
  if(R.plane !== P){ R.plane = P; for(const k of ['fuel','smoke','lsoOk']) R.cd[k] = 0; }
  const w = liveWing();
  if(!P.dead && !P.onDeck){
    // a Zero sitting on the player's tail
    if(w && G.enemies.some(e => !e.dead && !e.takeoff && e.type==='zero' && Math.hypot(e.x - P.x, e.y - P.y) < 340
         && (e.x - P.x)*P.f < -40 && Math.cos(e.a)*P.f > 0.3))
      radio(wingCall(w), 'זירו מאחוריך! שבור ימינה או שמאלה!', 'tail');
    if(P.hp < P.max*0.35 && w) radio(wingCall(w), 'אתה מעשן! חזור לנושאת לתיקון', 'smoke');
    if(P.fuel < P.maxFuel*0.22) radio('נושאת', 'הדלק שלך נגמר. חזור הביתה לתדלוק', 'fuel');
    // the landing signal officer talks the player down
    const C = G.carrier, near = Math.abs(P.x - (C.x + C.len/2)) < 650 && P.y > SEA - 200 && (C.x + C.len/2 - P.x)*P.f > 0;
    if(near){
      if(P.speed >= 225) radio('קצין נחיתה', 'מהר מדי – הורד מצערת!', 'lso');
      else if(P.p > 0.32) radio('קצין נחיתה', 'האף גבוה מדי – יישר!', 'lso');
      else if(P.p < -0.32) radio('קצין נחיתה', 'אתה צולל – הרם את האף!', 'lso');
      else radio('קצין נחיתה', 'נראה טוב, המשך כך', 'lsoOk');
    }
  }
  // the player's kills, now and then
  if(R.kills == null) R.kills = G.kills;
  if(G.kills > R.kills){ R.kills = G.kills; if(w && Math.random() < 0.35) radio(wingCall(w), KILL_CALLS[Math.floor(Math.random()*KILL_CALLS.length)], 'kill'); }
  // the carrier taking hits
  if(R.chp == null) R.chp = G.carrier.hp;
  if(G.carrier.hp < R.chp - 1) radio('נושאת', 'אנחנו תחת התקפה! צריכים עזרה מעל הנושאת', 'carrier');
  R.chp = G.carrier.hp;
  // a wingman badly hurt (once each)
  for(const x of G.wingmen) if(!x.dead && !x.hurtCall && x.hp < x.max*0.4){ x.hurtCall = true; radio(wingCall(x), 'נפגעתי! אני מחזיק מעמד', null); }
}

// intensity rises fast and falls slowly, so the music does not flicker between layers
function flightMusicUpdate(dt){
  if(!FlightMusic.playing) return;
  const c = combatIntensity(), M = G.musicK || 0;
  G.musicK = c.k > M ? Math.min(c.k, M + dt*1.2) : Math.max(c.k, M - dt*0.12);
  FlightMusic.set(G.musicK, c.boss);
}

// the radio box, under the star strip
function drawRadio(ctx){
  const R = G.radio; if(!R || !R.list.length) return;
  ctx.save(); ctx.font = '13px Rubik, sans-serif'; ctx.textBaseline = 'middle';
  const rtl = !isEn(); ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = rtl ? 'right' : 'left';
  R.list.forEach((m, i) => {
    const y = 142 + i*24, text = `📻 ${m.who}: ${m.text}`, w = Math.min(460, ctx.measureText(text).width + 22);
    ctx.globalAlpha = clamp(m.t, 0, 1);
    ctx.fillStyle = 'rgba(12,34,24,.78)'; ctx.fillRect(8, y, w, 20);
    ctx.fillStyle = '#7fd08a'; ctx.fillRect(rtl ? 8 + w - 3 : 8, y, 3, 20);
    ctx.fillStyle = '#d9f2d6'; ctx.fillText(text, rtl ? 8 + w - 11 : 19, y + 10.5);
  });
  ctx.restore();
}
