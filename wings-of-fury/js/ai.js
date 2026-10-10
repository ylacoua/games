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
    s.flash = Math.max(0,(s.flash||0)-dt);
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
      fireFlak(s.x, s.y-s.h, tg.x, tg.y, tg.vx, tg.vy, err, big?18:8+lvl, big);
      s.cool = big ? rnd(2.2,2.9) : rnd(1.5,2.3) - lvl*0.12;
    }
  }
  P.lit = lit;

  for(const sh of G.ships){
    if(sh.dead){ sh.sink += dt*0.12; continue; }
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

  for(const so of G.soldiers){
    if(so.dead) continue;
    so.t += dt; so.x += so.dir*so.speed*dt; so.y = groundY(so.x);
    if(groundY(so.x+so.dir*12) > SEA-14) so.dir = -so.dir;
    so.cool -= dt;
    if(so.cool<=0 && !P.dead && !P.onDeck && dist2(so.x,so.y,P.x,P.y)<280*280){
      const a = Math.atan2(P.y-so.y, P.x-so.x)+rnd(-0.12,0.12);
      G.shots.push({x:so.x, y:so.y-12, vx:Math.cos(a)*600, vy:Math.sin(a)*600, team:'e', dmg:1.5, life:0.6});
      so.cool = rnd(1.5,3);
    }
  }
  G.soldiers = G.soldiers.filter(s=>!s.dead);
}

function spawnSoldier(x){
  G.soldiers.push({x, y:groundY(x), dir:Math.random()<.5?-1:1, speed:rnd(26,42), t:rnd(0,1), cool:rnd(1,3), dead:false});
}
function killSoldier(so){
  so.dead=true; earn('soldier', so.x, so.y-10);
  for(let i=0;i<4;i++) G.debris.push({x:so.x,y:so.y-8,vx:rnd(-50,50),vy:rnd(-120,-40),r:0,vr:0,life:0.6,c:'#7a1f1a',spark:true});
}

// ---- generic steering for AI aircraft (heading angle a, y-down) ----
function steer(e, tx, ty, turn, dt){
  let want = Math.atan2(ty-e.y, tx-e.x);
  const right = Math.cos(e.a) >= 0;
  const sink = Math.max(0, Math.sin(e.a))*e.speed*0.9;
  const gy = Math.min(groundY(e.x + Math.cos(e.a)*80), groundY(e.x + Math.cos(e.a)*180));
  let avoid = false;
  if(e.y + sink > gy - 70){ want = right ? -0.7 : -Math.PI+0.7; avoid = true; }
  else if(e.y < CEIL+40) want = right ? 0.35 : Math.PI-0.35;
  if(avoid) turn *= 1.7;
  const d = wrapA(want-e.a);
  e.a = wrapA(e.a + clamp(d, -turn*dt, turn*dt));
  e.x += Math.cos(e.a)*e.speed*dt + G.weather.wind*0.3*dt;
  e.y += Math.sin(e.a)*e.speed*dt;
  return d;
}
function aimedAt(e, tx, ty){ return Math.abs(wrapA(Math.atan2(ty-e.y, tx-e.x) - e.a)); }

function shootFrom(e, team, dmg, spd=760){
  const a = e.a + rnd(-0.04,0.04);
  G.shots.push({x:e.x+Math.cos(e.a)*18, y:e.y+Math.sin(e.a)*18, vx:Math.cos(a)*spd+Math.cos(e.a)*e.speed*0.5, vy:Math.sin(a)*spd+Math.sin(e.a)*e.speed*0.5, team, dmg, life:0.8});
}

// ---- spawning ----
function updateSpawns(dt, viewW){
  const P = G.player, def = G.def, lvl = G.idx;
  const airborne = !P.dead && !P.onDeck;
  const alive = G.enemies.filter(e=>!e.dead && e.type==='zero').length;
  G.zeroT -= dt;
  if(G.zeroT<=0 && airborne && P.x>1200 && alive < 3+lvl){
    const n = 1 + (Math.random()<0.25+lvl*0.1 ? 1 : 0);
    for(let i=0;i<n;i++) spawnZero(P.x + (Math.random()<.5?-1:1)*(viewW*0.65+rnd(100,300)), clamp(P.y+rnd(-180,120), CEIL+60, 300));
    say(n>1?'מטוסי זירו מתקרבים!':'מטוס זירו באופק!',2);
    G.zeroT = def.zeroEvery*rnd(0.8,1.2);
  }
  if(def.bombers){
    G.bomberT -= dt;
    if(G.bomberT<=0 && airborne){
      G.enemies.push({type:'betty', x:Math.min(G.L, P.x+viewW+600), y:rnd(140,200), a:Math.PI, speed:145, hp:90, size:24, cool:0, bombs:3, dead:false});
      say('מפציץ אויב בדרך לנושאת! יירט אותו',3); SFX.alarm();
      G.bomberT = rnd(40,55)-lvl*3;
    }
  }
  if(def.boss==='emily' && !G.bossSpawned && P.x > G.L*0.5){
    G.bossSpawned = true;
    G.boss = {type:'emily', x:P.x+viewW*0.8, y:170, a:Math.PI, speed:100, hp:1300, max:1300, size:40, boxW:120, boxH:44, cool:0, guns:[{dx:-40,dy:-14},{dx:10,dy:16},{dx:52,dy:-6}], gcool:[0,0.4,0.8], dead:false, dir:-1};
    G.enemies.push(G.boss);
    spawnZero(G.boss.x+120, 120); spawnZero(G.boss.x+160, 240);
    say('סירה מעופפת "אמילי" באופק! הפל אותה',4); SFX.alarm();
  }
}

function spawnZero(x, y){
  x = clamp(x, -300, G.L+300);
  G.enemies.push({type:'zero', x, y, a: x>G.player.x?Math.PI:0, speed:rnd(215,250)+G.idx*8, hp:28+G.idx*4, size:16, cool:1, burst:0, evade:0, dead:false});
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
    if(e.type==='zero') zeroAI(e, dt, lvl);
    else if(e.type==='betty') bettyAI(e, dt);
    else if(e.type==='emily') emilyAI(e, dt, lvl);
    if(e.y >= groundY(e.x)-4){ e.hp=0; hurtEnemy(e, 1); }
    if(!P.dead && !P.onDeck && P.inv<=0 && dist2(e.x,e.y,P.x,P.y) < ((e.size||16)+10)**2){ damagePlayer(35); hurtEnemy(e, 60); }
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
  if(!tg){ steer(e, e.x + Math.cos(e.a)*300, 180, 1.2, dt); return; }
  e.evade -= dt;
  if(e.evade>0){ steer(e, e.x + Math.cos(e.a)*400, 60, 2.4, dt); return; }
  const lead = tg.d/760;
  const tx = tg.x + tg.vx*lead, ty = tg.y + tg.vy*lead;
  steer(e, tx, ty, 2.0+lvl*0.12, dt);
  if(tg.d < 80) e.evade = rnd(0.8,1.4);
  e.cool -= dt;
  if(e.cool<=0 && tg.d<430 && aimedAt(e, tx, ty) < 0.14){
    shootFrom(e, 'e', 3+lvl*0.6); SFX.enemyGun();
    e.burst++; e.cool = e.burst%6===0 ? rnd(0.8,1.4) : 0.11;
  }
}

function bettyAI(e, dt){
  const C = G.carrier;
  steer(e, e.x>C.x ? C.x-2000 : -2000, 170, 0.6, dt);
  e.cool -= dt;
  if(e.bombs>0 && e.cool<=0 && e.x > C.x+40 && e.x < C.x+C.len-20){
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
  if(w.hp<=0){ w.dead=true; boom(w.x, w.y, 34, false); say(`איבדנו את ${WINGMEN[w.kind].name}`,3); }
}

function nearestEnemyPlane(x, y, range){
  let best=null, bd=range*range;
  for(const e of G.enemies){ if(e.dead) continue; const d=dist2(x,y,e.x,e.y); if(d<bd){bd=d;best=e;} }
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
    if(sh.dead) continue; const d=Math.abs(sh.x-x);
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
    if(w.dead) continue;
    w.flash = Math.max(0,(w.flash||0)-dt);
    w.cool -= dt;
    if(w.state==='wait'){
      if(!P.onDeck || G.state==='fly'){ if(!P.onDeck){ w.state='fly'; w.a=-0.25; } }
      continue;
    }
    if(w.state==='rearm'){
      w.t -= dt;
      if(w.t<=0){ w.state='fly'; w.bombs=4; w.hp=w.max; w.x=C.x+C.len*0.6; w.y=DECK_Y-70; w.a=-0.3; }
      continue;
    }
    const maxS = WINGMEN[w.kind].speed;
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
        w.speed = maxS;
        steer(w, C.x+C.len/2, DECK_Y-140, 1.4, dt);
        if(Math.abs(w.x-(C.x+C.len/2))<120 && Math.abs(w.y-(DECK_Y-140))<80){ w.state='rearm'; w.t=6; }
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

function followLeader(w, dt, maxS){
  const P = G.player;
  const pt = P.onDeck || P.dead ? {x:G.carrier.x+G.carrier.len/2 + Math.sin(G.time*0.5+w.slot)*500, y:200+w.slot*40} : formationPoint(w);
  const d = Math.hypot(pt.x-w.x, pt.y-w.y);
  w.speed = d>200 ? maxS*1.1 : clamp(P.speed, 170, maxS);
  steer(w, pt.x, pt.y, 1.8, dt);
}

function updateWeather(dt){
  const W = G.weather;
  W.gust = Math.sin(G.time*0.7)*W.wind*0.35;
  W.flash = Math.max(0, W.flash - dt*2.5);
  if(W.storm && Math.random() < dt/7){ W.flash = 1; setTimeout(()=>SFX.thunder(), rnd(200,900)); }
}
