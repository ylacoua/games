// ---- Automated tests (run by tests.html) ----
// Every mission is launched and played in fast simulation; "cheats" stand in for the player (they knock out
// whatever the objective needs), so what is tested is the mission logic, its phases, win/lose conditions, the
// result screen, stars and skins - plus a few unit checks. Nothing is written to the real save.

const TESTS = [];
const test = (name, fn) => TESTS.push({name, fn});

// ---------- helpers ----------
storeSave = () => {};                                        // never touch the player's saved game
function freshSave(diffKey='normal'){ SAVE = defaultSave(); SAVE.money = 1e6; SAVE.unlocked = LEVELS.length; SAVE.difficulty = diffKey; }
function launch(key, o={}){
  G = null; for(const k in keys) keys[k] = false;
  UI.lo = {plane:o.plane||'hellcat', ord:o.ord||'bomb', wing:o.wing||[]}; UI.level = key;
  if(typeof key==='string' && key.startsWith('lesson')) startLesson(+key.slice(6));
  else if(key==='training'){ UI.tr = null; UI.trainingHangar(); UI.act('tlaunch'); }
  else UI.act('launch');
  UI.hide();
  if(!G) throw new Error('המשימה לא הושקה');
  return G;
}
function fly(x, y){ const P = G.player; P.onDeck = false; G.state = 'fly'; P.x = x ?? (G.carrier.x + 800); P.y = y ?? 150; P.speed = 230; P.throttle = 0.85; P.gear = 0; P.gearWant = 0; P.airT = 10; }
function god(){ const P = G.player; P.inv = 99; P.hp = P.max; P.fuel = P.maxFuel; P.ammo = 500; }
// run the simulation: step(t) is called every frame (return true to stop); renders now and then to catch drawing errors
async function sim(secs, step, renderEvery=20){
  for(let i=0; i<secs*60; i++){
    const t = i/60;
    if(step && step(t)) break;
    update(1/60, 1200);
    if(renderEvery && i % renderEvery === 0) render(ctx, CW || 320, CH || 180);
    if(!G || G.state==='over') break;
    if(i % 900 === 899) await new Promise(r => setTimeout(r, 0));   // keep the page responsive
  }
}
function land(){
  const P = G.player, C = G.carrier;
  if(C.burning) C.burning = 0;
  P.onDeck = false; P.dead = false; G.state = 'fly'; P.x = C.x + 200; P.y = DECK_Y - 12; P.p = 0; P.speed = 150; P.f = 1; P.throttle = 0; P.gear = 1; P.airT = 10; P.inv = 0;
  for(let i=0; i<400 && G.state!=='rearm'; i++) update(1/60, 1200);
  if(G.state!=='rearm') throw new Error('הנחיתה על הנושאת נכשלה');
  if(!document.querySelector('[data-act="finish"]')) throw new Error('אין כפתור "סיים משימה" אחרי הנחיתה');
  UI.act('finish');
}
const resultTitle = () => (document.querySelector('#ui h1') || {}).textContent || '';
const resultStars = () => (document.querySelector('#ui .stars-res .big') || {}).textContent || '';
const won = () => /הושלמה|ניצחון/.test(resultTitle());
const killPlanes = (keepAce) => { for(const e of G.enemies) if(!e.dead && !(keepAce && e.ace)){ e.hp = 0; hurtEnemy(e, 1); } };
const killShip = sh => { if(!sh.dead){ sh.hp = 0; hitShip(sh, 1, 'gun', sh.x + 99999); } };
const killStructs = f => { for(const s of G.structures) if(!s.dead && !s.hidden && (!f || f(s))) hitStruct(s, 99999, 'bomb'); };
const assert = (cond, msg) => { if(!cond) throw new Error(msg); };
const winInfo = () => `${resultTitle()} ${resultStars()}`.trim();

// ---------- unit checks ----------
test('שמירה ישנה משודרגת עם כל השדות החדשים', async () => {
  const old = {money:500, owned:{hellcat:true}, plane:'hellcat', up:{engine:0,armor:0,guns:0,payload:0,fuel:0}, unlocked:2, best:{0:true}};
  const s = Object.assign(defaultSave(), old);
  assert(s.skins && s.skins.standard && s.skin==='standard' && s.won && s.difficulty==='normal', 'חסרים שדות בשמירה');
  return 'skins, skin, won, difficulty – קיימים';
});
const LEVELS_D = Object.keys(DIFFICULTY);                   // easy, normal, hard, expert
test('רמות קושי: נזק, עמידות אויבים, מטוסים, תיקון ותגמול', async () => {
  const loss = {}, zhp = {}, shp = {};
  for(const k of LEVELS_D){
    freshSave(k); launch(0); fly(); const P = G.player; P.inv = 0; const hp0 = P.hp; damagePlayer(10); loss[k] = hp0 - P.hp;
    assert(G.lives === Math.max(2, 5 + DIFFICULTY[k].lives), `מספר מטוסים שגוי ב-${k}`);
    const z = launchFrom({kind:'island', x:G.islands[0].strip.x0, is:G.islands[0]}, 'zero'); update(1/60, 1200); zhp[k] = z.max;
    shp[k] = G.structures.find(s=>s.type==='bunker').max;
  }
  for(let i=1;i<LEVELS_D.length;i++){
    const a = LEVELS_D[i-1], b = LEVELS_D[i];
    assert(loss[a] < loss[b], `נזק לא מדורג: ${JSON.stringify(loss)}`);
    assert(zhp[a] < zhp[b], `עמידות זירו לא מדורגת: ${JSON.stringify(zhp)}`);
    assert(shp[a] < shp[b], `עמידות מבנים לא מדורגת: ${JSON.stringify(shp)}`);
  }
  // expert: landing repairs only half of the damage
  freshSave('expert'); launch(0); fly(); G.player.hp = G.player.max*0.2; UI.crashed = false; UI.act('takeoff');
  assert(Math.abs(G.player.hp/G.player.max - 0.6) < 0.01, 'תיקון חלקי ברמת מומחה לא עובד');
  // outside a mission the menu setting counts; inside one, the difficulty it was started on
  G = null; freshSave('hard'); assert(payout(1000) === 1500, 'תגמול ברמה קשה'); freshSave('easy'); assert(payout(1000) === 750, 'תגמול ברמה קלה');
  launch(0); SAVE.difficulty = 'hard'; assert(payout(1000) === 750, 'שינוי רמת קושי באמצע משימה השפיע עליה'); G = null;
  return LEVELS_D.map(k=>`${DIFFICULTY[k].name}: נזק ${loss[k].toFixed(1)}, זירו ${Math.round(zhp[k])}, בונקר ${shp[k]}`).join(' · ');
});
// a pilot who never evades or shoots back, circling over the first island: how long does he last?
test('רמות קושי: זמן הישרדות של טייס פסיבי יורד מרמה לרמה', async () => {
  const pilot = (P, alt) => { for(const k in keys) keys[k] = false; keys.KeyW = true;
    const want = clamp((P.y - alt)/150, -0.35, 0.35);
    if(!P.loop && !P.vl && !P.mv){ if(P.p < want-0.04) keys.ArrowUp = true; else if(P.p > want+0.04) keys.ArrowDown = true; }
    const is = G.islands[0]; if(P.x > is.x1+250 && P.f>0 && !P.loop) keys.ArrowLeft = true; if(P.x < is.x0-350 && P.f<0 && !P.loop) keys.ArrowRight = true; };
  const sec = {};
  for(const k of LEVELS_D){
    freshSave(k); launch(3); fly(G.islands[0].x0 - 300, 280); let t = 0;
    await sim(180, tt => { t = tt; const P = G.player; if(P.dead) return true; P.fuel = P.maxFuel; pilot(P, 280); }, 0);
    sec[k] = t; for(const kk in keys) keys[kk] = false;
  }
  for(let i=1;i<LEVELS_D.length;i++) assert(sec[LEVELS_D[i]] < sec[LEVELS_D[i-1]], `לא מדורג: ${JSON.stringify(sec)}`);
  return LEVELS_D.map(k=>`${DIFFICULTY[k].name}: ${sec[k].toFixed(0)} שנ'`).join(' · ') + ' (משימה 4)';
});
test('שפה: באנגלית אין עברית בתפריטים ובתצוגת הטיסה, והכיוון משמאל לימין', async () => {
  const HEB = /[֐-׿]/, left = new Set(), tick = () => new Promise(r => setTimeout(r, 0));
  const scan = () => { const w = document.createTreeWalker(UI.root, NodeFilter.SHOW_TEXT); let t;
    while((t = w.nextNode())) if(HEB.test(t.nodeValue) && !t.parentElement.closest('[data-notr]')) left.add(t.nodeValue.trim()); };
  const C = CanvasRenderingContext2D.prototype, fill = C.fillText;
  C.fillText = function(t, ...a){ if(typeof t==='string' && HEB.test(tr(t))) left.add('קנבס: ' + tr(t)); return fill.call(this, t, ...a); };
  try{
    freshSave(); setLang('en');
    assert(document.documentElement.dir==='ltr', 'הכיוון לא התחלף ל-ltr');
    for(const p of ['tut','camp','extra','keys']){ UI.homePanel = p; G = null; UI.mainMenu(); await tick(); scan(); }
    const keysL = [...LEVELS.keys(), 'def', 'gnd', ...Object.keys(SPECIALS)];
    for(const k of keysL){
      G = null; UI.briefing(k); await tick(); scan(); UI.act('hangar', String(k)); await tick(); scan();
      for(const t of ['planes','upgrades','skins']){ UI.tab = t; UI.hangar(k); await tick(); scan(); }
      launch(k); fly(); await sim(8, () => god(), 6);
    }
    launch(0); fly(); killStructs(); for(const sh of G.ships) killShip(sh);
    await sim(60, () => { god(); if(G.counter) for(const e of G.counter) if(!e.dead){ e.hp = 0; hurtEnemy(e, 1); } return G.complete; });
    land(); await tick(); scan();
    assert(/Mission complete|Victory/.test(resultTitle()), 'מסך הסיום לא באנגלית: ' + resultTitle());
    assert(!left.size, 'נשארה עברית: ' + [...left].slice(0, 6).join(' | '));
    setLang('he'); G = null; UI.homePanel = null; UI.mainMenu(); await tick();
    assert(document.documentElement.dir==='rtl' && /כנפי הרעם/.test(UI.root.textContent), 'החזרה לעברית נכשלה');
  } finally { C.fillText = fill; SAVE.lang = 'he'; applyLang(); }
  return 'כל המסכים, ' + Object.keys(LANG_EN).length + ' מחרוזות במילון';
});
test('שיירה: מטוסי הכנף בתקיפה חופשית מטביעים סירות וצוללות', async () => {
  freshSave(); launch('convoy', {wing:['wildcat','helldiver','helldiver']}); fly(); G.wingMode = 'attack';
  const S = G.special, P = G.player; let boats = 0, subs = 0;
  const hb = hurtBoat, hs = hurtSub;
  hurtBoat = (b, d) => { const was = b.dead; hb(b, d); if(!was && b.dead) boats++; };
  hurtSub  = (b, d) => { const was = b.dead; hs(b, d); if(!was && b.dead) subs++; };
  try{
    // the player stays high above the convoy and does not fire: every kill is the wingmen's
    await sim(110, () => { god(); P.ammo = 0; P.ord = 0; P.x = Math.max(...S.convoy.map(s=>s.x)); P.y = -900; P.a = 0; return !!G.special.endT; }, 0);
  } finally { hurtBoat = hb; hurtSub = hs; }
  assert(boats > 0, 'מטוסי הכנף לא הטביעו אף סירה');
  assert(subs > 0, 'המפציצים לא השמידו אף צוללת');
  return `${boats} סירות, ${subs} צוללות`;
});
test('סקינים: נפתחים בניצחון ונקנים', async () => {
  freshSave(); assert(!skinUnlocked('olive'), 'סקין פתוח לפני ניצחון');
  SAVE.best[0] = true; assert(skinUnlocked('olive'), 'הסקין לא נפתח אחרי ניצחון');
  UI.lo = {plane:'hellcat', ord:'bomb', wing:[]}; UI.level = 0; UI.tab = 'skins';
  const m = SAVE.money; UI.act('buyskin', 'olive');
  assert(SAVE.skins.olive && SAVE.skin==='olive' && SAVE.money === m - SKINS.olive.price, 'הקנייה נכשלה');
  UI.act('buyskin', 'blueangels'); assert(!SAVE.skins.blueangels, 'אפשר לקנות סקין נעול');
  return `${Object.keys(SKINS).length} סקינים`;
});

// ---------- every mission starts and runs (on every difficulty) ----------
const ALL = [...LEVELS.map((_,i)=>i), 'def', 'gnd', ...SPECIAL_ORDER];
test('כל המשימות עולות ורצות 25 שניות בלי שגיאות (×4 רמות קושי)', async () => {
  let n = 0;
  for(const d of LEVELS_D) for(const k of ALL){
    freshSave(d); launch(k, {wing: (SPECIALS[k] && SPECIALS[k].noWing) ? [] : ['wildcat','helldiver']}); fly();
    await sim(25, t => { god(); keys.Space = (t*60|0) % 90 < 30; });
    keys.Space = false; n++;
  }
  return `${n} הרצות`;
});
test('שיעורי ההדרכה והאימון החופשי', async () => {
  for(let i=0;i<LESSONS.length;i++){ freshSave(); launch('lesson'+i); await sim(15, () => god()); }
  freshSave(); launch('training'); fly(); await sim(15, () => god());
  return `${LESSONS.length} שיעורים + אימון`;
});

// ---------- winning every mission ----------
for(const idx of LEVELS.map((_,i)=>i)) test(`קמפיין ${idx+1}: מטרות → מתקפת נגד → נחיתה → ניצחון`, async () => {
  freshSave(); launch(idx); fly();
  killStructs(); for(const sh of G.ships) killShip(sh); if(G.boss && !G.boss.dead){ G.boss.hp = 0; hurtEnemy(G.boss, 1); }
  let sawCounter = false;
  await sim(60, () => { god();
    if(G.def.boss==='emily' && G.boss && !G.boss.dead && !G.boss.takeoff){ G.boss.hp = 0; hurtEnemy(G.boss, 1); }
    if(G.def.boss==='emily' && !G.bossSpawned) G.player.x = G.L*0.5;
    for(const sh of G.ships) killShip(sh);
    if(G.counter){ sawCounter = true; for(const e of G.counter) if(!e.dead){ e.hp = 0; hurtEnemy(e, 1); } }
    return G.complete; });
  assert(sawCounter, 'מתקפת הנגד לא יצאה');
  assert(G.complete, 'המשימה לא הסתיימה אחרי מתקפת הנגד');
  land(); assert(won(), 'אין מסך ניצחון: ' + resultTitle());
  return winInfo();
});
test('הגנה על הנושאת: 10 גלים → מתקפת נגד → ניצחון', async () => {
  freshSave(); launch('def'); fly();
  await sim(400, () => { god(); const D = G.defense;
    if(D.phase===1){ if(D.state==='between') D.t = Math.min(D.t, 0.2); D.spawnT = 0; killPlanes(); }
    else { for(const sh of G.ships) killShip(sh); killPlanes(); }
    return G.complete; }, 60);
  assert(G.defense.phase===2 && G.complete, `נתקע בגל ${G.defense.wave}`);
  land(); assert(won(), resultTitle()); return winInfo();
});
test('סיוע לכוחות היבשה: שלושת האיים נכבשים', async () => {
  freshSave(); launch('gnd'); fly();
  await sim(900, t => { god(); const S = G.ground;
    if(S.phase==='assault' || S.phase==='unload'){
      if(Math.random() < 0.15){ const so = G.soldiers.find(s=>!s.dead && islandOf(s.x)===S.island); if(so) killSoldier(so); }
      if(Math.random() < 0.05){ const tk = G.jtanks.find(k=>!k.dead && k.island===S.island); if(tk) hitJPTank(tk, 999); }
      if(Math.random() < 0.05){ const s = G.structures.find(s=>!s.dead && s.island===S.island); if(s) hitStruct(s, 99999, 'bomb'); }
    }
    killPlanes(); }, 60);
  assert(won(), `לא נכבש – שלב ${G.ground.phase}, אי ${G.ground.island+1}`); return winInfo();
});

const specialWin = (id, secs, step, needLand) => test(`משימה מיוחדת "${SPECIALS[id].name}": כל השלבים → ניצחון`, async () => {
  freshSave(); launch(id); fly();
  const log = [];
  await sim(secs, t => { god(); const r = step(G.special, t, G.player); if(r && log[log.length-1]!==r) log.push(r); return needLand && G.complete; }, 30);
  if(needLand){ assert(G.complete, 'השלב האחרון לא הושלם'); land(); }
  assert(won(), (G.special.reason || resultTitle() || 'לא הסתיים') + ' · ' + log.join(' → '));
  return winInfo() + (log.length ? ' · ' + log.join(' → ') : '');
});
specialWin('rescue', 300, S => { for(const b of S.boats) hurtBoat(b, 999); for(const so of G.soldiers) if(!so.dead) killSoldier(so); killPlanes(); if(S.cur===1) return 'טייס 2'; });
specialWin('dark', 60, S => { killStructs(s=>s.type==='radar' || s.type==='light'); if(S.truck && !S.truck.dead){ SPECIALS.dark.hitTruck(S, 999); } killPlanes(); if(S.truck) return 'משאית מכ"ם'; }, true);
specialWin('convoy', 340, S => { for(const b of S.boats) hurtBoat(b, 999); for(const sb of S.subs) hurtSub(sb, 999); S.torps.length = 0; killPlanes();
  if(S.bs) killShip(S.bs); if(S.mineWarn){ for(const m of S.mines) if(!m.dead) SPECIALS.convoy.blowMine(m); return 'מוקשים'; } });
specialWin('bridge', 260, (S) => { killPlanes(); const T = S.train;
  if(T && T.ph==='run' && T.x < S.bridge.x1 - 20 && !S.bridge.dead){ explode((S.bridge.x0+S.bridge.x1)/2, S.bridge.y, 50, 300, 'p', 'bomb'); }
  if(S.phase2==='pontoon' && S.pont.prog > 0.3){ explode(S.vc, groundY(S.vc)-5, 50, 200, 'p', 'bomb'); return 'גשר צף'; }
  if(S.phase2==='home') return 'חזרה'; }, true);
specialWin('clock', 60, (S, t, P) => { const hf = S.fields.find(f=>f.hidden); if(hf){ P.x = (hf.is.x0+hf.is.x1)/2; P.y = groundY(P.x) - 150; return 'סיור'; } killStructs(); killPlanes(); });
specialWin('ace', 240, S => { if(S.round===1 && S.wings) for(const z of S.wings) if(!z.dead){ z.hp = 0; hurtEnemy(z, 1); }
  const e = S.ace; if(e && !e.dead && !e.retreat && G.enemies.includes(e) && !e.takeoff){ e.hp = 0; hurtEnemy(e, 1); return 'סיבוב ' + S.round; } });
specialWin('burning', 260, (S, t) => { if(t > 100) killPlanes(); }, true);
specialWin('assault', 600, (S, t) => {
  if(S.stage==='aa') killStructs(s=>s.type==='aa');
  if(t > 30){ if(Math.random()<0.08){ const so=G.soldiers.find(s=>!s.dead); if(so) killSoldier(so); }
    if(Math.random()<0.03){ const tk=G.jtanks.find(k=>!k.dead); if(tk) hitJPTank(tk, 999); }
    if(Math.random()<0.03){ const s=G.structures.find(s=>!s.dead && s.island===0); if(s) hitStruct(s, 99999, 'bomb'); } }
  if(S.bs) killShip(S.bs);
  if(S.emily && !S.emily.dead && !S.emily.takeoff){ S.emily.hp = 0; hurtEnemy(S.emily, 1); }
  if(S.jc) killShip(S.jc);
  return 'שלב ' + S.stage; });

// ---------- losing ----------
test('הפסד: כל המטוסים אבדו בקמפיין', async () => {
  freshSave(); launch(0); fly();
  await sim(200, () => { const P = G.player; if(!P.dead && !P.onDeck) crashPlayer('בדיקה'); if(G.state==='rearm') UI.act('takeoff'); if(P.onDeck) fly(); }, 0);
  assert(/נכשלה/.test(resultTitle()), resultTitle() || 'לא הסתיים'); return resultTitle();
});
test('הפסד: הטייס שבמים נהרג כשלא מגינים עליו', async () => {
  freshSave(); launch('rescue'); fly();
  await sim(120, () => god(), 0);
  assert(/נכשלה/.test(resultTitle()), resultTitle() || 'לא הסתיים'); return G.special.reason;
});
test('הפסד: הגשר הצף מושלם', async () => {
  freshSave(); launch('bridge'); fly();
  await sim(260, () => { god(); killPlanes(); const S = G.special, T = S.train;
    if(T && T.ph==='run' && T.x < S.bridge.x1 - 20 && !S.bridge.dead) explode((S.bridge.x0+S.bridge.x1)/2, S.bridge.y, 50, 300, 'p', 'bomb'); }, 0);
  assert(/נכשלה/.test(resultTitle()), resultTitle() || 'לא הסתיים'); return G.special.reason;
});

// ---------- performance ----------
test('ביצועים: זמן ציור בפלישה הגדולה (שיא העומס)', async () => {
  freshSave(); launch('assault'); fly(3800, 250);
  await sim(70, t => { god(); if(G.special.stage==='aa') killStructs(s=>s.type==='aa'); }, 0);
  const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900; const c = cv.getContext('2d');
  const t0 = performance.now(); for(let i=0;i<60;i++){ update(1/60, 1200); render(c, 1600, 900); } const ms = (performance.now() - t0)/60;
  const objects = G.soldiers.length + G.jtanks.length + G.enemies.length + G.ground.units.length + G.fx.length;
  assert(ms < 40, `פריים איטי מדי: ${ms.toFixed(1)}ms`);
  return `${ms.toFixed(1)}ms לפריים (עדכון + ציור, 1600×900) · ${objects} עצמים`;
});

// ---------- runner ----------
async function runAllTests(){
  const rows = document.getElementById('rows'), sum = document.getElementById('summary');
  const results = []; let pass = 0, fail = 0;
  const t00 = performance.now();
  for(const [i, tc] of TESTS.entries()){
    const tr = document.createElement('tr'); tr.innerHTML = `<td class="st run">…</td><td>${tc.name}</td><td class="info"></td><td class="ms"></td>`; rows.appendChild(tr);
    sum.textContent = `רץ ${i+1} מתוך ${TESTS.length}: ${tc.name}`;
    await new Promise(r => setTimeout(r, 0));
    const t0 = performance.now(); let ok = true, info = '';
    try{ info = await tc.fn() || ''; }catch(e){ ok = false; info = e.message + '\n' + (e.stack||'').split('\n').slice(1,3).join('\n'); }
    const ms = performance.now() - t0;
    ok ? pass++ : fail++;
    results.push({name:tc.name, ok, info, ms:Math.round(ms)});
    tr.cells[0].className = 'st ' + (ok ? 'ok' : 'bad'); tr.cells[0].textContent = ok ? '✔' : '✘';
    tr.cells[2].innerHTML = ok ? info : `<pre>${info.replace(/</g,'&lt;')}</pre>`;
    tr.cells[3].textContent = (ms/1000).toFixed(1) + 's';
  }
  G = null;
  const secs = ((performance.now() - t00)/1000).toFixed(0);
  sum.innerHTML = fail ? `<span class="bad">✘ ${fail} נכשלו</span> · ${pass} עברו · ${secs} שניות` : `<span class="ok">✔ כל ${pass} הבדיקות עברו</span> · ${secs} שניות`;
  window.__testsDone = {pass, fail, results};
}
