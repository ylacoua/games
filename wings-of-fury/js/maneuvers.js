// ---- Combat manoeuvres ----
// Shared by every aircraft that flies the "pilot" model (the player's plane and the wingmen: facing f, pitch p)
// and, in a simpler form, by the Japanese fighters (heading angle a):
//   loop, Immelmann (half loop + half roll), split-S (half roll + half loop down), hammerhead (stall turn),
//   barrel roll (evasive), air brake (make a pursuer overshoot) and, for dive bombers, dive brakes.
// o.roll is the visual roll about the nose axis (0 = upright, PI = on its back). It eases toward o.rollGoal,
// and the 3D model is drawn whenever the aircraft is between those two attitudes, so nothing ever snaps over.

const DIVE_BOMBERS = {dauntless:1, helldiver:1, val:1};
const ROLL_RATE = Math.PI/0.35;                 // a half roll takes about a third of a second
const BARREL_T = 0.65, BARREL_COOL = 2.2;       // barrel roll: duration and the pause before the next one
const BRAKE_T = 0.9, BRAKE_COOL = 2.5;          // air brake
const BARREL_DODGE = 0.6;                       // share of bullets that miss an aircraft in a barrel roll

// Reverse the facing while keeping the exact attitude in space (the same flight path, described from the
// other side): heading angle ang becomes PI-ang and the roll turns half way round.
function mvFlip(o, ang){
  o.f = -o.f;
  o.p = clamp(wrapA(Math.PI - ang), -1.35, 1.35);
  o.roll = wrapA((o.roll||0) + Math.PI);
}

// Split-S: half roll onto the back, then pull through a half loop downward; exits upright, reversed and lower.
// Hammerhead: pull to the vertical, climb until the speed is almost gone, pivot over (seen from above, wings
// edge-on to the sky) and come straight back down the other way.
function mvStart(o, kind){
  if(kind==='split'){ o.mv = {kind, ang:o.p, t:0}; o.rollGoal = Math.PI; }
  else if(kind==='hammer'){ o.mv = {kind, ang:o.p, t:0, phase:0}; o.rollGoal = Math.PI/2; }
}

// advance a split-S or hammerhead in progress (the caller moves the aircraft along mv.ang)
function mvUpdate(o, dt, turn){
  const m = o.mv; if(!m) return;
  m.t += dt;
  if(m.kind==='split'){
    const rolled = Math.abs(wrapA(o.roll - Math.PI)) < 0.6;            // pull hard only once on its back
    m.ang -= turn*0.85*(rolled ? 1 : 0.3)*dt;
    o.speed = Math.max(o.speed, 140);
    if(m.ang <= -Math.PI){ mvFlip(o, m.ang); o.p = 0; o.rollGoal = 0; o.mv = null; }
  } else if(m.kind==='hammer'){
    if(m.phase===0){
      m.ang = Math.min(Math.PI/2, m.ang + turn*0.9*dt);                // up to the vertical
      o.speed -= 150*dt;                                               // trading speed for height
      if(o.speed < 75 || m.t > 2.4) m.phase = 1;
    } else {
      o.speed = Math.max(25, o.speed - 120*dt);
      m.ang += 3.4*dt;                                                 // pivot: the nose sweeps over and down
      if(m.ang >= Math.PI*1.5){ mvFlip(o, m.ang); o.rollGoal = 0; o.mv = null; o.speed = Math.max(o.speed, 70); }
    }
  }
}

// per-frame bookkeeping for every manoeuvring aircraft: roll easing, barrel roll path, air brake, cooldowns
function mvTick(o, dt){
  if(o.roll == null){ o.roll = 0; o.rollGoal = 0; }
  const d = wrapA((o.rollGoal||0) - o.roll), s = ROLL_RATE*dt;
  o.roll = Math.abs(d) <= s ? (o.rollGoal||0) : wrapA(o.roll + Math.sign(d)*s);
  o.brCool = Math.max(0, (o.brCool||0) - dt); o.bkCool = Math.max(0, (o.bkCool||0) - dt);
  if(o.br){
    // corkscrew: the aircraft rises off its line and settles back onto it as it rolls right round
    o.y -= 15*Math.PI*Math.cos(Math.PI*o.br.t)/BARREL_T*dt;
    o.br.t += dt/BARREL_T; if(o.br.t >= 1) o.br = null;
  }
  if(o.brk > 0){ o.brk -= dt; o.speed = Math.max(105, o.speed - 230*dt); }
}
function mvBarrel(o){ if(o.br || o.brCool > 0) return false; o.br = {t:0}; o.brCool = BARREL_COOL; o.speed *= 0.93; return true; }
function mvBrake(o){ if(o.brk > 0 || o.bkCool > 0) return false; o.brk = BRAKE_T; o.bkCool = BRAKE_COOL; return true; }
function mvBusy(o){ return !!(o.mv || o.br); }
// a bullet that reaches an aircraft in a barrel roll usually goes wide
function dodges(o){ return !!o.br && Math.random() < BARREL_DODGE; }

// the roll actually shown: the eased roll plus a full turn during a barrel roll
function visRoll(o){
  let r = o.roll || 0;
  if(o.br){ const t = o.br.t; r += 2*Math.PI*t*t*(3-2*t); }
  return wrapA(r);
}

// Draw a pilot-model aircraft (ctx already at its position): the flat sprite when upright or on its back,
// otherwise the 3D model at the true roll angle; then any brakes that are out.
function drawPilotPlane(ctx, o, type, nation, ang, flash, prop, gear){
  const r = visRoll(o);
  ctx.save();
  if(Math.abs(r) < 0.02 || Math.abs(r) > Math.PI-0.02){
    ctx.scale(o.f, 1); ctx.rotate(-ang); if(Math.abs(r) > 1) ctx.scale(1, -1);
    drawPlane(ctx, type, null, null, 1, flash, prop, gear);
    drawBrakes(ctx, type, o.dive, o.brk > 0);
  } else drawPlane3D(ctx, type, null, nation, o.f > 0 ? 0 : Math.PI, r, ang, flash, prop);
  ctx.restore();
}

// Split flaps under the wing's trailing edge (air brake), plus the perforated upper plates of a dive bomber's
// dive brakes. Drawn in the sprite's own frame (nose +x).
function drawBrakes(ctx, type, dive, air){
  if(!dive && !air) return;
  const A = AIRCRAFT[type]; if(!A) return;
  const w = A.wing, xe = w.x - w.rx*0.15, y = w.y;
  const plate = (s) => {
    ctx.beginPath(); ctx.moveTo(xe, y+s*1); ctx.lineTo(xe-8, y+s*1); ctx.lineTo(xe-10.5, y+s*6.5); ctx.lineTo(xe-2.5, y+s*6.5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    if(dive){ ctx.fillStyle='rgba(20,24,30,.8)'; for(let k=0;k<3;k++){ ctx.beginPath(); ctx.arc(xe-3-k*2.4-s*0, y+s*3.8, 0.7, 0, 7); ctx.fill(); } ctx.fillStyle='#7d8590'; }
  };
  ctx.fillStyle='#7d8590'; ctx.strokeStyle='rgba(30,34,40,.85)'; ctx.lineWidth=0.6;
  plate(1);                       // below the wing
  if(dive) plate(-1);             // and above it
}

// ---- Japanese fighters (heading-angle model) ----
// Manoeuvres picked when someone is on their tail; e.faceLock / e.rollOverride steer the renderer's roll.
function zeroManeuver(e, kind){
  const dir = Math.cos(e.a) >= 0 ? 1 : -1;
  e.man = kind; e.mdir = dir; e.mphase = 0;
  if(kind==='split'){ e.mt = 2.5; e.faceLock = -dir; }                  // roll onto the back first
  else if(kind==='imm'){ e.mt = 2.5; e.faceLock = dir; }                 // stay upright until over the top
  else if(kind==='hammer'){ e.mt = 3.2; e.faceLock = dir; e.rollOverride = Math.PI/2; }
  else if(kind==='barrel'){ e.mt = BARREL_T; e.br = {t:0}; e.speed *= 0.93; }
  else if(kind==='brake'){ e.mt = BRAKE_T; e.brk = BRAKE_T; }
}
// Runs a zero's special manoeuvre for this frame. Returns true when it handled the movement itself.
function zeroManeuverStep(e, dt, turn){
  const dir = e.mdir, end = () => { e.man = null; e.mt = 0; e.faceLock = null; e.rollOverride = null; };
  if(e.br){ e.y -= 15*Math.PI*Math.cos(Math.PI*e.br.t)/BARREL_T*dt; e.br.t += dt/BARREL_T; if(e.br.t >= 1){ e.br = null; if(e.man==='barrel') end(); } }
  if(e.brk > 0){ e.brk -= dt; e.speed = Math.max(95, e.speed - 230*dt); if(e.brk <= 0){ e.brk = 0; if(e.man==='brake') end(); } }
  if(e.man==='barrel' || e.man==='brake') return false;
  if(e.man==='split'){
    // nose down and round underneath (a turns toward +PI/2 = down, then on to the reverse heading)
    if(Math.cos(e.a)*dir < -0.85){ end(); return false; }
    steerAngle(e, e.a + dir*1.3, turn*1.15, dt); e.speed = Math.max(e.speed, e.base*0.95);
    return true;
  }
  if(e.man==='imm'){
    if(Math.cos(e.a)*dir < -0.85){ end(); return false; }               // over the top: now it rolls upright
    steerAngle(e, e.a - dir*1.3, turn*1.15, dt);
    return true;
  }
  if(e.man==='hammer'){
    const up = -Math.PI/2;
    if(e.mphase===0){
      e.a = wrapA(e.a + clamp(wrapA(up - e.a), -2.2*dt, 2.2*dt));
      e.speed -= 160*dt;
      if(e.speed < 75 || Math.abs(wrapA(up - e.a)) < 0.05 && e.speed < 95) e.mphase = 1;
    } else {
      e.speed = Math.max(25, e.speed - 120*dt);
      e.a = wrapA(e.a - dir*3.4*dt);                                     // pivot back over the top
      if(Math.sin(e.a) > 0.97){ e.face = -dir; end(); e.speed = Math.max(e.speed, 90); }
    }
    e.x += Math.cos(e.a)*e.speed*dt; e.y += Math.sin(e.a)*e.speed*dt;
    return true;
  }
  return false;
}
