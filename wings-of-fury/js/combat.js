// ---- In-flight additions: kill streaks, daring-flight bonuses, damage to the player's systems, dead-stick
// landings, cloud cover, supply crates, new enemies and targets in the campaign, and the carrier's ordnance stock ----

// ---------- A1: kill streaks ----------
// Enemy aircraft the player shoots down within 4 s of each other build a streak; every kill after the first pays
// half its value again per step (double = +50%, triple = +100%...). Five in one sortie: "Ace in a day".
// Only the player's own fire counts (shots and bombs carry own:true; hurtEnemy sees e.byP from this frame).
const COMBO = {window: 4, labels: {2: 'הפלה כפולה!', 3: 'הפלה משולשת!', 4: 'הפלה מרובעת!'}};
// "+$100" inside Hebrew text: a left-to-right mark keeps the plus sign in front of the amount (not in English,
// where it is not needed and would get in the way of the translation lookup)
const plus$ = v => (isEn() ? '' : '‎') + '+$' + v;
function comboKill(e){
  const P = G.player, C = G.combo || (G.combo = {n: 0, last: -9, show: 0, text: ''});
  if(P.sortie == null) P.sortie = 0;
  C.n = G.time - C.last < COMBO.window ? C.n + 1 : 1; C.last = G.time;
  P.sortie++;
  const base = SCORE[e.type] || 100;
  if(C.n >= 2){
    const bonus = payout(Math.round(base*0.5*(C.n - 1)));
    G.earned += bonus; G.comboBonus = (G.comboBonus || 0) + bonus;
    banner(`${COMBO.labels[C.n] || `רצף של ${C.n} הפלות!`} ${plus$(bonus)}`);
    SFX.tone(520 + C.n*90, 900 + C.n*120, 0.22, 0.07, 'triangle');
  }
  if(P.sortie === 5 && !P.aceDay){
    P.aceDay = true; const b = payout(500); G.earned += b;
    banner(`אס ביום אחד! חמש הפלות בגיחה אחת ${plus$(b)}`, 3); SFX.pickup();
  }
  // a kill in the middle of a manoeuvre is worth a little extra
  if(P.br || P.loop || P.vl || P.mv) daring('הפלה בתמרון!', 100);
}
// a big line of gold text under the radar
function banner(text, t = 1.8){ const C = G.combo || (G.combo = {n: 0, last: -9}); C.text = text; C.show = t; C.max = t; }

// ---------- A2: daring flight ----------
function daring(text, v){
  const b = payout(v); G.earned += b; G.daringBonus = (G.daringBonus || 0) + b;
  const P = G.player; G.fx.push({type: 'text', x: P.x, y: P.y - 34, t: 0, max: 1.6, text: `${text} ${plus$(b)}`});
  SFX.tone(700, 1100, 0.12, 0.05, 'triangle');
}
function daringUpdate(dt){
  const P = G.player; if(P.dead || P.onDeck) return;
  const C = G.carrier, nearDeck = Math.abs(P.x - (C.x + C.len/2)) < 800;
  // skimming the waves: below about 130 ft over open sea, at speed, for 3 s
  if(overSea(P.x) && SEA - P.y < 45 && P.speed > 150 && !nearDeck){
    P.skim = (P.skim || 0) + dt;
    if(P.skim > 3 && !(P.skimCd > G.time)){ P.skimCd = G.time + 25; daring('טיסה על הגלים!', 150); }
  } else P.skim = 0;
  // a near miss: an enemy aircraft passing within a few metres
  for(const e of G.enemies){
    if(e.dead || e.takeoff || (e.nearCd || 0) > G.time) continue;
    if(dist2(e.x, e.y, P.x, P.y) < 30*30){ e.nearCd = G.time + 8; daring('כמעט התנגשות!', 50); }
  }
}

// ---------- A3 / A4: damage to the player's systems, dead-stick landing ----------
// A hit may also damage a system (heavier hits more likely): the engine (first hit: 20% less power and smoke,
// second: it stops - glide home), the controls (turns 30% slower) or a fuel tank (it leaks). The carrier's crew
// repairs everything on the next landing (a new aircraft has none of it).
const SYS_NAMES = {eng: 'מנוע', ctrl: 'הגאים', leak: 'מיכל דלק'};
function sysOf(P){ return P.sys || (P.sys = {eng: 0, ctrl: false, leak: false}); }
function hitSystem(P, d){
  if(P.dead || Math.random() > Math.min(0.3, d*0.012)) return;
  const S = sysOf(P), opts = [];
  if(S.eng < 2) opts.push('eng'); if(!S.ctrl) opts.push('ctrl'); if(!S.leak) opts.push('leak');
  if(!opts.length) return;
  const k = opts[Math.floor(Math.random()*opts.length)];
  if(k === 'eng'){
    S.eng++;
    if(S.eng === 2){ say('המנוע נדם! גלוש לנושאת ונחת בלי מנוע', 4); SFX.alarm(); radio('נושאת', 'המנוע שלך נדם – גלוש אלינו, אנחנו מוכנים', null); }
    else say('המנוע נפגע! פחות כוח', 2.5);
  } else if(k === 'ctrl'){ S.ctrl = true; say('ההגאים נפגעו! המטוס מגיב לאט יותר', 2.5); }
  else { S.leak = true; say('מיכל הדלק נפגע ודולף!', 2.5); }
  SFX.tone(300, 120, 0.25, 0.08, 'sawtooth');
}
const engK = P => !P.sys ? 1 : P.sys.eng >= 2 ? 0 : P.sys.eng === 1 ? 0.8 : 1;
const ctrlK = P => P.sys && P.sys.ctrl ? 0.7 : 1;
function systemsUpdate(dt){
  const P = G.player; if(P.dead || !P.sys) return;
  const S = P.sys;
  if(S.leak && P.fuel > 0){ P.fuel = Math.max(0, P.fuel - 1.4*dt); if(Math.random() < dt*6) G.fx.push({type: 'smoke', x: P.x, y: P.y + 4, c: 'rgba(190,200,210,.5)', s: 3, t: 0, max: 0.8, vx: 0, vy: 30}); }
  if(S.eng >= 1 && !P.onDeck && Math.random() < dt*(S.eng >= 2 ? 6 : 10)) puff(P.x + P.f*10, P.y - 2, S.eng >= 2 ? '#1c1a18' : '#3b3835', 7, 1.2);
  if(S.eng === 1 && Math.random() < dt*0.6) SFX.tone(90, 60, 0.15, 0.06, 'sawtooth');   // a cough from the hurt engine
}
// landing with no engine (stopped, or out of fuel): a bonus
function deadStickLanding(P){
  if(!((P.sys && P.sys.eng >= 2) || P.fuel <= 0)) return;
  const b = payout(500); G.earned += b; G.deadsticks = (G.deadsticks || 0) + 1;
  banner(`נחיתת חירום בלי מנוע! ${plus$(b)}`, 2.6); SFX.pickup();
}

// ---------- A5: cloud banks ----------
// A few big clouds in the play area itself (not the far background). Inside one, the player cannot be seen:
// Zeros lose him unless they are right on top of him, and AA cannot aim. The screen mists over while inside.
function makeCloudBanks(){
  const banks = [], n = Math.max(2, Math.round(G.L/2300));
  for(let i = 0; i < n; i++){
    const w = rnd(280, 420), h = rnd(80, 115), b = {x: 1500 + (i + rnd(0.2, 0.8))*(G.L - 1500)/n, y: rnd(-560, -40), w, h, puffs: []};
    for(let k = 0; k < 14; k++){ const a = Math.random()*Math.PI*2, r = Math.sqrt(Math.random()); b.puffs.push({dx: Math.cos(a)*r*w*0.42, dy: Math.sin(a)*r*h*0.38, r: rnd(0.28, 0.45)*h}); }
    banks.push(b);
  }
  return banks;
}
const inBank = (b, x, y, pad = 0) => ((x - b.x)/(b.w/2 + pad))**2 + ((y - b.y)/(b.h/2 + pad))**2 < 1;
function hiddenInCloud(x, y){ return !!(G.banks && G.banks.some(b => inBank(b, x, y))); }
// can an enemy at (ex, ey) see the player? (a cloud hides him unless the enemy is very close)
function playerHidden(ex, ey){
  const P = G.player; return !!(P && !P.dead && hiddenInCloud(P.x, P.y) && Math.hypot(ex - P.x, ey - P.y) > 140);
}
function cloudsUpdate(dt){
  if(G.banksL !== G.L){ G.banks = makeCloudBanks(); G.banksL = G.L; }   // built once the mission has set its length
  const P = G.player, inside = !P.dead && !P.onDeck && hiddenInCloud(P.x, P.y);
  G.cloudK = clamp((G.cloudK || 0) + (inside ? 2.5 : -2)*dt, 0, 1);
  if(inside && !G.cloudSaid){ G.cloudSaid = true; say('בתוך הענן – האויב לא רואה אותך', 2.5); }
  for(const b of G.banks || []) b.x += G.weather.wind*0.12*dt;
}
function drawCloudBanks(ctx){
  if(!G.banks) return;
  const W = G.weather, night = W.time === 'night', dusk = W.time === 'dusk' || W.time === 'dawn';
  const c = night ? '#3a4458' : W.rain > 0.5 ? '#8a939c' : dusk ? '#f0d2c4' : '#f4f7fa', shade = night ? '#262d3c' : W.rain > 0.5 ? '#626b74' : dusk ? '#b08b98' : '#c9d4df';
  const P = G.player, near = b => !P.dead && inBank(b, P.x, P.y, 60);
  for(const b of G.banks){
    const a = near(b) ? 0.5 : 0.9;                               // see-through while the player is in it
    for(const p of b.puffs) softSmoke(ctx, shade, b.x + p.dx, b.y + p.dy + p.r*0.25, p.r, a*0.8);
    for(const p of b.puffs) softSmoke(ctx, c, b.x + p.dx, b.y + p.dy, p.r*0.92, a);
  }
}
// the mist over the screen while inside a cloud (screen space)
function drawCloudMist(ctx, vw, vh){
  const k = G.cloudK || 0; if(k <= 0.01) return;
  const night = G.weather.time === 'night';
  ctx.fillStyle = night ? `rgba(40,48,64,${0.35*k})` : `rgba(235,240,245,${0.32*k})`; ctx.fillRect(0, 0, vw, vh);
}

// ---------- A6: supply crates ----------
// Now and then a crate comes down on a parachute ahead of the player. Fly through it for 30 s of: heavy rounds
// (double gun damage), boost (+25% speed), or at once: repair (all damage and systems), or ammunition.
const POWERS = {
  guns:   {name: 'תחמושת כבדה', t: 30, color: '#ff9a4a'},
  boost:  {name: 'מנוע מוגבר', t: 30, color: '#7fd0ff'},
  repair: {name: 'תיקון', t: 0, color: '#7fd08a'},
  ammo:   {name: 'תחמושת וחימוש', t: 0, color: '#f2c14e'}
};
function cratesUpdate(dt){
  const P = G.player; G.crates = G.crates || [];
  if(G.crateT == null) G.crateT = rnd(60, 100);
  if(!P.dead && !P.onDeck && P.x > 900){
    G.crateT -= dt;
    if(G.crateT <= 0){
      G.crateT = rnd(80, 130);
      const keys = Object.keys(POWERS), kind = keys[Math.floor(Math.random()*keys.length)];
      G.crates.push({x: P.x + P.f*rnd(550, 850), y: Math.min(P.y - 220, 60), kind, t: 0});
      say('ארגז אספקה צנח! טוס דרכו כדי לקבל אותו', 3);
    }
  }
  for(const c of G.crates){
    c.t += dt; c.y += 32*dt; c.x += G.weather.wind*0.5*dt;
    if(!P.dead && !P.onDeck && dist2(c.x, c.y, P.x, P.y) < 34*34){ c.got = true; takePower(c.kind); }
    if(c.y >= groundY(c.x) - 6){ c.gone = true; if(overSea(c.x)) G.fx.push({type: 'wsplash', x: c.x, t: 0, max: 0.8, h: 16, w: 6}); }
  }
  G.crates = G.crates.filter(c => !c.got && !c.gone);
  if(G.pow && (G.pow.t -= dt) <= 0) G.pow = null;
}
function takePower(kind){
  const P = G.player, p = POWERS[kind]; SFX.pickup();
  if(kind === 'repair'){ P.hp = P.max; P.sys = null; }
  else if(kind === 'ammo'){ P.ammo = Math.max(P.ammo, 500) + 200; P.ord = Math.min(P.ordMax, P.ord + 2); }
  else G.pow = {kind, t: p.t, max: p.t};
  banner(`📦 ${p.name}${p.t ? ` · ${p.t} שניות` : ''}`, 2.2);
}
const powGuns = () => G.pow && G.pow.kind === 'guns' ? 2 : 1;
const powBoost = () => G.pow && G.pow.kind === 'boost' ? 1.25 : 1;
function drawCrates(ctx){
  for(const c of G.crates || []){
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(Math.sin(c.t*1.7)*0.1);
    ctx.fillStyle = '#eeebe2'; ctx.beginPath(); ctx.arc(0, -26, 13, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = POWERS[c.kind].color; ctx.beginPath(); ctx.arc(0, -26, 13, Math.PI*1.4, Math.PI*1.6); ctx.lineTo(0, -26); ctx.fill();
    ctx.strokeStyle = 'rgba(40,40,40,.5)'; ctx.lineWidth = 0.7; ctx.beginPath();
    for(const s of [-1, -0.4, 0.4, 1]){ ctx.moveTo(s*13, -26); ctx.lineTo(0, -7); } ctx.stroke();
    ctx.fillStyle = '#6b5a3e'; ctx.fillRect(-7, -8, 14, 10); ctx.strokeStyle = '#3e3424'; ctx.strokeRect(-7, -8, 14, 10);
    ctx.fillStyle = '#f2efe6'; ctx.fillRect(-1.5, -7, 3, 8); ctx.fillRect(-6, -4.5, 12, 3);        // a white cross: supplies
    ctx.restore();
    // a soft glow so it can be found
    const g = ctx.createRadialGradient(c.x, c.y - 10, 0, c.x, c.y - 10, 40); g.addColorStop(0, 'rgba(255,240,180,.25)'); g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y - 10, 40, 0, 7); ctx.fill();
  }
}

// ---------- B1: new enemies in the campaign ----------
// Floatplanes (A6M2-N, mission 2 on) take off from the water between the islands; heavy fighters (J2M, mission
// 3 on) are a quarter of the Zeros launched: tougher, faster, dark green; kamikaze pairs (mission 4 on) cruise
// in high and dive onto the carrier.
const HEAVY_SKIN = {s: {top: '#2f3a2a', side: '#39442f', under: '#a9a68f', hi: 'rgba(200,210,170,.22)'}, wing: '#33402d', cowl: '#151515', fin: '#2f3a2a'};
const campaignOn = () => G && !G.special && !G.defense && !G.ground && !G.training && !G.tutorial;
function makeHeavy(e){ e.heavy = true; e.hp *= 2; e.max = e.hp; e.full += 25; e.skin = HEAVY_SKIN; e.big = 1.12; e.size = 18; return e; }
function campaignSpawns(dt){
  if(!campaignOn() || G.complete) return;
  const P = G.player, lvl = G.idx; if(P.dead || P.onDeck || P.x < 1200) return;
  // floatplanes
  if(lvl >= 1){
    if(G.rufeT == null) G.rufeT = rnd(40, 70);
    G.rufeT -= dt;
    if(G.rufeT <= 0 && G.islands.length > 1){
      G.rufeT = rnd(70, 100);
      const i = Math.floor(Math.random()*(G.islands.length - 1)), x = (G.islands[i].x1 + G.islands[i+1].x0)/2, dir = P.x < x ? -1 : 1;
      const e = {type: 'zero', float: true, x, y: SEA - 12, a: dir > 0 ? 0 : Math.PI, speed: 0, full: 205, hp: 28, max: 28, size: 16, cool: 1, burst: 0, evade: 0, dead: false,
        takeoff: {t: 0, ground: SEA - 12, water: true}};
      G.enemies.push(e); say('מטוס ימי יפני ממריא מהמים!', 2.5);
    }
  }
  // kamikaze pairs
  if(lvl >= 3){
    if(G.kamiT == null) G.kamiT = rnd(55, 80);
    G.kamiT -= dt;
    if(G.kamiT <= 0){
      G.kamiT = rnd(80, 110);
      const site = nearestSite(launchSites(), G.L);
      if(site){
        for(let k = 0; k < 2; k++){ const e = launchFrom(site, 'zero', k*1.4); e.forceKami = true; }
        say('קמיקזה! שני מטוסים ממריאים לצלול על הנושאת – יירט אותם!', 4); SFX.alarm();
        radio('נושאת', 'מטוסי קמיקזה בדרך אלינו! יירט אותם לפני שיגיעו', null);
      }
    }
  }
}
// floats under a floatplane, in the aircraft's own frame
function drawFloats(ctx, e){
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); if(Math.cos(e.a) < 0) ctx.scale(1, -1);
  ctx.strokeStyle = '#3c4237'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-1, 5); ctx.lineTo(-3, 11); ctx.moveTo(8, 5); ctx.lineTo(9, 11); ctx.stroke();
  ctx.fillStyle = e.flash > 0 ? '#fff' : '#b8b4a0'; ctx.beginPath(); ctx.ellipse(3, 12.5, 15, 2.8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#8d8a78'; ctx.fillRect(-12, 12.5, 26, 1.2);
  ctx.restore();
}

// ---------- B2: new targets in the campaign ----------
// A radar station on one island (mission 2 on): while it works, fighters launch 35% more often. Bombs on an
// island's airstrip crater it: no take-offs from there for 60 s. One destroyer per mission (mission 2 on) is a
// flak ship: three AA mounts that fire faster and further.
function campaignTargets(idx){
  if(idx < 1 || !G.islands.length) return;
  const is = G.islands[Math.min(G.islands.length - 1, 1 + Math.floor(Math.random()*Math.max(1, G.islands.length - 1)))], i = G.islands.indexOf(is);
  const xs = G.structures.filter(s => s.island === i).map(s => s.x), a = is.x0 + is.slope + 40, b = is.x1 - is.slope - 40;
  let best = a, gap = -1;                                       // the widest free spot on the island
  const pts = [a, ...xs.sort((p, q) => p - q), b];
  for(let k = 0; k < pts.length - 1; k++) if(pts[k+1] - pts[k] > gap){ gap = pts[k+1] - pts[k]; best = (pts[k] + pts[k+1])/2; }
  const r = makeStruct('radar', best); r.island = i; r.radarCamp = true; G.structures.push(r);
  const ds = G.ships.find(sh => sh.type === 'destroyer');
  if(ds){ ds.flak = true; ds.turrets = [-40, 20, 52].map(dx => ({dx, hp: 60, max: 60, cool: rnd(1, 3), dead: false})); }
}
const campaignRadarOn = () => campaignOn() && G.structures.some(s => s.radarCamp && !s.dead);
function stripCratered(is){ return is.strip && (is.strip.crater || 0) > G.time; }
// a bomb that bursts on an airstrip
function craterStrip(x, y, kind){
  if(kind !== 'bomb') return;
  for(const is of G.islands){
    const s = is.strip; if(!s || x < s.x0 || x > s.x1 || groundY(x) - y > 20) continue;
    const was = stripCratered(is);
    s.crater = G.time + 60; (s.holes = s.holes || []).push({x, t: G.time});
    if(!was) say('המסלול חורר! לא ימריאו ממנו מטוסים במשך דקה', 3);
  }
}
function drawCraters(ctx){
  for(const is of G.islands){
    const s = is.strip; if(!s || !s.holes) continue;
    for(const h of s.holes){
      if(G.time - h.t > 60) continue;
      const y = groundY(h.x);
      ctx.fillStyle = 'rgba(40,32,24,.85)'; ctx.beginPath(); ctx.ellipse(h.x, y + 1, 11, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(120,100,70,.8)'; ctx.fillRect(h.x - 14, y - 2, 4, 2); ctx.fillRect(h.x + 10, y - 2, 4, 2);
    }
  }
}

// ---------- B4: the carrier's ordnance stock ----------
// Each campaign mission starts with a limited magazine on the carrier; what is dropped is gone, what comes back
// on landing goes back to the magazine. An empty magazine cannot be chosen on deck. (Training, lessons: unlimited.)
const STOCK = {bomb: 26, rocket: 32, torpedo: 6};
function stockOn(){ return !!(G && !G.training && !G.tutorial); }
function stockInit(){ if(stockOn()) G.stock = {bomb: STOCK.bomb + G.idx*2, rocket: STOCK.rocket + G.idx*2, torpedo: STOCK.torpedo + (G.idx >= 2 ? 2 : 0)}; }
// load an aircraft from the magazine (on take-off / after landing); returns what it gets
function stockLoad(type, want){
  if(!G.stock) return want;
  const n = Math.min(want, G.stock[type]); G.stock[type] -= n; return n;
}
// what an aircraft brings back goes back on the shelf
function stockReturn(type, n){ if(G.stock && n > 0) G.stock[type] += n; }

// ---------- per-frame driver and HUD ----------
function combatUpdate(dt){
  if(!G || G.tutorial) return;
  daringUpdate(dt); systemsUpdate(dt); cloudsUpdate(dt); cratesUpdate(dt); campaignSpawns(dt);
  if(G.combo && G.combo.show > 0) G.combo.show -= dt;
}
function drawCombatHUD(ctx, vw){
  const P = G.player;
  ctx.save(); ctx.textBaseline = 'middle';
  // the streak / bonus banner
  const C = G.combo;
  if(C && C.show > 0){
    const k = C.show/C.max, pop = 1 + Math.max(0, (k - 0.85)/0.15)*0.25;
    ctx.globalAlpha = Math.min(1, C.show*2); ctx.textAlign = 'center';
    ctx.font = `${Math.round(26*pop)}px "Secular One", Rubik, sans-serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,12,4,.7)'; const by = G.special || G.ground ? 140 : 112;                 // below a special mission's status lines
    ctx.strokeText(C.text, vw/2, by); ctx.fillStyle = '#ffd24a'; ctx.fillText(C.text, vw/2, by);
    ctx.globalAlpha = 1;
  }
  // systems and power-up, under the aircraft panel on the right
  const items = [];
  if(P.sys){ if(P.sys.eng >= 2) items.push(['מנוע: נדם', '#ff6b4a']); else if(P.sys.eng) items.push(['מנוע: פגוע', '#ffb04a']);
    if(P.sys.ctrl) items.push(['הגאים: פגועים', '#ffb04a']); if(P.sys.leak) items.push(['דליפת דלק', '#ffb04a']); }
  if(G.pow) items.push([`${POWERS[G.pow.kind].name}: ${Math.ceil(G.pow.t)}`, POWERS[G.pow.kind].color]);
  if(G.stock && !P.dead) items.push([`במלאי הנושאת: ${G.stock[P.ordType]} ${ORD[P.ordType].name}`, 'rgba(239,230,207,.75)']);
  if(items.length){
    ctx.font = '12px Rubik, sans-serif'; ctx.textAlign = 'right'; ctx.direction = 'rtl';
    ctx.fillStyle = 'rgba(8,16,28,.5)'; ctx.fillRect(vw - 182, 116, 170, 6 + items.length*17);
    items.forEach(([t, c], i) => { ctx.fillStyle = c; ctx.fillText(t, vw - 20, 126 + i*17); });
  }
  ctx.restore();
}
