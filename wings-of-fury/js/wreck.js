// ---- Shot-down enemy aircraft: how they fall, burn, break up and end in the sea or on the ground ----
// A downed aircraft is a 'fall' effect that picks one of four ways down:
//   spiral - the nose drops along the path and it rolls round its own axis
//   flat   - a flat spin: it turns round the vertical axis, nose a little down, sinking almost straight down
//            (a plane that has lost a wing spins faster)
//   dive   - from high up only: it noses over into a long, steep, ever faster dive straight into the sea
//   glide  - a long burning glide, mostly for the bombers
// spiral, flat and dive are drawn with the 3D model (plane3d.js), so the roll and the spin really turn the
// aircraft in depth; the glide, seen side on, uses the detailed sprite.
// Some lose a wing on the way, some Zeros blow apart in the air, and some pilots jump. The fire is a tongue of
// flame from the engine streaming back along the path, the smoke a continuous ribbon that widens, greys and drifts
// on the wind, and stays in the sky for a few seconds after the end. Into the sea: a tall splash, the tail standing
// up for a moment, bubbles and an oil slick that sometimes burns; onto land: a fireball and a burning wreck.
const WRECK = {trailEvery: 0.04, trailMax: 70, maxFalling: 6, trailLife: 3.5};
const WRECK_COL = {zero: '#c9c3a8', val: '#6b7a55', betty: '#5d6b4c'};
const WRECK_ENGINE = {betty: [6, 3]};                                // where the fire is, in the aircraft's own frame
const sgn = () => Math.random() < 0.5 ? -1 : 1;

function makeFall(e){
  const big = e.type === 'betty' || e.type === 'val', r = Math.random();
  const falling = G.fx.filter(f => f.type === 'fall').length;
  // high up, a third of them go into the long dive; otherwise spiral / flat spin / glide
  const high = groundY(e.x) - e.y > 450;
  const mode = high && Math.random() < 0.35 ? 'dive'
    : big ? (r < 0.65 ? 'glide' : r < 0.9 ? 'spiral' : 'flat') : (r < 0.5 ? 'spiral' : r < 0.75 ? 'flat' : 'glide');
  // a Zero has no armour and no self-sealing tanks: now and then it simply blows apart (and so does anything
  // beyond a handful already falling, to keep the screen readable)
  const burst = (e.type === 'zero' && Math.random() < 0.22) || falling >= WRECK.maxFalling;
  const f = {type: 'fall', kind: e.type, skin: e.skin || null, x: e.x, y: e.y,
    vx: Math.cos(e.a)*e.speed*0.6, vy: Math.sin(e.a)*e.speed*0.4 - 30, rot: e.a, spin: rnd(2, 3.2)*sgn(), roll: 0, rollV: rnd(5, 8)*sgn(),
    mode, t: 0, max: 14, fire: 0.35, trail: [], trailT: 0,
    face: Math.cos(e.a) >= 0 ? 1 : -1, yaw: Math.cos(e.a) >= 0 ? 0 : Math.PI, diveAng: rnd(1.1, 1.4), wingSide: sgn(),
    burstT: burst ? rnd(0.15, 0.4) : -1, wingOff: !burst && mode !== 'glide' && mode !== 'dive' && Math.random() < 0.3,
    // the pilot jumps only where the player can see it happen: a canopy from a kill far off screen (by a wingman
    // or the carrier's guns) used to drift into view later with no aircraft going down anywhere near it
    bailT: !burst && SEA - e.y > 220 && fallInView(e) && Math.random() < 0.3 ? rnd(0.5, 1.1) : -1};
  wreckWhine(f);
  return f;
}

// the 3D attitude of a spiral, flat spin or dive (null for the glide, drawn as a sprite)
function fall3D(f){
  if(f.mode === 'flat') return {yaw: f.yaw, roll: 0.2*Math.sin(f.t*3), pitch: -0.5};
  if(f.mode !== 'spiral' && f.mode !== 'dive') return null;
  return {yaw: f.face > 0 ? 0 : Math.PI, roll: f.roll, pitch: -Math.atan2(f.vy, f.face*f.vx)};   // nose along the path
}
// is (x, y) on the player's screen, more or less? (the view is about 1,100 wide around the aircraft)
function fallInView(e){
  const P = G.player; if(!P || P.dead) return false;
  return Math.abs(e.x - P.x) < 520 && Math.abs(e.y - P.y) < 380;
}
// the point the fire comes from, in the world
function fallFirePoint(f){
  const A = fall3D(f);
  if(A){
    const [ox, oy, oz] = f.kind === 'betty' ? [6, 3, 9] : [16, 1, 0];
    const p = xform([ox, oy, oz], Math.cos(A.roll), Math.sin(A.roll), Math.cos(A.pitch), Math.sin(A.pitch), Math.cos(A.yaw), Math.sin(A.yaw));
    return {x: f.x + p[0], y: f.y + p[1]};
  }
  const [ox, oy] = WRECK_ENGINE[f.kind] || [14, 1], c = Math.cos(f.rot), s = Math.sin(f.rot);
  const sy = fallFlip(f) * fallSquash(f);
  return {x: f.x + c*ox - s*oy*sy, y: f.y + s*ox + c*oy*sy};
}
// heading left, it is drawn mirrored so it is not upside down - except in a flat spin, where it really turns over
const fallFlip = f => f.mode !== 'flat' && Math.cos(f.rot) < 0 ? -1 : 1;
// how much of the aircraft's side we see while it rolls (1 = flat side on, near 0 = edge on)
function fallSquash(f){
  if(f.mode !== 'spiral') return 1;
  const c = Math.cos(f.roll); return Math.sign(c || 1) * Math.max(0.12, Math.abs(c));
}

function updateFalls(dt){
  const W = G.weather.wind;
  for(const f of G.fx){
    if(f.t >= f.max) continue;
    if(f.type === 'fall') updateFall(f, dt, W);
    else if(f.type === 'part') updatePart(f, dt);
    else if(f.type === 'trailfade') for(const p of f.pts){ p.x += W*0.3*dt; p.y -= 5*dt; }
    else if(f.type === 'echute') updateEnemyChute(f, dt, W);
    else if((f.type === 'slick' && f.burn && f.t < f.max - 2) || (f.type === 'wreck' && f.t < f.max - 1.5)){
      if(Math.random() < dt*(f.type === 'wreck' ? 10 : 6)) puff(f.x + rnd(-10, 10), (f.type === 'wreck' ? f.y : SEA) - 6, '#24221f', 8, 1.6);
    }
  }
}

function updateFall(f, dt, W){
  if(f.mode === 'glide'){ f.vy += 140*dt; f.vx *= 1 - 0.12*dt; }
  else if(f.mode === 'flat'){ f.vy = Math.min(190, f.vy + 260*dt); f.vx *= 1 - 1.2*dt; }
  else if(f.mode === 'dive'){
    // nose over to a steep angle, then straight down it, faster and faster
    const want = f.face > 0 ? f.diveAng : Math.PI - f.diveAng;
    let h = Math.atan2(f.vy, f.vx), d = Math.atan2(Math.sin(want - h), Math.cos(want - h));
    h += clamp(d, -1.4*dt, 1.4*dt);
    const spd = Math.min(560, Math.hypot(f.vx, f.vy) + 170*dt);
    f.vx = Math.cos(h)*spd; f.vy = Math.sin(h)*spd;
  }
  else { f.vy += 300*dt; f.vx *= 1 - 0.3*dt; }
  f.x += f.vx*dt; f.y += f.vy*dt;
  if(f.mode === 'flat'){ f.yaw += f.spin*(f.wingGone ? 1.8 : 1)*dt; f.rot = Math.PI/2 - 0.5; }   // turning round the vertical axis
  else if(f.mode === 'dive'){ f.rot = Math.atan2(f.vy, f.vx); f.roll += 1.3*dt; }               // a slow roll on the way down
  else {
    // the nose follows the path down
    let d = Math.atan2(f.vy, f.vx) - f.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
    f.rot += d*Math.min(1, dt*(f.mode === 'glide' ? 1.5 : 2.5));
    if(f.mode === 'spiral') f.roll += f.rollV*(f.wingGone ? 1.7 : 1)*dt; else f.roll = Math.sin(f.t*2)*0.35;
  }
  f.fire = Math.min(1, f.fire + dt*0.35);                              // the fire takes hold as it falls
  if(f.wingOff && !f.wingGone && f.t > 0.2){ f.wingGone = true; G.fx.push(wreckPart(f, 'wing')); f.spin *= 1.6; }
  if(f.burstT >= 0 && f.t >= f.burstT){ midairBreak(f); return; }
  if(f.bailT >= 0 && f.t >= f.bailT){ f.bailT = -1; G.fx.push({type: 'echute', x: f.x, y: f.y - 6, vx: f.vx*0.25, t: 0, max: 40}); }
  const fp = fallFirePoint(f);
  if(Math.random() < dt*10) spark(fp.x, fp.y);
  // the smoke ribbon: a point every few hundredths of a second, drifting on the wind and rising a little
  f.trailT -= dt;
  if(f.trailT <= 0){ f.trailT = WRECK.trailEvery; f.trail.push({x: fp.x, y: fp.y, t: G.time}); if(f.trail.length > WRECK.trailMax) f.trail.shift(); }
  for(const p of f.trail){ p.x += W*0.3*dt; p.y -= 5*dt; }
  const gy = groundY(f.x);
  if(f.y >= gy - 4){ f.t = f.max; wreckImpact(f, gy); }
}

// a piece of a broken aircraft: a wing, the front with the burning engine, or the tail
function wreckPart(f, shape){
  return {type: 'part', shape, kind: f.kind, skin: f.skin, x: f.x, y: f.y, vx: f.vx + rnd(-70, 70), vy: f.vy - rnd(20, 90),
    rot: f.rot, spin: rnd(4, 9)*sgn(), t: 0, max: 10, burn: shape !== 'wing' || Math.random() < 0.5, flip: Math.cos(f.rot) < 0};
}
function updatePart(f, dt){
  f.vy += 330*dt; f.vx *= 1 - 0.5*dt; f.x += f.vx*dt; f.y += f.vy*dt; f.rot += f.spin*dt;
  if(f.burn && Math.random() < dt*12) puff(f.x, f.y, '#2a2826', 6, 1.1);
  const gy = groundY(f.x);
  if(f.y >= gy - 2){
    f.t = f.max;
    if(overSea(f.x)) G.fx.push({type: 'wsplash', x: f.x, t: 0, max: 0.9, h: 26, w: 7});
    else boom(f.x, gy - 2, 14, false, true);
  }
}
function midairBreak(f){
  boom(f.x, f.y, 40, true, true); SFX.planeBoom();
  for(const s of ['front', 'tail', 'wing', 'wing']) G.fx.push(wreckPart(f, s));
  for(let i = 0; i < 8; i++) G.debris.push({x: f.x, y: f.y, vx: f.vx*0.5 + rnd(-150, 150), vy: rnd(-180, 60), r: 0, vr: rnd(-9, 9), life: 2, c: WRECK_COL[f.kind] || '#999', smoke: i < 3});
  f.t = f.max; keepTrail(f);
}
function keepTrail(f){ if(f.trail.length > 2) G.fx.push({type: 'trailfade', pts: f.trail, t: 0, max: WRECK.trailLife}); }

function wreckImpact(f, gy){
  keepTrail(f);
  addTraumaAt(f.x, gy, 0.3, 320);
  if(overSea(f.x)){
    splash(f.x);
    const dive = f.mode === 'dive';                                    // straight in at full speed: a much taller column
    G.fx.push({type: 'wsplash', x: f.x, t: 0, max: dive ? 1.7 : 1.3, h: (f.kind === 'betty' ? 80 : 58)*(dive ? 1.9 : 1), w: (f.kind === 'betty' ? 18 : 12)*(dive ? 1.3 : 1)});
    if(dive){ addTraumaAt(f.x, gy, 0.35, 450); SFX.boom(false); }
    G.fx.push({type: 'sink', x: f.x, kind: f.kind, skin: f.skin, dir: Math.sign(f.vx) || 1, t: 0, max: dive ? 1.4 : 2.6, steep: dive});
    G.fx.push({type: 'slick', x: f.x + (Math.sign(f.vx) || 1)*10, t: 0, max: 12, w: rnd(28, 46), burn: Math.random() < 0.45});
  } else {
    boom(f.x, gy - 4, 32, true, true); SFX.boom(false);
    G.fx.push({type: 'wreck', x: f.x, y: gy, kind: f.kind, rot: rnd(-0.25, 0.25), flip: f.vx < 0, t: 0, max: 8});
  }
}

// an enemy pilot under a white canopy, down to the sea, where he stays a moment and is gone
function updateEnemyChute(f, dt, W){
  if(f.down) return;
  const open = Math.min(1, f.t/0.7);
  f.vx += (W*0.6 - f.vx)*Math.min(1, dt*0.8); f.x += f.vx*dt; f.y += (open < 1 ? 110 : 45)*dt;
  if(f.y >= groundY(f.x) - 4){ f.down = true; f.y = groundY(f.x) - 2; f.max = f.t + 3; }
}

// the rising whine of a plane diving to its end, for falls near the player (one at a time)
function wreckWhine(f){
  const P = G.player; if(!P || P.dead || Math.hypot(f.x - P.x, f.y - P.y) > 1000) return;
  if((SFX.diveUntil || 0) > G.time) return;
  const h = Math.max(40, groundY(f.x) - f.y);
  const dur = f.mode === 'dive' ? Math.min(5, h/330 + 1) : Math.min(4, f.mode === 'glide' ? h/120 : Math.sqrt(2*h/300) + 0.4);
  SFX.diveUntil = G.time + dur;
  if(SFX.dive) SFX.dive(dur);
}

// ---------- drawing ----------
function drawWreckFx(ctx, f, k){
  switch(f.type){
    case 'fall': drawSmokeRibbon(ctx, f.trail, 0); drawFall(ctx, f); break;
    case 'trailfade': drawSmokeRibbon(ctx, f.pts, k); break;
    case 'part': drawPart(ctx, f); break;
    case 'wsplash': drawWaterColumn(ctx, f, k); break;
    case 'sink': drawSink(ctx, f, k); break;
    case 'slick': drawSlick(ctx, f, k); break;
    case 'wreck': drawGroundWreck(ctx, f, k); break;
    case 'echute': drawEnemyChute(ctx, f); break;
  }
}

// a widening ribbon: black and dense at the aircraft, then grey and thin as it ages; fade (0..1) for a trail left behind
// It is stroked as a few long polylines, one per age band, rather than segment by segment: overlapping
// see-through segments would show as a string of beads.
const RIBBON_BANDS = 14;
function drawSmokeRibbon(ctx, pts, fade){
  if(pts.length < 2) return;
  const band = p => Math.min(RIBBON_BANDS - 1, Math.floor((G.time - p.t)/WRECK.trailLife*RIBBON_BANDS));
  ctx.save(); ctx.lineCap = 'butt'; ctx.lineJoin = 'round';          // flat ends: neighbouring bands meet without overlapping
  let i = pts.length - 1;
  while(i > 0){
    const b = band(pts[i]); let j = i;
    while(j > 0 && band(pts[j-1]) === b) j--;
    const age = (b + 0.5)/RIBBON_BANDS*WRECK.trailLife, a = Math.max(0, 1 - (b + 0.5)/RIBBON_BANDS)*(1 - fade);
    if(a > 0.01){
      const g = Math.round(28 + Math.min(1, age/1.6)*72);
      ctx.strokeStyle = `rgba(${g},${g-2},${g-4},${0.62*a})`; ctx.lineWidth = Math.min(28, 7 + age*8);
      ctx.beginPath(); ctx.moveTo(pts[Math.max(0, j-1)].x, pts[Math.max(0, j-1)].y);   // join the band before it
      for(let k = j; k <= i; k++) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.stroke();
    }
    if(j === 0) break;
    i = j - 1;
  }
  ctx.restore();
}
function drawFlame(ctx, x, y, vx, vy, size){
  const ang = Math.atan2(-vy, -vx), len = 8 + 14*size + Math.random()*6, wid = 2.5 + 2.5*size;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = 'rgba(255,110,30,.75)'; ctx.beginPath(); ctx.ellipse(len*0.45, 0, len*0.6, wid*1.3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = `rgba(255,${190 + (Math.random()*50|0)},70,.9)`; ctx.beginPath(); ctx.ellipse(len*0.3, 0, len*0.38, wid*0.8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,248,215,.95)'; ctx.beginPath(); ctx.ellipse(len*0.12, 0, len*0.16, wid*0.4, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function drawFall(ctx, f){
  const A = fall3D(f);
  if(A){
    // the flame first, so the aircraft stays readable with the fire streaming out from behind it
    const fp = fallFirePoint(f); drawFlame(ctx, fp.x, fp.y, f.vx, f.vy, f.fire*0.8);
    ctx.save(); ctx.translate(f.x, f.y);
    drawPlane3D(ctx, f.kind, f.skin, 'jp', A.yaw, A.roll, A.pitch, false, false, f.wingGone ? {noWing: f.wingSide} : null);
    ctx.restore();
    // the fire streaming on past the tail, and the glow of the burning engine
    const tp = xform([-20, 0, 0], Math.cos(A.roll), Math.sin(A.roll), Math.cos(A.pitch), Math.sin(A.pitch), Math.cos(A.yaw), Math.sin(A.yaw));
    drawFlame(ctx, f.x + tp[0], f.y + tp[1], f.vx, f.vy, f.fire*0.55);
    ctx.fillStyle = `rgba(255,${170 + (Math.random()*70|0)},60,.55)`; ctx.beginPath(); ctx.arc(fp.x, fp.y, 1.5 + 1.5*f.fire, 0, 7); ctx.fill();
    return;
  }
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
  ctx.scale(1, fallFlip(f) * fallSquash(f));                       // upright whichever way it heads, squashed while it rolls
  if(f.wingGone){ ctx.fillStyle = '#1b1a18'; ctx.beginPath(); ctx.moveTo(-2, 1); ctx.lineTo(6, 0); ctx.lineTo(3, 4); ctx.lineTo(-1, 3.5); ctx.fill(); }
  drawPlane(ctx, f.kind, f.skin, null, 1, false, false);
  ctx.restore();
  const fp = fallFirePoint(f); drawFlame(ctx, fp.x, fp.y, f.vx, f.vy, f.fire);
}
function drawPart(ctx, f){
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); if(f.flip) ctx.scale(1, -1);
  if(f.shape === 'wing'){
    ctx.fillStyle = WRECK_COL[f.kind] || '#999'; ctx.beginPath(); ctx.moveTo(-10, -1.5); ctx.lineTo(9, -2); ctx.lineTo(10, 1.5); ctx.lineTo(-8, 2.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b8322a'; ctx.beginPath(); ctx.arc(1, 0, 1.6, 0, 7); ctx.fill();          // the roundel on it
    ctx.fillStyle = '#1b1a18'; ctx.fillRect(-10, -1.5, 2, 3.7);
  } else {
    // half the aircraft: clip the full drawing at a ragged cut just behind the cockpit
    ctx.beginPath();
    if(f.shape === 'front'){ ctx.moveTo(-1, -20); ctx.lineTo(40, -20); ctx.lineTo(40, 20); ctx.lineTo(-1, 20); ctx.lineTo(2, 6); ctx.lineTo(-3, 1); ctx.lineTo(1, -5); }
    else { ctx.moveTo(-40, -20); ctx.lineTo(-1, -20); ctx.lineTo(1, -5); ctx.lineTo(-3, 1); ctx.lineTo(2, 6); ctx.lineTo(-1, 20); ctx.lineTo(-40, 20); }
    ctx.closePath(); ctx.save(); ctx.clip(); drawPlane(ctx, f.kind, f.skin, null, 1, false, false); ctx.restore();
  }
  ctx.restore();
  if(f.burn) drawFlame(ctx, f.x, f.y, f.vx, f.vy, 0.3);
}
// a tall column of white water that rises, spreads and falls back, with a ring of foam
function drawWaterColumn(ctx, f, k){
  const h = f.h*Math.sin(Math.min(1, k*1.4)*Math.PI), w = f.w*(1 + k*0.8), a = 1 - k;
  ctx.fillStyle = `rgba(235,245,252,${0.85*a})`;
  ctx.beginPath(); ctx.moveTo(f.x - w*0.6, SEA); ctx.quadraticCurveTo(f.x - w*0.3, SEA - h*0.6, f.x - w*0.15, SEA - h);
  ctx.quadraticCurveTo(f.x, SEA - h*1.12, f.x + w*0.15, SEA - h); ctx.quadraticCurveTo(f.x + w*0.3, SEA - h*0.6, f.x + w*0.6, SEA); ctx.closePath(); ctx.fill();
  for(let i = 0; i < 7; i++){                                          // droplets thrown out of the top
    const s = (i/6 - 0.5)*2, dx = s*w*(0.8 + k*1.6), dy = -h*0.9 + k*k*60 - Math.abs(s)*8;
    ctx.fillRect(f.x + dx, SEA + Math.min(0, dy), 2, 2);
  }
  ctx.strokeStyle = `rgba(240,248,255,${0.6*a})`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(f.x, SEA + 1, w*(1 + k*2.4), 2.5 + k*2, 0, 0, 7); ctx.stroke();
}
// the tail standing out of the water for a moment, sliding under, then bubbles
function drawSink(ctx, f, k){
  const down = Math.min(1, k*1.25)*26;
  if(k < 0.8){
    ctx.save(); ctx.beginPath(); ctx.rect(f.x - 40, SEA - 60, 80, 60); ctx.clip();
    ctx.translate(f.x, SEA + down - 6); ctx.scale(f.dir, 1); ctx.rotate(f.steep ? 1.45 : 1.2);   // nose down, tail up
    drawPlane(ctx, f.kind, f.skin, null, 1, false, false); ctx.restore();
  }
  ctx.fillStyle = `rgba(230,242,250,${0.8*(1 - k)})`;
  for(let i = 0; i < 4; i++){ const ph = (k*5 + i*0.37) % 1; ctx.beginPath(); ctx.arc(f.x + (i - 1.5)*5, SEA - ph*6, 1.2 + ph, 0, 7); ctx.fill(); }
}
// oil on the water: a dark sheen that spreads and fades, sometimes burning with low flames
function drawSlick(ctx, f, k){
  const w = f.w*(0.5 + Math.min(1, k*3)*0.7), a = k > 0.75 ? (1 - k)/0.25 : 1;
  ctx.fillStyle = `rgba(20,24,28,${0.38*a})`; ctx.beginPath(); ctx.ellipse(f.x, SEA + 1.5, w, 2.6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = `rgba(150,120,200,${0.12*a})`; ctx.beginPath(); ctx.ellipse(f.x - w*0.2, SEA + 1, w*0.5, 1.2, 0, 0, 7); ctx.fill();   // rainbow sheen
  if(f.burn && f.t < f.max - 2){
    const n = 4, fade = Math.min(1, (f.max - 2 - f.t)/2);
    for(let i = 0; i < n; i++){
      const x = f.x + (i/(n-1) - 0.5)*w*1.3, h = (4 + Math.random()*7)*fade;
      ctx.fillStyle = `rgba(255,${130 + (Math.random()*90|0)},40,.85)`; ctx.beginPath(); ctx.moveTo(x - 3, SEA + 1); ctx.quadraticCurveTo(x, SEA - h*1.6, x + 3, SEA + 1); ctx.fill();
    }
  }
}
// a broken, blackened airframe lying on the ground, burning out
function drawGroundWreck(ctx, f, k){
  ctx.save(); ctx.translate(f.x, f.y - 3); ctx.rotate(f.rot); if(f.flip) ctx.scale(-1, 1);
  ctx.globalAlpha = k > 0.8 ? (1 - k)/0.2 : 1;
  ctx.fillStyle = '#26231f';
  ctx.beginPath(); ctx.moveTo(-16, 2); ctx.lineTo(-10, -3); ctx.lineTo(4, -4); ctx.lineTo(13, -1); ctx.lineTo(15, 3); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-18, 1); ctx.lineTo(-14, -9); ctx.lineTo(-11, -2); ctx.fill();             // the tail fin sticking up
  ctx.fillStyle = '#3a3630'; ctx.fillRect(-4, -2, 12, 3); ctx.fillRect(10, 1, 9, 2);                   // a bent wing
  ctx.restore();
  if(f.t < f.max - 1.5) for(let i = 0; i < 2; i++) drawFlame(ctx, f.x + (i ? 6 : -5), f.y - 4, 0, 60, 0.25 + 0.15*i);
}
function drawEnemyChute(ctx, f){
  const open = Math.min(1, f.t/0.7), a = f.down ? Math.max(0, (f.max - f.t)/3) : 1;
  ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = a;
  if(!f.down){
    ctx.rotate(Math.sin(f.t*1.8)*0.12);
    if(open > 0.05){
      const r = 3 + 10*open;
      ctx.fillStyle = '#eeebe2'; ctx.beginPath(); ctx.arc(0, -24, r, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(40,40,40,.5)'; ctx.lineWidth = 0.6; ctx.beginPath();
      for(const s of [-1, -0.35, 0.35, 1]){ ctx.moveTo(s*r, -24); ctx.lineTo(0, -5); } ctx.stroke();
    }
    ctx.fillStyle = '#6b6a4a'; ctx.fillRect(-1.5, -5, 3, 5);
    ctx.fillStyle = '#d9a982'; ctx.beginPath(); ctx.arc(0, -6.5, 1.6, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(238,235,226,.8)'; ctx.beginPath(); ctx.ellipse(6, 0, 8, 1.6, 0, 0, 7); ctx.fill();   // the canopy spread on the water
    ctx.fillStyle = '#d9a982'; ctx.beginPath(); ctx.arc(-2, -2, 1.6, 0, 7); ctx.fill();
  }
  ctx.restore();
}
// lights for the night layer (render.js drawDarkness)
function wreckLights(hole){
  for(const f of G.fx){
    if(f.type === 'fall') hole(f.x, f.y, 55, 0.7);
    else if(f.type === 'part' && f.burn) hole(f.x, f.y, 30, 0.45);
    else if(f.type === 'slick' && f.burn && f.t < f.max - 2) hole(f.x, SEA, 45, 0.5);
    else if(f.type === 'wreck' && f.t < f.max - 1.5) hole(f.x, f.y - 4, 40, 0.55);
  }
}
