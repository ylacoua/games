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
      so.x += so.dir*so.speed*dt; so.y = groundY(so.x);
      if(groundY(so.x+so.dir*12) > SEA-14) so.dir = -so.dir;
    }
  }
  G.soldiers = G.soldiers.filter(s=>!s.dead);
}

function spawnSoldier(x){
  G.soldiers.push({x, y:groundY(x), dir:Math.random()<.5?-1:1, speed:rnd(26,42), t:rnd(0,1), cool:rnd(1,3), dead:false, safe:0.8});   // safe: they just ran out of the blast
}
function killSoldier(so){
  so.dead=true; earn('soldier', so.x, so.y-10);
  for(let i=0;i<4;i++) G.debris.push({x:so.x,y:so.y-8,vx:rnd(-50,50),vy:rnd(-120,-40),r:0,vr:0,life:0.6,c:'#7a1f1a',spark:true});
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
    if(is.strip && G.structures.some(s=>s.island===i && !s.dead)) sites.push({kind:'island', x:(is.strip.x0+is.strip.x1)/2, is});
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
    : {type:'zero',  x, y, a:dir>0?0:Math.PI, speed:0, full, hp:28+G.idx*4, size:16, cool:1, burst:0, evade:0, dead:false};
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
  if(G.zeroT<=0 && airborne && P.x>1200 && alive < 3+lvl){
    const site = nearestSite(launchSites(), P.x);
    if(site){
      const n = 1 + (Math.random()<0.25+lvl*0.1 ? 1 : 0);
      for(let i=0;i<n;i++) launchFrom(site, 'zero', i*1.6);
      say(site.kind==='carrier' ? 'מטוסי זירו ממריאים מהנושאת היפנית!' : (n>1 ? 'מטוסי זירו ממריאים מהאי!' : 'מטוס זירו ממריא מהאי!'), 2.5);
    }
    G.zeroT = def.zeroEvery*rnd(0.8,1.2);
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
    boom(e.x, e.y, e.type==='emily'?90:34, e.type!=='zero');
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
  // target: the player, or a wingman that is closer
  let tg = (!P.dead && !P.onDeck) ? {x:P.x, y:P.y, vx:playerVel(P).vx, vy:playerVel(P).vy, d:Math.hypot(P.x-e.x,P.y-e.y)*0.85} : null;
  for(const w of G.wingmen){
    if(w.dead || w.state!=='fly') continue;
    const d = Math.hypot(w.x-e.x, w.y-e.y);
    if(!tg || d*1.3 < tg.d) tg = {x:w.x, y:w.y, vx:Math.cos(w.a)*w.speed, vy:Math.sin(w.a)*w.speed, d};
  }
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
    if(!e.kamikaze){ e.kamikaze = true; e.escort = null; say('מטוס זירו פגוע צולל בקמיקזה על הנושאת!', 2.5); SFX.alarm(); }
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
  const turn = 2.3 + lvl*0.12;
  e.mt -= dt; e.cool -= dt;
  if(e.mt <= 0) e.man = null;
  if(!e.man){
    const c = chasedBy(e);
    if((c && Math.random() < dt*2.5) || (e.flash>0 && Math.random() < 0.5)){
      const ref = c ? c.a : e.a + Math.PI;
      e.man = ['break','break','zoom','dive'][Math.floor(Math.random()*4)];
      e.turnDir = (wrapA(e.a - ref) >= 0 ? 1 : -1) * (Math.random()<0.25 ? -1 : 1);
      e.mt = rnd(0.9, 1.6);
    } else if(tg.d < 110){ e.man = 'extend'; e.mt = rnd(0.9, 1.4); e.extendA = e.a + rnd(-0.5, 0.5); }
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
  e.speed += (e.base - e.speed)*Math.min(1, dt*1.5);
  const lead = tg.d/760;
  const tx = tg.x + tg.vx*lead, ty = tg.y + tg.vy*lead;
  // weave while closing from range, tighten up when in firing range
  const weave = tg.d > 420 ? Math.sin(G.time*2.2 + e.phase)*0.4 : 0;
  steerAngle(e, Math.atan2(ty-e.y, tx-e.x) + weave, turn, dt);
  if(e.cool<=0 && tg.d<430 && aimedAt(e, tx, ty) < 0.14){
    shootFrom(e, 'e', 3+lvl*0.6); SFX.enemyGun();
    e.burst++; e.cool = e.burst%6===0 ? rnd(0.8,1.4) : 0.11;
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
    e.bombs--; e.cool = 0.45; SFX.drop();
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
    w.dead=true; boom(w.x, w.y, 34, false);
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
function nearestGroundTarget(x, range, preferAA){
  let best=null, bd=range;
  for(const s of G.structures){
    if(s.dead || !s.primary) continue;
    let d = Math.abs(s.x-x); if(preferAA && s.type!=='aa') d += 400;
    if(d<bd){ bd=d; best={x:s.x, y:s.y-s.h/2, gy:s.y, obj:s}; }
  }
  for(const sh of G.ships){
    if(sh.dead || !inPlay(sh.x)) continue; const d=Math.abs(sh.x-x);
    if(d<bd){ bd=d; best={x:sh.x, y:SEA-sh.h/2, gy:SEA-sh.h, obj:sh}; }
  }
  return best;
}

function formationPoint(w){
  const P = G.player;
  const side = w.slot%2===0 ? -1 : 1;
  return {x: P.x - P.f*(70 + w.slot*45), y: P.y + side*(40 + w.slot*18) - 20};
}

function updateWingmen(dt){
  const P = G.player, C = G.carrier, attack = G.wingMode==='attack';
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
    if(w.role==='fighter'){
      const tgt = attack ? nearestEnemyPlane(w.x, w.y, 1600) : nearestEnemyPlane(P.x, P.y, 650);
      if(tgt){
        w.speed = maxS;
        const d = Math.hypot(tgt.x-w.x, tgt.y-w.y), lead = d/760;
        const tx = tgt.x+Math.cos(tgt.a)*tgt.speed*lead, ty = tgt.y+Math.sin(tgt.a)*tgt.speed*lead;
        steer(w, tx, ty, 2.0, dt);
        if(w.cool<=0 && d<420 && aimedAt(w,tx,ty)<0.13){ shootFrom(w,'p',4); w.cool=0.12; }
      } else if(attack){
        const g = nearestGroundTarget(w.x, 3000, true);
        if(g){
          w.speed = maxS;
          const tx = g.x, ty = g.y;
          const far = Math.abs(tx-w.x) > 420;
          steer(w, far ? tx - Math.sign(tx-w.x)*300 : tx, far ? g.gy-220 : ty, 1.8, dt);
          if(!far && w.cool<=0 && aimedAt(w,tx,ty)<0.15){ shootFrom(w,'p',5); w.cool=0.11; }
        } else followLeader(w, dt, maxS);
      } else followLeader(w, dt, maxS);
    } else { // bomber
      if(w.bombs<=0){
        // out of bombs: fly to a gate off the carrier's bow, then turn in and land to rearm
        const gate = {x:C.x+C.len+300, y:DECK_Y-90};
        w.speed = maxS; steer(w, gate.x, gate.y, 1.4, dt);
        if(Math.hypot(w.x-gate.x, w.y-gate.y) < 110 && Math.cos(w.a) < 0.2){ w.state='landing'; }
        continue;
      }
      const g = attack ? nearestGroundTarget(w.x, 99999) : nearestGroundTarget(P.x, 950);
      if(!g){ followLeader(w, dt, maxS); continue; }
      w.speed = maxS;
      const alt = 220, ty = g.gy - alt, fall = Math.sqrt(2*alt/320);
      const vx = Math.cos(w.a)*w.speed, dir = Math.sign(g.x - w.x) || 1;
      const impact = w.x + vx*fall;
      const approach = Math.abs(g.x - w.x) > 900 ? {x:g.x - dir*200, y:ty} : {x:g.x + dir*600, y:ty};
      steer(w, approach.x, approach.y, 1.3, dt);
      if(w.cool<=0 && Math.abs(impact-g.x)<22 && Math.abs(w.y-ty)<70 && Math.abs(Math.sin(w.a))<0.35){
        G.drops.push({kind:'bomb', x:w.x, y:w.y+8, vx:vx, vy:Math.sin(w.a)*w.speed, team:'p', dmg:65, r:52});
        w.bombs--; w.cool=0.5; SFX.drop();
      }
    }
    if(w.y >= groundY(w.x)-4){ w.hp=0; hurtWing(w,1); }
  }
}

// Wingmen never appear out of nowhere: they start parked on the carrier deck and launch in turn.
function startWingLaunch(w, delay, x){
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
    if(DECK_Y-9 - w.y > 70){ w.state='fly'; w.takeoff=null; w.gear=0; }
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
