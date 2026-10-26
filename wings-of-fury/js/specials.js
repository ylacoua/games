// ---- Special missions ("משימות נוספות"): eight one-off scenarios with rules of their own ----
// Each mission: name, icon, brief, goals, tip, reward, map settings (time / rain / wind / zeroEvery / lives /
// noWing) and hooks: setup(S), update(S, dt), draw(ctx, S) (world, under the aircraft), over(ctx, S) (world,
// above them), screen(ctx, vw, S) (screen overlays), hud(S) (status lines), plus blast / bullet / friend / air
// for weapons hitting the mission's own objects. G.special holds the running mission's state S. Winning one
// records SAVE.won[id], which makes its skin available in the hangar.

const SPECIAL_ORDER = ['rescue','dark','convoy','bridge','clock','ace','burning','assault'];

function specialDef(id){
  const M = SPECIALS[id];
  return {name:M.name, brief:M.brief, mode:'special', time:M.time||'day', rain:M.rain||0, wind:M.wind||0, storm:!!M.storm,
    islands:0, ships:0, zeroEvery:M.zeroEvery||1e9, bombers:false, boss:null, jcarrier:false, reward:M.reward};
}
function specialSetup(id){
  const M = SPECIALS[id];
  G.special = {id, M, t:0, endT:0, bonus:0};
  if(M.lives) G.lives = M.lives;
  M.setup(G.special);
}
function specialUpdate(dt){
  const S = G.special;
  S.t += dt;
  if(S.endT > 0){ S.endT -= dt; if(S.endT <= 0) UI.result(S.win, S.reason); return; }
  S.M.update(S, dt);
}
// end the mission after a short pause, so the last explosion can be seen
function specialEnd(win, reason){
  const S = G.special; if(S.endT > 0) return;
  S.win = win; S.reason = reason; S.endT = 2.5;
  say(win ? reason || 'המשימה הושלמה!' : reason, 4);
  if(win) SFX.pickup();
}
// objectives done; the player lands on a carrier to finish (the deck panel then offers "סיים משימה")
function specialLandToFinish(text){
  if(G.complete) return;
  G.complete = true; SFX.pickup(); say(text, 6);
}

// hooks called from the engine
function specialDraw(ctx){ const S = G.special; if(S.M.draw) S.M.draw(ctx, S); }
function specialDrawOver(ctx){ const S = G.special; if(S.M.over) S.M.over(ctx, S); }
function specialBlast(x, y, r, dmg, team){ const S = G.special; if(S && S.M.blast) S.M.blast(S, x, y, r, dmg, team); }
function specialBulletHit(s){ const S = G.special; return !!(S && S.M.bullet && S.M.bullet(S, s)); }
function specialFriendHit(s){ const S = G.special; return !!(S && S.M.friend && S.M.friend(S, s)); }
function specialAirTargets(){ const S = G.special; return S && S.M.air ? S.M.air(S) : []; }
// the convoy ship an attacker goes for: a crippled straggler if there is one, otherwise the nearest
function specialPickShip(x){
  const S = G.special; if(!S || !S.convoy) return null;
  const hurt = S.convoy.filter(sh=>!sh.dead && sh.hp < sh.max*0.5).sort((a,b)=>a.hp-b.hp)[0];
  if(hurt) return hurt;
  let b = null; for(const sh of S.convoy) if(!sh.dead && (!b || Math.abs(sh.x-x) < Math.abs(b.x-x))) b = sh;
  return b;
}

// status banner under the mini-map (one or two lines), plus any screen-space overlay of the mission
function drawSpecialHUD(ctx, vw){
  const S = G.special;
  if(S.M.screen) S.M.screen(ctx, vw, S);
  if(!S.M.hud) return;
  const lines = [].concat(S.M.hud(S)).filter(Boolean);
  ctx.save(); ctx.direction='rtl'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font='14px Rubik, sans-serif';
  const w = Math.max(...lines.map(l=>ctx.measureText(l).width)) + 30, y = G.ground ? 112 : 66;
  ctx.fillStyle='rgba(20,34,52,.22)'; ctx.fillRect(vw/2-w/2, y-13, w, 8 + lines.length*19);
  ctx.shadowColor='rgba(0,0,0,.7)'; ctx.shadowBlur=3; ctx.fillStyle='#f2d58a';
  lines.forEach((l,i)=>ctx.fillText(l, vw/2, y + i*19));
  ctx.restore();
}
const mmss = t => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`; };
const pct = (a, b) => Math.max(0, Math.round(100*a/b)) + '%';

// ---------- building blocks ----------

// an island with structures at given x positions (or spread evenly), palms and entrenched riflemen
function specIsland(x0, w, h, at, o={}){
  const is = {x0, x1:x0+w, h, slope:130, seed:rnd(0,9), palms:[]};
  if(o.hills) is.hills = o.hills;                       // custom relief, set before the first height lookup
  G.islands.push(is);
  const i = G.islands.length-1, a = is.x0+is.slope+50, b = is.x1-is.slope-50;
  is.strip = {x0:a-20, x1:b+20};
  for(const [t, x] of at){ const s = makeStruct(t, x); s.island = i; G.structures.push(s); }
  for(let p=0;p<Math.floor((b-a)/170);p++) is.palms.push({x:rnd(a,b), s:rnd(0.8,1.25)});
  for(let k=0;k<(o.soldiers||0);k++){ const x = rnd(o.sx0||a, o.sx1||b); G.soldiers.push({x, y:groundY(x), dir:1, speed:0, t:rnd(0,1), cool:rnd(0.5,2), dead:false, def:true, home:x, island:i}); }
  return is;
}
// a Japanese carrier waiting beyond the edge of the map: raids take off from it
function spEnemyCarrier(x){
  const jc = makeShip('jcarrier', x, x, x); jc.speed = 0; jc.dir = -1; jc.turrets.forEach(t=>t.cool = 1e9);
  G.ships.push(jc); return jc;
}
// a raid: Val dive bombers, each with Zeros flying close escort (launched one after another)
function spQueueRaid(S, at, vals, zeros, valOpts){
  S.queue = S.queue || [];
  for(let v=0; v<vals; v++){
    const grp = {};
    S.queue.push({at: at + v*3.2, type:'val', grp, opts:valOpts});
    const n = Math.floor(zeros/vals) + (v < zeros % vals ? 1 : 0);
    for(let k=0;k<n;k++) S.queue.push({at: at + v*3.2 + 0.8 + k*0.6, type:'zero', grp, slot:k});
  }
  S.queue.sort((a,b)=>a.at-b.at);
}
function spRunQueue(S, jc){
  S.live = S.live || [];
  while(S.queue && S.queue.length && S.queue[0].at <= S.t){
    const it = S.queue.shift();
    const e = launchFrom({kind:'carrier', sh:jc, x:jc.x}, it.type);
    if(it.opts) Object.assign(e, typeof it.opts==='function' ? it.opts(e) : it.opts);
    if(it.type==='val') it.grp.val = e;
    else if(it.type==='zero' && it.grp.val){ e.escort = it.grp.val; e.eslot = it.slot; }
    S.live.push(e);
  }
}
const spLiveLeft = S => (S.live||[]).filter(e=>!e.dead && G.enemies.includes(e)).length + (S.queue ? S.queue.length : 0);

// --- torpedo bombers ("The Burning Carrier"): Bettys that come in low over the water and drop a torpedo at
// the carrier from about 600 px out, then climb away ---
function bettyTorpRun(e, dt){
  const S = G.special, C = G.carrier, cx = C.x + C.len/2, C2 = G.carrier2;
  if(!e.dropped){
    // keep high over the second carrier's guns, then let down to wave-top height for the run in
    const high = C2 && e.x > C2.x - 500;
    steer(e, high ? C2.x - 900 : cx, high ? 200 : SEA - 70, 0.9, dt);
    if(Math.abs(e.x - cx) < 650 && e.y > SEA - 120){
      e.dropped = true; (S.etorps ||= []).push({x:e.x, dir:Math.sign(cx - e.x) || -1, spd:150, run:0});
      splash(e.x); say('טורפדו במים – בדרך לנושאת!', 2.5); SFX.alarm();
    }
  } else steer(e, G.L + 1300, 150, 0.7, dt);                // climbs away and heads home
}
function etorpsUpdate(S, dt){
  for(const t of (S.etorps||[])){
    if(t.dead) continue;
    t.x += t.dir*t.spd*dt; t.run += t.spd*dt;
    if(Math.random() < dt*8) G.fx.push({type:'wake', x:t.x - t.dir*8, y:SEA+2, t:0, max:1.6});
    const C = G.carrier;
    if(t.x > C.x + 20 && t.x < C.x + C.len - 20){
      t.dead = true; G.fx.push({type:'column', x:t.x, y:SEA, t:0, max:1.6}); boom(t.x, SEA-8, 60, true);
      C.hp -= 110; C.hit = 0.4;
      if(C.burning > 0){ C.burning = Math.min(150, C.burning + 12); say('פגיעת טורפדו! האש התפשטה – הכיבוי יימשך יותר', 3.5); }
      else say('פגיעת טורפדו בנושאת!', 3);
    }
    if(t.run > 1500) t.dead = true;
  }
  if(S.etorps) S.etorps = S.etorps.filter(t=>!t.dead);
}

// --- motor torpedo boats ---
// drawn 1.6x the original sketch: a 70-foot motor torpedo boat should look bigger than a fighter
const BOAT_S = 1.6, BOAT_HALF = 21*BOAT_S, BOAT_H = 13*BOAT_S;
function spBoat(x, dir){ return {x, dir, hp:30, speed:rnd(60,75), cool:rnd(1,2), shots:0, away:0, flash:0, dead:false, torp:true}; }
// is a point (with some padding, for blast radius) on the boat?
const boatHit = (b, x, y, pad=0) => Math.abs(x - b.x) < BOAT_HALF + pad && y > SEA - BOAT_H - pad && y < SEA + 4;
function hurtBoat(b, d){
  if(b.dead) return;
  b.hp -= d; b.flash = 0.1;
  if(b.hp <= 0){ b.dead = true; boom(b.x, SEA-6, 30, true); splash(b.x); earn('boat', b.x, SEA-10); }
}
// goalOf(b): where the boat wants to be (null = just cruise); attack(b, dt): what it does once there
function boatsUpdate(S, dt, goalOf, attack){
  const P = G.player;
  for(const b of S.boats){
    if(b.dead) continue;
    b.flash = Math.max(0, b.flash-dt); b.cool -= dt;
    const goal = b.away > 0 ? null : goalOf(b);
    if(b.away > 0){ b.away -= dt; b.x += b.dir*b.speed*1.2*dt; }
    else if(goal != null){
      const d = goal - b.x;
      if(Math.abs(d) > 10){ b.dir = Math.sign(d); b.x += b.dir*Math.min(Math.abs(d), b.speed*dt); }
      else attack(b, dt);
    }
    if(Math.random() < dt*5) G.fx.push({type:'wake', x:b.x - b.dir*BOAT_HALF, y:SEA+2, t:0, max:1.2});
    // bow machine gun at a low-flying aircraft
    if(!P.dead && !P.onDeck && Math.abs(P.x-b.x) < (S.boatRange||340) && P.y > SEA-300 && b.cool <= 0){
      const a = Math.atan2(P.y-(SEA-16), P.x-b.x) + rnd(-0.07,0.07);
      G.shots.push({x:b.x + b.dir*14, y:SEA-16, vx:Math.cos(a)*700, vy:Math.sin(a)*700, team:'e', dmg:S.boatDmg||2, life:0.65});
      b.shots++; b.cool = b.shots%5===0 ? rnd(1.0,1.7) : 0.13;
    }
  }
  S.boats = S.boats.filter(b=>!b.dead && b.x > -700 && b.x < G.L+900);
}
function drawBoat(ctx, b){
  ctx.save(); ctx.translate(b.x, SEA+2); ctx.scale(b.dir*BOAT_S, BOAT_S);
  const W = b.flash > 0 ? '#ffffff' : null;
  ctx.fillStyle = W || '#4a4f55'; ctx.beginPath(); ctx.moveTo(-18,0); ctx.lineTo(13,0); ctx.lineTo(21,-8); ctx.lineTo(-18,-6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = W || '#3a3e43'; ctx.fillRect(-18,-2,32,2);
  ctx.fillStyle = W || '#5a6067'; ctx.fillRect(-7,-13,11,7); ctx.fillStyle='#1e2226'; ctx.fillRect(-5,-11,6,2);   // wheelhouse
  ctx.strokeStyle='#26292d'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(10,-8); ctx.lineTo(16,-12); ctx.stroke();   // bow gun
  ctx.fillStyle='#5a5f66'; ctx.fillRect(-15,-9,4,3); ctx.fillRect(-15,-5,9,2);                                          // torpedo tubes
  ctx.fillStyle='#f2efe6'; ctx.fillRect(-19,-17,6,4); ctx.fillStyle='#b8241c'; ctx.beginPath(); ctx.arc(-16,-15,1.2,0,7); ctx.fill();   // ensign
  ctx.restore();
}
// --- torpedoes running at our ships (convoy) ---
function torpsUpdate(S, dt){
  for(const t of S.torps){
    if(t.dead) continue;
    t.x += t.dir*t.spd*dt; t.run += t.spd*dt;
    if(Math.random() < dt*8) G.fx.push({type:'wake', x:t.x - t.dir*8, y:SEA+2, t:0, max:1.6});
    if(S.convoy) for(const sh of S.convoy){
      if(sh.dead || Math.abs(t.x - sh.x) > sh.w/2) continue;
      t.dead = true; G.fx.push({type:'column', x:t.x, y:SEA, t:0, max:1.6}); splash(t.x); boom(t.x, SEA-6, 50, true);
      hurtShip(sh, 45, 'פגיעת טורפדו!'); break;
    }
    if(t.run > 1400) t.dead = true;
  }
  S.torps = S.torps.filter(t=>!t.dead);
}
function drawTorps(ctx, S){
  for(const t of S.torps){
    const g = ctx.createLinearGradient(t.x, 0, t.x - t.dir*60, 0); g.addColorStop(0,'rgba(240,250,255,.85)'); g.addColorStop(1,'rgba(240,250,255,0)');
    ctx.fillStyle = g; ctx.fillRect(Math.min(t.x, t.x - t.dir*60), SEA+2, 60, 2.2);
    ctx.fillStyle='rgba(20,28,34,.7)'; ctx.fillRect(t.x - 4, SEA+5, 8, 2);
  }
}

// --- our cargo ships (convoy) ---
function hurtShip(sh, d, msg){
  if(sh.dead) return;
  sh.hp -= d; sh.flash = 0.15;
  if(sh.hp <= 0){ sh.dead = true; sh.sink = 0.001; boom(sh.x, SEA-14, 60, true); say(`${sh.name} נפגעה וטובעת!`, 4); SFX.alarm(); }
  else if(msg) say(`${msg} ${sh.name} נפגעה (${pct(sh.hp, sh.max)})`, 2.5);
}
function drawFreighter(ctx, sh){
  const W = sh.flash > 0 ? '#ffffff' : null;
  ctx.save();
  ctx.beginPath(); ctx.rect(sh.x-90, -3000, 180, SEA+3+3000); ctx.clip();          // the sea hides what is below
  const s = sh.sink || 0;
  ctx.translate(sh.x, SEA + s*s*60); ctx.rotate(s*0.35);
  // hull with a sheer line, bow at +x
  ctx.fillStyle = W || '#5e666e'; ctx.beginPath(); ctx.moveTo(-55,-14); ctx.lineTo(52,-16); ctx.lineTo(58,-18); ctx.lineTo(50,6); ctx.lineTo(-50,6); ctx.lineTo(-56,-6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = W || '#3d444b'; ctx.fillRect(-52,-1,102,4);                                    // boot topping
  ctx.fillStyle = W || '#727a82'; ctx.fillRect(-10,-28,22,14); ctx.fillRect(-6,-34,14,6);         // midships house
  ctx.fillStyle='#1e2328'; for(let i=0;i<4;i++) ctx.fillRect(-8+i*5,-25,3,2);
  ctx.fillStyle = W || '#4b5157'; ctx.fillRect(2,-42,5,9);                                        // funnel
  // masts and cargo booms, hatches with deck cargo
  ctx.strokeStyle='#3b4046'; ctx.lineWidth=1.2; ctx.beginPath();
  for(const mx of [-34, 30]){ ctx.moveTo(mx,-15); ctx.lineTo(mx,-44); ctx.moveTo(mx,-40); ctx.lineTo(mx+(mx<0?14:-14),-17); }
  ctx.stroke();
  ctx.fillStyle = W || '#6b5a3e'; ctx.fillRect(-48,-20,12,5); ctx.fillRect(-26,-19,10,4); ctx.fillRect(18,-21,12,6); ctx.fillRect(38,-20,10,4);
  drawUSFlag(ctx, -54, -30, 0.45);
  ctx.restore();
  if(!sh.dead){ const k = sh.hp/sh.max; ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(sh.x-30, SEA-62, 60, 4);
    ctx.fillStyle = k<0.35?'#c8402f':k<0.65?'#e8b33a':'#5fae6b'; ctx.fillRect(sh.x-30, SEA-62, 60*k, 4); }
}

// --- submarines ---
function hurtSub(sb, d){
  if(sb.dead) return;
  sb.hp -= d; sb.flash = 0.3;
  if(sb.hp <= 0){ sb.dead = true; G.fx.push({type:'column', x:sb.x, y:SEA, t:0, max:1.6}); boom(sb.x, SEA-4, 50, true); earn('sub', sb.x, SEA-20); say('צוללת הושמדה!', 2.5); }
  else say('פגיעה בצוללת!', 1.5);
}
function drawSub(ctx, sb){
  ctx.save();
  ctx.fillStyle = sb.flash>0 ? 'rgba(255,255,255,.4)' : 'rgba(12,20,26,.33)';
  ctx.beginPath(); ctx.ellipse(sb.x, SEA+15, 42, 6, 0, 0, 7); ctx.fill();                       // hull, dimly seen under the surface
  ctx.fillRect(sb.x-6, SEA+5, 12, 6);
  ctx.strokeStyle='#22282d'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(sb.x-2, SEA+4); ctx.lineTo(sb.x-2, SEA-12); ctx.lineTo(sb.x-6, SEA-12); ctx.stroke();   // periscope
  ctx.strokeStyle='rgba(240,250,255,.7)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(sb.x-14, SEA+1); ctx.lineTo(sb.x-2, SEA-1); ctx.lineTo(sb.x+10, SEA+1); ctx.stroke();   // feather of spray
  ctx.restore();
}

// --- rescue floatplane (OS2U Kingfisher) ---
const KF_SKIN = {s:{top:'#55708c', side:'#7088a2', under:'#d9dcdf', hi:'rgba(220,230,240,.3)'}, wing:'#5d7792'};
function drawFloatplane(ctx, v){
  ctx.save(); ctx.translate(v.x, v.y); ctx.scale(v.dir, 1); ctx.rotate(-(v.pitch||0));
  drawPlane(ctx, 'dauntless', KF_SKIN, null, 0.9, v.flash > 0, v.ph!=='water' || v.pick > 0, 0);
  ctx.strokeStyle='#3a4450'; ctx.lineWidth=1.1; ctx.beginPath(); ctx.moveTo(-2,5); ctx.lineTo(-4,11); ctx.moveTo(8,5); ctx.lineTo(9,11); ctx.stroke();
  ctx.fillStyle = v.flash > 0 ? '#ffffff' : '#c9ced3'; ctx.beginPath(); ctx.ellipse(3, 13, 17, 3.2, 0, 0, 7); ctx.fill();   // main float
  ctx.restore();
  const k = v.hp/v.max; ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(v.x-18, v.y-26, 36, 3); ctx.fillStyle = k<0.4?'#c8402f':'#7fd0ff'; ctx.fillRect(v.x-18, v.y-26, 36*k, 3);
}

// ====================================================================================================
const SPECIALS = {

// 1. ---------------------------------------------------------------------------------------------------
rescue:{
  name:'הטייס שנפל', icon:'🛟', reward:4500, zeroEvery:20, wind:5,
  brief:'טייס אמריקאי נטש את מטוסו הרחק מהנושאת, ונמצא במים ליד אי יפני מבוצר, עם רפסודה וזיקוקי איתות. רובאים מהחוף וגלים של סירות טורפדו מנסים להגיע אליו. מטוס חילוץ ימי (קינגפישר) יוצא מהנושאת למסע ארוך, ינחת לידו על המים ויאסוף אותו – ואז צריך ללוות אותו כל הדרך חזרה. באמצע המשימה פורצת סערה.',
  goals:['הגן על הטייס שבמים: השמד את הרובאים בחוף ואת גלי הסירות','לווה את מטוס החילוץ עד הטייס – הוא לא יאסוף אותו כל עוד יש סירות בטווח','היה מוכן להפתעה: ייתכן שיש עוד מישהו במים','לווה את מטוס החילוץ בדרך הארוכה חזרה לנושאת – מטוסי זירו יארבו לו'],
  tip:'הטייס רחוק מהנושאת: לא תספיק לנחות ולחמש מחדש באמצע. צא עם רקטות – הן הכי טובות נגד סירות. בסערה, זיקוקי האיתות האדומים מסמנים איפה הטייס.',
  setup(S){
    G.L = 9000;
    specIsland(4300, 1250, 60, [['aa',4560],['bunker',4760],['aa',4900],['barracks',5020],['aa',5170],['bunker',5310]], {soldiers:14, sx0:5260, sx1:5470});
    // a second, smaller island further east, with a coastal gun covering the water off its beach
    specIsland(6700, 950, 56, [['aa',6930],['bunker',7100],['arty',7360],['aa',7470]], {soldiers:9, sx0:7380, sx1:7600});
    S.coastGun = G.structures.find(s=>s.type==='arty');
    S.pilots = [{x:5720, hp:100, max:100, found:true}, {x:7820, hp:100, max:100, found:false}]; S.cur = 0;
    S.pilot = S.pilots[0]; S.flares = []; S.flareT = 2; S.shellT = 5;
    S.boats = []; S.boatT = 6; S.wave = 0; S.vip = null; S.pick = 0;
    S.boatRange = 400; S.boatDmg = 2.5;                    // the boats' deck guns reach further and hit harder here
    say('הטייס שלנו במים, רחוק מזרחית לאי! טוס אליו והגן עליו עד שמטוס החילוץ יגיע', 5);
  },
  // two Zeros take off from the island to jump the rescue plane
  ambush(S, text){
    const is = G.islands[S.cur ? 1 : 0], site = {kind:'island', x:(is.strip.x0+is.strip.x1)/2, is};
    for(let k=0;k<2;k++) launchFrom(site, 'zero', k*1.4);
    say(text, 3.5);
  },
  update(S, dt){
    const p = S.pilot = S.pilots[S.cur], C = G.carrier, M = SPECIALS.rescue;
    // the coastal gun on the second island lobs shells at the man in the water and at the floatplane by him
    if(S.cur===1 && S.coastGun && !S.coastGun.dead && !p.aboard){
      S.shellT -= dt;
      if(S.shellT <= 0){
        const v1 = S.vip, onWater = v1 && !v1.dead && v1.ph==='water', tx = onWater && Math.random()<0.5 ? v1.x : p.x, x = tx + rnd(-60, 60);
        G.fx.push({type:'column', x, y:SEA, t:0, max:1.6}); splash(x); SFX.noise(0.7, 500, 0.35);
        if(Math.abs(x - tx) < 30){ if(tx===p.x){ p.hp -= 14; say('פגז מתותח החוף פגע ליד הטייס!', 2); } else { v1.hp -= 18; v1.flash = 0.2; } }
        S.shellT = rnd(4, 5.5);
      }
    }
    // riflemen on the beach shoot at the man in the water
    if(!p.aboard) for(const so of G.soldiers){
      if(so.dead || Math.abs(so.x - p.x) > 360) continue;
      if(Math.random() < dt*0.4){ tracer(so.x, so.y-10, p.x, SEA-6, false); if(Math.random() < 0.5) p.hp -= 1.5; }
    }
    // waves of torpedo boats come in from the east, each bigger than the last; they stop off the pilot
    // and rake him with machine guns
    S.boatT -= dt;
    if(S.boatT <= 0 && !p.aboard){
      S.wave++;
      const n = Math.min(6 - S.boats.length, 2 + S.wave);
      for(let k=0;k<n;k++){ const b = spBoat(p.x + 1400 + k*150, -1); b.hp = 45; S.boats.push(b); }
      if(n > 0) say(`גל ${S.wave}: ${n} סירות טורפדו מתקרבות לטייס!`, 3);
      S.boatT = 22;
    }
    const v0 = S.vip;
    boatsUpdate(S, dt, b => p.aboard ? G.L + 600 : p.x + 120 + (S.boats.indexOf(b)%4)*45, (b, dt) => {
      if(b.cool > 0 || p.aboard) return;
      // they shoot at the rescue plane too once it is down on the water
      if(v0 && !v0.dead && v0.ph==='water' && Math.random() < 0.35){ tracer(b.x, SEA-14, v0.x, v0.y, false); if(Math.random() < 0.5){ v0.hp -= 2.5; v0.flash = 0.1; } }
      else { tracer(b.x, SEA-14, p.x, SEA-6, false); if(Math.random() < 0.6) p.hp -= 3; }
      b.cool = rnd(1.0, 1.6);
    });
    if(v0 && !v0.dead && v0.hp <= 0){ v0.dead = true; boom(v0.x, v0.y, 40, true); return specialEnd(false, 'מטוס החילוץ הושמד.'); }
    if(p.hp <= 0 && !p.aboard) return specialEnd(false, 'הטייס שבמים נהרג.');
    // flares: every few seconds the pilot fires one, more often once the storm closes in
    S.flareT -= dt;
    if(S.flareT <= 0 && !p.aboard){ S.flares.push({x:p.x, y:SEA-6, vy:-230, t:0}); S.flareT = S.storm ? 3.5 : 7; }
    for(const f of S.flares){ f.t += dt; f.vy += 70*dt; f.y += f.vy*dt; if(Math.random() < dt*12) puff(f.x, f.y, 'rgba(230,200,200,.5)', 4, 1); }
    S.flares = S.flares.filter(f=>f.t < 3.5);
    // the storm
    if(!S.storm && S.t > 50){ S.storm = true; Object.assign(G.weather, {rain:0.85, storm:true, wind:-22}); say('סערה פורצת! הראות יורדת – עקוב אחרי זיקוקי האיתות האדומים', 5); }
    // the rescue plane
    if(!S.vip && S.t > 30){
      S.vip = {x:C.x + C.len, y:DECK_Y-40, dir:1, speed:140, hp:150, max:150, ph:'out', pitch:0.1, flash:0, dead:false, gcool:0};
      say('מטוס החילוץ ממריא מהנושאת – יש לו דרך ארוכה. הגן על הטייס עד שיגיע', 4);
    }
    const v = S.vip; if(!v || v.dead) return;
    v.flash = Math.max(0, v.flash - dt);
    // the Kingfisher's rear gunner fires at a Zero closing from behind
    v.gcool -= dt;
    if(v.gcool <= 0 && v.ph!=='water'){
      const z = G.enemies.find(e=>!e.dead && e.type==='zero' && !e.takeoff && dist2(e.x, e.y, v.x, v.y) < 320*320 && (e.x - v.x)*v.dir < 0);
      if(z){ const a = Math.atan2(z.y-v.y, z.x-v.x) + rnd(-0.1, 0.1); G.shots.push({x:v.x - v.dir*10, y:v.y-6, vx:Math.cos(a)*780, vy:Math.sin(a)*780, team:'p', dmg:3, life:0.6}); v.gcool = 0.3; SFX.enemyGun(); }
    }
    if(v.ph==='out'){
      v.x += v.speed*dt; v.y += (300 - v.y)*Math.min(1, dt*0.8); v.pitch = (v.y - 300)*0.002;
      if(!S.amb1 && v.x > 2600){ S.amb1 = true; M.ambush(S, 'מטוסי זירו ממריאים מהאי לעבר מטוס החילוץ!'); }
      if(v.x > p.x - 620) v.ph = 'land';
    } else if(v.ph==='land'){
      const tx = p.x - 70, ty = SEA - 6, d = Math.max(1, Math.hypot(tx - v.x, ty - v.y));
      v.speed = Math.max(80, v.speed - 25*dt);
      v.x += (tx - v.x)/d*v.speed*dt; v.y += (ty - v.y)/d*v.speed*dt; v.pitch = -0.12;
      if(v.y >= SEA - 7 || d < 12){ v.ph = 'water'; v.y = SEA - 6; v.pitch = 0; splash(v.x); say('מטוס החילוץ נחת על המים', 3); }
    } else if(v.ph==='water'){
      v.y = SEA - 6 + Math.sin(G.time*3)*0.8;
      if(v.x < p.x - 24) v.x += 25*dt;
      const threat = S.boats.some(b=>!b.dead && Math.abs(b.x - p.x) < 550);
      if(threat){ if(!S.warned){ say('הסירות קרובות מדי – אי אפשר לאסוף את הטייס! השמד אותן', 3); S.warned = true; } }
      else { S.warned = false; S.pick += dt; }
      if(S.pick >= 6){
        p.aboard = true; v.ph = 'takeoff'; v.speed = 20; S.pick = 0; SFX.pickup();
        if(S.cur===0){
          // the surprise: a second pilot further into enemy waters
          S.pilots[1].found = true; S.boatT = 8;
          say('הטייס הראשון על הסיפון! רגע – זיקוק נוסף ממזרח: טייס שני במים, ליד תותח חוף. מטוס החילוץ ממשיך אליו', 6);
        } else say('גם הטייס השני על הסיפון! לווה את מטוס החילוץ חזרה לנושאת', 5);
      }
    } else if(v.ph==='takeoff'){
      v.speed = Math.min(150, v.speed + 55*dt); v.x += v.speed*dt;
      if(Math.random() < dt*10) G.fx.push({type:'wake', x:v.x-14, y:SEA+2, t:0, max:1.2});
      if(v.speed > 110){ v.y -= 60*dt; v.pitch = 0.25; }
      if(v.y < SEA - 140){
        if(S.cur===0){ S.cur = 1; v.ph = 'out'; v.pitch = 0; M.ambush(S, 'מטוסי זירו ממריאים מהאי השני לעבר מטוס החילוץ!'); }
        else { v.ph = 'home'; v.dir = -1; v.pitch = 0; M.ambush(S, 'מארב! מטוסי זירו רודפים אחרי מטוס החילוץ בדרך חזרה'); }
      }
    } else if(v.ph==='home'){
      v.x -= v.speed*dt; v.y += (280 - v.y)*Math.min(1, dt*0.6);
      if(v.x < C.x + C.len*0.8) specialEnd(true, 'שני הטייסים חולצו בשלום! מטוס החילוץ חזר לנושאת');
    }
  },
  air(S){ const v = S.vip; return v && !v.dead && v.ph!=='water' ? [{o:v, x:v.x, y:v.y, vx:v.dir*v.speed, vy:0}] : []; },
  friend(S, s){
    const v = S.vip; if(!v || v.dead || dist2(s.x, s.y, v.x, v.y) > 18*18) return false;
    s.life = 0; v.hp -= s.dmg*0.6; v.flash = 0.1; spark(s.x, s.y);           // armour plate behind the crew
    if(v.hp <= 0){ v.dead = true; boom(v.x, v.y, 40, true); specialEnd(false, 'מטוס החילוץ הופל.'); }
    return true;
  },
  bullet(S, s){ for(const b of S.boats) if(!b.dead && boatHit(b, s.x, s.y)){ s.life = 0; hurtBoat(b, s.dmg); spark(s.x, s.y); return true; } return false; },
  blast(S, x, y, r, dmg, team){ if(team==='p') for(const b of S.boats) if(!b.dead && boatHit(b, x, y, r)) hurtBoat(b, dmg); },
  draw(ctx, S){
    for(const p of S.pilots){
      if(p.aboard || !p.found) continue;
      ctx.fillStyle='rgba(60,190,120,.35)'; ctx.beginPath(); ctx.ellipse(p.x, SEA+4, 46, 5, 0, 0, 7); ctx.fill();   // dye marker
      const bob = Math.sin(G.time*2.2)*1.2;
      ctx.fillStyle='#e8b923'; ctx.beginPath(); ctx.ellipse(p.x, SEA-1+bob, 10, 3.2, 0, 0, 7); ctx.fill();          // raft
      ctx.fillStyle='#f2c419'; ctx.fillRect(p.x-3, SEA-9+bob, 6, 6);                                                 // life vest
      ctx.fillStyle='#d9b48a'; ctx.beginPath(); ctx.arc(p.x, SEA-11+bob, 2.4, 0, 7); ctx.fill();
      const wave = Math.sin(G.time*6)*3;
      ctx.strokeStyle='#d9b48a'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(p.x+2, SEA-8+bob); ctx.lineTo(p.x+5, SEA-15+bob+wave*0.3); ctx.stroke();   // waving
      const k = p.hp/p.max; ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(p.x-16, SEA-26, 32, 3); ctx.fillStyle = k<0.35?'#c8402f':'#7fd08a'; ctx.fillRect(p.x-16, SEA-26, 32*k, 3);
    }
    for(const b of S.boats) drawBoat(ctx, b);
    if(S.vip && !S.vip.dead) drawFloatplane(ctx, S.vip);
  },
  over(ctx, S){
    for(const f of S.flares){
      const a = Math.max(0, 1 - f.t/3.5), g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 26);
      g.addColorStop(0, `rgba(255,90,60,${0.9*a})`); g.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, 26, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,235,210,${a})`; ctx.beginPath(); ctx.arc(f.x, f.y, 2.2, 0, 7); ctx.fill();
    }
  },
  hud(S){
    const p = S.pilot, v = S.vip, who = S.cur ? 'הטייס השני' : 'הטייס';
    let line;
    if(!v) line = `הגן על הטייס שבמים · מטוס החילוץ ממריא בעוד ${Math.ceil(30 - S.t)}`;
    else if(v.ph==='out' || v.ph==='land') line = `מטוס החילוץ בדרך אל ${who} – לווה אותו`;
    else if(v.ph==='water') line = S.warned ? 'סירות קרובות מונעות את החילוץ – השמד אותן!' : `אוסף את ${who}... ${Math.max(0, Math.ceil(6 - S.pick))}`;
    else if(v.ph==='takeoff') line = 'מטוס החילוץ ממריא מהמים';
    else line = 'שני הטייסים על הסיפון! לווה את מטוס החילוץ חזרה לנושאת';
    const ps = S.pilots.filter(q=>q.found).map((q,i)=>`${i ? 'טייס 2' : 'טייס 1'}: ${q.aboard ? 'נאסף' : pct(q.hp, q.max)}`).join(' · ');
    return [line, `${ps} · מטוס החילוץ: ${v ? pct(v.hp, v.max) : 'על הסיפון'}${S.cur===1 && S.coastGun && !S.coastGun.dead ? ' · תותח חוף פעיל!' : ''}`];
  },
  short: S => 'חילוץ הטייס'
},

// 2. ---------------------------------------------------------------------------------------------------
dark:{
  name:'המשחק בחושך', icon:'🔦', reward:5000, time:'night', wind:6, zeroEvery:22, lockMode:true,
  brief:'לילה ללא ירח. זרקורים ותחנות מכ"ם שומרים על שני איים מבוצרים. כשאלומת זרקור תופסת אותך היא ננעלת עליך – ובאותו רגע כל תותחי הנ"מ באי פותחים באש מרוכזת. תמרון חד משחרר אותך מהנעילה, אבל אחרי 7 שניות הזרקורים מתחילים לחפש אותך מחדש. כל עוד מכ"ם פעיל, הזרקורים באותו אי רואים רחוק יותר וננעלים מהר יותר.',
  goals:['השמד את שלוש תחנות המכ"ם (שתיים באי הראשון, אחת בשני) – והיה מוכן לשלב שני','מהר: זרקור שהושמד משוקם אחרי דקה, כל עוד יש מכ"ם פעיל באותו אי','כשזרקור ננעל עליך – בצע מיד תמרון (לופ, אימלמן, ספליט S, פניית פטיש או פנייה לאחור תמיד משחררים; גלגול חבית ובלימה – לפעמים)','נצל את 7 השניות שבהן הזרקורים מחפשים אותך כדי לתקוף','חזור לנושאת ונחת כדי לסיים'],
  tip:'תמרון שהתחיל לפני הנעילה לא משחרר – צריך תמרון חדש. אפשר גם להשמיד זרקור (יריות מספיקות) כדי לפתוח "חור" בהגנה.',
  setup(S){
    G.L = 6400;
    specIsland(2000, 1500, 60, [['light',2200],['aa',2340],['aa',2470],['radar',2600],['bunker',2760],['light',2900],['aa',3020],['radar',3160],['aa',3280],['light',3390]]);
    specIsland(4300, 1300, 62, [['light',4500],['aa',4630],['bunker',4760],['aa',4890],['light',4990],['radar',5090],['aa',5210],['aa',5330],['light',5440]]);
    S.radars = G.structures.filter(s=>s.type==='radar'); S.left = S.radars.length;
    say('לילה. שלוש תחנות מכ"ם מכוונות את הזרקורים. השמד אותן', 5);
  },
  update(S, dt){
    const left = S.radars.filter(r=>!r.dead).length;
    if(left < S.left){ say(left ? `מכ"ם הושמד! נותרו ${left}. הזרקורים באי הזה איטיים יותר עכשיו` : 'כל תחנות המכ"ם הקבועות הושמדו!', 3.5); S.left = left; }
    // phase 2: a mobile radar on a truck, and night bombers sent against the carrier
    if(!left && !S.truck){
      const is = G.islands[1];
      S.truck = {x:is.x0 + 260, island:1, dir:1, speed:24, hp:60, max:60, dead:false, flash:0, x0:is.x0 + 200, x1:is.x1 - 200};
      S.bombers = [0,1].map(k=>{ const e = {type:'betty', x:G.L + 300 + k*220, y:150 + k*40, a:Math.PI, speed:145, full:145, hp:90, max:90, size:24, cool:0, bombs:3, dead:false}; G.enemies.push(e); return e; });
      say('מודיעין: משאית מכ"ם ניידת נוסעת באי השני ומכוונת את הזרקורים! ושני מפציצי לילה בדרך לנושאת', 6); SFX.alarm();
    }
    const T = S.truck;
    if(T && !T.dead){
      T.flash = Math.max(0, T.flash - dt);
      T.x += T.dir*T.speed*dt; if(T.x > T.x1) T.dir = -1; if(T.x < T.x0) T.dir = 1;
    }
    if(T && T.dead && !S.bombers.some(e=>!e.dead && G.enemies.includes(e)))
      specialLandToFinish('המכ"ם הנייד הושמד ומפציצי הלילה נעצרו! חזור לנושאת ונחת כדי לסיים');
  },
  hitTruck(S, d){
    const T = S.truck; if(!T || T.dead) return;
    T.hp -= d; T.flash = 0.1;
    if(T.hp <= 0){ T.dead = true; boom(T.x, groundY(T.x)-8, 40, true); earn('radar', T.x, groundY(T.x)-20); say('משאית המכ"ם הושמדה!', 3); }
  },
  bullet(S, s){
    const T = S.truck; if(!T || T.dead) return false;
    const gy = groundY(T.x);
    if(Math.abs(s.x - T.x) < 16 && s.y > gy - 22 && s.y < gy + 2){ s.life = 0; SPECIALS.dark.hitTruck(S, s.dmg*0.5); spark(s.x, s.y); return true; }
    return false;
  },
  blast(S, x, y, r, dmg, team){
    const T = S.truck; if(team!=='p' || !T || T.dead) return;
    if(Math.abs(x - T.x) < r + 16 && Math.abs(y - groundY(T.x)) < r + 24) SPECIALS.dark.hitTruck(S, dmg);
  },
  draw(ctx, S){
    const T = S.truck; if(!T || T.dead) return;
    const gy = groundY(T.x), W = T.flash > 0 ? '#ffffff' : null;
    ctx.save(); ctx.translate(T.x, gy); ctx.scale(T.dir, 1);
    ctx.fillStyle = W || '#3a3d33'; ctx.fillRect(-14, -12, 20, 9); ctx.fillRect(6, -10, 8, 7);              // box body and cab
    ctx.fillStyle = '#8fb3c9'; ctx.fillRect(8, -9, 4, 3);
    ctx.fillStyle = '#111'; for(const wx of [-9, 0, 10]){ ctx.beginPath(); ctx.arc(wx, -2.5, 2.6, 0, 7); ctx.fill(); }
    const k = Math.cos(G.time*2.5), aw = 12*Math.abs(k) + 2;                                                  // the turning dish
    ctx.strokeStyle='#2c2e27'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(-4, -18); ctx.stroke();
    ctx.fillStyle = W || (k > 0 ? '#6a6a5e' : '#4e4e44'); ctx.fillRect(-4 - aw/2, -24, aw, 7);
    if(Math.sin(G.time*4) > 0){ ctx.fillStyle='#ff4a3a'; ctx.beginPath(); ctx.arc(-4, -26, 1.3, 0, 7); ctx.fill(); }
    ctx.restore();
  },
  // inside a searchlight beam the cockpit is dazzled: the screen washes white
  screen(ctx, vw, S){
    const P = G.player; if(!P.lit || P.dead) return;
    const a = 0.22 + 0.08*Math.sin(G.time*9), g = ctx.createRadialGradient(vw/2, H*0.45, 40, vw/2, H*0.45, vw*0.7);
    g.addColorStop(0, `rgba(255,252,230,${a+0.15})`); g.addColorStop(1, `rgba(255,250,220,${a*0.4})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, H);
  },
  hud(S){
    const lights = G.structures.filter(s=>s.type==='light' && !s.dead);
    const locked = lights.filter(s=>s.lock).length, blind = Math.max(0, ...lights.map(s=>s.blind||0));
    const state = locked ? `ננעלת! (${locked} זרקורים) – בצע תמרון כדי להשתחרר` : blind > 0 ? `הזרקורים מחפשים אותך מחדש בעוד ${Math.ceil(blind)}` : '';
    const T = S.truck;
    const goal = !T ? `תחנות מכ"ם שנותרו: ${S.left} מתוך ${S.radars.length}`
      : !T.dead ? `שלב 2: השמד את משאית המכ"ם הניידת באי השני (${pct(T.hp, T.max)}) ועצור את מפציצי הלילה`
      : `מפציצי לילה: ${S.bombers.filter(e=>!e.dead && G.enemies.includes(e)).length}`;
    return [goal + (G.complete ? ' · חזור לנושאת ונחת' : ''), state];
  },
  short: S => S.truck ? (S.truck.dead ? 'מפציצי לילה' : 'מכ"ם נייד!') : `מכ"ם: ${S.left}/${S.radars.length}`
},

// 3. ---------------------------------------------------------------------------------------------------
convoy:{
  name:'השיירה', icon:'🚢', reward:4500,
  brief:'שיירה של ארבע ספינות אספקה אמריקאיות שטה לאורך כל המפה. צוללות (רואים רק פריסקופ ושובל), סירות טורפדו ומפציצי צלילה יתקפו אותה. לקראת הסוף מגיעה מהאופק אוניית מערכה יפנית ומפגיזה את השיירה.',
  goals:['לווה את השיירה עד קצה המפה – לפחות שתי ספינות צריכות להגיע','באמצע הדרך: פוצץ את שדה המוקשים לפני שהספינות מגיעות אליו','ספינה שנפגעה קשה מאטה – והאויב יתמקד בה','השמד צוללות בפצצות (פצצה שמתפוצצת במים פוגעת בצוללת מתחת לפני המים)','הפל את מפציצי הצלילה ועצור את סירות הטורפדו','כשאוניית המערכה מגיעה: להטביע אותה, או להמשיך להגן על השיירה'],
  tip:'צוללת אפשר לפגוע רק בפצצות או ברקטות שפוגעות במים לידה. שובל לבן במים הוא טורפדו בדרך לספינה.',
  setup(S){
    G.L = 7600;                                             // a long passage: about four minutes
    const names = ['ליברטי 1','ליברטי 2','ליברטי 3','ליברטי 4'];
    S.convoy = [1690, 1460, 1230, 1000].map((x,i)=>({x, w:110, hp:100, max:100, speed:22, dead:false, sink:0, flash:0, name:`ספינת האספקה "${names[i]}"`}));
    S.exitX = G.L - 450; S.startLead = 1690;
    S.boats = []; S.subs = []; S.torps = []; S.queue = []; S.live = [];
    // a minefield laid across the route, about half way
    S.mines = Array.from({length:7}, (_,k)=>({x:4300 + k*55 + rnd(-12,12), dead:false, bob:rnd(0,6)}));
    S.jc = spEnemyCarrier(G.L + 1000);
    S.events = [
      {at:8,   ev:'subs', n:2}, {at:30, ev:'boats', n:3}, {at:50, raid:[2,2]},
      {at:72,  ev:'subs', n:2}, {at:92, ev:'boats', n:3}, {at:105, raid:[3,3]},
      {at:125, ev:'subs', n:2}, {at:145, ev:'boats', n:4}, {at:165, ev:'battleship'},
      {at:175, raid:[2,3]}, {at:195, ev:'subs', n:2}, {at:215, ev:'boats', n:3}, {at:230, raid:[3,4]}
    ];
    S.shellT = 6;
    say('השיירה יוצאת לדרך ארוכה. הגן עליה מצוללות, סירות, מטוסים – ומה שמחכה באמצע הדרך', 5);
  },
  update(S, dt){
    const alive = S.convoy.filter(s=>!s.dead), lead = alive.reduce((b,s)=>!b || s.x > b.x ? s : b, null);
    // the convoy steams on in line ahead; a badly damaged ship (under half) can only make 13 knots, and the
    // ships behind it have to slow down too or close up on it - ships that reach the far edge are safe
    const order = alive.slice().sort((a,b)=>b.x - a.x);
    order.forEach((sh, i)=>{
      sh.speed = sh.hp < sh.max*0.5 ? 13 : 22;
      if(i && order[i-1].x - sh.x < 170) sh.speed = Math.min(sh.speed, order[i-1].speed);
      if(sh.hp < sh.max*0.5 && !sh.slowSaid){ sh.slowSaid = true; say(`${sh.name} נפגעה קשה ומאטה – האויב יתמקד בה!`, 4); }
    });
    for(const sh of S.convoy){
      sh.flash = Math.max(0, sh.flash - dt);
      if(sh.dead){ sh.sink = Math.min(1.4, sh.sink + dt*0.18); if(sh.sink < 1 && Math.random() < dt*4) puff(sh.x+rnd(-30,30), SEA-20, '#2a2a2a', 12, 2); continue; }
      if(sh.x < S.exitX){ sh.x += sh.speed*dt; if(Math.random() < dt*3) G.fx.push({type:'wake', x:sh.x - 56, y:SEA+2, t:0, max:1.5}); }
      else sh.safe = true;
      // the minefield
      for(const m of S.mines){
        if(m.dead || Math.abs(sh.x + sh.w/2 - m.x) > 20) continue;
        m.dead = true; G.fx.push({type:'column', x:m.x, y:SEA, t:0, max:1.6}); boom(m.x, SEA-8, 50, true);
        hurtShip(sh, 55, 'עלתה על מוקש!');
      }
    }
    if(!S.mineWarn && S.mines.some(m=>!m.dead) && lead.x > S.mines[0].x - 1500){ S.mineWarn = true; say('שדה מוקשים לפני השיירה! פוצץ את המוקשים בפצצות, רקטות או יריות לפני שהספינות מגיעות', 6); SFX.alarm(); }
    if(alive.length < 2) return specialEnd(false, 'השיירה הושמדה: פחות משתי ספינות שרדו.');
    if(alive.every(s=>s.safe)){ S.bonus = 600*alive.length; G.earned += S.bonus; return specialEnd(true, `השיירה הגיעה! ${alive.length} ספינות בשלום (בונוס $${S.bonus})`); }
    // scripted threats
    while(S.events.length && S.events[0].at <= S.t){
      const e = S.events.shift();
      if(e.ev==='subs'){ for(let k=0;k<e.n;k++) S.subs.push({x:lead.x + 1000 + k*300, hp:70, cool:rnd(2,5), dead:false, flash:0, slot:k}); say('צוללות אויב לפני השיירה! חפש פריסקופים', 3.5); }
      else if(e.ev==='boats'){ for(let k=0;k<e.n;k++) S.boats.push(spBoat(Math.min(G.L + 200, lead.x + 1700) + k*130, -1)); say('סירות טורפדו מתקרבות לשיירה!', 3); }
      else if(e.ev==='battleship'){
        const bs = makeShip('battleship', G.L + 400, lead.x + 900, G.L + 400); bs.dir = -1; bs.speed = 14; G.ships.push(bs); S.bs = bs;
        say('אוניית מערכה יפנית באופק! היא מפגיזה את השיירה', 5); SFX.alarm();
      } else if(e.raid){
        spQueueRaid(S, S.t, e.raid[0], e.raid[1], v => ({aim: specialPickShip(v.x), cruiseY: DECK_Y - 320}));
        say('מפציצי צלילה ממריאים לעבר השיירה!', 3);
      }
    }
    spRunQueue(S, S.jc);
    // submarines hold station ahead of the convoy and fire torpedoes at it
    for(const sb of S.subs){
      if(sb.dead) continue;
      sb.flash = Math.max(0, sb.flash - dt);
      const want = lead.x + 430 + sb.slot*140;
      sb.x += clamp(want - sb.x, -60*dt, 60*dt);
      if(Math.abs(want - sb.x) < 60){ sb.cool -= dt; if(sb.cool <= 0){ S.torps.push({x:sb.x - 30, dir:-1, spd:150, run:0}); sb.cool = 13; say('טורפדו במים!', 2); } }
      if(Math.random() < dt*3) G.fx.push({type:'wake', x:sb.x - 4, y:SEA+2, t:0, max:0.8});
    }
    S.subs = S.subs.filter(s=>!s.dead);
    // torpedo boats: run in, fire a torpedo from close range, then turn away
    boatsUpdate(S, dt, b => { const t = specialPickShip(b.x); return t ? t.x + 260 : null; }, (b) => {
      if(b.torp){ S.torps.push({x:b.x - 20, dir:-1, spd:180, run:0}); b.torp = false; b.away = 5; b.dir = 1; say('סירה שיגרה טורפדו!', 2); }
      else { b.torp = true; b.away = 0; }
    });
    torpsUpdate(S, dt);
    // the battleship's main guns
    if(S.bs && !S.bs.dead && S.bs.x - lead.x < 1800){
      S.shellT -= dt;
      if(S.shellT <= 0){
        const t = alive[Math.floor(Math.random()*alive.length)], x = t.x + rnd(-90, 90);
        G.fx.push({type:'column', x, y:SEA, t:0, max:1.6}); splash(x); SFX.noise(0.8, 500, 0.4);
        if(Math.abs(x - t.x) < 55){ boom(x, SEA-14, 45, true); hurtShip(t, 22, 'פגז ישיר!'); }
        S.shellT = rnd(4, 5.5);
      }
    }
  },
  bullet(S, s){
    for(const b of S.boats) if(!b.dead && boatHit(b, s.x, s.y)){ s.life = 0; hurtBoat(b, s.dmg); spark(s.x, s.y); return true; }
    for(const m of S.mines) if(!m.dead && Math.abs(s.x - m.x) < 7 && s.y > SEA-12 && s.y < SEA+3){ s.life = 0; SPECIALS.convoy.blowMine(m); return true; }
    return false;
  },
  blowMine(m){ m.dead = true; G.fx.push({type:'column', x:m.x, y:SEA, t:0, max:1.4}); boom(m.x, SEA-6, 34, true); G.earned += 50; G.fx.push({type:'text', x:m.x, y:SEA-40, t:0, max:1.2, text:'+$50'}); },
  blast(S, x, y, r, dmg, team){
    if(team==='p'){
      for(const b of S.boats) if(!b.dead && boatHit(b, x, y, r)) hurtBoat(b, dmg);
      for(const sb of S.subs) if(!sb.dead && Math.abs(x-sb.x) < r+34 && y > SEA-24) hurtSub(sb, dmg*1.1);   // a "depth charge"
      for(const m of S.mines) if(!m.dead && Math.abs(x-m.x) < r+12 && y > SEA-40) SPECIALS.convoy.blowMine(m);
    } else {
      for(const sh of S.convoy) if(!sh.dead && Math.abs(x-sh.x) < sh.w/2 + r*0.5 && y > SEA-60) hurtShip(sh, dmg*0.45, 'פגיעת פצצה!');
    }
  },
  draw(ctx, S){
    // moored contact mines: black spheres with horns, bobbing at the surface
    for(const m of S.mines){
      if(m.dead) continue;
      const y = SEA - 3 + Math.sin(G.time*2 + m.bob)*1.2;
      ctx.fillStyle='#1b1d20'; ctx.beginPath(); ctx.arc(m.x, y, 5, 0, 7); ctx.fill();
      ctx.strokeStyle='#1b1d20'; ctx.lineWidth=1.2; ctx.beginPath();
      for(let i=0;i<5;i++){ const a = Math.PI + i*Math.PI/4; ctx.moveTo(m.x + Math.cos(a)*5, y + Math.sin(a)*5); ctx.lineTo(m.x + Math.cos(a)*8, y + Math.sin(a)*8); }
      ctx.stroke();
      ctx.fillStyle='rgba(240,250,255,.5)'; ctx.fillRect(m.x-7, SEA+1, 14, 1.5);
    }
    for(const sh of S.convoy) drawFreighter(ctx, sh);
    for(const sb of S.subs) drawSub(ctx, sb);
    for(const b of S.boats) drawBoat(ctx, b);
    drawTorps(ctx, S);
  },
  hud(S){
    const alive = S.convoy.filter(s=>!s.dead), lead = alive.reduce((b,s)=>Math.max(b, s.x), 0);
    const prog = Math.min(100, Math.round(100*(lead - S.startLead)/(S.exitX - S.startLead)));
    const mines = S.mineWarn ? S.mines.filter(m=>!m.dead).length : 0;
    const threats = [mines ? `מוקשים: ${mines}` : '', S.subs.length ? `צוללות: ${S.subs.length}` : '', S.boats.length ? `סירות: ${S.boats.length}` : '', S.bs && !S.bs.dead ? 'אוניית מערכה!' : ''].filter(Boolean).join(' · ');
    return [`השיירה: ${alive.length} מתוך 4 ספינות · התקדמות ${prog}%`, threats];
  },
  short: S => `שיירה: ${S.convoy.filter(s=>!s.dead).length}/4`
},

// 4. ---------------------------------------------------------------------------------------------------
bridge:{
  name:'גשר על הנהר', icon:'🌉', reward:5500, wind:4, zeroEvery:30,
  brief:'מבצע עומק: ממריאים מהנושאת, חוצים את הים וטסים אל היבשת שבקצה השני של המפה. בדרך לגשר יש חגורת הגנה ארוכה עם תותחי נ"מ רבים, תותחי ענק ובונקרים. הגשר עצמו נמצא עמוק בפנים, בעמק עם נהר, ורכבות אספקה יוצאות ממנהרה בגבעה וחוצות אותו. הגשר עשוי פלדה – רק פצצות ורקטות פוגעות בו.',
  goals:['המרא מהנושאת וטוס מזרחה אל היבשת','עבור את חגורת הנ"מ – או השמד תותחים בדרך, או טוס מעליהם','הפל את הגשר – הכי טוב בזמן שרכבת חוצה אותו (בונוס $2,500)','אם הגשר נפל בלי רכבת: השמד את הרכבת הבאה כשהיא עוצרת לפני הפער. אל תיתן לשלוש רכבות לעבור','אחר כך: השמד את הגשר הצף שהאויב מתחיל לבנות, וחזור לנושאת דרך חגורת הנ"מ'],
  tip:'הנ"מ לא מגיע לגובה רב – אבל למעלה מחכים מטוסי זירו שממריאים מהיבשת. אפשר לחצות את החגורה גבוה ולצלול רק מעל העמק, או לטוס נמוך ולהשמיד תותחים בדרך. הדרך ארוכה – תכנן דלק וחזרה לנושאת לחימוש.',
  setup(S){
    G.L = 9600;
    const vc = 8000; S.vc = vc;
    // the mainland: from the coast in mid-map to beyond the far edge, with an AA belt before the river valley
    const at = [['aa',3750],['bunker',3900],['aa',4050],['aa',4250],['barracks',4400],['aa',4550],['aa',4750],['bunker',4900],['aa',5050],
      ['biggun',5200],['aa',5350],['fuel',5500],['aa',5650],['aa',5850],['bunker',6000],['aa',6150],['biggun',6400],['aa',6550],['barracks',6700],
      ['aa',6850],['bunker',7000],['aa',7150],['aa',7350],['aa',vc-235],['aa',vc+235],['barracks',8450],['aa',8650]];
    const is = specIsland(3400, 6800, 75, at,
      {hills:[{c:4600, w:120, h:40}, {c:5800, w:140, h:35}, {c:6900, w:110, h:45}, {c:vc, w:95, h:-62}, {c:vc-230, w:70, h:34}, {c:vc+230, w:70, h:34}, {c:8900, w:95, h:55}],
       soldiers:18});
    S.is = is;
    const bx0 = vc - 150, bx1 = vc + 150, by = Math.min(groundY(bx0), groundY(bx1)) - 1;
    S.bridge = {x0:bx0, x1:bx1, y:by, hp:240, max:240, dead:false, fall:0};
    S.tunnel = 8930; S.trackX0 = 7250; S.trainT = 50; S.passed = 0; S.train = null;
    say('המרא וטוס מזרחה אל היבשת. הגשר נמצא עמוק בפנים, אחרי חגורת נ"מ', 5);
  },
  trackY(S, x){ const B = S.bridge; return (x >= B.x0 && x <= B.x1) ? B.y : groundY(x) - 1; },
  update(S, dt){
    const B = S.bridge, M = SPECIALS.bridge;
    if(B.dead) B.fall = Math.min(1, B.fall + dt*0.8);
    // trains: a locomotive and five wagons out of the tunnel, westward across the bridge
    if(!S.train){ S.trainT -= dt; if(S.trainT <= 0){ S.train = {x:S.tunnel, speed:34, cars:5, hp:150, max:150, ph:'run', flash:0, fall:0}; say('רכבת יוצאת מהמנהרה!', 3); } }
    const T = S.train;
    if(T){
      T.flash = Math.max(0, T.flash - dt);
      const len = 14 + T.cars*28;
      if(T.ph==='run'){
        let nx = T.x - T.speed*dt;
        if(B.dead && T.x > B.x1 && nx <= B.x1 + 14){ nx = B.x1 + 14; T.ph = 'stopped'; say('הרכבת עצרה לפני הגשר ההרוס – השמד אותה!', 4); }
        T.x = nx;
        if(Math.random() < dt*6) puff(T.x + 6, M.trackY(S, T.x) - 22, 'rgba(70,70,70,.6)', 7, 1.6);
        if(T.x + len < S.trackX0 + 40){ S.passed++; S.train = null; S.trainT = 40;
          if(S.passed >= 3) return specialEnd(false, 'שלוש רכבות עברו את הגשר עם אספקה לחזית.');
          say(`רכבת עברה את הגשר! (${S.passed} מתוך 3)`, 3.5); }
      } else if(T.ph==='falling'){
        T.fall += dt;
        if(T.fall > 1.6 && !T.boomed){ T.boomed = true; for(let i=0;i<5;i++) boom(B.x0 + 30 + i*50, groundY(S.vc) - 10, 55, true); }
      }
    }
    // phase 2: with the bridge and a train gone, engineers start laying a pontoon bridge across the river
    if(B.dead && S.trainKilled && !S.phase2){
      S.phase2 = 'pontoon'; S.pont = {prog:0, hp:120, max:120, dead:false, flash:0};
      for(let k=0;k<5;k++){ const x = S.vc + rnd(-70, 70); G.soldiers.push({x, y:groundY(x), dir:1, speed:0, t:rnd(0,1), cool:rnd(0.5,2), dead:false, def:true, home:x, island:0}); }
      say(S.perfect ? 'מושלם! הגשר קרס עם הרכבת עליו. אבל – צוות הנדסה מתחיל לבנות גשר צף על הנהר! השמד אותו לפני שיושלם' : 'הגשר והרכבת הושמדו! אבל צוות הנדסה מתחיל לבנות גשר צף על הנהר – השמד אותו לפני שיושלם', 6);
      SFX.alarm();
    }
    if(S.phase2==='pontoon'){
      const Pn = S.pont; Pn.flash = Math.max(0, Pn.flash - dt);
      Pn.prog = Math.min(1, Pn.prog + dt/45);
      if(Pn.prog >= 1) return specialEnd(false, 'הגשר הצף הושלם – הרכבות חוזרות לעבור את הנהר.');
    }
    // phase 3: the way home, back across the AA belt with fighters on your tail
    if(S.phase2==='pontoon' && S.pont.dead){
      S.phase2 = 'home'; const P = G.player;
      for(let k=0;k<4;k++){ const z = {type:'zero', x:P.x + 500 + k*120, y:Math.max(CEIL+100, P.y - 120 - k*40), a:Math.PI, speed:250, full:250, hp:44, max:44, size:16, cool:1, burst:0, evade:0, dead:false}; G.enemies.push(z); }
      specialLandToFinish('הגשר הצף הושמד! עכשיו חזור לנושאת דרך חגורת הנ"מ – ארבעה מטוסי זירו רודפים אחריך. נחת כדי לסיים');
    }
  },
  hitPont(S, d){
    const Pn = S.pont; if(!Pn || Pn.dead) return;
    Pn.hp -= d; Pn.flash = 0.1;
    if(Pn.hp <= 0){ Pn.dead = true; for(let i=0;i<3;i++) boom(S.vc - 40 + i*40, groundY(S.vc) - 4, 40, true); G.fx.push({type:'column', x:S.vc, y:groundY(S.vc), t:0, max:1.4}); G.earned += 800; S.bonus += 800; say('הגשר הצף הושמד! בונוס $800', 3); }
  },
  hitTrain(S, d){
    const T = S.train; if(!T || T.ph==='falling' || T.dead) return;
    T.hp -= d; T.flash = 0.1;
    if(T.hp <= 0){ T.dead = true; S.trainKilled = true; earn('train', T.x + 60, SPECIALS.bridge.trackY(S, T.x) - 20);
      for(let i=0;i<4;i++) boom(T.x + 20 + i*30, SPECIALS.bridge.trackY(S, T.x + 20 + i*30) - 10, 40, true);
      S.train = null; S.trainT = 40; say('הרכבת הושמדה!', 3); }
  },
  bullet(S, s){
    const T = S.train, M = SPECIALS.bridge;
    if(T && T.ph!=='falling' && s.x > T.x - 4 && s.x < T.x + 14 + T.cars*28 && Math.abs(s.y - (M.trackY(S, s.x) - 10)) < 12){ s.life = 0; M.hitTrain(S, s.dmg*0.35); spark(s.x, s.y); return true; }
    const B = S.bridge;
    if(!B.dead && s.x > B.x0 && s.x < B.x1 && s.y > B.y - 24 && s.y < B.y + 6){ s.life = 0; spark(s.x, s.y); return true; }   // bullets glance off the steel
    const Pn = S.pont, fy = groundY(S.vc);
    if(Pn && !Pn.dead && Math.abs(s.x - S.vc) < 50*Pn.prog + 6 && s.y > fy - 10 && s.y < fy + 4){ s.life = 0; M.hitPont(S, s.dmg*0.3); spark(s.x, s.y); return true; }
    return false;
  },
  blast(S, x, y, r, dmg, team){
    if(team!=='p') return;
    const B = S.bridge, T = S.train, M = SPECIALS.bridge;
    if(S.pont && !S.pont.dead && Math.abs(x - S.vc) < 50*S.pont.prog + r && y > groundY(S.vc) - r - 20) M.hitPont(S, dmg);
    if(!B.dead && x > B.x0 - r && x < B.x1 + r && Math.abs(y - B.y) < r + 30){
      B.hp -= dmg; boom(x, B.y - 8, 26, false);
      if(B.hp <= 0){
        B.dead = true; earn('bridge', (B.x0+B.x1)/2, B.y - 30); SFX.planeBoom();
        if(T && T.ph==='run' && T.x < B.x1 && T.x + 14 + T.cars*28 > B.x0){
          T.ph = 'falling'; S.perfect = true; S.trainKilled = true; G.earned += 2500; S.bonus = 2500;
          say('הגשר קורס – עם הרכבת עליו! בונוס $2,500', 5);
        } else say('הגשר קרס! עכשיו השמד את הרכבת הבאה', 4);
      } else say(`פגיעה בגשר! (${pct(B.hp, B.max)})`, 1.5);
    }
    if(T && T.ph!=='falling' && x > T.x - r && x < T.x + 14 + T.cars*28 + r && Math.abs(y - M.trackY(S, x)) < r + 20) M.hitTrain(S, dmg);
  },
  draw(ctx, S){
    const B = S.bridge, M = SPECIALS.bridge, vc = S.vc, floor = groundY(vc);
    // river at the bottom of the gorge
    ctx.fillStyle='#3d7398'; ctx.beginPath(); ctx.ellipse(vc, floor + 1, 44, 4, 0, 0, 7); ctx.fill();
    ctx.strokeStyle='rgba(220,240,255,.35)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(vc-30, floor); ctx.lineTo(vc-10, floor); ctx.moveTo(vc+8, floor+1); ctx.lineTo(vc+26, floor+1); ctx.stroke();
    // the pontoon bridge growing out from both banks: boats with a plank deck on top
    const Pn = S.pont;
    if(Pn && !Pn.dead){
      const half = 50*Pn.prog, W = Pn.flash > 0 ? '#ffffff' : null;
      for(let x = vc - half; x <= vc + half; x += 12){ ctx.fillStyle = W || '#4a4a3c'; ctx.beginPath(); ctx.ellipse(x, floor + 1, 5, 2.4, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = W || '#7a5a34'; ctx.fillRect(vc - half - 4, floor - 4, half*2 + 8, 3);
      const k = Pn.prog; ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(vc-30, floor-20, 60, 3); ctx.fillStyle='#e8b33a'; ctx.fillRect(vc-30, floor-20, 60*k, 3);
    }
    // railway: sleepers and rails along the ground, up to the tunnel
    ctx.strokeStyle='#4a3a28'; ctx.lineWidth=2;
    for(let x = S.trackX0; x < S.tunnel; x += 7){ if(x > B.x0 && x < B.x1) continue; const y = groundY(x); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 2.5); ctx.stroke(); }
    ctx.strokeStyle='#2b2b2b'; ctx.lineWidth=1.2; ctx.beginPath();
    for(let x = S.trackX0; x <= S.tunnel; x += 6){ if(x > B.x0 && x < B.x1) continue; const y = groundY(x) - 2.5; (x===S.trackX0 || x-6 < B.x1 && x > B.x1) ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    // tunnel portal in the hillside
    const ty = groundY(S.tunnel);
    ctx.fillStyle='#6b6457'; ctx.beginPath(); ctx.arc(S.tunnel, ty, 22, Math.PI, 0); ctx.fill();
    ctx.fillStyle='#0d0d0d'; ctx.beginPath(); ctx.arc(S.tunnel, ty, 16, Math.PI, 0); ctx.fill();
    // the bridge: stone piers and a steel truss (falling in two halves once it is cut)
    const truss = (x0, x1, y) => {
      ctx.strokeStyle='#3c4148'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.moveTo(x0, y-18); ctx.lineTo(x1, y-18); ctx.stroke();
      ctx.lineWidth=1.1; ctx.beginPath(); const n = Math.max(1, Math.round((x1-x0)/25));
      for(let i=0;i<=n;i++){ const x = x0 + (x1-x0)*i/n; ctx.moveTo(x, y); ctx.lineTo(x, y-18); if(i<n){ const x2 = x0 + (x1-x0)*(i+1)/n; ctx.moveTo(x, y); ctx.lineTo(x2, y-18); } }
      ctx.stroke();
    };
    if(!B.dead){
      ctx.fillStyle='#7b7468'; for(const px of [B.x0+70, (B.x0+B.x1)/2, B.x1-70]){ ctx.fillRect(px-6, B.y, 12, groundY(px) - B.y + 4); }
      truss(B.x0, B.x1, B.y);
      ctx.strokeStyle='#2b2b2b'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(B.x0, B.y-2.5); ctx.lineTo(B.x1, B.y-2.5); ctx.stroke();
      const k = B.hp/B.max; ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(vc-40, B.y-34, 80, 4); ctx.fillStyle = k<0.35?'#c8402f':'#e8b33a'; ctx.fillRect(vc-40, B.y-34, 80*k, 4);
    } else {
      const f = B.fall, mid = (B.x0+B.x1)/2;
      ctx.fillStyle='#7b7468'; for(const px of [B.x0+70, B.x1-70]) ctx.fillRect(px-6, B.y + 30*f, 12, Math.max(0, groundY(px) - B.y - 30*f + 4));
      ctx.save(); ctx.translate(B.x0, B.y); ctx.rotate(f*1.05); truss(0, mid-B.x0-6, 0); ctx.restore();
      ctx.save(); ctx.translate(B.x1, B.y); ctx.rotate(-f*1.05); truss(-(B.x1-mid-6), 0, 0); ctx.restore();
    }
    // the train
    const T = S.train;
    if(T){
      const car = (x, i) => {
        const y = T.ph==='falling' ? Math.min(groundY(x) - 6, M.trackY(S, x) + T.fall*T.fall*160) : M.trackY(S, x);
        ctx.save(); ctx.translate(x, y); if(T.ph==='falling') ctx.rotate((i%2 ? 1 : -1)*Math.min(1.2, T.fall));
        const W = T.flash > 0 ? '#ffffff' : null;
        if(i===0){   // locomotive (front = -x, it runs west)
          ctx.fillStyle = W || '#1e1e1e'; ctx.fillRect(0, -15, 22, 10); ctx.fillRect(14, -21, 8, 16);
          ctx.fillStyle = W || '#2c2c2c'; ctx.fillRect(3, -21, 4, 6);                     // smokestack
          ctx.fillStyle='#b8241c'; ctx.fillRect(0, -6, 22, 2);
        } else { ctx.fillStyle = W || (i%2 ? '#6b4b2e' : '#5d5a3e'); ctx.fillRect(0, -17, 25, 12); ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(11, -16, 2, 10); }
        ctx.fillStyle='#111'; for(const wx of [4, (i===0?18:21)]){ ctx.beginPath(); ctx.arc(wx, -3, 2.6, 0, 7); ctx.fill(); }
        ctx.restore();
      };
      for(let i=0;i<=T.cars;i++) car(T.x + (i===0 ? 0 : 14 + (i-1)*28 + 10), i);
    }
  },
  hud(S){
    const B = S.bridge, T = S.train;
    if(S.phase2==='pontoon') return [`שלב 2: השמד את הגשר הצף לפני שיושלם – בנוי ${Math.round(S.pont.prog*100)}%`, `גשר צף: ${pct(S.pont.hp, S.pont.max)}`];
    if(S.phase2==='home') return ['שלב 3: חזור לנושאת ונחת – מטוסי זירו רודפים אחריך'];
    const tr = !T ? (S.trainT > 0 ? `רכבת הבאה בעוד ${Math.ceil(S.trainT)}` : '') : T.ph==='stopped' ? 'הרכבת עצרה – השמד אותה!' : T.ph==='falling' ? 'הרכבת נופלת!' : 'רכבת בדרך לגשר';
    return [B.dead ? 'הגשר הופל!' : `הגשר: ${pct(B.hp, B.max)}`, [tr, `רכבות שעברו: ${S.passed}/3`].filter(Boolean).join(' · ')];
  },
  short: S => S.phase2==='pontoon' ? `גשר צף ${Math.round(S.pont.prog*100)}%` : S.phase2==='home' ? 'חזרה לנושאת' : S.bridge.dead ? 'גשר: הופל' : `גשר: ${pct(S.bridge.hp, S.bridge.max)}`
},

// 5. ---------------------------------------------------------------------------------------------------
clock:{
  name:'השעון המתקתק', icon:'⏱', reward:5000, zeroEvery:20, wind:8,
  brief:'מודיעין גילה שיפן מכינה מתקפת קמיקזה גדולה מארבעה שדות תעופה – אחד מהם מוסווה ולא ידוע איפה הוא. יש לך חמש דקות להשמיד את ההאנגרים ומחסני הדלק בכל שדה. כל שדה שיישאר פעיל כשהזמן ייגמר ישגר גל של חמישה מטוסי קמיקזה על הנושאת.',
  goals:['השמד את ההאנגרים (צריפים) ומחסן הדלק בכל שדה – לפני שהשעון מגיע לאפס','השדה הרביעי מוסווה: טוס נמוך מעל האיים הרחוקים (או שלח מטוס כנף) כדי לגלות אותו','אם הזמן נגמר: הפל את מטוסי הקמיקזה לפני שהם פוגעים בנושאת','הנושאת חייבת לשרוד'],
  tip:'אין מספיק פצצות לכל השדות בגיחה אחת: תכנן נחיתה לחימוש מחדש. השדה המוסווה רחוק – חפש אותו מוקדם. כל שנייה שנשארת בשעון מוסיפה בונוס.',
  setup(S){
    G.L = 10400;
    const plan = [2100, 4300, 6500, 8600];
    S.fields = plan.map((x0, i)=>{
      const is = specIsland(x0, 1150, 58, [['aa',x0+230],['barracks',x0+400],['fuel',x0+560],['barracks',x0+720],['aa',x0+880],['bunker',x0+990]], {soldiers:6});
      const idx = G.islands.indexOf(is);
      const targets = G.structures.filter(s=>s.island===idx && (s.type==='barracks' || s.type==='fuel'));
      const f = {is, idx, targets, name:['הראשון','השני','השלישי','הרביעי'][i], done:false, hidden: i===3};
      if(f.hidden) for(const s of G.structures) if(s.island===idx) s.hidden = true;   // camouflaged until spotted
      return f;
    });
    S.timer = 300; S.phase = 1; S.kami = [];
    G.carrier.max = G.carrier.hp = 900;                        // takes about ten kamikaze hits
    say('חמש דקות! השמד את ארבעת שדות התעופה לפני שהקמיקזה ממריאים. אחד מהם מוסווה – צריך למצוא אותו', 6); SFX.alarm();
  },
  update(S, dt){
    // reconnaissance: a low pass over the camouflaged field (by you or a wingman) gives it away
    const hf = S.fields.find(f=>f.hidden);
    if(hf){
      const cx = (hf.is.x0 + hf.is.x1)/2, P = G.player;
      const spot = o => Math.abs(o.x - cx) < 600 && groundY(o.x) - o.y < 280;
      if((!P.dead && !P.onDeck && spot(P)) || G.wingmen.some(w=>!w.dead && w.state==='fly' && spot(w))){
        hf.hidden = false; for(const s of G.structures) if(s.island===hf.idx) s.hidden = false;
        say('השדה המוסווה אותר! מטוסים חונים מתחת לרשתות הסוואה – והנ"מ שלו פותח באש', 5); SFX.alarm();
      }
    }
    for(const f of S.fields){
      if(!f.done && f.targets.every(s=>s.dead)){ f.done = true; G.earned += 500; S.bonus += 500; say(`שדה התעופה ${f.name} הושמד! בונוס $500`, 3.5); SFX.pickup(); }
    }
    const alive = S.fields.filter(f=>!f.done);
    if(S.phase===1){
      S.timer -= dt;
      if(!alive.length){ const b = Math.ceil(S.timer)*40; G.earned += b; S.bonus += b; return specialEnd(true, `כל השדות הושמדו בזמן! בונוס זמן $${b}`); }
      if(S.timer <= 0){
        S.phase = 2; G.def.zeroEvery = 1e9;
        alive.forEach((f, i)=>{
          if(f.hidden){ f.hidden = false; for(const s of G.structures) if(s.island===f.idx) s.hidden = false; }
          const site = {kind:'island', x:(f.is.strip.x0+f.is.strip.x1)/2, is:f.is};
          for(let k=0;k<5;k++){ const e = launchFrom(site, 'zero', k*1.3 + i*0.4); e.forceKami = true; S.kami.push(e); }
        });
        say(`הזמן נגמר! ${alive.length*5} מטוסי קמיקזה ממריאים לעבר הנושאת – הפל אותם!`, 6); SFX.alarm(); SFX.banzai();
      }
    } else {
      const left = S.kami.filter(e=>!e.dead && G.enemies.includes(e)).length;
      if(!left) specialEnd(true, 'גל הקמיקזה נעצר! הנושאת ניצלה');
    }
  },
  draw(ctx, S){
    // Zeros parked on each working airfield
    for(const f of S.fields){
      if(f.done || S.phase===2 || f.hidden) continue;
      for(let k=0;k<3;k++){
        const x = f.is.strip.x0 + 120 + k*230, y = groundY(x) - wheelDrop('zero', 1)*0.75;
        ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); drawPlane(ctx, 'zero', null, null, 0.75, false, false, 1); ctx.restore();
      }
    }
  },
  hud(S){
    const alive = S.fields.filter(f=>!f.done).length;
    if(S.phase===2){ const left = S.kami.filter(e=>!e.dead && G.enemies.includes(e)).length; return [`קמיקזה בדרך לנושאת! נותרו ${left}`, `נושאת: ${pct(G.carrier.hp, G.carrier.max)}`]; }
    const hid = S.fields.some(f=>f.hidden);
    return [`⏱ ${mmss(S.timer)}`, `שדות תעופה פעילים: ${alive} מתוך 4${hid ? ' · השדה הרביעי עדיין לא אותר' : ''}`];
  },
  // the clock itself, big and red in the last half minute
  screen(ctx, vw, S){
    if(S.phase!==1 || S.timer > 30) return;
    ctx.save(); ctx.textAlign='center'; ctx.font='bold 40px Rubik, sans-serif';
    ctx.fillStyle = `rgba(230,60,40,${0.55 + 0.35*Math.sin(G.time*8)})`; ctx.shadowColor='rgba(0,0,0,.6)'; ctx.shadowBlur=6;
    ctx.fillText(mmss(S.timer), vw/2, 170); ctx.restore();
  },
  short: S => S.phase===1 ? `⏱ ${mmss(S.timer)}` : 'קמיקזה!'
},

// 6. ---------------------------------------------------------------------------------------------------
ace:{
  name:'אס מול אס', icon:'🎯', reward:5000, lives:3, noWing:true, time:'dusk', wind:0,
  brief:'טייס האס היפני המפורסם, במטוס זירו בצבעים מיוחדים, מאתגר אותך לדו-קרב מעל הים – בשלושה סיבובים. קודם שני מטוסי הכנף שלו, אחר כך הוא עצמו. בלי מטוסי כנף ובלי נ"מ. הוא משתמש בכל התמרונים, וכשהוא נפגע הוא מתנתק, מטפס אל השמש וצולל עליך מתוך הסנוור. ואם תפיל אותו – הוא לא מוותר בקלות.',
  goals:['סיבוב 1: הפל את שני מטוסי הכנף של האס','סיבוב 2: הפל את האס','סיבוב 3: ...?','שלושה מטוסים בלבד – אין מטוסי כנף. היזהר מהצלילה מתוך השמש'],
  tip:'כשהאס מטפס אל השמש – אל תרדוף אחריו למעלה. התכונן: גלגול חבית או ספליט S ברגע שהוא צולל עליך.',
  setup(S){
    G.L = 4800; S.spawnT = 6; S.round = 1;
    say('האס היפני בדרך עם שני מטוסי כנף. הוא מנענע כנפיים: זה אתגר לדו-קרב', 5);
  },
  spawnAce(S, strong){
    S.ace = {type:'zero', x:G.L - 150, y:80, a:Math.PI, speed:strong?300:285, full:strong?305:295, hp:strong?380:320, max:strong?380:320, size:16, cool:1.5, burst:0, evade:0, dead:false, ace:true, skin:SKINS.ace};
    S.next = [0.5];                                         // one break-off into the sun, at half damage
    G.enemies.push(S.ace);
  },
  update(S, dt){
    // round 1: the ace's two wingmen, good pilots in their own right
    if(S.round===1){
      if(!S.wings){
        S.spawnT -= dt;
        if(S.spawnT <= 0){
          S.wings = [0,1].map(k=>{ const z = {type:'zero', x:G.L - 150 + k*90, y:60 + k*50, a:Math.PI, speed:275, full:280, hp:70, max:70, size:16, cool:1.5, burst:0, evade:0, dead:false}; G.enemies.push(z); return z; });
          say('סיבוב 1: שני מטוסי הכנף של האס תוקפים!', 3); SFX.alarm();
        }
        return;
      }
      if(S.wings.every(z=>z.dead || !G.enemies.includes(z))){ S.round = 2; S.spawnT = 5; say('שני מטוסי הכנף הופלו. סיבוב 2: האס עצמו נכנס לקרב!', 4); }
      return;
    }
    if(!S.ace || (S.round===3 && S.ace.dead && S.chute)){
      // the pilot under his parachute drifting down to the sea, before the last round
      if(S.chute){ const c = S.chute; c.y = Math.min(SEA-4, c.y + 26*dt); c.x += 8*dt; if(c.y >= SEA-4 && !c.splash){ c.splash = true; splash(c.x); } }
      S.spawnT -= dt;
      if(S.spawnT <= 0){
        this.spawnAce(S, S.round===3); S.chute = null;
        say(S.round===3 ? 'סיבוב 3: האס חזר במטוס חדש וחזק יותר! הוא לא מוותר' : 'האס כאן!', 3.5); SFX.alarm();
      }
      return;
    }
    const e = S.ace;
    if(e.dead){
      if(S.round===2){
        // he bails out - and comes back for a last round
        S.round = 3; S.spawnT = 14; S.chute = {x:e.x, y:e.y};
        say('האס נפגע ונטש בצניחה! אבל הנושאת שלו קרובה... היכון לסיבוב 3', 5);
        return;
      }
      return specialEnd(true, 'האס היפני הופל סופית! ניצחת בדו-קרב');
    }
    if(!G.enemies.includes(e)){ e.x = clamp(e.x, 100, G.L-100); e.y = 60; G.enemies.push(e); }   // flew off the map: comes back
    if(S.next.length && e.hp/e.max <= S.next[0] && !e.retreat){
      S.next.shift(); e.retreat = {ph:'climb', t:0}; e.man = null; e.faceLock = null; e.rollOverride = null;
      say('האס נפגע! הוא מתנתק ומטפס אל תוך השמש...', 3.5);
    }
  },
  draw(ctx, S){
    const c = S.chute; if(!c) return;
    if(c.y < SEA - 5){
      ctx.fillStyle='#e9e4d6'; ctx.beginPath(); ctx.arc(c.x, c.y - 26, 14, Math.PI, 0); ctx.fill();          // canopy
      ctx.strokeStyle='rgba(60,60,60,.7)'; ctx.lineWidth=0.6; ctx.beginPath();
      for(const dx of [-13, -6, 6, 13]){ ctx.moveTo(c.x + dx, c.y - 26); ctx.lineTo(c.x, c.y - 6); } ctx.stroke();
    }
    ctx.fillStyle='#5a5a40'; ctx.fillRect(c.x - 2, c.y - 7, 4, 7); ctx.fillStyle='#d9b48a'; ctx.beginPath(); ctx.arc(c.x, c.y - 8.5, 2, 0, 7); ctx.fill();
  },
  // diving out of the sun: a blinding glare around him hides the aircraft
  over(ctx, S){
    const e = S.ace; if(!e || e.dead || !e.sunDive) return;
    const r = 130, g = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, r);
    g.addColorStop(0, 'rgba(255,253,235,.97)'); g.addColorStop(0.35, 'rgba(255,240,190,.75)'); g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 7); ctx.fill();
    ctx.strokeStyle='rgba(255,245,210,.35)'; ctx.lineWidth=3; ctx.beginPath();
    for(let i=0;i<8;i++){ const a = i*Math.PI/4 + G.time*0.3; ctx.moveTo(e.x + Math.cos(a)*30, e.y + Math.sin(a)*30); ctx.lineTo(e.x + Math.cos(a)*170, e.y + Math.sin(a)*170); }
    ctx.stroke();
  },
  hud(S){
    if(S.round===1) return S.wings ? [`סיבוב 1 מתוך 3: מטוסי הכנף של האס`, `נותרו ${S.wings.filter(z=>!z.dead && G.enemies.includes(z)).length} מתוך 2`] : `האס ומטוסי הכנף שלו מגיעים בעוד ${Math.ceil(S.spawnT)}`;
    const e = S.ace;
    if(!e || e.dead) return [`סיבוב ${S.round} מתוך 3`, `האס מגיע בעוד ${Math.ceil(S.spawnT)}`];
    return [`סיבוב ${S.round} מתוך 3 · האס היפני: ${pct(e.hp, e.max)}`, e.sunDive ? 'צולל מתוך השמש!' : e.retreat ? 'מטפס אל השמש...' : ''];
  },
  short: S => S.round===1 ? 'סיבוב 1/3' : S.ace && !S.ace.dead ? `סיבוב ${S.round}/3 · ${pct(S.ace.hp, S.ace.max)}` : `סיבוב ${S.round}/3`
},

// 7. ---------------------------------------------------------------------------------------------------
burning:{
  name:'הנושאת הבוערת', icon:'🔥', reward:4500, lives:3, noWing:true, wind:10,
  brief:'הנושאת שלך נפגעה ובוערת. הסיפון סגור לנחיתה עד שהאש תכובה – כשתי דקות – ושלושה גלי תקיפה בדרך לגמור את העבודה, כולל מפציצי טורפדו שטסים נמוך מעל המים. כל פגיעה בנושאת הבוערת מפיצה את האש ומאריכה את הכיבוי. אין חימוש מחדש: כל כדור חשוב. במזרח יש נושאת שנייה – אפשר לנחות עליה, אבל גם היא מותקפת.',
  goals:['שרוד שלושה גלי תקיפה והגן על הנושאת הבוערת','הפל את מפציצי הטורפדו לפני שהם מטילים – פגיעת טורפדו מפיצה את האש','הגן גם על הנושאת השנייה – אם היא טובעת, המשימה נכשלת','אל תנחת על הסיפון הבוער. אחרי שהאש כובתה והאויב הושמד – נחת כדי לסיים'],
  tip:'מפציצי הטורפדו טסים ממש מעל המים: יירט אותם רחוק מהנושאת. חסוך בתחמושת – צרורות קצרים מטווח קרוב.',
  setup(S){
    G.L = 5600;
    const C = G.carrier; C.max = 900; C.hp = 520; C.burning = 120;
    const C2 = G.carrier2 = {x:4300, len:520, hp:900, max:900, hit:0};
    S.c2aim = {x:C2.x + C2.len/2, speed:0, dead:false};     // what Vals sent against the second carrier aim at
    S.jc = spEnemyCarrier(G.L + 1000);
    spQueueRaid(S, 8, 3, 4);                                  // wave 1: dive bombers on the burning carrier
    spQueueRaid(S, 48, 2, 4, {aim:S.c2aim});                  // wave 2: dive bombers on the second carrier...
    for(let k=0;k<3;k++) S.queue.push({at:52 + k*2.5, type:'betty', grp:{}, opts:{torpRun:true, hp:130, max:130}});   // ...and torpedo bombers
    spQueueRaid(S, 92, 4, 6, v => Math.random() < 0.4 ? {aim:S.c2aim} : {});   // wave 3: everything
    S.queue.sort((a,b)=>a.at-b.at);
    say('הנושאת בוערת! אי אפשר לנחות עד שהאש תכובה. שלושה גלי תקיפה בדרך', 5); SFX.alarm();
  },
  update(S, dt){
    const C = G.carrier, C2 = G.carrier2;
    spRunQueue(S, S.jc);
    etorpsUpdate(S, dt);
    if(C2.hp <= 0) return specialEnd(false, 'הנושאת השנייה הוטבעה.');
    if(!S.w2 && S.t > 48){ S.w2 = true; say('גל 2: מפציצי צלילה על הנושאת השנייה, ומפציצי טורפדו נמוך מעל המים!', 5); SFX.alarm(); }
    if(!S.w3 && S.t > 92){ S.w3 = true; say('גל 3: התקיפה הגדולה – על שתי הנושאות!', 5); SFX.alarm(); }
    // a hit on the burning deck feeds the fire
    if(C.burning > 0 && C.hp < (S.lastHp ?? C.hp) - 20){ C.burning = Math.min(150, C.burning + 6); if(!S.spreadSaid || S.t - S.spreadSaid > 6){ S.spreadSaid = S.t; say('פגיעה בנושאת – האש מתפשטת!', 2.5); } }
    S.lastHp = C.hp;
    if(C.burning > 0){
      C.burning -= dt;
      if(Math.random() < dt*10) puff(C.x + rnd(60, C.len-40), DECK_Y - 14, Math.random()<0.5 ? '#222' : '#3a3a3a', rnd(14, 24), 2.6);
      if(C.burning <= 0){ C.burning = 0; say('האש כובתה! הסיפון פתוח לנחיתה', 4); SFX.pickup(); }
    }
    if(!C.burning && S.t > 95 && !spLiveLeft(S) && !(S.etorps||[]).length) specialLandToFinish('האש כובתה והתוקפים הושמדו! נחת על אחת הנושאות כדי לסיים');
  },
  // bombs aimed at the second carrier
  blast(S, x, y, r, dmg, team){
    const C2 = G.carrier2; if(team!=='e' || !C2) return;
    if(x > C2.x - r && x < C2.x + C2.len + r && y > DECK_Y - r){ C2.hp -= dmg; C2.hit = 0.3; }
  },
  draw(ctx, S){ drawTorps(ctx, {torps: S.etorps || []}); },
  over(ctx, S){
    const C = G.carrier; if(!(C.burning > 0)) return;
    const k = Math.min(1, C.burning/30);
    for(const [dx, s] of [[120, 1], [230, 1.3], [330, 0.9], [440, 1.1]]){
      const x = C.x + dx, h = (14 + Math.sin(G.time*13 + dx)*4)*s*(0.5 + 0.5*k);
      const g = ctx.createRadialGradient(x, DECK_Y-4, 2, x, DECK_Y-4, 30*s);
      g.addColorStop(0, 'rgba(255,170,60,.45)'); g.addColorStop(1, 'rgba(255,100,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, DECK_Y-4, 30*s, 0, 7); ctx.fill();
      ctx.fillStyle='#ff7a1c'; ctx.beginPath(); ctx.moveTo(x-8*s, DECK_Y-1); ctx.quadraticCurveTo(x-6*s, DECK_Y-h*0.6, x+Math.sin(G.time*9+dx)*3, DECK_Y-h); ctx.quadraticCurveTo(x+6*s, DECK_Y-h*0.6, x+8*s, DECK_Y-1); ctx.fill();
      ctx.fillStyle='#ffd23a'; ctx.beginPath(); ctx.moveTo(x-4*s, DECK_Y-1); ctx.quadraticCurveTo(x, DECK_Y-h*0.7, x+4*s, DECK_Y-1); ctx.fill();
    }
  },
  // flying through the smoke over the carrier
  screen(ctx, vw, S){
    const C = G.carrier, P = G.player; if(!(C.burning > 0) || P.dead) return;
    const d = Math.abs(P.x - (C.x + C.len/2)), k = clamp(1 - d/700, 0, 1) * clamp((P.y - 150)/250, 0, 1);
    if(k > 0){ ctx.fillStyle = `rgba(40,38,36,${0.38*k})`; ctx.fillRect(0, 0, vw, H); }
  },
  hud(S){
    const C = G.carrier, left = spLiveLeft(S);
    const wave = S.t > 92 ? 3 : S.t > 48 ? 2 : 1;
    return [(C.burning > 0 ? `הסיפון בוער · נפתח בעוד ${Math.ceil(C.burning)}` : 'הסיפון פתוח לנחיתה') + ` · גל ${wave} מתוך 3`,
            `נושאת: ${pct(C.hp, C.max)} · נושאת 2: ${pct(G.carrier2.hp, G.carrier2.max)}${left ? ` · מטוסי אויב: ${left}` : ''}`];
  },
  short: S => G.carrier.burning > 0 ? `🔥 ${Math.ceil(G.carrier.burning)}` : 'האש כובתה'
},

// 8. ---------------------------------------------------------------------------------------------------
assault:{
  name:'הפלישה הגדולה', icon:'⭐', reward:8000, zeroEvery:22, wind:6,
  brief:'הפלישה הגדולה לאי המבוצר, בכמה שלבים: להשתיק את הנ"מ, ללוות את הנחתת, לתמוך בכוחות בחוף מול טנקים והסתערות בנזאי, ולהטביע אוניית מערכה שמגיעה להפגיז אותם. ובסוף – הפתעה.',
  goals:['שלב 1: השמד את כל תותחי הנ"מ באי – רק אז הנחתת יוצאת','שלב 2: לווה את הנחתת ותמוך בכוחות שעולים לחוף','שלב 3: אוניית מערכה תגיע להפגיז את החוף – הטבע אותה','שלב 4: כבוש את האי... ואז היה מוכן להפתעה','שלב 5: מישהו יבוא לנקום – והוא צף'],
  tip:'קח טורפדו לשלב של אוניית המערכה: שני טורפדו מטביעים אותה. אפשר לנחות ולהחליף חימוש בין השלבים.',
  setup(S){
    groundSetup({plan:[{x0:2600, w:2300, h:66, mult:1.5}], inf:24, tanks:5, msg:'שלב 1: השמד את תותחי הנ"מ באי. הנחתת ממתינה ליד הנושאת'});
    G.L = 7800;
    const is = G.islands[0];
    for(const x of [is.x0 + 420, is.x1 - 380]){ const s = makeStruct('aa', x); s.island = 0; G.structures.push(s); }
    G.ground.hold = true; S.stage = 'aa'; S.is = is; S.shellT = 5;
  },
  update(S, dt){
    const Gd = G.ground, is = S.is;
    if(S.stage==='aa'){
      const left = G.structures.filter(s=>!s.dead && s.type==='aa' && s.island===0).length;
      if(!left){ Gd.hold = false; S.stage = 'land'; say('הנ"מ הושתק! שלב 2: הנחתת יוצאת לחוף – לווה אותה', 5); SFX.pickup(); }
    } else if(S.stage==='land'){
      // once the troops are ashore (or the beach has already fallen) the battleship steams in
      if(Gd.phase!=='sail' && (Gd.phase==='assault' || is.captured || Gd.units.filter(u=>!u.dead).length >= 6)){
        S.stage = 'battleship';
        const bs = makeShip('battleship', G.L + 300, is.x1 + 700, G.L + 300); bs.dir = -1; bs.speed = 16; G.ships.push(bs); S.bs = bs;
        for(let k=0;k<3;k++){ const x = is.x1 - 200 - k*60; G.jtanks.push({x, y:groundY(x), hp:CHIHA.hp, max:CHIHA.hp, cool:rnd(1,3), dead:false, island:0, aim:Math.PI, flash:0}); }
        say('שלב 3: אוניית מערכה מגיעה להפגיז את החוף, וטנקים יוצאים להתקפת נגד!', 6); SFX.alarm();
      }
    }
    // the battleship shells the troops on the beach
    if(S.bs && !S.bs.dead && S.bs.x < is.x1 + 1500){
      S.shellT -= dt;
      const us = Gd.units.filter(u=>!u.dead);
      if(S.shellT <= 0 && us.length){
        const u = us[Math.floor(Math.random()*us.length)];
        boom(u.x + rnd(-20,20), u.y - 6, 40, true); SFX.noise(0.8, 500, 0.4);
        for(const o of us) if(Math.abs(o.x - u.x) < 34) hitUS(o, o.type==='tank' ? 45 : 12);
        S.shellT = rnd(4, 5.5);
      }
    }
    // the surprise: once the island is ours and the battleship is gone, an Emily raid heads for the carrier
    if(!S.emily && is.captured && S.bs && S.bs.dead){
      const x = is.x1 + 500;
      const em = {type:'emily', x, y:SEA-12, a:Math.PI, speed:0, full:110, hp:1300, max:1300, size:40, boxW:120, boxH:44, cool:0,
        guns:[{dx:-40,dy:-14},{dx:10,dy:16},{dx:52,dy:-6}], gcool:[0,0.4,0.8], dead:false, dir:-1, takeoff:{t:0, ground:SEA-12, water:true}, raid:true, bombs:6};
      G.enemies.push(em); G.boss = em; S.emily = em;
      for(let k=0;k<4;k++){ const z = {type:'zero', x:x + 120 + k*60, y:SEA - 160 - k*25, a:Math.PI, speed:240, full:240, hp:34+5*2, max:34+5*2, size:16, cool:1, burst:0, evade:0, dead:false, escort:em, eslot:k}; G.enemies.push(z); }
      S.stage = 'emily'; G.def.zeroEvery = 1e9;
      say('הפתעה! סירה מעופפת "אמילי" ממריאה עם ליווי וטסה להפציץ את הנושאת! הפל אותה', 6); SFX.alarm();
    }
    // stage 5: the Japanese carrier comes for revenge, launching fighters as it closes
    if(S.stage==='emily' && S.emily.dead){
      const jc = makeShip('jcarrier', G.L + 500, S.is.x1 + 1100, G.L + 500); jc.dir = -1; jc.speed = 14; G.ships.push(jc); S.jc = jc;
      G.def.zeroEvery = 18; G.zeroT = 6; S.stage = 'jcarrier';
      say('"אמילי" הופלה! אבל נושאת מטוסים יפנית מגיעה לנקום ומשגרת מטוסי זירו – הטבע אותה!', 6); SFX.alarm();
    }
    if(S.stage==='jcarrier' && S.jc.dead) specialEnd(true, 'הפלישה הצליחה! האי נכבש, אוניית המערכה ו"אמילי" הושמדו, והנושאת היפנית טבעה');
  },
  hud(S){
    const t = {aa:'שלב 1: השמד את הנ"מ באי', land:'שלב 2: לווה את הנחתת ותמוך בכוחות', battleship:'שלב 3: הטבע את אוניית המערכה והחזק את החוף', emily:'שלב 4: הפל את "אמילי" לפני שתפציץ את הנושאת!', jcarrier:'שלב 5: הטבע את הנושאת היפנית!'}[S.stage];
    const extra = S.stage==='aa' ? `נ"מ שנותרו: ${G.structures.filter(s=>!s.dead && s.type==='aa' && s.island===0).length}`
      : S.stage==='battleship' ? [S.bs.dead ? 'אוניית המערכה טבעה' : 'אוניית המערכה מפגיזה!', S.is.captured ? 'האי נכבש' : 'האי עדיין בקרב'].join(' · ')
      : S.stage==='emily' ? `"אמילי": ${pct(S.emily.hp, S.emily.max)} · נושאת: ${pct(G.carrier.hp, G.carrier.max)}`
      : S.stage==='jcarrier' ? `הנושאת היפנית: ${pct(S.jc.hp, S.jc.max)} · נושאת שלנו: ${pct(G.carrier.hp, G.carrier.max)}` : '';
    return [t, extra];
  },
  short: S => ({aa:'שלב 1/5', land:'שלב 2/5', battleship:'שלב 3/5', emily:'שלב 4/5', jcarrier:'שלב 5/5'})[S.stage]
}
};
