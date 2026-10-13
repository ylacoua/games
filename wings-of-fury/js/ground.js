// ---- "Ground Support": escort a US landing ship and its troops as they take three fortified islands ----
// A landing ship (LST) carrying 50 infantry and 5 Patton tanks sails from the carrier to each island in turn.
// Ashore, US troops fight their way across the island against entrenched infantry, Type 97 Chi-Ha tanks,
// bunkers and field guns. The player's job is close air support. When an island's defenders are wiped out a
// US flag is raised, the troops re-embark and the LST sails on. Island 2 is 20% stronger than island 1 and
// island 3 is 50% stronger than island 2. Losing the LST or every soldier and tank fails the mission.

const GROUND = {
  name:'סיוע לכוחות היבשה', mode:'ground',
  brief:'נחתת של צבא ארה"ב עם 50 חיילים ו-5 טנקי פטון יוצאת מהנושאת לכבוש שלושה איים מבוצרים. הפצץ את הבונקרים, התותחים, הטנקים והחיילים היפנים כדי שכוחות היבשה יוכלו לכבוש כל אי. האי השני חזק ב-20% מהראשון, והשלישי חזק ב-50% מהשני. אסור לאבד את הנחתת ואת כל הכוחות.',
  time:'day', rain:0, wind:8, storm:false, islands:0, ships:0, zeroEvery:16, bombers:false, boss:null, jcarrier:false, reward:6000
};

// unit stats: hp, weapon range, damage, seconds between shots, speed
const US_INF  = {hp:10,  range:110, dmg:3,  rate:1.1, speed:20};
const PATTON  = {hp:120, range:230, dmg:30, rate:2.6, speed:15};
const CHIHA   = {hp:80,  range:190, dmg:30, rate:2.8, speed:11};
const JP_INF  = {range:110, dmg:3, rate:1.2};
const BUNKER_MG = {range:180, dmg:3, rate:0.3};
const ARTY    = {range:760, rate:4.5};

function groundSetup(){
  G.L = 9800;
  // three islands, each stronger than the last (x1.0, x1.2, x1.8)
  const plan = [
    {x0:2500, w:1250, h:58, mult:1.0},
    {x0:5000, w:1450, h:62, mult:1.2},
    {x0:7600, w:1750, h:70, mult:1.8}
  ];
  plan.forEach((p,i)=>{
    const is = {x0:p.x0, x1:p.x0+p.w, h:p.h, slope:130, seed:rnd(0,9), palms:[], mult:p.mult, captured:false, flag:null};
    G.islands.push(is);
    const a = is.x0+is.slope+60, b = is.x1-is.slope-40;
    is.strip = {x0:a-20, x1:b+20};
    const n = k => Math.round(k*p.mult);
    // fortifications spread across the island, the strongest toward the far (inland) side
    const types = [];
    for(let k=0;k<n(4);k++) types.push('bunker');
    for(let k=0;k<n(2);k++) types.push('arty');
    for(let k=0;k<n(2);k++) types.push('aa');
    types.push('barracks','fuel');
    types.sort(()=>Math.random()-0.5);
    const step = (b-a)/types.length;
    types.forEach((t,k)=>{ const s = makeStruct(t, a + step*(k+0.5) + rnd(-step*0.15, step*0.15)); s.island = i; G.structures.push(s); });
    for(let q=0;q<Math.floor((b-a)/200);q++) is.palms.push({x:rnd(a,b), s:rnd(0.8,1.2)});
    // entrenched infantry and tanks
    for(let k=0;k<n(30);k++){ const x = rnd(a, b); G.soldiers.push({x, y:groundY(x), dir:1, speed:0, t:rnd(0,1), cool:rnd(0.5,2), dead:false, def:true, home:x, island:i}); }
    for(let k=0;k<n(3);k++){ const x = rnd(a+(b-a)*0.3, b); G.jtanks.push({x, y:groundY(x), hp:CHIHA.hp, max:CHIHA.hp, cool:rnd(1,3), dead:false, island:i, aim:Math.PI, flash:0}); }
  });
  G.ground = {phase:'sail', island:0, inf:50, tanks:5, units:[], shells:[], unloadT:0, flagT:0, endT:0,
    lst:{x:G.carrier.x + G.carrier.len + 200, hp:700, max:700, speed:36, ramp:0, flash:0}};
  say('הנחתת יוצאת לאי הראשון. הפצץ את ההגנות לפני שהכוחות יורדים לחוף', 5);
}

// ---------- helpers ----------
const usUnits = () => G.ground.units.filter(u=>!u.dead);
function islandOf(x){ return G.islands.findIndex(is=>x>=is.x0 && x<=is.x1); }
function jpForces(i){
  return {
    inf: G.soldiers.filter(s=>!s.dead && islandOf(s.x)===i).length,
    tanks: G.jtanks.filter(t=>!t.dead && t.island===i).length,
    posts: G.structures.filter(s=>!s.dead && s.island===i && (s.type==='bunker'||s.type==='arty'||s.type==='aa')).length
  };
}
function tracer(x1,y1,x2,y2,us){ G.fx.push({type:'tracer', x1, y1, x2, y2, c: us ? 'rgba(255,240,160,.9)' : 'rgba(255,150,90,.9)', t:0, max:0.08}); }
function hitUS(u, d){
  if(u.dead) return;
  u.hp -= d; u.flash = 0.1;
  if(u.hp<=0){ u.dead = true; if(u.type==='tank'){ boom(u.x, u.y-8, 30, true); G.debris.push({x:u.x,y:u.y-6,vx:rnd(-40,40),vy:-120,r:0,vr:3,life:2,c:'#4b5530'}); } }
}
function hitJPTank(t, d){
  if(t.dead) return;
  t.hp -= d; t.flash = 0.1;
  if(t.hp<=0){ t.dead = true; boom(t.x, t.y-8, 34, true); earn('chiha', t.x, t.y-10); }
}

// ---------- main update ----------
function groundUpdate(dt){
  const S = G.ground, L = S.lst, is = G.islands[S.island];
  L.flash = Math.max(0, L.flash - dt);
  const beachX = is ? is.x0 - 40 : L.x;

  if(S.phase==='sail'){
    L.ramp = Math.max(0, L.ramp - dt);
    if(L.x < beachX){ L.x = Math.min(beachX, L.x + L.speed*dt); if(Math.random()<dt*4) G.fx.push({type:'wake', x:L.x-80, y:SEA+2, t:0, max:1.5}); }
    else { S.phase = 'unload'; S.unloadT = 0; say(`הנחתת הגיעה לחוף האי ה${['ראשון','שני','שלישי'][S.island]}! הכוחות יורדים`, 4); }
  } else if(S.phase==='unload'){
    L.ramp = Math.min(1, L.ramp + dt);
    S.unloadT -= dt;
    if(L.ramp>=1 && S.unloadT<=0 && (S.inf>0 || S.tanks>0)){
      const tank = S.tanks>0 && (S.inf===0 || Math.random()<S.tanks/(S.tanks+S.inf)*1.6);
      const st = tank ? PATTON : US_INF, x = is.x0 + 30;
      S.units.push({type: tank?'tank':'inf', x, y:groundY(x), hp:st.hp, max:st.hp, cool:rnd(0.3,1.5), dead:false, t:rnd(0,1), off:rnd(-25,25), flash:0, aim:0, rf:rnd(0.45,1)});
      if(tank) S.tanks--; else S.inf--;
      S.unloadT = tank ? 0.9 : 0.18;
    }
    if(S.inf<=0 && S.tanks<=0) S.phase = 'assault';
  }
  if(S.phase==='assault' || S.phase==='unload'){
    const f = jpForces(S.island);
    if(f.inf + f.tanks + f.posts === 0 && usUnits().length){
      // island taken: raise the flag
      S.phase = 'flag'; S.flagT = 0; is.captured = true; is.flag = {t:0};
      for(const s of G.structures) if(s.island===S.island && !s.dead){ s.dead = true; }   // the rest is abandoned
      say(`האי ה${['ראשון','שני','שלישי'][S.island]} נכבש! דגל ארה"ב מונף`, 5); SFX.pickup();
      G.earned += 1000*(S.island+1);
    }
  } else if(S.phase==='flag'){
    S.flagT += dt; is.flag.t = Math.min(1, S.flagT/4);
    if(S.flagT > 5){
      if(S.island >= G.islands.length-1){ S.phase = 'won'; S.endT = 3; say('שלושת האיים נכבשו! ניצחון!', 5); }
      else { S.phase = 'load'; say('הכוחות חוזרים לנחתת וממשיכים לאי הבא', 4); }
    }
  } else if(S.phase==='load'){
    // survivors walk back to the beach and board; the LST then sails to the next island
    let left = 0;
    for(const u of S.units){
      if(u.dead) continue;
      if(u.x > is.x0 + 35){ u.x -= (u.type==='tank'?PATTON:US_INF).speed*1.6*dt; u.y = groundY(u.x); left++; }
      else { u.dead = true; u.boarded = true; if(u.type==='tank') S.tanks++; else S.inf++; }
    }
    if(left===0){ S.units = []; S.island++; S.phase = 'sail'; say('הנחתת יוצאת לאי הבא', 3); }
  } else if(S.phase==='won'){
    S.endT -= dt; if(S.endT<=0){ UI.result(true); return; }
  }

  updateUSUnits(dt);
  updateJPGround(dt);
  updateShells(dt);

  // failure checks
  if(L.hp <= 0 && S.phase!=='won'){ boom(L.x, SEA-10, 80, true); UI.result(false, 'הנחתת הוטבעה עם הכוחות.'); return; }
  if(S.phase!=='won' && S.phase!=='flag' && S.inf<=0 && S.tanks<=0 && usUnits().length===0 && S.phase!=='sail'){
    UI.result(false, 'כל כוחות היבשה האמריקאיים הושמדו.'); return;
  }
}

// US troops advance across the island and fight whatever is in range
function updateUSUnits(dt){
  const S = G.ground;
  if(S.phase==='load' || S.phase==='flag') return;
  for(const u of S.units){
    if(u.dead) continue;
    u.t += dt; u.cool -= dt; u.flash = Math.max(0, u.flash-dt); u.fireT = Math.max(0, (u.fireT||0)-dt);
    const st = u.type==='tank' ? PATTON : US_INF;
    // nearest enemy ahead or close behind: soldiers, Chi-Ha tanks, fortifications
    let tg=null, td=st.range;
    for(const s of G.soldiers){ if(s.dead) continue; const d=Math.abs(s.x-u.x); if(d<td){ td=d; tg={x:s.x, y:s.y-8, o:s, kind:'inf'}; } }
    for(const t of G.jtanks){ if(t.dead) continue; const d=Math.abs(t.x-u.x); if(d<td+(u.type==='tank'?30:0)){ td=d; tg={x:t.x, y:t.y-8, o:t, kind:'tank'}; } }
    for(const s of G.structures){ if(s.dead || s.island!==S.island || s.type==='light') continue; const d=Math.abs(s.x-u.x)-s.w/2; if(d<td){ td=d; tg={x:s.x, y:s.y-s.h/2, o:s, kind:'post'}; } }
    // keep spacing: don't walk into the man in front; stop at this unit's own preferred firing distance
    const crowded = u.type==='inf' && S.units.some(o=>o!==u && !o.dead && o.type==='inf' && o.x > u.x && o.x - u.x < 7);
    if(!crowded && !(tg && td < st.range*u.rf)){
      const front = G.islands[S.island].x1 - 60;
      if(u.x < front + u.off) u.x += st.speed*dt;
      u.y = groundY(u.x);
    }
    if(tg){
      u.aim = Math.atan2(tg.y-(u.y-10), tg.x-u.x);
      if(u.cool<=0){
        u.cool = st.rate*rnd(0.8,1.2); u.fireT = 0.08;
        tracer(u.x, u.y-(u.type==='tank'?11:10), tg.x, tg.y, true);
        if(u.type==='tank'){
          SFX.noise(0.25, 900, 0.12);
          boom(tg.x, tg.y, 18, false, true);
          if(tg.kind==='tank') hitJPTank(tg.o, st.dmg);
          else if(tg.kind==='post') hitStruct(tg.o, st.dmg, 'bomb');
          for(const s of G.soldiers) if(!s.dead && Math.abs(s.x-tg.x)<22) { if(Math.random()<0.7) killSoldier(s); }
        } else {
          if(Math.random()<0.3) SFX.noise(0.04, 2400, 0.03, 'bandpass', 3);
          if(tg.kind==='inf'){ if(Math.random()<0.25) killSoldier(tg.o); }
          else if(tg.kind==='tank') hitJPTank(tg.o, 0.6);
          else hitStruct(tg.o, 0.8, 'gun');
        }
      }
    }
  }
}

// Japanese side: entrenched infantry and bunkers shoot at US troops, Chi-Ha tanks counter-attack,
// field guns shell the landing ship and the troops
function updateJPGround(dt){
  const S = G.ground, us = usUnits();
  const nearestUS = (x, range)=>{ let b=null, bd=range; for(const u of us){ const d=Math.abs(u.x-x); if(d<bd){ bd=d; b=u; } } return b; };
  for(const s of G.soldiers){
    if(s.dead || s.aim != null) continue;                     // already busy shooting at a low aircraft
    s.gcool = (s.gcool ?? rnd(0.5,2)) - dt;
    const u = nearestUS(s.x, JP_INF.range);
    if(u && s.gcool<=0){
      s.gcool = JP_INF.rate*rnd(0.8,1.4); s.fireT = 0.07;
      if(u.type==='tank' && Math.abs(u.x-s.x) < 35 && Math.random() < 0.3){
        // close-in attack on a tank with an explosive charge
        boom(u.x, u.y-4, 16, false); hitUS(u, 22);
      } else { tracer(s.x, s.y-10, u.x, u.y-6, false); if(Math.random()<0.45) hitUS(u, u.type==='tank' ? 0.3 : JP_INF.dmg); }
    }
  }
  for(const t of G.jtanks){
    if(t.dead) continue;
    t.flash = Math.max(0, t.flash-dt); t.cool -= dt;
    const u = nearestUS(t.x, 520);
    if(u){
      const d = Math.abs(u.x-t.x);
      if(d > CHIHA.range*0.85){ t.x += Math.sign(u.x-t.x)*CHIHA.speed*dt; t.y = groundY(t.x); t.moving = true; }
      else t.moving = false;
      t.aim = Math.atan2(u.y-8-(t.y-9), u.x-t.x);
      if(d < CHIHA.range && t.cool<=0){
        t.cool = CHIHA.rate*rnd(0.85,1.2); t.fireT = 0.1;
        tracer(t.x, t.y-9, u.x, u.y-8, false); boom(u.x, u.y-6, 14, false, true); SFX.noise(0.2, 700, 0.08);
        hitUS(u, u.type==='tank' ? CHIHA.dmg : 10);
        for(const o of us) if(o!==u && o.type==='inf' && Math.abs(o.x-u.x)<16 && Math.random()<0.5) hitUS(o, 10);
      }
    } else t.moving = false;
  }
  for(const s of G.structures){
    if(s.dead) continue;
    s.gcool = (s.gcool ?? rnd(0.5,2)) - dt;
    if(s.type==='bunker'){
      const u = nearestUS(s.x, BUNKER_MG.range);
      if(u && s.gcool<=0){ s.gcool = BUNKER_MG.rate*rnd(0.8,1.3); tracer(s.x+6, s.y-s.h+11, u.x, u.y-6, false); if(Math.random()<0.5) hitUS(u, u.type==='tank' ? 0.3 : BUNKER_MG.dmg); }
    } else if(s.type==='arty'){
      // field gun: the landing ship while it is within reach, otherwise the troops
      if(s.gcool>0) continue;
      const L = S.lst; let tx=null, ty=null;
      if(Math.abs(L.x - s.x) < ARTY.range && S.phase!=='load'){ tx = L.x + rnd(-60,40); ty = SEA-14; }
      else { const tk = us.filter(u=>u.type==='tank' && Math.abs(u.x-s.x)<ARTY.range);   // guns go for the tanks first
        const u = tk.length ? tk[0] : nearestUS(s.x, ARTY.range); if(u){ tx = u.x + rnd(-18,18); ty = u.y-4; } }
      if(tx!=null){
        s.gcool = ARTY.rate*rnd(0.8,1.25);
        const T = 1.6, sx = s.x, sy = s.y-s.h+8;
        s.aim = Math.atan2(-1, Math.sign(tx-sx)||-1);
        S.shells.push({x:sx, y:sy, vx:(tx-sx)/T, vy:(ty-sy)/T - 0.5*300*T});
        SFX.noise(0.4, 600, 0.12); G.fx.push({type:'boom', x:sx-Math.sign(sx-tx)*20, y:sy-6, r:8, t:0, max:0.25});
      }
    }
  }
}

function updateShells(dt){
  const S = G.ground, L = S.lst;
  for(const sh of S.shells){
    sh.vy += 300*dt; sh.x += sh.vx*dt; sh.y += sh.vy*dt;
    const onShip = Math.abs(sh.x - L.x) < 75 && sh.y > SEA-26;
    if(onShip || sh.y >= groundY(sh.x)-2){
      sh.dead = true;
      if(onShip){ L.hp -= 30; L.flash = 0.15; boom(sh.x, SEA-16, 28, false); }
      else if(overSea(sh.x)) splash(sh.x);
      else { boom(sh.x, sh.y, 26, false); for(const u of usUnits()) if(Math.abs(u.x-sh.x)<38) hitUS(u, u.type==='tank' ? 35 : 10); }
    }
  }
  S.shells = S.shells.filter(s=>!s.dead);
}

// ---------- hooks used by the shared combat code ----------
// player's bombs/rockets: Chi-Ha tanks take blast damage too
function groundBlast(x, y, r, dmg){
  if(!G.ground) return;
  for(const t of G.jtanks) if(!t.dead && Math.abs(t.x-x) < r+12 && y > t.y-40) hitJPTank(t, dmg*0.9);
}
// player's guns against Chi-Ha tanks (armour shrugs most of it off)
function groundBulletHit(s){
  if(!G.ground) return false;
  for(const t of G.jtanks) if(!t.dead && Math.abs(s.x-t.x)<14 && s.y > t.y-16 && s.y < t.y+2){ s.life=0; hitJPTank(t, s.dmg*0.25); spark(s.x,s.y); return true; }
  return false;
}
// enemy bullets (strafing Zeros) against the landing ship and US troops
function groundFriendHit(s){
  if(!G.ground) return false;
  const L = G.ground.lst;
  if(Math.abs(s.x-L.x) < 75 && s.y > SEA-30 && s.y < SEA){ s.life=0; L.hp -= s.dmg*0.5; L.flash=0.1; spark(s.x,s.y); return true; }
  for(const u of usUnits()) if(Math.abs(s.x-u.x)<8 && s.y > u.y-14 && s.y < u.y+2){ s.life=0; hitUS(u, u.type==='tank' ? s.dmg*0.2 : s.dmg*2); return true; }
  return false;
}
// what a Zero with nothing in the air strafes: the landing ship at sea, or the troops ashore
function groundStrafeTarget(e){
  const S = G.ground, L = S.lst;
  const us = usUnits();
  const pt = (S.phase==='sail' || !us.length) ? {x:L.x, y:SEA-20} : us[Math.floor(us.length/2)];
  return {x:pt.x, y:(pt.y||SEA)-10, vx:0, vy:0, d:Math.hypot(pt.x-e.x, pt.y-e.y)};
}
