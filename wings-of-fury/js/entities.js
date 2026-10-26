// ---- Player flight model, weapons, projectiles, damage and effects ----
const keys = {};

// P.loop holds a flat turn-around in progress: {t: 0..1}. The plane keeps its altitude and pitch while
// its horizontal motion slows, passes through zero and reverses.
// P.vl: a vertical loop in progress; P.mv: a split-S or hammerhead (maneuvers.js)
function heading(P){ return P.mv ? P.mv.ang : P.vl ? P.vl.ang : P.p; }
function turnK(P){ return P.loop ? Math.cos(Math.PI*P.loop.t) : 1; }
function playerVel(P){ const a=heading(P); return {vx:P.f*Math.cos(a)*P.speed*turnK(P), vy:-Math.sin(a)*P.speed}; }

// our carriers (a second one exists in Carrier Defense and "The Burning Carrier")
function carriers(){ return G.carrier2 ? [G.carrier, G.carrier2] : [G.carrier]; }
function nearestCarrier(x){ return carriers().reduce((b,c)=> Math.abs(c.x+c.len/2-x) < Math.abs(b.x+b.len/2-x) ? c : b); }

function updatePlayer(dt){
  const P = G.player, st = G.stats, K = keys;
  const C = P.onDeck ? (P.deckC || G.carrier) : nearestCarrier(P.x);   // the deck we are on, or the nearest one
  if(P.dead) return;
  P.inv = Math.max(0, P.inv-dt); P.hitT = Math.max(0, P.hitT-dt);
  P.cool -= dt; P.ordCool -= dt; P.gunnerCool -= dt;

  // ---- on the carrier deck: taxi, take-off or roll out after landing ----
  if(P.onDeck){
    P.y = DECK_Y-9; P.p = 0; P.gear = 1; P.gearWant = 1;
    if(P.landing){
      P.speed = Math.max(0, P.speed - 330*dt);
      P.x += P.f*P.speed*dt;
      if(P.speed<=0){ P.landing=false; G.state='rearm'; UI.openDeck(false); }
    } else {
      // the deck ahead must be clear: wingmen parked forward launch before the player can roll
      const blocked = G.wingmen.some(w=>!w.dead && w.state==='launch' && w.y >= DECK_Y-10 && w.x > P.x);
      if(blocked && (K.KeyW||K.ArrowRight) && !(P.waitMsg>0)){ say('המתן: מטוסי הכנף ממריאים לפניך',1.5); P.waitMsg = 1.6; }
      P.waitMsg = (P.waitMsg||0) - dt;
      if(!blocked && (K.KeyW||K.ArrowRight)) P.throttle = Math.min(1, P.throttle+dt*0.7);
      if(K.KeyS||K.ArrowLeft)  P.throttle = Math.max(0, P.throttle-dt*1.2);
      P.speed += (P.throttle*st.speed*0.85 - P.speed)*0.7*dt;
      P.x += P.speed*dt;
      if(P.speed>0) G.state='fly';
      if((K.ArrowUp && P.speed>120) || P.x > C.x+C.len){ P.onDeck=false; P.airT=0; if(K.ArrowUp) P.p=0.18; say('בהצלחה, טייס!',2); }
    }
    if(P.x < C.x || P.x > C.x+C.len){
      if(P.landing && P.speed>150){ P.onDeck=false; P.landing=false; }   // touch-and-go
      else if(P.landing){ P.onDeck=false; P.landing=false; }
    }
    if(P.onDeck){ shootGuns(P, st, dt); return; }
  }

  // ---- airborne ----
  const outOfFuel = P.fuel<=0;
  if(K.KeyW) P.throttle = Math.min(1, P.throttle+dt*0.8);
  if(K.KeyS) P.throttle = Math.max(0, P.throttle-dt*0.8);
  const fwdKey = P.f>0 ? K.ArrowRight : K.ArrowLeft, backKey = P.f>0 ? K.ArrowLeft : K.ArrowRight;
  if(!P.loop && !P.vl && !P.mv){
    if(backKey && P.speed>110 && !P.br){ P.loop = {t:0}; P.p *= 0.5; }
    else if(fwdKey) P.throttle = Math.min(1, P.throttle+dt*0.8);
  }
  mvTick(P, dt);
  // Z: barrel roll (evasive) · S twice quickly: air brake (both from level-ish flight)
  if(K.KeyZ && !P.loop && !P.vl && !P.mv && P.speed > 110 && mvBarrel(P)){ P.lastMv = 'barrel'; say('גלגול חבית!', 0.8); }
  if(P.brakeReq){ P.brakeReq = false; if(!P.vl && !P.mv && P.speed > 130 && mvBrake(P)){ P.lastMv = 'brake'; say('בלימה! תן לרודף לעקוף אותך', 1.2); } }
  // dive bombers: ↓ + S in a steep dive opens the dive brakes; the plane pulls out by itself near the ground
  const diver = DIVE_BOMBERS[G.stats.type];
  if(diver && !P.loop && !P.vl && !P.mv){
    if(!P.dive && K.KeyS && K.ArrowDown && P.p <= -0.8){ P.dive = true; say('בלמי צלילה פתוחים – כוון והטל', 1.5); }
    if(P.dive && (!K.KeyS || P.p > -0.3)) P.dive = false;
  } else P.dive = false;
  if(P.dive && groundY(P.x) - P.y < 150){ P.dive = false; P.pull = true; say('משיכה!', 1); }
  if(P.pull){ P.p = Math.min(0.1, P.p + 2.4*dt); if(P.p >= 0.1) P.pull = false; }

  if(P.mv){
    mvUpdate(P, dt, st.turn);
    if(!P.mv) say(P.lastMv==='split' ? 'יציאה מספליט S' : 'יציאה מפניית פטיש', 0.8);
  } else if(!P.vl){
    // pitch stays available during the turn
    const tr = st.turn*0.5*(P.stall?0.4:1)*(P.loop?0.5:1);   // pitch rate: gentler than the turn-around
    if(K.ArrowUp && !P.pull) P.p += tr*dt;
    if(K.ArrowDown && !P.pull) P.p -= tr*dt;
    P.p = clamp(P.p, -1.35, 1.35);
    // keep pulling with the nose already pointing up: over the top into a full loop,
    // or, with the throttle back (S), stand on the tail and pivot over in a hammerhead
    P.upHold = (K.ArrowUp && P.p >= 0.95 && !P.loop && !P.br) ? (P.upHold||0) + dt : 0;
    if(P.upHold > 0.15){
      if(K.KeyS && P.speed > 80){ mvStart(P, 'hammer'); P.lastMv = 'hammer'; P.upHold = 0; say('פניית פטיש!', 1); }
      else if(P.speed > 140){ P.vl = {ang:P.p}; P.upHold = 0; say('לופ! ← לכיוון ההפוך בפסגה = אימלמן', 1.5); }
    }
    // keep pushing with the nose already pointing down: half roll and pull through into a split-S
    P.downHold = (K.ArrowDown && P.p <= -1.3 && !P.loop && !P.br && !K.KeyS && !P.dive) ? (P.downHold||0) + dt : 0;
    if(P.downHold > 0.25 && P.speed > 120){ mvStart(P, 'split'); P.lastMv = 'split'; P.downHold = 0; say('ספליט S!', 1); }
  } else {
    // vertical loop: the nose keeps coming round, over the top inverted and down the back, back to level flight
    P.vl.ang += st.turn*0.8*dt;
    P.speed = Math.max(P.speed, 130);
    // the arrow toward the new direction near the top: Immelmann, half roll upright and fly off reversed
    if(backKey && P.vl.ang > Math.PI*0.55 && P.vl.ang < Math.PI) P.vl.imm = true;
    if(P.vl.imm && P.vl.ang >= Math.PI){ mvFlip(P, P.vl.ang); P.p = 0; P.rollGoal = 0; P.vl = null; P.lastMv = 'imm'; say('אימלמן!', 1); }
    else if(P.vl.ang >= Math.PI*2){ P.p = 0; P.vl = null; P.lastMv = 'loop'; }
  }
  if(P.loop){
    P.loop.t += dt * st.turn/1.25;          // ~0.65s for a Hellcat, quicker for agile planes
    P.speed -= 40*dt;                       // a hard turn bleeds a little speed
    if(P.loop.t >= 1){ P.f = -P.f; P.loop = null; }
  }
  // boundaries: auto turn back
  if(!P.loop && !P.vl && !P.mv && ((P.x < -350 && P.f<0) || (P.x > G.L+350 && P.f>0))){ P.loop={t:0}; P.speed=Math.max(P.speed,170); }

  // landing gear: retracts after take-off, lowers automatically on approach to the carrier
  const mid = C.x + C.len/2;
  const nearCarrier = Math.abs(P.x-mid) < C.len/2+550 && P.y > DECK_Y-230;
  const towardDeck = Math.abs(P.x-mid) < C.len/2 || Math.sign(mid-P.x) === P.f;
  const want = (P.airT||0) < 1 ? 1 : ((P.airT||0) > 4 && nearCarrier && towardDeck && !P.loop && !P.mv && P.p <= 0.2) ? 1 : 0;
  if(want !== P.gearWant){ P.gearWant = want; SFX.tone(want?140:220, want?220:140, 0.6, 0.05, 'sawtooth'); if(want) say('גלגלים למטה',1.5); }
  P.gear = clamp(P.gear + clamp(want-P.gear, -dt/0.9, dt/0.9), 0, 1);

  const a = heading(P);
  const target = (outOfFuel ? 0 : P.throttle*st.speed) * (1 - 0.12*P.gear);
  P.speed += (target-P.speed)*0.55*dt - (Math.sin(a)>0 ? 145 : 70)*Math.sin(a)*dt;   // dives gain speed more slowly than climbs lose it
  P.speed = clamp(P.speed, 0, st.speed*1.2);
  if(P.dive) P.speed = Math.min(P.speed, st.speed*0.78);                 // dive brakes hold a steady, slow dive
  P.stall = P.speed < 100 && !P.loop && !P.vl && !P.mv;
  if(P.stall) P.p = Math.max(-1.3, P.p - 1.1*dt);
  const v = playerVel(P);
  P.x += v.vx*dt + G.weather.wind*0.35*dt + G.weather.gust*dt;
  P.y += v.vy*dt + (P.stall ? 80*dt : 0);
  if(P.y < CEIL){ P.y = CEIL; if(!P.loop && !P.vl && !P.mv) P.p = Math.min(P.p, 0); }
  if(!outOfFuel){ P.fuel -= (0.32+0.5*P.throttle)*dt; if(P.fuel<=0){ P.fuel=0; say('אזל הדלק! גלוש לנושאת',4); SFX.alarm(); } }
  else if(Math.random()<dt*0.5) {}
  if(P.hp < P.max*0.35){ P.smoke -= dt; if(P.smoke<=0){ P.smoke=0.05; puff(P.x-v.vx*0.03, P.y, '#333', 8); } }

  shootGuns(P, st, dt);
  if((K.KeyX||K.KeyB) && P.ordCool<=0 && P.ord>0) dropOrd(P);
  if(st.gunner) rearGunner(P);

  // ---- landing / ground collision ----
  const onCarrierX = P.x > C.x+10 && P.x < C.x+C.len-10;
  P.airT = (P.airT||0) + dt;
  if(onCarrierX && P.y >= DECK_Y-9 && P.y < DECK_Y+12){
    if(P.airT < 1.2 && P.p >= 0){ P.y = DECK_Y-9; P.p = Math.max(P.p, 0.05); return; }  // just lifted off
    if(C.burning > 0) return crashPlayer('הסיפון בוער – אי אפשר לנחות עליו עדיין');
    if(!P.loop && !P.vl && !P.mv && Math.abs(P.p)<0.32 && P.speed<225){
      P.deckC = C; G.homeDeck = C;                           // re-arm and take off again from this carrier
      P.onDeck=true; P.landing=true; P.y=DECK_Y-9; P.p=0; P.throttle=0; G.state='landing';
      SFX.tone(200,120,0.3,0.1,'triangle'); say('נחיתה! וו הבלימה נתפס',2);
      return;
    }
    return crashPlayer(Math.abs(P.p)>=0.32 ? 'נחיתה בזווית תלולה מדי' : 'מהיר מדי לנחיתה – הורד מצערת (S)');
  }
  if(P.x > C.x && P.x < C.x+C.len && P.y > DECK_Y+12) return crashPlayer('התנגשת בדופן הנושאת');
  if(P.y >= groundY(P.x)-6) return crashPlayer(overSea(P.x) ? 'התרסקת לים' : 'התרסקת על האי');
}

function shootGuns(P, st, dt){
  if(!keys.Space || P.cool>0 || P.ammo<=0) return;
  const a = heading(P), cx = P.f*Math.cos(a), cy = -Math.sin(a), v = playerVel(P);
  const spread = rnd(-0.03,0.03);
  const ca = Math.cos(spread), sa = Math.sin(spread);
  const dx = cx*ca - cy*sa, dy = cx*sa + cy*ca;
  G.shots.push({x:P.x+cx*24, y:P.y+cy*24-2, vx:dx*950+v.vx*0.5, vy:dy*950+v.vy*0.5, team:'p', dmg:6*st.gun, life:0.9});
  P.cool = 1/st.rate; P.ammo--;
  if(Math.random()<0.6) SFX.gun();
  if(P.ammo===0) say('נגמרה התחמושת – חזור לנושאת',3);
}

function rearGunner(P){
  if(P.gunnerCool>0) return;
  const a = heading(P), fx = P.f*Math.cos(a), fy = -Math.sin(a);
  let best=null, bd=460*460;
  for(const e of G.enemies){
    if(e.dead) continue;
    const dx=e.x-P.x, dy=e.y-P.y, d=dx*dx+dy*dy;
    if(d<bd && dx*fx+dy*fy < 0){ bd=d; best=e; }
  }
  if(!best) return;
  const ang = Math.atan2(best.y-P.y, best.x-P.x) + rnd(-0.08,0.08);
  G.shots.push({x:P.x-fx*14, y:P.y-6, vx:Math.cos(ang)*800, vy:Math.sin(ang)*800, team:'p', dmg:4, life:0.7});
  P.gunnerCool = 0.32; SFX.enemyGun();
}

function dropOrd(P){
  const v = playerVel(P), a = heading(P), t = P.ordType;
  P.ord--;
  if(t==='bomb'){ G.drops.push({kind:'bomb', x:P.x, y:P.y+8, vx:v.vx*0.9, vy:v.vy*0.9+20, team:'p', dmg:ORD.bomb.dmg, r:ORD.bomb.radius}); P.ordCool=0.3; }
  else if(t==='rocket'){
    const dx=P.f*Math.cos(a), dy=-Math.sin(a);
    G.drops.push({kind:'rocket', x:P.x+dx*10, y:P.y+6, vx:dx*640+v.vx*0.5, vy:dy*640+v.vy*0.5, team:'p', dmg:ORD.rocket.dmg, r:ORD.rocket.radius, life:2.4});
    P.ordCool=0.22; SFX.rocket();
  } else {
    const alt = groundY(P.x) - P.y;
    G.drops.push({kind:'torpedo', x:P.x, y:P.y+8, vx:v.vx*0.8, vy:Math.max(v.vy,0)+10, team:'p', dmg:ORD.torpedo.dmg, r:ORD.torpedo.radius, run:false, dir:P.f, ok:alt<160});
    P.ordCool=0.8; SFX.drop();
  }
}

function crashPlayer(reason){
  const P = G.player; if(P.dead) return;
  P.dead=true; P.loop=null; P.vl=null; P.mv=null; P.br=null; G.lives--; G.lost = (G.lost||0) + 1;   // G.lost: for the star rating
  boom(P.x, Math.min(P.y, groundY(P.x)-4), 50, true, true); SFX.planeBoom();
  if(overSea(P.x) && P.y>SEA-20) splash(P.x);
  for(let i=0;i<10;i++) G.debris.push({x:P.x,y:P.y,vx:rnd(-160,160),vy:rnd(-260,-40),r:rnd(0,6),vr:rnd(-8,8),life:2.5,c:G.stats.color});
  say(reason + (G.lives>0 ? ` · נותרו ${G.lives} מטוסים` : ''), 4);
  G.endT = 2.8;
}

function damagePlayer(d){
  const P=G.player; if(P.dead || P.inv>0 || P.onDeck) return;
  P.hp -= d*PLAYER_DAMAGE; P.hitT=0.15; SFX.hit();
  if(P.hp<=0){ P.hp=0; crashPlayer('המטוס הופל'); }
}

// ---- projectiles ----
function updateProjectiles(dt){
  const W = G.weather.wind;
  // bullets
  for(const s of G.shots){
    s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=dt;
    if(s.y >= groundY(s.x)){ s.life=0; if(Math.random()<0.3) puff(s.x, s.y-2, overSea(s.x)?'#cfe6f2':'#a58d63', 3); continue; }
    if(s.team==='p') bulletVsEnemy(s); else bulletVsFriend(s);
  }
  G.shots = G.shots.filter(s=>s.life>0);
  // bombs / rockets / torpedoes
  for(const d of G.drops){
    if(d.kind==='bomb'){
      if(!d.sndTried){ d.sndTried = true; d.snd = SFX.whistle(d.team==='p' ? 0.06 : 0.04); }   // whistles all the way down
      d.vy += 320*dt; d.vx += W*0.25*dt; d.x+=d.vx*dt; d.y+=d.vy*dt;
      if(hitsSolid(d.x,d.y) || d.y>=groundY(d.x)-2){ detonate(d); }
      else if(d.team==='e' && d.x>G.carrier.x && d.x<G.carrier.x+G.carrier.len && d.y>DECK_Y-4){ detonate(d); }
    } else if(d.kind==='rocket'){
      d.vy += 40*dt; d.x+=d.vx*dt; d.y+=d.vy*dt; d.life-=dt;
      if(Math.random()<0.7) puff(d.x-d.vx*0.02, d.y-d.vy*0.02, '#ddd', 3, 0.5);
      if(d.life<=0 || hitsSolid(d.x,d.y) || d.y>=groundY(d.x)-2 || hitsEnemyPlane(d.x,d.y,20)) detonate(d);
    } else if(d.kind==='torpedo'){
      if(!d.run){
        d.vy += 300*dt; d.x+=d.vx*dt; d.y+=d.vy*dt;
        // dropped straight onto a ship: it strikes the hull or deck unarmed and does nothing
        const struck = G.ships.find(sh=>!sh.dead && Math.abs(d.x-sh.x)<sh.w/2 && d.y > SEA - sh.h*0.6);
        if(struck){
          d.dead=true; spark(d.x, d.y); SFX.tone(700,500,0.12,0.06,'square');
          say('הטורפדו נחת על גוף הספינה ולא התפוצץ. הטל אותו למים, לפני הספינה',3); continue;
        }
        if(d.y >= groundY(d.x)-2){
          if(!overSea(d.x)) detonate(d);
          else if(!d.ok){ splash(d.x); d.dead=true; say('הטורפדו נשבר – הטל אותו נמוך יותר',3); }
          else { d.run=true; d.y=SEA+9; d.spd=80; d.dist=0; d.vx=d.dir*d.spd; d.vy=0; splash(d.x); }
        }
      } else {
        // running submerged in a straight line: it starts slowly, accelerates, and only arms after TORPEDO_ARM of run
        d.spd = Math.min(280, d.spd + 170*dt); d.vx = d.dir*d.spd;
        d.x += d.vx*dt; d.dist += d.spd*dt;
        if(Math.random()<0.6) G.fx.push({type:'wake', x:d.x - Math.sign(d.vx)*10, y:SEA+2, t:0, max:1.4});
        if(!overSea(d.x)) detonate(d);
        const sh = G.ships.find(sh=>!sh.dead && Math.abs(d.x-sh.x)<sh.w/2);
        if(sh){
          if(d.dist >= TORPEDO_ARM){ d.target = sh; detonate(d); }
          else { d.dead=true; G.fx.push({type:'wake', x:d.x, y:SEA+2, t:0, max:1}); SFX.tone(500,350,0.1,0.05,'square');
            say('הטורפדו הוטל קרוב מדי ולא הספיק להתחמש. הטל אותו רחוק יותר מהספינה',3); }
        }
        if(d.x < -400 || d.x > G.L+400) d.dead=true;
      }
    }
  }
  G.drops = G.drops.filter(d=>!d.dead);
  // flak shells
  for(const f of G.flak){
    f.x+=f.vx*dt; f.y+=f.vy*dt; f.fuse-=dt;
    const P=G.player;
    if(f.team==='p'){
      // the carrier's proximity shells burst near enemy aircraft
      const near = G.enemies.some(e=>!e.dead && dist2(f.x,f.y,e.x,e.y) < ((e.size||16)+12)**2);
      if(f.fuse<=0 || near){
        f.dead=true; G.fx.push({type:'flak', x:f.x, y:f.y, t:0, max:0.7, r:26});
        for(const e of G.enemies) if(!e.dead && dist2(f.x,f.y,e.x,e.y) < ((e.size||16)+40)**2) hurtEnemy(e, f.dmg);
      }
      continue;
    }
    const near = !P.dead && dist2(f.x,f.y,P.x,P.y) < 30*30;
    if(f.fuse<=0 || near){
      f.dead=true; G.fx.push({type:'flak', x:f.x, y:f.y, t:0, max:1.1, r:f.big?40:30}); SFX.flak();
      // hot fragments spraying out, and a burst close by rocks the aircraft
      for(let i=0;i<(f.big?8:5);i++){ const a=rnd(0,Math.PI*2), sp=rnd(60,170); G.debris.push({x:f.x,y:f.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:0,vr:0,life:rnd(0.25,0.5),c:Math.random()<.5?'#ffd27a':'#ff8a3a',spark:true}); }
      if(!P.dead){ const d = Math.hypot(f.x-P.x, f.y-P.y); if(d < 170) G.shake = Math.max(G.shake||0, (1 - d/170)*(f.big?0.6:0.4)); }
      if(!P.dead && dist2(f.x,f.y,P.x,P.y) < (f.big?58:46)**2) damagePlayer(f.dmg);
      for(const w of G.wingmen) if(!w.dead && w.state!=='wait' && dist2(f.x,f.y,w.x,w.y)<44*44) hurtWing(w, f.dmg*0.8);
    }
  }
  G.flak = G.flak.filter(f=>!f.dead);
}

function hitsSolid(x,y){
  for(const s of G.structures) if(!s.dead && x>s.x-s.w/2 && x<s.x+s.w/2 && y>s.y-s.h && y<s.y+4) return true;
  for(const sh of G.ships) if(!sh.dead && Math.abs(x-sh.x)<sh.w/2 && y>SEA-sh.h) return true;
  return false;
}
function hitsEnemyPlane(x,y,r){
  for(const e of G.enemies) if(!e.dead && dist2(x,y,e.x,e.y) < (r+(e.size||16))**2) return true;
  return false;
}

function detonate(d){
  d.dead=true;
  if(d.snd){ d.snd.stop(); d.snd = null; }     // the whistle stops at the moment of impact
  if(d.kind==='torpedo' && d.target){
    // a torpedo hit is decided per ship class (see hitShip) and throws up a tall column of water
    const sh = d.target;
    G.fx.push({type:'column', x:d.x, y:SEA, t:0, max:1.6}); splash(d.x); boom(d.x, SEA-6, 60, true);
    hitShip(sh, 0, 'torpedo', d.x);
    return;
  }
  if(d.y>SEA-6 && overSea(d.x)) splash(d.x);
  explode(d.x, Math.min(d.y, groundY(d.x)), d.r, d.dmg, d.team, d.kind);
}

// Area damage
function explode(x, y, r, dmg, team, kind){
  boom(x, y, r, r>45);
  if(team==='p'){
    for(const s of G.structures){
      if(s.dead) continue;
      const cx = clamp(x, s.x-s.w/2, s.x+s.w/2), cy = clamp(y, s.y-s.h, s.y);
      const d = Math.hypot(x-cx, y-cy);
      if(d<r) hitStruct(s, dmg*(1-0.5*d/r), kind);
    }
    for(const sh of G.ships){
      if(sh.dead) continue;
      if(Math.abs(x-sh.x) < sh.w/2 + r && y > SEA - sh.h - r) hitShip(sh, dmg, kind, x);
    }
    for(const so of G.soldiers) if(!so.dead && !(so.safe>0) && Math.abs(so.x-x)<r && y>so.y-40) killSoldier(so);
    groundBlast(x, y, r, dmg);
    for(const e of G.enemies) if(!e.dead && dist2(x,y,e.x,e.y) < (r+(e.size||16))**2) hurtEnemy(e, dmg*0.8);
    if(G.special) specialBlast(x, y, r, dmg, 'p');       // boats, submarines, the bridge, the train
  } else {
    const P=G.player;
    if(!P.dead && dist2(x,y,P.x,P.y)<(r+10)**2) damagePlayer(dmg*0.5);
    const C=G.carrier;
    if(x>C.x-r && x<C.x+C.len+r && y>DECK_Y-r){ C.hp -= dmg; C.hit=0.3; if(C.hp<=0){ C.hp=0; } }
    if(G.special) specialBlast(x, y, r, dmg, 'e');       // our convoy ships
  }
}

function bulletVsEnemy(s){
  for(const e of G.enemies){
    if(e.dead) continue;
    const hit = e.boxW ? (Math.abs(s.x-e.x)<e.boxW/2 && Math.abs(s.y-e.y)<e.boxH/2) : dist2(s.x,s.y,e.x,e.y) < (e.size||16)**2;
    if(hit && !dodges(e)){ s.life=0; hurtEnemy(e, s.dmg); spark(s.x,s.y); return; }
  }
  for(const st of G.structures){
    if(!st.dead && s.x>st.x-st.w/2 && s.x<st.x+st.w/2 && s.y>st.y-st.h){ s.life=0; hitStruct(st, s.dmg, 'gun'); spark(s.x,s.y); return; }
  }
  for(const sh of G.ships){
    if(!sh.dead && Math.abs(s.x-sh.x)<sh.w/2 && s.y>SEA-sh.h-14){ s.life=0; hitShip(sh, s.dmg, 'gun', s.x); spark(s.x,s.y); return; }
  }
  for(const so of G.soldiers){
    if(!so.dead && Math.abs(s.x-so.x)<6 && s.y>so.y-14 && s.y<so.y+2){ s.life=0; killSoldier(so); return; }
  }
  groundBulletHit(s);                                       // Ground Support: Chi-Ha tanks
  if(G.special && s.life>0) specialBulletHit(s);            // special missions: boats, train...
}
function bulletVsFriend(s){
  const P=G.player;
  if(!P.dead && !P.onDeck && dist2(s.x,s.y,P.x,P.y)<16*16 && !dodges(P)){ s.life=0; damagePlayer(s.dmg); spark(s.x,s.y); return; }
  if(G.special && specialFriendHit(s)) return;              // the rescue plane
  const C = G.carrier;
  if(s.x>C.x && s.x<C.x+C.len && s.y>DECK_Y-8 && s.y<SEA){ s.life=0; C.hp -= s.dmg*0.6; C.hit=0.1; spark(s.x,s.y); return; }
  for(const w of G.wingmen) if(!w.dead && w.state!=='wait' && dist2(s.x,s.y,w.x,w.y)<15*15 && !dodges(w)){ s.life=0; hurtWing(w, s.dmg); return; }
}

function earn(type, x, y){
  const v = SCORE[type]||0; G.earned += v; G.kills++;
  if(v) G.fx.push({type:'text', x, y:y-20, t:0, max:1.2, text:'+$'+v});
}

function hitStruct(s, d, kind){
  if(s.dead || s.hidden) return;                           // hidden: camouflaged until spotted ("Ticking Clock")
  if(kind==='gun') d *= ({bunker:0.15, biggun:0.12, core:0.08, aa:0.6, barracks:0.45, fuel:1, light:1, arty:0.3, radar:0.5})[s.type] ?? 0.5;
  s.hp -= d; s.flash = 0.1;
  if(s.hp<=0){
    s.dead=true; s.deadT = G.time; earn(s.type, s.x, s.y-s.h);   // deadT: repair crews may rebuild it (extras.js)
    boom(s.x, s.y-s.h/2, s.type==='core'?110:50, true);
    for(let i=0;i<6;i++) G.debris.push({x:s.x,y:s.y-s.h/2,vx:rnd(-140,140),vy:rnd(-280,-80),r:0,vr:rnd(-9,9),life:2,c:'#5d5546'});
    if(s.type==='bunker'||s.type==='barracks') for(let i=0;i<(s.type==='barracks'?6:3);i++) spawnSoldier(s.x+rnd(-15,15));
    if(s.type==='fuel'){ explode(s.x, s.y-10, 95, 90, 'p', 'fuel'); }
    if(s.type==='core'){ say('מבצר אוקינאווה הושמד!',5); }
  }
}

function hitShip(sh, d, kind, x){
  if(sh.dead) return;
  if(kind==='torpedo'){
    // one torpedo sinks a destroyer; capital ships (carrier, battleship) need two
    const hits = (sh.type==='jcarrier' || sh.type==='battleship') ? 2 : 1;
    sh.hp -= sh.max/hits + 1; sh.flash=0.2;
    if(sh.hp>0) say(sh.type==='jcarrier' ? 'פגיעת טורפדו! עוד טורפדו אחד יטביע את הנושאת' : 'פגיעת טורפדו! עוד טורפדו אחד יטביע אותה', 3);
  } else {
    const t = sh.turrets.find(t=>!t.dead && Math.abs(sh.x+t.dx-x)<45);
    if(t){ t.hp -= kind==='gun'? d*0.35 : d; if(t.hp<=0){ t.dead=true; boom(sh.x+t.dx, SEA-sh.h*0.5-8, 40, false); earn('turret', sh.x+t.dx, SEA-sh.h); } return; }
    let mul = kind==='gun'?0.1 : 0.6;
    if(sh.type==='battleship' && sh.turrets.some(t=>!t.dead)) mul *= 0.3;
    sh.hp -= d*mul; sh.flash=0.1;
  }
  if(sh.hp<=0){
    sh.dead=true; sh.sink=0.001; earn(sh.type, sh.x, SEA-sh.h);
    for(let i=0;i<5;i++) setTimeout(()=>G && boom(sh.x+rnd(-sh.w/2,sh.w/2), SEA-sh.h, 50, true), i*220);
    say(sh.type==='battleship'?'אוניית המערכה טובעת!':sh.type==='jcarrier'?'הנושאת היפנית הוטבעה! לא ימריאו ממנה עוד מטוסים':'משחתת אויב הוטבעה',3);
  }
}

// ---- effects ----
// Caps so a big battle can't pile up thousands of particles: purely cosmetic smoke and sparks are
// thinned out first once the scene is busy.
const FX_MAX = 320, DEBRIS_MAX = 260;
function boom(x,y,r,big,quiet){   // quiet: the caller plays its own sound (aircraft explosions)
  G.fx.push({type:'boom', x, y, r, t:0, max:big?0.9:0.6});
  const busy = G.debris.length > DEBRIS_MAX*0.6;
  for(let i=0;i<(big?18:9)*(busy?0.4:1);i++){
    const a=rnd(0,Math.PI*2), s=rnd(40,big?260:150);
    G.debris.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-80,r:0,vr:0,life:rnd(0.4,1),c:Math.random()<.5?'#ffcf5a':'#ff7a2a',spark:true});
  }
  for(let i=0;i<(big?6:3);i++) puff(x+rnd(-r/3,r/3), y+rnd(-r/3,r/3), '#2b2b2b', rnd(10,18), 1.6);
  if(!quiet) SFX.boom(big);
}
function splash(x){ G.fx.push({type:'splash', x, y:SEA, t:0, max:0.9}); SFX.splash(); }
function spark(x,y){ if(G.debris.length > DEBRIS_MAX) return; G.debris.push({x,y,vx:rnd(-60,60),vy:rnd(-80,0),r:0,vr:0,life:0.2,c:'#ffe7a0',spark:true}); }
function puff(x,y,c,s,life=1){ if(G.fx.length > FX_MAX) return; G.fx.push({type:'smoke', x, y, c, s, t:0, max:life, vx:rnd(-10,10), vy:rnd(-25,-8)}); }

function updateFx(dt){
  if(G.shake > 0) G.shake = Math.max(0, G.shake - dt*1.6);
  for(const f of G.fx){ f.t+=dt; if(f.type==='smoke'){ f.x+=f.vx*dt+G.weather.wind*0.3*dt; f.y+=f.vy*dt; } if(f.type==='text') f.y-=30*dt; }
  G.fx = G.fx.filter(f=>f.t<f.max);
  for(const d of G.debris){ d.vy+=400*dt; d.x+=d.vx*dt; d.y+=d.vy*dt; d.r+=d.vr*dt; d.life-=dt; if(d.y>groundY(d.x)){ d.y=groundY(d.x); d.vx*=0.5; d.vy*=-0.2; } }
  G.debris = G.debris.filter(d=>d.life>0);
  if(G.fx.length > FX_MAX*1.5) G.fx.splice(0, G.fx.length - FX_MAX*1.5);          // drop the oldest
  if(G.debris.length > DEBRIS_MAX*1.5) G.debris.splice(0, G.debris.length - DEBRIS_MAX*1.5);
}
