// ---- Ground defences, ships, soldiers, enemy aircraft, bosses and AI wingmen ----

function fireFlak(sx, sy, tx, ty, tvx, tvy, err, dmg, big){
  const sp = big?470:430;
  let t = Math.hypot(tx-sx, ty-sy)/sp;
  const px = tx + tvx*t + rnd(-err,err), py = ty + tvy*t + rnd(-err,err);
  t = Math.hypot(px-sx, py-sy)/sp;
  const a = Math.atan2(py-sy, px-sx);
  G.flak.push({x:sx, y:sy, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, fuse:t+rnd(-0.08,0.12), dmg, big});
}

// pick a flying target for a gun: player first, else a nearby wingman
function gunTarget(x, y, range){
  const P = G.player;
  if(!P.dead && !P.onDeck && Math.hypot(P.x-x, P.y-y)<range && P.y<y-30){ const v=playerVel(P); return {x:P.x,y:P.y,vx:v.vx,vy:v.vy,isP:true}; }
  for(const w of G.wingmen) if(!w.dead && w.state==='fly' && Math.abs(w.x-x)<range*0.8 && w.y<y-30)
    return {x:w.x,y:w.y,vx:Math.cos(w.a)*w.speed,vy:Math.sin(w.a)*w.speed};
  return null;
}

function updateGround(dt){
  const P = G.player, lvl = G.idx, night = G.weather.time==='night';
  let lit = false;
  for(const s of G.structures){
    if(s.dead) continue;
    s.flash = Math.max(0,(s.flash||0)-dt); s.muzzle = Math.max(0,(s.muzzle||0)-dt);
    if(s.type==='light'){
      const dx = P.x-s.x;
      if(night && !P.dead && Math.abs(dx)<950 && !P.onDeck){   // searchlights only lock on in the dark
        const want = Math.atan2(P.y-(s.y-s.h), dx);
        const d = wrapA(want-s.aim);
        s.aim += clamp(d, -0.55*dt, 0.55*dt);
        if(Math.abs(d)<0.07) lit = true;
      } else s.aim = -Math.PI/2 + Math.sin(G.time*0.5+s.x)*0.7;
      continue;
    }
    if(s.type!=='aa' && s.type!=='biggun') continue;
    const big = s.type==='biggun';
    const tg = gunTarget(s.x, s.y, big?1000:740);
    if(!tg){ s.cool = Math.max(s.cool, 0.6); continue; }
    s.aim = Math.atan2(tg.y-(s.y-s.h), tg.x-s.x);
    s.cool -= dt;
    if(s.cool<=0){
      let err = night ? 95 : 55;
      if(tg.isP && P.lit) err = 18;
      err *= G.weather.rain>0.5 ? 1.25 : 1;
      fireFlak(s.x, s.y-s.h, tg.x, tg.y, tg.vx, tg.vy, err, big?18:8+lvl, big); s.muzzle = 0.1;
      s.cool = big ? rnd(2.2,2.9) : rnd(1.5,2.3) - lvl*0.12;
    }
  }
  P.lit = lit;

  for(const sh of G.ships){
    if(sh.dead){
      // sinking: smoke from the break, foam and air bubbles boiling up, a few secondary explosions early on
      sh.sink += dt*0.12;
      if(sh.sink < 1.4){
        if(Math.random() < dt*6) G.fx.push({type:'wake', x:sh.x + rnd(-sh.w/2, sh.w/2), y:SEA+2, t:0, max:1.6});
        if(Math.random() < dt*4*(1.4-sh.sink)) puff(sh.x + rnd(-20,20), SEA - 20 - sh.h*(1-sh.sink), '#262626', 12, 2.2);
        if(sh.sink < 0.5 && Math.random() < dt*1.2) boom(sh.x + rnd(-sh.w/3, sh.w/3), SEA-6, 30, false);
        if(Math.random() < dt*1.5) splash(sh.x + rnd(-sh.w/2, sh.w/2));
      }
      continue;
    }
    sh.flash = Math.max(0,(sh.flash||0)-dt);
    sh.x += sh.dir*sh.speed*dt;
    if(sh.x<sh.minX) sh.dir=1; if(sh.x>sh.maxX) sh.dir=-1;
    if(Math.random()<dt*3) G.fx.push({type:'wake', x:sh.x - sh.dir*sh.w/2, y:SEA+2, t:0, max:1.5});
    for(const t of sh.turrets){
      if(t.dead) continue;
      const tx = sh.x+t.dx, ty = SEA-sh.h*0.5-8;
      const tg = gunTarget(tx, ty, 760);
      if(!tg) continue;
      t.aim = Math.atan2(tg.y-ty, tg.x-tx);
      t.cool -= dt;
      if(t.cool<=0){
        fireFlak(tx, ty, tg.x, tg.y, tg.vx, tg.vy, (night?90:55)*(tg.isP&&P.lit?0.3:1), sh.type==='battleship'?14:9+lvl, sh.type==='battleship');
        t.cool = sh.type==='battleship' ? rnd(1.3,2.0) : rnd(1.8,2.6);
      }
    }
  }

  // Survivors of wrecked buildings run about the island and fire rifles and light machine guns, but only at
  // aircraft passing very low over them; small-arms rounds have a short reach and do little damage.
  const fliers = [];
  if(!P.dead && !P.onDeck) fliers.push({x:P.x, y:P.y});
  for(const w of G.wingmen) if(!w.dead && w.state==='fly') fliers.push({x:w.x, y:w.y});
  for(const so of G.soldiers){
    if(so.dead) continue;
    so.t += dt; so.cool -= dt; so.fireT = Math.max(0, (so.fireT||0) - dt); so.safe = Math.max(0, (so.safe||0) - dt);
    let tg = null;
    for(const f of fliers){ if(groundY(f.x) - f.y < SMALL_ARMS_ALT && Math.abs(f.x-so.x) < 230){ tg = f; break; } }
    if(tg){
      so.aim = Math.atan2(tg.y-(so.y-11), tg.x-so.x);           // stop, kneel and fire
      if(so.cool<=0){
        const a = so.aim + rnd(-0.1,0.1);
        G.shots.push({x:so.x+Math.cos(so.aim)*7, y:so.y-11, vx:Math.cos(a)*650, vy:Math.sin(a)*650, team:'e', dmg:1, life:0.38, small:true});
        so.cool = rnd(0.7,1.5); so.fireT = 0.07;
        if(Math.random()<0.4) SFX.noise(0.04, 2600, 0.04, 'bandpass', 3);
      }
    } else {
      so.aim = null;
      if(!so.def){                                             // entrenched defenders hold their positions
        so.x += so.dir*so.speed*dt; so.y = groundY(so.x);
        if(groundY(so.x+so.dir*12) > SEA-14) so.dir = -so.dir;
      }
    }
  }
  G.soldiers = G.soldiers.filter(s=>!s.dead);
}

function spawnSoldier(x){
  G.soldiers.push({x, y:groundY(x), dir:Math.random()<.5?-1:1, speed:rnd(26,42), t:rnd(0,1), cool:rnd(1,3), dead:false, safe:0.8});   // safe: they just ran out of the blast
}
function killSoldier(so){
  so.dead=true; earn('soldier', so.x, so.y-10); addBody(so.x, 'jp', -(so.dir||1));
  for(let i=0;i<4;i++) G.debris.push({x:so.x,y:so.y-8,vx:rnd(-50,50),vy:rnd(-120,-40),r:0,vr:0,life:0.6,c:'#7a1f1a',spark:true});
}

// Wingmen fly with the same model as the player's aircraft: they face left or right (f), climb and dive with a
// limited, eased pitch (p), reverse direction with the same flat turn-around (ft: 0..1), and can pull a full
// vertical loop (vl: the loop angle). They never just roll onto their back.
function pilotSteer(w, want, turn, dt){
  if(w.f == null){ w.f = Math.cos(w.a) >= 0 ? 1 : -1; w.p = clamp(Math.atan2(-Math.sin(w.a), Math.abs(Math.cos(w.a))), -1.35, 1.35); w.pr = 0; }
  mvTick(w, dt);
  if(w.mv){                                                     // split-S or hammerhead (maneuvers.js)
    mvUpdate(w, dt, turn);
  } else if(w.vl != null){                                      // loop in progress
    w.vl += turn*0.75*dt; w.speed = Math.max(w.speed, 130);
    // Immelmann: roll out at the top and fly off the other way, higher
    if(w.vlImm && w.vl >= Math.PI){ mvFlip(w, w.vl); w.p = 0; w.rollGoal = 0; w.vl = null; w.vlImm = false; }
    else if(w.vl >= Math.PI*2){ w.p = 0; w.vl = null; w.vlImm = false; }
  } else if(w.ft != null){                                      // turn-around in progress
    w.ft += dt*turn/1.3; w.speed -= 30*dt;
    if(w.ft >= 1){ w.f = -w.f; w.ft = null; }
  } else {
    const c = Math.cos(want);
    if((w.f > 0 && c < -0.35) || (w.f < 0 && c > 0.35)){ w.ft = 0; w.p *= 0.5; }    // the goal is behind: turn around
    else {
      const pd = clamp(Math.atan2(-Math.sin(want), Math.abs(c)), -1.35, 1.35);    // pitch that points at the goal
      const rate = clamp((pd - w.p)*3, -turn*0.8, turn*0.8);
      w.pr = (w.pr||0) + (rate - (w.pr||0))*Math.min(1, dt*6);
      w.p = clamp(w.p + w.pr*dt, -1.35, 1.35);
    }
  }
  const ang = w.mv ? w.mv.ang : w.vl != null ? w.vl : w.p, k = w.ft != null ? Math.cos(Math.PI*w.ft) : 1;
  w.dive = !!DIVE_BOMBERS[w.kind] && !w.mv && w.vl == null && ang <= -0.8;   // dive brakes out in a steep dive
  const vx = w.f*Math.cos(ang)*w.speed, vy = -Math.sin(ang)*w.speed;
  w.x += vx*k*dt + G.weather.wind*0.3*dt; w.y += vy*dt;
  w.a = Math.atan2(vy, vx);                                     // heading, for aiming and for other code
}

// ---- generic steering for AI aircraft (heading angle a, y-down) ----
function steer(e, tx, ty, turn, dt){ return steerAngle(e, Math.atan2(ty-e.y, tx-e.x), turn, dt); }

// Fly toward a heading. The turn rate is proportional to the heading error and eases in and out (like rolling
// into and out of a bank), so aircraft settle onto a heading instead of twitching around it.
function steerAngle(e, want, turn, dt){
  const right = Math.cos(e.a) >= 0;
  const sink = Math.max(0, Math.sin(e.a))*e.speed*0.9;
  const gy = Math.min(groundY(e.x + Math.cos(e.a)*80), groundY(e.x + Math.cos(e.a)*180));
  let avoid = false;
  if(e.y + sink > gy - 70){ want = right ? -0.7 : -Math.PI+0.7; avoid = true; }
  else if(e.y < CEIL+40) want = right ? 0.35 : Math.PI-0.35;
  if(avoid) turn *= 1.7;
  if(e.pilot && e.state==='fly'){ pilotSteer(e, want, turn, dt); return wrapA(want-e.a); }
  const d = wrapA(want-e.a);
  const rate = clamp(d*3.2, -turn, turn);
  e.av = (e.av||0) + (rate - (e.av||0))*Math.min(1, dt*(avoid ? 12 : 6));
  e.a = wrapA(e.a + e.av*dt);
  e.x += Math.cos(e.a)*e.speed*dt + G.weather.wind*0.3*dt;
  e.y += Math.sin(e.a)*e.speed*dt;
  return d;
}

// Is an American aircraft sitting behind `e` with its nose pointed at it?
function chasedBy(e){
  const P = G.player, list = [];
  if(!P.dead && !P.onDeck){ const v = playerVel(P); list.push({x:P.x, y:P.y, a:Math.atan2(v.vy, v.vx)}); }
  for(const w of G.wingmen) if(!w.dead && w.state==='fly') list.push({x:w.x, y:w.y, a:w.a});
  for(const c of list){
    const dx = e.x-c.x, dy = e.y-c.y, d = Math.hypot(dx,dy);
    if(d < 400 && Math.abs(wrapA(Math.atan2(dy,dx) - c.a)) < 0.4) return c;
  }
  return null;
}
function aimedAt(e, tx, ty){ return Math.abs(wrapA(Math.atan2(ty-e.y, tx-e.x) - e.a)); }

function shootFrom(e, team, dmg, spd=760){
  const a = e.a + rnd(-0.04,0.04);
  G.shots.push({x:e.x+Math.cos(e.a)*18, y:e.y+Math.sin(e.a)*18, vx:Math.cos(a)*spd+Math.cos(e.a)*e.speed*0.5, vy:Math.sin(a)*spd+Math.sin(e.a)*e.speed*0.5, team, dmg, life:0.8});
}

// ---- spawning: enemy aircraft take off from somewhere real ----
// Launch sites: an island airstrip while at least one building on that island still stands,
// and every Japanese carrier still afloat. With no sites left, no more fighters appear.
function launchSites(){
  const sites = [];
  G.islands.forEach((is,i)=>{
    if(is.strip && !is.captured && G.structures.some(s=>s.island===i && !s.dead)) sites.push({kind:'island', x:(is.strip.x0+is.strip.x1)/2, is});
  });
  for(const sh of G.ships) if(sh.type==='jcarrier' && !sh.dead) sites.push({kind:'carrier', x:sh.x, sh});
  return sites;
}
function nearestSite(sites, x){ return sites.reduce((b,s)=>!b || Math.abs(s.x-x)<Math.abs(b.x-x) ? s : b, null); }

// Put an aircraft at the start of its take-off run; `delay` staggers a second plane behind the first.
function launchFrom(site, type, delay=0){
  const P = G.player;
  let x, y, dir;
  if(site.kind==='carrier'){
    const sh = site.sh; dir = sh.dir; x = sh.x - dir*sh.w*0.35; y = SEA - JDECK - 5;
  } else {
    const s = site.is.strip; dir = P.x > (s.x0+s.x1)/2 ? 1 : -1;
    x = dir>0 ? s.x0+15 : s.x1-15; y = groundY(x) - 5;
  }
  const full = type==='betty' ? 145 : type==='val' ? 185 : rnd(215,250) + G.idx*8;
  const e = type==='val'
    ? {type:'val', x, y, a:dir>0?0:Math.PI, speed:0, full, hp:45, size:18, cool:0, dead:false}
    : type==='betty'
    ? {type:'betty', x, y, a:dir>0?0:Math.PI, speed:0, full, hp:90, size:24, cool:0, bombs:3, dead:false}
    : {type:'zero',  x, y, a:dir>0?0:Math.PI, speed:0, full, hp:34+G.idx*5, size:16, cool:1, burst:0, evade:0, dead:false};
  e.max = e.hp;
  e.takeoff = {t:-delay, ground:y, deck: site.kind==='carrier' ? site.sh : null};
  G.enemies.push(e);
  return e;
}

// Take-off roll and initial climb. Aircraft are vulnerable on the ground but do not attack until airborne.
function takeoffStep(e, dt){
  const k = e.takeoff, dir = Math.cos(e.a) >= 0 ? 1 : -1;
  const carry = k.deck ? k.deck.dir*k.deck.speed*dt : 0;
  k.t += dt;
  if(k.t < 0){ e.x += carry; return; }                               // waiting its turn on the runway
  if(k.deck && k.deck.dead){ e.hp = 0; hurtEnemy(e, 1); return; }    // carrier sank under it
  const accel = e.type==='emily' ? 0.22 : e.type==='betty' ? 0.4 : 0.6;
  e.speed = Math.min(e.full, e.speed + e.full*accel*dt);
  const rotate = e.full * (e.type==='emily' ? 0.75 : 0.6);
  if(e.speed < rotate){
    e.x += dir*e.speed*dt + carry; e.a = dir>0 ? 0 : Math.PI;
    e.y = k.deck ? SEA-JDECK-5 : k.water ? SEA-12 : groundY(e.x)-5;
    if(k.water && Math.random()<0.5) G.fx.push({type:'wake', x:e.x - dir*30, y:SEA+2, t:0, max:1.4});
    else if(!k.deck && !k.water && Math.random()<0.25) puff(e.x - dir*14, e.y+3, 'rgba(170,150,110,.6)', 5, 0.8);
  } else {
    const climb = e.type==='zero' ? 0.32 : 0.16;
    e.a = dir>0 ? -climb : -Math.PI+climb;
    e.x += Math.cos(e.a)*e.speed*dt; e.y += Math.sin(e.a)*e.speed*dt;
    if(k.ground - e.y > (e.type==='zero' ? 90 : 70)){ e.takeoff = null; e.speed = e.full; }
  }
}

function updateSpawns(dt, viewW){
  const P = G.player, def = G.def, lvl = G.idx;
  const airborne = !P.dead && !P.onDeck;
  const alive = G.enemies.filter(e=>!e.dead && e.type==='zero').length;
  G.zeroT -= dt;
  if(G.zeroT<=0 && airborne && P.x>1200 && alive < 4+lvl){
    const site = nearestSite(launchSites(), P.x);
    if(site){
      const n = 1 + (Math.random()<0.25+lvl*0.1 ? 1 : 0);
      for(let i=0;i<n;i++) launchFrom(site, 'zero', i*1.6);
      say(site.kind==='carrier' ? 'מטוסי זירו ממריאים מהנושאת היפנית!' : (n>1 ? 'מטוסי זירו ממריאים מהאי!' : 'מטוס זירו ממריא מהאי!'), 2.5);
    }
    G.zeroT = def.zeroEvery*rnd(0.65,1.0);
  }
  if(def.bombers){
    G.bomberT -= dt;
    if(G.bomberT<=0 && airborne){
      // land-based bombers need an island airfield; the nearest one to our carrier sends them
      const site = nearestSite(launchSites().filter(s=>s.kind==='island'), G.carrier.x);
      if(site){ launchFrom(site, 'betty'); say('מפציץ אויב ממריא לעבר הנושאת! יירט אותו',3); SFX.alarm(); }
      G.bomberT = rnd(40,55)-lvl*3;
    }
  }
  if(def.boss==='emily' && !G.bossSpawned && P.x > G.L*0.4){
    // the flying boat takes off from the water between the last two islands
    G.bossSpawned = true;
    const n = G.islands.length, x = n>1 ? (G.islands[n-2].x1 + G.islands[n-1].x0)/2 : G.islands[0].x1 + 700;
    const dir = P.x < x ? -1 : 1;
    G.boss = {type:'emily', x, y:SEA-12, a:dir>0?0:Math.PI, speed:0, full:100, hp:1300, max:1300, size:40, boxW:120, boxH:44, cool:0,
      guns:[{dx:-40,dy:-14},{dx:10,dy:16},{dx:52,dy:-6}], gcool:[0,0.4,0.8], dead:false, dir, takeoff:{t:0, ground:SEA-12, water:true}};
    G.enemies.push(G.boss);
    const site = nearestSite(launchSites(), x);
    if(site){ launchFrom(site, 'zero'); launchFrom(site, 'zero', 1.6); }
    say('סירה מעופפת "אמילי" ממריאה מהמים! הפל אותה',4); SFX.alarm();
  }
}
function hurtEnemy(e, d){
  if(e.dead) return;
  e.hp -= d; e.flash=0.08;
  if(e.hp<=0){
    e.dead = true; earn(e.type, e.x, e.y);
    boom(e.x, e.y, e.type==='emily'?90:34, e.type!=='zero', true); SFX.planeBoom();
    for(let i=0;i<(e.type==='emily'?14:6);i++) G.debris.push({x:e.x,y:e.y,vx:Math.cos(e.a)*e.speed*0.6+rnd(-90,90),vy:rnd(-150,40),r:0,vr:rnd(-8,8),life:2.2,c:e.type==='zero'?'#c9c3a8':'#556b4a',smoke:true});
    if(e.type==='emily') say('"אמילי" הופלה!',4);
  }
}

function updateEnemies(dt){
  const P = G.player, lvl = G.idx;
  for(const e of G.enemies){
    if(e.dead) continue;
    e.flash = Math.max(0,(e.flash||0)-dt);
    if(e.takeoff){ takeoffStep(e, dt); continue; }
    if(e.type==='zero') zeroAI(e, dt, lvl);
    else if(e.type==='betty') bettyAI(e, dt);
    else if(e.type==='val') valAI(e, dt);
    else if(e.type==='emily') emilyAI(e, dt, lvl);
    if(e.y >= groundY(e.x)-4){ e.hp=0; hurtEnemy(e, 1); }
    // aircraft pass each other without colliding: damage comes only from guns, rockets, bombs and flak
  }
  G.enemies = G.enemies.filter(e=>!e.dead && e.x>-1200 && e.x<G.L+1200);
}

function zeroAI(e, dt, lvl){
  const P = G.player;
  // Target: any American aircraft in the air - the player or a wingman - with no preference for the player.
  // A Zero keeps its target for a while, and avoids one that several other Zeros are already chasing,
  // so the attackers spread out over the player and the wingmen.
  const air = [];
  if(!P.dead && !P.onDeck) air.push({o:P, x:P.x, y:P.y, vx:playerVel(P).vx, vy:playerVel(P).vy});
  for(const w of G.wingmen) if(!w.dead && w.state==='fly') air.push({o:w, x:w.x, y:w.y, vx:Math.cos(w.a)*w.speed, vy:Math.sin(w.a)*w.speed});
  e.tgtT = (e.tgtT||0) - dt;
  let pick = air.find(a=>a.o===e.tgtO);
  // already sitting on this target's tail: don't let it go
  if(pick && Math.hypot(pick.x-e.x, pick.y-e.y) < 700 && aimedAt(e, pick.x, pick.y) < 0.9) e.tgtT = Math.max(e.tgtT, 1);
  if(!pick || e.tgtT<=0){
    let best=null, bs=Infinity;
    for(const a of air){
      const chasers = G.enemies.filter(z=>z!==e && !z.dead && z.tgtO===a.o).length;
      const onTail = aimedAt(e, a.x, a.y) < 0.9 ? -350 : 0;           // prefer whoever is already in front of the guns
      const score = Math.hypot(a.x-e.x, a.y-e.y) + chasers*220 + (a.o===e.tgtO ? -150 : 0) + onTail;
      if(score < bs){ bs=score; best=a; }
    }
    pick = best; e.tgtO = best ? best.o : null; e.tgtT = rnd(5,9);
  }
  let tg = pick ? {x:pick.x, y:pick.y, vx:pick.vx, vy:pick.vy, d:Math.hypot(pick.x-e.x, pick.y-e.y)} : null;
  if(!tg && G.def.mode==='ground' && G.ground) tg = groundStrafeTarget(e);     // nothing in the air: strafe the landing force
  if(!tg && G.def.mode==='defense'){                      // nothing in the air: strafe the carrier
    const C = G.carrier, cx = C.x + C.len/2;
    tg = {x:cx, y:DECK_Y-12, vx:0, vy:0, d:Math.hypot(cx-e.x, DECK_Y-12-e.y)};
  }
  if(!tg){ steer(e, e.x + Math.cos(e.a)*300, 180, 1.2, dt); return; }
  // The Zero was light and agile: it weaves on approach, breaks hard when someone gets on its tail or hits it,
  // zooms up or dives away, and extends after overshooting before turning back in.
  if(e.base == null){ e.base = e.speed; e.phase = rnd(0, 6.28); e.man = null; e.mt = 0; }
  // Badly damaged (20% or less) and within reach of our carrier: a suicide dive onto its deck.
  const C = G.carrier, cmid = C.x + C.len/2;
  if(e.max && e.hp <= e.max*0.2 && Math.abs(e.x - cmid) < 3500){
    if(!e.kamikaze){ e.kamikaze = true; e.escort = null; say('מטוס זירו פגוע צולל בקמיקזה על הנושאת! בנזאיייייייי!', 2.5); SFX.banzai(); }
    e.speed += (e.base*1.25 - e.speed)*Math.min(1, dt*2);
    const want = Math.atan2(DECK_Y-4 - e.y, cmid - e.x), d = wrapA(want - e.a);
    e.a = wrapA(e.a + clamp(d, -2.2*dt, 2.2*dt));                     // no terrain avoidance: it means to hit
    e.x += Math.cos(e.a)*e.speed*dt; e.y += Math.sin(e.a)*e.speed*dt;
    if(Math.random() < 0.5) puff(e.x, e.y, '#2a2a2a', 7, 1.2);        // trailing smoke
    if(e.x > C.x && e.x < C.x+C.len && e.y >= DECK_Y-10){
      e.dead = true; explode(e.x, DECK_Y-4, 55, 90, 'e', 'kamikaze');   // as much damage as a bomb
      say('פגיעת קמיקזה בנושאת!', 2.5);
    }
    return;
  }
  // Close escort: stay in formation on an assigned bomber until an American aircraft comes near it (or us),
  // or the bomber is gone or has started its dive; then fight like any other Zero.
  if(e.escort){
    const b = e.escort;
    const near = (x,y,r)=>{ const P=G.player; if(!P.dead && !P.onDeck && dist2(x,y,P.x,P.y)<r*r) return true;
      return G.wingmen.some(w=>!w.dead && w.state==='fly' && dist2(x,y,w.x,w.y)<r*r); };
    if(b.dead || !G.enemies.includes(b) || (b.ph && b.ph!=='cruise') || near(b.x,b.y,520) || near(e.x,e.y,420)) e.escort = null;
    else {
      // a flight of five spread around the lead bomber: two close on the flanks, two wider and further back,
      // one high above as top cover (offsets: behind the bomber, above/below it)
      const ESC = [[60,-45],[60,45],[120,-95],[120,95],[180,-150]];
      const bdir = Math.cos(b.a) >= 0 ? 1 : -1, [ox, oy] = ESC[(e.eslot||0) % 5];
      const fx = b.x - bdir*ox, fy = b.y + oy;
      const dx = fx - e.x, dy = fy - e.y, d = Math.hypot(dx, dy), ba = b.a;
      if(d > 160){ e.speed += (e.base*1.1 - e.speed)*Math.min(1, dt*2); steer(e, fx + Math.cos(ba)*b.speed*0.8, fy + Math.sin(ba)*b.speed*0.8, 2.0, dt); }
      else {
        const along = dx*Math.cos(ba) + dy*Math.sin(ba), across = -dx*Math.sin(ba) + dy*Math.cos(ba);
        e.speed += (clamp(b.speed + along*0.9, 130, e.base*1.15) - e.speed)*Math.min(1, dt*2.5);
        steerAngle(e, ba + clamp(across*0.012, -0.35, 0.35), 1.8, dt);
      }
      return;
    }
  }
  // Strike-role Zeros (about half of each flight) go for the carrier itself, even when fighters are about;
  // they still break and jink if someone gets on their tail.
  if(e.role==='strike' && G.def.mode==='defense') tg = {x:cmid, y:DECK_Y-12, vx:0, vy:0, d:Math.hypot(cmid-e.x, DECK_Y-12-e.y)};
  const turn = 2.5 + lvl*0.12;
  e.mt -= dt; e.cool -= dt;
  if(e.mt <= 0){ e.man = null; e.faceLock = null; e.rollOverride = null; }
  if(!e.man){
    // Really chased = an enemy behind it (not a head-on pass) holding its nose on it for a moment;
    // a nose sweeping past during someone else's loop or turn-around doesn't scare it off.
    let c = chasedBy(e);
    if(c && Math.abs(wrapA(Math.atan2(c.y-e.y, c.x-e.x) - e.a)) < 1.9) c = null;
    e.chasedT = c ? (e.chasedT||0) + dt : 0;
    if(e.chasedT < 0.5) c = null;
    // a hit makes it break off - but a Zero pressing home an attack from someone's tail mostly holds on
    const committed = tg.d < 450 && aimedAt(e, tg.x, tg.y) < 0.6;
    if((c && Math.random() < dt*2.5) || (e.flash>0 && Math.random() < (committed ? 0.04 : 0.3))){
      const ref = c ? c.a : e.a + Math.PI;
      // defensive manoeuvres: hard turns, climbs and dives, plus the aerobatic ones (maneuvers.js), each only
      // when there is the height and speed for it
      const alt = groundY(e.x) - e.y, level = Math.abs(Math.sin(e.a)) < 0.5;
      const pool = ['break','break','zoom','dive'];
      if(level && (e.brCool||0) <= 0) pool.push('barrel','barrel');
      if(level && alt > 330) pool.push('split');
      if(level && e.y > CEIL + 300) pool.push('imm');
      if(level && e.speed > 150 && e.y > CEIL + 350) pool.push('hammer');
      if(level && c && Math.hypot(c.x-e.x, c.y-e.y) < 260) pool.push('brake');
      const pick = pool[Math.floor(Math.random()*pool.length)];
      if(['barrel','split','imm','hammer','brake'].includes(pick)){ zeroManeuver(e, pick); if(pick==='barrel') e.brCool = BARREL_COOL; }
      else {
        e.man = pick;
        e.turnDir = (wrapA(e.a - ref) >= 0 ? 1 : -1) * (Math.random()<0.25 ? -1 : 1);
        e.mt = rnd(0.9, 1.6);
      }
    } else if(tg.d < 110 && aimedAt(e, tg.x, tg.y) > 1.2){
      // only after overshooting (target now beside or behind): extend, then turn back in.
      // A Zero sitting on someone's tail stays there and keeps firing.
      e.man = 'extend'; e.mt = rnd(0.7, 1.1); e.extendA = e.a + rnd(-0.5, 0.5);
    }
  }
  e.brCool = Math.max(0, (e.brCool||0) - dt);
  if(zeroManeuverStep(e, dt, turn)) return;          // split-S, Immelmann, hammerhead fly themselves
  if(e.man==='barrel' || e.man==='brake'){            // these keep the chase going underneath
    steerAngle(e, e.a, turn, dt);
    return;
  }
  if(e.man){
    let want, sp = e.base;
    if(e.man==='break'){ want = e.a + e.turnDir*1.4 + Math.sin(G.time*9 + e.phase)*0.25; sp = e.base*0.92; }   // hard turn with jinks
    else if(e.man==='zoom'){ want = Math.cos(e.a) >= 0 ? -1.25 : -Math.PI+1.25; sp = e.base*0.85; }          // climb away
    else if(e.man==='dive'){ want = Math.cos(e.a) >= 0 ? 0.9 : Math.PI-0.9; sp = e.base*1.15; }              // dive for speed
    else { want = e.extendA - (Math.cos(e.extendA)>=0 ? 0.35 : -0.35); sp = e.base*1.05; }                   // extend, climbing slightly
    e.speed += (sp - e.speed)*Math.min(1, dt*2);
    steerAngle(e, want, turn*1.2, dt);
    return;
  }
  // Pursuit: a Zero chasing an aircraft from behind opens the throttle to close the gap (even on a faster
  // American fighter at full power), then matches its speed once in gun range instead of overshooting.
  const tSpd = Math.hypot(tg.vx, tg.vy), ahead = aimedAt(e, tg.x, tg.y) < 0.9;
  let want = e.base;
  if(ahead && tSpd > 0){
    if(tg.d > 260) want = clamp(tSpd*1.12, e.base, e.base*1.35);
    else want = clamp(tSpd + (tg.d - 170)*0.4, e.base*0.6, e.base*1.3);
  }
  e.speed += (want - e.speed)*Math.min(1, dt*1.8);
  // Lead the target along its curve, not a straight line: watch how fast its flight path is turning (loops,
  // turn-arounds) and aim where it will be on that arc when the bullets arrive.
  const va = Math.atan2(tg.vy, tg.vx);
  if(e.tva != null && e.tvo === e.tgtO){ const w = clamp(wrapA(va - e.tva)/Math.max(dt, 1e-3), -3, 3); e.tw = (e.tw||0)*0.8 + w*0.2; }
  else e.tw = 0;
  e.tva = va; e.tvo = e.tgtO;
  const lead = tg.d/760, la = va + (e.tw||0)*lead*0.5;
  const tx = tg.x + Math.cos(la)*tSpd*lead, ty = tg.y + Math.sin(la)*tSpd*lead;
  // weave while closing from range, then track hard once in firing range
  const weave = tg.d > 560 ? Math.sin(G.time*2.2 + e.phase)*0.35 : 0;
  steerAngle(e, Math.atan2(ty-e.y, tx-e.x) + weave, tg.d < 560 ? turn*1.25 : turn, dt);
  // Fire when the target (its size included) is inside the cone: long bursts with short pauses
  const cone = 0.1 + Math.atan2(18, Math.max(tg.d, 1));
  if(e.cool<=0 && tg.d<560 && aimedAt(e, tx, ty) < cone){
    shootFrom(e, 'e', 3+lvl*0.6); SFX.enemyGun();
    e.burst++; e.cool = e.burst%8===0 ? rnd(0.6,1.0) : 0.11;
  }
}

function bettyAI(e, dt){
  const C = G.carrier;
  if(e.cruiseY == null) e.cruiseY = Math.random() < 0.45 ? CEIL + rnd(150, 350) : 170;   // some bomb from high altitude
  steer(e, e.x>C.x ? C.x-2000 : -2000, e.cruiseY, 0.6, dt);
  e.cool -= dt;
  const carry = Math.cos(e.a)*e.speed*Math.sqrt(2*Math.max(0, DECK_Y-e.y)/320);   // a falling bomb keeps the bomber's forward speed
  if(e.bombs>0 && e.cool<=0 && e.x+carry > C.x+40 && e.x+carry < C.x+C.len-20){
    G.drops.push({kind:'bomb', x:e.x, y:e.y+10, vx:Math.cos(e.a)*e.speed, vy:30, team:'e', dmg:60, r:50});
    e.bombs--; e.cool = 0.45;
  }
  // tail gunner shoots at the player when close
  const P = G.player;
  if(!P.dead && !P.onDeck && dist2(e.x,e.y,P.x,P.y)<330*330 && Math.random()<dt*2.5){
    const a = Math.atan2(P.y-e.y, P.x-e.x)+rnd(-0.1,0.1);
    G.shots.push({x:e.x, y:e.y, vx:Math.cos(a)*700, vy:Math.sin(a)*700, team:'e', dmg:3, life:0.6});
  }
}

function emilyAI(e, dt, lvl){
  const P = G.player;
  // slow patrol over the far half of the map, bobbing in altitude
  if(e.x < G.L*0.45) e.dir = 1; if(e.x > G.L-300) e.dir = -1;
  steer(e, e.x + e.dir*500, 170 + Math.sin(G.time*0.4)*60, 0.35, dt);
  if(P.dead || P.onDeck) return;
  e.guns.forEach((g,i)=>{
    e.gcool[i] -= dt;
    const gx = e.x+g.dx*Math.sign(Math.cos(e.a)||1), gy = e.y+g.dy;
    if(e.gcool[i]<=0 && dist2(gx,gy,P.x,P.y)<560*560){
      const a = Math.atan2(P.y-gy, P.x-gx)+rnd(-0.07,0.07);
      G.shots.push({x:gx, y:gy, vx:Math.cos(a)*720, vy:Math.sin(a)*720, team:'e', dmg:3+lvl*0.4, life:0.85});
      e.gcool[i] = Math.random()<0.15 ? rnd(0.8,1.5) : 0.16; SFX.enemyGun();
    }
  });
}

// ---- AI wingmen ----
function hurtWing(w, d){
  if(w.dead) return;
  w.hp -= d; w.flash = 0.08;
  if(w.hp<=0){
    w.dead=true; boom(w.x, w.y, 34, false, true); SFX.planeBoom();
    if(G.def.mode==='defense'){ w.respawnT = 10; say(`איבדנו את ${WINGMEN[w.kind].name} – מטוס חלופי ימריא מהנושאת בעוד 10 שניות`,3); }
    else say(`איבדנו את ${WINGMEN[w.kind].name}`,3);
  }
}

// Wingmen only go after targets inside the playable area: not aircraft still on their take-off run beyond
// the map edge, nor ships that are out of reach (the carrier task force during the defense phase).
const inPlay = x => x > -300 && x < G.L + 150;
function nearestEnemyPlane(x, y, range){
  let best=null, bd=range*range;
  for(const e of G.enemies){ if(e.dead || e.takeoff || !inPlay(e.x)) continue; const d=dist2(x,y,e.x,e.y); if(d<bd){bd=d;best=e;} }
  return best;
}
function nearestGroundTarget(x, range, preferAA, skip){   // skip: targets another wingman already took
  let best=null, bd=range;
  for(const s of G.structures){
    if(s.dead || !s.primary || (skip && skip.has(s))) continue;
    let d = Math.abs(s.x-x); if(preferAA && s.type!=='aa') d += 400;
    if(d<bd){ bd=d; best={x:s.x, y:s.y-s.h/2, gy:s.y, obj:s}; }
  }
  for(const sh of G.ships){
    if(sh.dead || !inPlay(sh.x) || (skip && skip.has(sh))) continue; const d=Math.abs(sh.x-x);
    if(d<bd){ bd=d; best={x:sh.x, y:SEA-sh.h/2, gy:SEA-sh.h, obj:sh}; }
  }
  // Ground Support: Chi-Ha tanks and Japanese infantry on the island being fought over are targets too,
  // tanks first (they count as closer)
  if(G.ground){
    const isl = G.ground.island;
    for(const t of G.jtanks){
      if(t.dead || t.island!==isl || (skip && skip.has(t))) continue; const d = Math.abs(t.x-x) - 300;
      if(d<bd){ bd=d; best={x:t.x, y:t.y-6, gy:t.y, obj:t}; }
    }
    for(const s of G.soldiers){
      if(s.dead || islandOf(s.x)!==isl || (skip && skip.has(s))) continue; const d = Math.abs(s.x-x);
      if(d<bd){ bd=d; best={x:s.x, y:s.y-6, gy:s.y, obj:s}; }
    }
  }
  return best;
}

function formationPoint(w){
  const P = G.player;
  const side = w.slot%2===0 ? -1 : 1;
  return {x: P.x - P.f*(70 + w.slot*45), y: P.y + side*(40 + w.slot*18) - 20};
}

// nearest enemy aircraft nobody else has taken (falls back to any, when there are more wingmen than enemies);
// with `around` set, only enemies near that x (the carrier) count
function pickEnemy(w, claimed, around){
  let best=null, bd=Infinity, any=null, ad=Infinity;
  for(const e of G.enemies){
    if(e.dead || e.takeoff || !inPlay(e.x)) continue;
    if(around!=null && Math.abs(e.x-around) > 1400) continue;
    const d = dist2(w.x,w.y,e.x,e.y);
    if(d < ad){ ad=d; any=e; }
    if(!claimed.has(e) && d < bd){ bd=d; best=e; }
  }
  if(!best && (around!=null || ad < 2600*2600)) best = any;
  return best && (around!=null || bd < 2600*2600 || best===any) ? best : null;
}
// keep attacking the same ground target until it is destroyed (and claim it so others pick different ones)
function stickyGround(w, range, preferAA, claimed){
  const alive = o => o && !o.dead && (o.hp == null || o.hp > 0);
  let g = null;
  if(w.gt && alive(w.gt.obj) && !claimed.has(w.gt.obj)){ const o = w.gt.obj; g = {x:o.x, y:w.gt.y, gy:w.gt.gy, obj:o}; }
  else { g = nearestGroundTarget(w.x, range, preferAA, claimed); w.run = null; }
  w.gt = g; if(g) claimed.add(g.obj);
  return g;
}
// A proper attack pass that works with the wingmen's flight model (no hovering over the target):
// setup - fly away to a start point well to one side, at altitude; run - fighters dive on the target firing,
// bombers fly level and release when the bomb will carry onto it; pull - climb away, then set up again.
function attackRun(w, g, dt, maxS, bomber){
  w.speed += (maxS - w.speed)*Math.min(1, dt*2);
  const alt = bomber ? 220 : 250;
  if(!w.run){ w.run = 'setup'; w.side = Math.sign(w.x - g.x) || 1; }
  if(w.run==='setup'){
    const sx = g.x + w.side*650, sy = g.gy - alt;
    steer(w, sx, sy, 1.6, dt);
    if(Math.abs(w.x - sx) < 140 && Math.abs(w.y - sy) < 120) w.run = 'run';
  } else if(w.run==='run'){
    const dir = -w.side;                                       // attacking back toward the target
    if(bomber){
      steer(w, g.x + dir*400, g.gy - alt, 1.3, dt);
      const vx = Math.cos(w.a)*w.speed, fall = Math.sqrt(2*Math.max(30, g.gy - w.y)/320);
      if(w.cool<=0 && Math.abs(w.x + vx*fall - g.x) < 26){
        G.drops.push({kind:'bomb', x:w.x, y:w.y+8, vx, vy:Math.sin(w.a)*w.speed, team:'p', dmg:65, r:52});
        w.bombs--; w.cool = 0.5; w.run = 'pull'; w.t = 1.6;
      }
    } else {
      steer(w, g.x, g.y, 1.9, dt);
      const d = Math.hypot(g.x-w.x, g.y-w.y);
      if(w.cool<=0 && d < 460 && aimedAt(w, g.x, g.y) < 0.2){ shootFrom(w,'p',5); w.cool = 0.11; w.ammo--; }
      if(d < 90 || g.gy - w.y < 90){ w.run = 'pull'; w.t = 1.4; }
    }
    if((g.x - w.x)*dir < -180){ w.run = 'pull'; w.t = 1.2; }    // overshot: break off
  } else {
    // pull out: climb away in the direction of travel, then come round for another pass
    const right = Math.cos(w.a) >= 0;
    steerAngle(w, right ? -0.6 : -Math.PI+0.6, 2.0, dt);
    w.t -= dt; if(w.t <= 0){ w.run = 'setup'; w.side = Math.sign(w.x - g.x) || 1; }
  }
}

// carrier defense patrol: a wide racetrack above our carrier, each wingman on its own lane
function patrolCarrier(w, dt, maxS){
  const C = G.carrier, cx = C.x + C.len/2, ang = G.time*0.3 + (w.slot||0)*2.1;
  w.speed += (maxS*0.85 - w.speed)*Math.min(1, dt);
  steer(w, cx + Math.cos(ang)*650, DECK_Y - 260 - (w.slot||0)*45, 1.4, dt);
}
// an enemy fighter sitting behind this wingman with its nose on it
function enemyOnTail(w){
  for(const e of G.enemies){
    if(e.dead || e.type!=='zero') continue;
    const dx = w.x-e.x, dy = w.y-e.y;
    if(dx*dx+dy*dy < 320*320 && Math.abs(wrapA(Math.atan2(dy,dx) - e.a)) < 0.35) return true;
  }
  return false;
}

function updateWingmen(dt){
  const P = G.player, C = G.carrier, attack = G.wingMode==='attack';
  const claimed = new Set();                                 // targets already taken by a wingman this frame
  for(const w of G.wingmen){
    if(w.dead){
      // Carrier Defense: a lost wingman is replaced by a fresh aircraft launched from its carrier 10 s later
      if(w.respawnT != null){
        w.respawnT -= dt;
        if(w.respawnT <= 0){
          w.respawnT = null;
          Object.assign(w, {dead:false, hp:w.max, bombs:4, flash:0, cool:0, off:null, face:null, av:0});
          const home = (w.home==='c2' && G.carrier2) ? G.carrier2 : C;
          startWingLaunch(w, 0, home.x + 330);
          say(`${WINGMEN[w.kind].name} חלופי ממריא מהנושאת`, 2.5);
        }
      }
      continue;
    }
    w.flash = Math.max(0,(w.flash||0)-dt);
    w.cool -= dt;
    // carrier operations: take-off roll, landing glide, roll-out and rearming on deck
    if(w.state==='launch'){ wingTakeoff(w, dt); continue; }
    if(w.state==='landing'){ wingLandingGlide(w, dt); continue; }
    if(w.state==='deck'){
      w.speed = Math.max(0, w.speed - 170*dt); w.x -= w.speed*dt; w.y = DECK_Y-9; w.a = Math.PI;
      if(w.speed<=0){ w.state='rearm'; w.t=5; }
      continue;
    }
    if(w.state==='rearm'){
      w.t -= dt;
      if(w.t<=0){ w.bombs=4; w.hp=w.max; startWingLaunch(w, 0); }
      continue;
    }
    const maxS = WINGMEN[w.kind].speed;
    // never stray beyond the edges of the map: turn back toward the action
    if(w.x > G.L + 200 || w.x < -400){
      w.speed += (maxS - w.speed)*Math.min(1, dt*2);
      steer(w, w.x > 0 ? G.L - 400 : 400, clamp(w.y, 120, DECK_Y-150), 1.8, dt);
      continue;
    }
    w.pilot = true;                                            // flies like the player's aircraft (see pilotSteer)
    const mode = G.wingMode, cx = C.x + C.len/2;
    // being shot at from behind: shake the attacker off with a loop, Immelmann, split-S, hammerhead,
    // barrel roll or air brake - whichever the height and speed allow
    if(w.vl==null && w.ft==null && !w.mv && !w.br && enemyOnTail(w) && Math.random() < dt*1.5){
      const alt = groundY(w.x) - w.y, pool = [];
      if(w.brCool <= 0 || w.brCool == null) pool.push('barrel', 'barrel');
      if(w.speed > 170 && alt > 260) pool.push('loop', 'imm');
      if(w.speed > 140 && alt > 340) pool.push('split');
      if(w.speed > 150 && alt > 220 && w.y > CEIL + 350) pool.push('hammer');
      if(w.speed > 150) pool.push('brake');
      const pick = pool[Math.floor(Math.random()*pool.length)];
      if(pick==='barrel') mvBarrel(w);
      else if(pick==='loop') w.vl = w.p ?? 0;
      else if(pick==='imm'){ w.vl = w.p ?? 0; w.vlImm = true; }
      else if(pick==='split' || pick==='hammer') mvStart(w, pick);
      else if(pick==='brake') mvBrake(w);
    }
    // Out of ammunition (fighters) or bombs (bombers): head back, land on the carrier and rearm.
    if(w.role==='fighter' ? w.ammo<=0 : w.bombs<=0){
      if(!w.rtb){ w.rtb = true; say(`${WINGMEN[w.kind].name} סיים את ה${w.role==='fighter'?'תחמושת':'פצצות'} וחוזר לנושאת להתחמש`, 2.5); }
      const gate = {x:C.x+C.len+300, y:DECK_Y-90};             // a gate off the bow, then turn in and land
      w.speed = maxS; steer(w, gate.x, gate.y, 1.4, dt);
      if(Math.hypot(w.x-gate.x, w.y-gate.y) < 110 && Math.cos(w.a) < 0.2){ w.state='landing'; }
      continue;
    }
    if(w.role==='fighter'){
      // Escort: engage whatever comes near the leader. Free attack / carrier defense: every wingman takes a
      // different enemy (keeping it while it lives), defense only within reach of the carrier.
      let tgt = null;
      if(mode==='escort') tgt = nearestEnemyPlane(P.x, P.y, 650);
      else {
        const ok = e => e && !e.dead && !e.takeoff && inPlay(e.x) && G.enemies.includes(e) && !claimed.has(e) && (mode!=='defend' || Math.abs(e.x-cx) < 1400);
        tgt = ok(w.tgt) ? w.tgt : pickEnemy(w, claimed, mode==='defend' ? cx : null);
        w.tgt = tgt; if(tgt) claimed.add(tgt);
      }
      if(!tgt && mode==='defend'){ patrolCarrier(w, dt, maxS); }
      else if(tgt){
        w.speed = maxS;
        const d = Math.hypot(tgt.x-w.x, tgt.y-w.y), lead = d/760;
        const tx = tgt.x+Math.cos(tgt.a)*tgt.speed*lead, ty = tgt.y+Math.sin(tgt.a)*tgt.speed*lead;
        steer(w, tx, ty, 2.0, dt);
        if(w.cool<=0 && d<420 && aimedAt(w,tx,ty)<0.13){ shootFrom(w,'p',4); w.cool=0.12; w.ammo--; }
      } else if(attack){
        const g = stickyGround(w, 3000, true, claimed);
        if(g) attackRun(w, g, dt, maxS, false); else { w.run = null; followLeader(w, dt, maxS); }
      } else { w.run = null; followLeader(w, dt, maxS); }
    } else { // bomber (out of bombs is handled above)
      // bombers: each picks its own target in free attack; in carrier defense they stay on patrol over the carrier
      const g = mode==='attack' ? stickyGround(w, 99999, false, claimed) : mode==='escort' ? nearestGroundTarget(P.x, 950) : null;
      if(!g){ w.run = null; if(mode==='defend') patrolCarrier(w, dt, maxS); else followLeader(w, dt, maxS); continue; }
      attackRun(w, g, dt, maxS, true);
    }
    if(w.y >= groundY(w.x)-4){ w.hp=0; hurtWing(w,1); }
  }
}

// Wingmen never appear out of nowhere: they start parked on the carrier deck and launch in turn.
function startWingLaunch(w, delay, x){
  w.ammo = WING_AMMO; w.bombs = 4; w.rtb = false;            // every launch is with full guns and racks
  w.state='launch'; if(x!=null) w.x = x;
  w.y = DECK_Y-9; w.a = 0; w.speed = 0; w.gear = 1; w.takeoff = {t:-delay};
}
function wingTakeoff(w, dt){
  const k = w.takeoff, full = WINGMEN[w.kind].speed;
  k.t += dt; if(k.t < 0) return;                                  // waiting its turn on deck
  w.speed = Math.min(full, w.speed + full*0.55*dt);
  if(w.speed < full*0.55){ w.x += w.speed*dt; w.y = DECK_Y-9; w.a = 0; }
  else {
    w.a = -0.25; w.x += Math.cos(w.a)*w.speed*dt; w.y += Math.sin(w.a)*w.speed*dt;
    w.gear = Math.max(0, w.gear - dt);
    if(DECK_Y-9 - w.y > 70){ w.state='fly'; w.takeoff=null; w.gear=0; w.f=null; w.ft=null; w.vl=null; w.mv=null; w.br=null; w.roll=0; w.rollGoal=0; }
  }
}
function wingLandingGlide(w, dt){
  const C = G.carrier, td = {x:C.x+C.len*0.55, y:DECK_Y-9};
  w.speed = Math.max(120, w.speed - 60*dt); w.gear = Math.min(1, (w.gear||0) + dt);
  const ang = Math.atan2(td.y-w.y, td.x-w.x); w.a = ang;
  w.x += Math.cos(ang)*w.speed*dt; w.y += Math.sin(ang)*w.speed*dt;
  if(Math.hypot(td.x-w.x, td.y-w.y) < 8){ w.state='deck'; w.y = DECK_Y-9; w.a = Math.PI; }
}
// After the player is shot down, lost wingmen are replaced too and launch with the new aircraft.
function restoreWingmen(){
  let k = 0;
  for(const w of G.wingmen){
    if(!w.dead) continue;
    Object.assign(w, {dead:false, hp:w.max, bombs:4, flash:0, cool:0, respawnT:null});
    startWingLaunch(w, 0.6 + k*1.4, G.carrier.x + 170 + k*80); k++;
  }
  if(k) say(k>1 ? `${k} מטוסי כנף חלופיים ממריאים מהנושאת` : 'מטוס כנף חלופי ממריא מהנושאת', 3);
}

// Formation keeping. The slot position eases toward its new place when the leader turns around (instead of
// jumping), and once close the wingman matches the leader's heading and adjusts speed, rather than chasing the
// slot point itself, which is what made it rock back and forth.
function followLeader(w, dt, maxS){
  const P = G.player;
  if(P.onDeck || P.dead){
    // holding pattern: a wide, steady racetrack over the carrier
    const C = G.carrier, cx = C.x + C.len/2, ang = G.time*0.35 + w.slot*2.1;
    const hx = cx + Math.cos(ang)*520, hy = 210 + w.slot*45 + Math.sin(ang)*40;
    w.speed += (clamp(maxS*0.8, 170, maxS) - w.speed)*Math.min(1, dt);
    steer(w, hx, hy, 1.2, dt);
    w.off = null;
    return;
  }
  // smooth the slot's offset from the leader (it swaps sides when the leader turns around), not its absolute
  // position, so the slot never lags behind a fast-moving leader
  const want = formationPoint(w), ox = want.x - P.x, oy = want.y - P.y;
  if(!w.off) w.off = {x:ox, y:oy};
  const k = Math.min(1, dt*1.4);
  w.off.x += (ox - w.off.x)*k; w.off.y += (oy - w.off.y)*k;
  w.fp = {x:P.x + w.off.x, y:P.y + w.off.y};
  const v = playerVel(P), pa = Math.atan2(v.vy, v.vx);
  const dx = w.fp.x - w.x, dy = w.fp.y - w.y, d = Math.hypot(dx, dy);
  if(d > 180){
    // rejoining: head for a point ahead of the slot at full speed
    // (an upgraded leader can out-run a stock wingman, so the escort may push past its normal top speed to keep up)
    const boost = d > 400 ? 1.45 : 1.25;
    w.speed += (Math.max(maxS*1.1, P.speed*boost) - w.speed)*Math.min(1, dt*2);
    const lead = Math.min(1.5, d/300);                       // aim at where the slot will be, not where it is
    steer(w, w.fp.x + v.vx*lead, w.fp.y + v.vy*lead, 1.8, dt);
  } else {
    // in formation: fly the leader's heading, nudged gently toward the slot
    const along = dx*Math.cos(pa) + dy*Math.sin(pa), across = -dx*Math.sin(pa) + dy*Math.cos(pa);
    const correct = clamp(across*0.012, -0.35, 0.35);
    w.speed += (clamp(P.speed + along*0.9, 150, Math.max(maxS*1.15, P.speed*1.25)) - w.speed)*Math.min(1, dt*2.5);
    steerAngle(w, pa + correct, 1.6, dt);
  }
}

function updateWeather(dt){
  const W = G.weather;
  W.gust = Math.sin(G.time*0.7)*W.wind*0.35;
  W.flash = Math.max(0, W.flash - dt*2.5);
  if(W.storm && Math.random() < dt/7){ W.flash = 1; setTimeout(()=>SFX.thunder(), rnd(200,900)); }
}
