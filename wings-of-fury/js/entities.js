// ---- Player flight model, weapons, projectiles, damage and effects ----
const keys = {};

// P.loop holds a flat turn-around in progress: {t: 0..1}. The plane keeps its altitude and pitch while
// its horizontal motion slows, passes through zero and reverses.
function heading(P){ return P.p; }
function turnK(P){ return P.loop ? Math.cos(Math.PI*P.loop.t) : 1; }
function playerVel(P){ const a=heading(P); return {vx:P.f*Math.cos(a)*P.speed*turnK(P), vy:-Math.sin(a)*P.speed}; }

function updatePlayer(dt){
  const P = G.player, st = G.stats, K = keys, C = G.carrier;
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
      if(K.KeyW||K.ArrowRight) P.throttle = Math.min(1, P.throttle+dt*0.7);
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
  if(!P.loop){
    const wantTurn = (K.ArrowLeft && P.f>0) || (K.ArrowRight && P.f<0);
    if(wantTurn && P.speed>110){ P.loop = {t:0}; P.p *= 0.5; }
    else if((K.ArrowRight && P.f>0) || (K.ArrowLeft && P.f<0)) P.throttle = Math.min(1, P.throttle+dt*0.8);
  }
  // pitch stays available during the turn
  const tr = st.turn*0.5*(P.stall?0.4:1)*(P.loop?0.5:1);   // pitch rate: gentler than the turn-around
  if(K.ArrowUp) P.p += tr*dt;
  if(K.ArrowDown) P.p -= tr*dt;
  P.p = clamp(P.p, -1.35, 1.35);
  if(P.loop){
    P.loop.t += dt * st.turn/1.25;          // ~0.65s for a Hellcat, quicker for agile planes
    P.speed -= 40*dt;                       // a hard turn bleeds a little speed
    if(P.loop.t >= 1){ P.f = -P.f; P.loop = null; }
  }
  // boundaries: auto turn back
  if(!P.loop && ((P.x < -350 && P.f<0) || (P.x > G.L+350 && P.f>0))){ P.loop={t:0}; P.speed=Math.max(P.speed,170); }

  // landing gear: retracts after take-off, lowers automatically on approach to the carrier
  const mid = C.x + C.len/2;
  const nearCarrier = Math.abs(P.x-mid) < C.len/2+550 && P.y > DECK_Y-230;
  const towardDeck = Math.abs(P.x-mid) < C.len/2 || Math.sign(mid-P.x) === P.f;
  const want = (P.airT||0) < 1 ? 1 : ((P.airT||0) > 4 && nearCarrier && towardDeck && !P.loop && P.p <= 0.2) ? 1 : 0;
  if(want !== P.gearWant){ P.gearWant = want; SFX.tone(want?140:220, want?220:140, 0.6, 0.05, 'sawtooth'); if(want) say('גלגלים למטה',1.5); }
  P.gear = clamp(P.gear + clamp(want-P.gear, -dt/0.9, dt/0.9), 0, 1);

  const a = heading(P);
  const target = (outOfFuel ? 0 : P.throttle*st.speed) * (1 - 0.12*P.gear);
  P.speed += (target-P.speed)*0.55*dt - (Math.sin(a)>0 ? 145 : 70)*Math.sin(a)*dt;   // dives gain speed more slowly than climbs lose it
  P.speed = clamp(P.speed, 0, st.speed*1.2);
  P.stall = P.speed < 100 && !P.loop;
  if(P.stall) P.p = Math.max(-1.3, P.p - 1.1*dt);
  const v = playerVel(P);
  P.x += v.vx*dt + G.weather.wind*0.35*dt + G.weather.gust*dt;
  P.y += v.vy*dt + (P.stall ? 80*dt : 0);
  if(P.y < CEIL){ P.y = CEIL; if(!P.loop) P.p = Math.min(P.p, 0); }
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
    if(!P.loop && Math.abs(P.p)<0.32 && P.speed<225){
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
  if(t==='bomb'){ G.drops.push({kind:'bomb', x:P.x, y:P.y+8, vx:v.vx*0.9, vy:v.vy*0.9+20, team:'p', dmg:ORD.bomb.dmg, r:ORD.bomb.radius}); P.ordCool=0.3; SFX.drop(); }
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
  P.dead=true; P.loop=null; G.lives--;
  boom(P.x, Math.min(P.y, groundY(P.x)-4), 50, true);
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
        if(d.y >= groundY(d.x)-2){
          if(!overSea(d.x)) detonate(d);
          else if(!d.ok){ splash(d.x); d.dead=true; say('הטורפדו נשבר – הטל אותו נמוך יותר',3); }
          else { d.run=true; d.y=SEA+9; d.vx=d.dir*270; d.vy=0; splash(d.x); }
        }
      } else {
        // running submerged in a straight line until it strikes a ship or a shore, or leaves the area
        d.x += d.vx*dt;
        if(Math.random()<0.6) G.fx.push({type:'wake', x:d.x - Math.sign(d.vx)*10, y:SEA+2, t:0, max:1.4});
        if(!overSea(d.x)) detonate(d);
        for(const sh of G.ships) if(!sh.dead && Math.abs(d.x-sh.x)<sh.w/2) { d.target = sh; detonate(d); break; }
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
      f.dead=true; G.fx.push({type:'flak', x:f.x, y:f.y, t:0, max:0.7, r:f.big?34:24}); SFX.flak();
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
    for(const so of G.soldiers) if(!so.dead && Math.abs(so.x-x)<r && y>so.y-40) killSoldier(so);
    for(const e of G.enemies) if(!e.dead && dist2(x,y,e.x,e.y) < (r+(e.size||16))**2) hurtEnemy(e, dmg*0.8);
  } else {
    const P=G.player;
    if(!P.dead && dist2(x,y,P.x,P.y)<(r+10)**2) damagePlayer(dmg*0.5);
    const C=G.carrier;
    if(x>C.x-r && x<C.x+C.len+r && y>DECK_Y-r){ C.hp -= dmg; C.hit=0.3; if(C.hp<=0){ C.hp=0; } }
  }
}

function bulletVsEnemy(s){
  for(const e of G.enemies){
    if(e.dead) continue;
    const hit = e.boxW ? (Math.abs(s.x-e.x)<e.boxW/2 && Math.abs(s.y-e.y)<e.boxH/2) : dist2(s.x,s.y,e.x,e.y) < (e.size||16)**2;
    if(hit){ s.life=0; hurtEnemy(e, s.dmg); spark(s.x,s.y); return; }
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
}
function bulletVsFriend(s){
  const P=G.player;
  if(!P.dead && !P.onDeck && dist2(s.x,s.y,P.x,P.y)<16*16){ s.life=0; damagePlayer(s.dmg); spark(s.x,s.y); return; }
  for(const w of G.wingmen) if(!w.dead && w.state!=='wait' && dist2(s.x,s.y,w.x,w.y)<15*15){ s.life=0; hurtWing(w, s.dmg); return; }
}

function earn(type, x, y){
  const v = SCORE[type]||0; G.earned += v; G.kills++;
  if(v) G.fx.push({type:'text', x, y:y-20, t:0, max:1.2, text:'+$'+v});
}

function hitStruct(s, d, kind){
  if(s.dead) return;
  if(kind==='gun') d *= ({bunker:0.15, biggun:0.12, core:0.08, aa:0.6, barracks:0.45, fuel:1, light:1})[s.type];
  s.hp -= d; s.flash = 0.1;
  if(s.hp<=0){
    s.dead=true; earn(s.type, s.x, s.y-s.h);
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
function boom(x,y,r,big){
  G.fx.push({type:'boom', x, y, r, t:0, max:big?0.9:0.6});
  for(let i=0;i<(big?18:9);i++){
    const a=rnd(0,Math.PI*2), s=rnd(40,big?260:150);
    G.debris.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-80,r:0,vr:0,life:rnd(0.4,1),c:Math.random()<.5?'#ffcf5a':'#ff7a2a',spark:true});
  }
  for(let i=0;i<(big?6:3);i++) puff(x+rnd(-r/3,r/3), y+rnd(-r/3,r/3), '#2b2b2b', rnd(10,18), 1.6);
  SFX.boom(big);
}
function splash(x){ G.fx.push({type:'splash', x, y:SEA, t:0, max:0.9}); SFX.splash(); }
function spark(x,y){ G.debris.push({x,y,vx:rnd(-60,60),vy:rnd(-80,0),r:0,vr:0,life:0.2,c:'#ffe7a0',spark:true}); }
function puff(x,y,c,s,life=1){ G.fx.push({type:'smoke', x, y, c, s, t:0, max:life, vx:rnd(-10,10), vy:rnd(-25,-8)}); }

function updateFx(dt){
  for(const f of G.fx){ f.t+=dt; if(f.type==='smoke'){ f.x+=f.vx*dt+G.weather.wind*0.3*dt; f.y+=f.vy*dt; } if(f.type==='text') f.y-=30*dt; }
  G.fx = G.fx.filter(f=>f.t<f.max);
  for(const d of G.debris){ d.vy+=400*dt; d.x+=d.vx*dt; d.y+=d.vy*dt; d.r+=d.vr*dt; d.life-=dt; if(d.y>groundY(d.x)){ d.y=groundY(d.x); d.vx*=0.5; d.vy*=-0.2; } }
  G.debris = G.debris.filter(d=>d.life>0);
}
