// ---- Automated tests (run by tests.html) ----
// Every mission is launched and played in fast simulation; "cheats" stand in for the player (they knock out
// whatever the objective needs), so what is tested is the mission logic, its phases, win/lose conditions, the
// result screen, stars and skins - plus a few unit checks. Nothing is written to the real save.

const TESTS = [];
const test = (name, fn) => TESTS.push({name, fn});

// ---------- helpers ----------
const realStoreSave = storeSave;                             // tested only against a fake storage
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
test('שמירה: גרסה, שדות חסרים בעומק, גיבוי ושחזור משמירה פגומה', async () => {
  const store = {d:{}, getItem(k){ return k in this.d ? this.d[k] : null; }, setItem(k, v){ this.d[k] = String(v); }};
  // a v1 save (no version) from before a new upgrade existed: `up.fuel` and `shake` must be filled in
  store.d[SAVE_KEY] = JSON.stringify({money:700, owned:{hellcat:true, corsair:true}, plane:'corsair', up:{engine:2, armor:1, guns:0, payload:0}, unlocked:3, best:{0:true}});
  let s = loadSave(store);
  assert(s.version === SAVE_VERSION && s.money === 700 && s.up.engine === 2 && s.up.fuel === 0 && s.owned.corsair, 'המרת שמירה ישנה נכשלה');
  assert(typeof s.shake === 'number' && typeof s.flashes === 'boolean' && s.skins.standard, 'חסרות הגדרות אפקטים בשמירה ישנה');
  // a field of the wrong type falls back to its default instead of breaking the game
  store.d[SAVE_KEY] = JSON.stringify({version:2, money:'oops', owned:{hellcat:true}, up:null});
  s = loadSave(store);
  assert(s.money === 0 && s.up.engine === 0, 'שדה פגום לא הוחלף בברירת מחדל');
  // two writes: the first good save becomes the backup; a damaged main save then loads the backup
  const keep = SAVE;
  try{
    store.d = {};
    SAVE = defaultSave(); SAVE.money = 111; realStoreSave(store);
    SAVE = defaultSave(); SAVE.money = 222; realStoreSave(store);
    assert(JSON.parse(store.d[SAVE_KEY + '.bak']).money === 111, 'לא נשמר גיבוי');
    store.d[SAVE_KEY] = '{"money": 3';                       // cut off in the middle of a write
    s = loadSave(store);
    assert(s.money === 111, 'השמירה הפגומה לא שוחזרה מהגיבוי');
    assert(store.d[SAVE_KEY + '.corrupt'] === '{"money": 3', 'העותק הפגום לא נשמר בצד');
    assert(SAVE_NOTICE && SAVE_NOTICE.includes('גיבוי'), 'אין הודעה לשחקן על שחזור השמירה');
  } finally { SAVE = keep; SAVE_NOTICE = null; }
  return `גרסה ${SAVE_VERSION}, השלמת שדות, גיבוי ושחזור`;
});
test('תחושה: רעידה דועכת לאפס, עצירת פגיעה לא נערמת, הגדרת רעידה כבויה', async () => {
  freshSave(); launch(0); fly();
  feelReset(); FEEL.t = 0.1; addTrauma(1);
  const o = shakeOffset();
  assert(Math.abs(o.x) + Math.abs(o.y) > 0.5, 'אין רעידה אחרי פגיעה חזקה');
  feelTick(0.75);
  const z = shakeOffset();
  assert(FEEL.trauma === 0 && z.x === 0 && z.y === 0, 'הרעידה לא חזרה לאפס');
  hitStop(0.1); hitStop(0.5);
  assert(FEEL.stopT === 0.1 && timeScale() < 1, 'עצירת פגיעה שנייה האריכה את הראשונה');
  feelTick(0.11);
  assert(timeScale() === 1, 'עצירת הפגיעה לא הסתיימה');
  const sh = SAVE.shake; SAVE.shake = 0; addTrauma(1);
  const off = shakeOffset(); SAVE.shake = sh; feelReset();
  assert(off.x === 0 && off.y === 0, 'הגדרת "רעידה כבויה" לא עובדת');
  // a nearby bomb rocks the view, a far one does not
  boom(G.player.x + 60, G.player.y, 50, true); const near = FEEL.trauma; feelReset();
  boom(G.player.x + 2000, G.player.y, 50, true); const far = FEEL.trauma; feelReset();
  assert(near > 0.2 && far === 0, `רעידה לפי מרחק שגויה: ${near.toFixed(2)} / ${far}`);
  G = null;
  return 'דעיכה, עצירה יחידה, כיבוי, מרחק';
});
test('צליל: ערוצים נפרדים, מחוון בריבוע, השתקה ומגביל', async () => {
  const keep = SAVE.vol, muted = SFX.muted;
  try{
    SAVE.vol = {main:1, sfx:1, engine:1, music:1}; SFX.muted = false;
    let g = SFX.busGains();
    assert(g.out === MAIN_GAIN && g.sfx === 1 && g.engine === 1 && g.music === 1, 'ברירת המחדל משנה את עוצמת המשחק המקורית');
    SAVE.vol = {main:0.5, sfx:1, engine:0, music:0.5}; g = SFX.busGains();
    assert(g.out === MAIN_GAIN*0.25 && g.music === 0.25 && g.engine === 0, 'המחוון לא עובר בריבוע או לא שקט ב-0');
    SFX.muted = true; assert(SFX.busGains().out === 0, 'ההשתקה לא מאפסת');
    SAVE.vol = {main:7, sfx:-1}; SFX.muted = false; g = SFX.busGains();
    assert(g.out === MAIN_GAIN && g.sfx === 0 && g.music === 1, 'ערכים מחוץ לטווח לא נחתכים');
    SFX.init();
    if(SFX.ctx){
      assert(SFX.engineBus && SFX.musicBus && SFX.limiter && SFX.limiter.ratio.value >= 12, 'חסרים ערוצים או מגביל');
      return 'ראשי / אפקטים / מנוע / מוזיקה → מגביל';
    }
    return 'חישוב העוצמות (אין WebAudio בדפדפן הזה)';
  } finally { SAVE.vol = keep; SFX.muted = muted; }
});
test('גרפיקה: שמש מחוץ ללוחות, סימני חריכה מוגבלים, עמודי עשן, כל מזג אוויר מצויר', async () => {
  // the sun and moon stay below the HUD panels (which end ~115 px down in HUD units)
  for(const time of ['day','dawn','dusk','night']){ const s = celestial({time, rain:0}, false, 1067); assert(s && s.y - s.r*1.2 > 115, `השמש מוסתרת ב-${time}`); }
  freshSave(); launch(0); fly();
  const is = G.islands[0], mid = (is.x0 + is.x1)/2;
  for(let i=0;i<90;i++) boom(mid + (i%9)*10, groundY(mid) - 2, 50, true, true);
  assert(G.scorch.length > 0 && G.scorch.length <= 60, `סימני חריכה: ${G.scorch && G.scorch.length}`);
  killStructs(s => s.island === 0); G.time += 5;
  for(const time of ['day','dawn','dusk','night']){ G.weather.time = time; for(const rain of [0, 1]){ G.weather.rain = rain; render(ctx, CW || 320, CH || 180); } }
  assert(G.far && G.far.length > 3, 'אין איים רחוקים');
  G = null;
  return 'שמש/ירח מתחת ללוחות · חריכה ≤ 60 · 8 מצבי מזג אוויר';
});
test('גרפיקה 2: מטוס שהופל נופל עד הים, אויב פגוע מעשן, שובלים, עשן רך, כל מזג אוויר', async () => {
  freshSave(); launch(0); fly(G.carrier.x + 1500, 150);
  // an enemy over the sea is shot down: a falling wreck, which ends in a splash and disappears
  const z = {type:'zero', x:G.player.x + 200, y:200, a:Math.PI, speed:220, hp:40, size:16, cool:9, burst:0, evade:0, dead:false};
  G.enemies.push(z);
  for(let i=0;i<3;i++) updateFx(1/60);
  hurtEnemy(z, 22); for(let i=0;i<60;i++) updateFx(1/60);
  assert(!z.dead && z.hp0 === 40 && !z.burning, 'אויב פגוע קל לא אמור לבעור');
  hurtEnemy(z, 10); for(let i=0;i<30;i++) updateFx(1/60);
  assert(z.burning, 'אויב פגוע קשה לא בוער');
  hurtEnemy(z, 999);
  const fall = G.fx.find(f => f.type === 'fall'); assert(fall, 'אין מטוס נופל');
  let n = 0; while(G.fx.includes(fall) && n++ < 600) updateFx(1/60);
  assert(!G.fx.includes(fall) && n < 600, 'המטוס הנופל לא הגיע לים');
  // a hard turn leaves a vapour trail
  const P = G.player; P.loop = {t:0}; for(let i=0;i<10;i++) update(1/60, 1200);
  assert(G.fx.some(f => f.type === 'trail'), 'אין שובל אדים בפנייה חדה');
  // every light and weather draws, including dawn fog, storm swell and lightning on the clouds
  P.hp = P.max*0.15; P.muzzle = 0.05;
  for(const time of ['day','dawn','dusk','night']) for(const rain of [0, 1]){ G.weather.time = time; G.weather.rain = rain; G.weather.flash = rain; render(ctx, CW || 320, CH || 180); }
  assert(SMOKE_SPR.size > 0 && SMOKE_SPR.size <= 49, `מטמון העשן: ${SMOKE_SPR.size}`);
  G = null;
  return 'נפילה עד הים בתוך ' + n + ' צעדים · עשן ואש · שובל · 8 מצבי מזג אוויר';
});
test('נפילת מטוסי אויב: שלוש צורות נפילה, כנף נתלשת, פיצוץ באוויר, שובל, ים, יבשה, מצנח', async () => {
  freshSave(); launch(0); fly(G.carrier.x + 1500, -800); god();
  const seaX = G.carrier.x + 1500, landX = (G.islands[0].x0 + G.islands[0].x1)/2;
  const mk = (x, o={}) => { const e = {type:o.type||'zero', x, y:SEA - 400, a:0.3, speed:220, hp:1, max:1, size:16, dead:false}; const f = makeFall(e); Object.assign(f, o.f||{}); G.fx.push(f); return f; };
  const run = (f, n=900) => { let i = 0; while(G.fx.includes(f) && i++ < n){ updateFx(1/60); if(i % 30 === 0) render(ctx, CW || 320, CH || 180); } return i; };
  const types = new Set();
  // each way down reaches the sea, leaves a lingering smoke trail, a tall splash, a sinking tail and an oil slick
  for(const mode of ['spiral', 'flat', 'glide']){
    G.fx.length = 0;
    const f = mk(seaX, {f:{mode, burstT:-1, wingOff:false, bailT:-1}});
    const steps = run(f);
    assert(!G.fx.includes(f) && steps < 900, `נפילה מסוג ${mode} לא הגיעה לים`);
    assert(f.trail.length > 10, `אין שובל עשן ב-${mode}`);
    for(const t of ['trailfade', 'wsplash', 'sink', 'slick']) assert(G.fx.some(x => x.type === t), `חסר ${t} אחרי נפילה לים (${mode})`);
    types.add(mode);
  }
  // spiral: the nose follows the path down (pointing down by the end)
  G.fx.length = 0; const sp = mk(seaX, {f:{mode:'spiral', burstT:-1, wingOff:false, bailT:-1}});
  for(let i = 0; i < 90; i++) updateFx(1/60);
  assert(Math.sin(sp.rot) > 0.5, 'האף לא יורד בצלילה: ' + sp.rot.toFixed(2));
  // a wing tears off
  G.fx.length = 0; const w = mk(seaX, {f:{mode:'flat', burstT:-1, wingOff:true, bailT:-1}});
  for(let i = 0; i < 30; i++) updateFx(1/60);
  assert(w.wingGone && G.fx.some(x => x.type === 'part' && x.shape === 'wing'), 'הכנף לא נתלשה');
  // a Zero blowing apart in the air: four burning pieces, the trail stays
  G.fx.length = 0; const b = mk(seaX, {f:{burstT:0.1, bailT:-1}});
  for(let i = 0; i < 12; i++) updateFx(1/60);
  assert(!G.fx.includes(b) && G.fx.filter(x => x.type === 'part').length === 4, 'הפיצוץ באוויר לא פירק את המטוס לארבעה חלקים');
  // onto land: a fireball and a burning wreck that burns out
  G.fx.length = 0; const l = mk(landX, {f:{mode:'flat', burstT:-1, wingOff:false, bailT:-1, vx:0}});
  run(l);
  const wr = G.fx.find(x => x.type === 'wreck'); assert(wr, 'אין שבר בוער על היבשה');
  // the enemy pilot jumps, comes down and is gone
  G.fx.length = 0; const p = mk(seaX, {f:{mode:'glide', burstT:-1, wingOff:false, bailT:0.1}});
  for(let i = 0; i < 20; i++) updateFx(1/60);
  const ch = G.fx.find(x => x.type === 'echute'); assert(ch, 'טייס האויב לא קפץ');
  let n = 0; while(G.fx.includes(ch) && n++ < 3000) updateFx(1/60);
  assert(!G.fx.includes(ch), 'המצנח של טייס האויב לא נעלם');
  // too many falling at once: the rest blow apart
  G.fx.length = 0; for(let i = 0; i < 8; i++) mk(seaX + i*30);
  assert(G.fx.filter(f => f.type === 'fall' && f.burstT < 0).length <= WRECK.maxFalling, 'יותר מדי מטוסים נופלים בבת אחת');
  // night lights and every drawing path
  G.weather.time = 'night'; render(ctx, CW || 320, CH || 180);
  G = null;
  return [...types].join(', ') + ' · כנף · פיצוץ · יבשה · מצנח';
});
test('גרסה: כל הסקריפטים ב-index.html נטענים עם מספר הגרסה (בלי קבצים ישנים מהמטמון)', async () => {
  const html = await (await fetch('index.html', {cache:'no-store'})).text();
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  const bad = srcs.filter(s => !s.endsWith('?v=' + GAME_VERSION));
  assert(srcs.length > 10 && !bad.length, `לא מעודכנים ל-${GAME_VERSION}: ${bad.slice(0, 4).join(', ')}`);
  return `${srcs.length} סקריפטים · v=${GAME_VERSION}`;
});
test('המראה: המטוס לא קופץ למטה כשהוא עוזב את הסיפון', async () => {
  const worst = [];
  for(const pull of [false, true]){
    freshSave(); launch(0); const P = G.player, C = G.carrier;
    for(const k in keys) keys[k] = false; keys.KeyW = true;
    let prev = null, w = 0, air = 0;
    for(let i=0;i<700 && air < 60;i++){                  // the first second in the air
      if(pull && P.speed > 125 && P.onDeck) keys.ArrowUp = true;
      update(1/60, 1200);
      const drawn = P.y - (P.liftV ?? 0);
      if(prev != null && !P.onDeck){ air++; w = Math.max(w, drawn - prev); }   // screen y grows downward: positive = down
      prev = drawn;
    }
    assert(air >= 60, 'המטוס לא המריא');
    for(const k in keys) keys[k] = false;
    worst.push(w); G = null;
  }
  assert(worst.every(w => w < 1), `ירידה בפריים אחד: ${worst.map(w => w.toFixed(2)).join(' / ')}`);
  return `ירידה מרבית בפריים: ${worst.map(w => w.toFixed(2)).join(' / ')} (גלגול מהחרטום / משיכה)`;
});
test('קצב פריימים: הגשם והעשן לא תלויים במספר הציורים בשנייה', async () => {
  freshSave(); launch(0); fly();
  G.weather.rain = 1;
  const y0 = G.rain.map(r => r.y);
  for(let i = 0; i < 10; i++) render(ctx, CW || 320, CH || 180);
  assert(G.rain.every((r, i) => r.y === y0[i]), 'הגשם זז בזמן הציור');
  update(1/60, 1200);
  assert(G.rain.some((r, i) => r.y !== y0[i]), 'הגשם לא זז בעדכון');
  // puffs added while drawing are thinned by the frame time: at 4 draws per 1/60 s about a quarter stay
  G.fx = []; RENDER_FX.drawing = true; RENDER_FX.keep = 0.25;
  try{ for(let i = 0; i < 200; i++) puff(0, 0, '#444', 6); } finally { RENDER_FX.drawing = false; RENDER_FX.keep = 1; }
  const kept = G.fx.length; G = null;
  assert(kept > 20 && kept < 90, `דילול העשן שגוי: ${kept}/200`);
  return `נשארו ${kept}/200 פסי עשן ב-240Hz`;
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
  // the flak and fighters are random, so one flight per level can come out close (hard and expert once ranked
  // the wrong way round); the average of 3 flights is stable
  const sec = {}, RUNS = 3;
  for(const k of LEVELS_D){
    let sum = 0;
    for(let r = 0; r < RUNS; r++){
      freshSave(k); launch(3); fly(G.islands[0].x0 - 300, 280); let t = 0;
      await sim(180, tt => { t = tt; const P = G.player; if(P.dead) return true; P.fuel = P.maxFuel; pilot(P, 280); }, 0);
      sum += t; for(const kk in keys) keys[kk] = false;
    }
    sec[k] = sum / RUNS;
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
    for(const p of ['tut','camp','extra','keys','set']){ UI.homePanel = p; G = null; UI.mainMenu(); await tick(); scan(); }
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
test('כוכבים בזמן הטיסה: מצב חי, הודעה כשכוכב אובד או מושג, ומדליות', async () => {
  const msgs = () => G.msg.map(m => m.text).join(' | ');
  // campaign: star 3 announced when the last side building falls; star 2 lost on the second crash
  freshSave(); launch(0); fly(); god();
  let st = starStatus(); assert(st && st.s2 && st.s3==='open' && /מבנים משניים 0\//.test(st.p), 'מצב התחלתי שגוי: ' + JSON.stringify({s2:st&&st.s2, s3:st&&st.s3, p:st&&st.p}));
  killStructs(); await sim(0.2, () => god());
  assert(starStatus().s3==='ok' && /הכוכב השלישי הושג/.test(msgs()), 'לא הודיע על הכוכב השלישי: ' + msgs());
  G.lost = 2; await sim(0.1);
  assert(!starStatus().s2 && /הכוכב השני אבד/.test(msgs()), 'לא הודיע על אובדן הכוכב השני');
  render(ctx, CW || 320, CH || 180);
  // convoy: a ship sunk is a third star lost for good, said once
  freshSave(); launch('convoy'); fly(); god();
  const ship = G.special.convoy[0]; ship.hp = 0; ship.dead = true; await sim(0.2, () => god());
  assert(starStatus().s3==='fail' && msgs().split('הכוכב השלישי אבד').length === 2, 'אובדן הכוכב השלישי בשיירה לא דווח פעם אחת');
  // training and lessons have no stars
  freshSave(); launch('training'); assert(starStatus()===null, 'יש כוכבים באימון');
  // medals: paid once each when the star total reaches them, also for stars won before medals existed
  freshSave(); SAVE.money = 0; SAVE.stars = {0:3, 1:3, 2:3, 3:3, def:2};   // 14 stars
  G = null; UI.homePanel = null; UI.mainMenu();
  assert(SAVE.medals[12] && !SAVE.medals[24] && SAVE.money === 1500, 'מדליית הארד לא ניתנה נכון: $' + SAVE.money);
  assert(/מדליית ארד/.test(UI.root.textContent) && /14\/48/.test(UI.root.textContent), 'מסך הבית לא מציג כוכבים ומדליה');
  UI.mainMenu(); assert(SAVE.money === 1500, 'מדליה שולמה פעמיים');
  return `${starsMax()} כוכבים אפשריים, ${MEDALS.length} מדליות`;
});
test('מוזיקת טיסה ורדיו: עוצמה לפי הקרב, שכבות, קריאות רדיו עם המתנה', async () => {
  // the layer mix: calm = pad only, full fight = drums in, boss layer only with a boss
  const m0 = FlightMusic.mix(0, false), m1 = FlightMusic.mix(1, true);
  assert(m0.pad > 0.5 && m0.pulse === 0 && m0.drive === 0 && m0.boss === 0, 'בשקט יש יותר מהפד');
  assert(m1.pulse === 1 && m1.drive === 1 && m1.boss === 1, 'בקרב מלא חסרות שכבות');
  freshSave(); launch(0, {wing:['wildcat']}); fly(); god();
  assert(FlightMusic.playing || !SFX.ctx, 'מוזיקת הטיסה לא התחילה');
  G.enemies.length = 0; assert(combatIntensity().k === 0, 'עוצמה בלי אויבים');
  // a Zero right behind the player, flying the same way
  const P = G.player; P.f = 1; P.a = 0;
  const z = {type:'zero', x:P.x - 180, y:P.y, a:0, speed:240, full:240, hp:999, max:999, size:16, cool:9, burst:0, evade:0, dead:false, hpScaled:true};
  G.enemies.push(z);
  assert(combatIntensity().k > 0.2, 'זירו קרוב לא מעלה את העוצמה');
  const w = G.wingmen[0]; w.state = 'escort'; w.x = P.x - 100; w.y = P.y - 60;
  radioUpdate(1/60);
  const calls = () => (G.radio ? G.radio.list : []).map(m => m.who + ': ' + m.text).join(' | ');
  assert(/זירו מאחוריך/.test(calls()), 'אין קריאת רדיו על זירו מאחור: ' + calls());
  const n = G.radio.list.length; radioUpdate(1/60); radioUpdate(1/60);
  assert(G.radio.list.length === n, 'הקריאה חוזרת בלי המתנה');
  // the carrier hit, and the LSO on approach
  G.carrier.hp -= 50; radioUpdate(1/60);
  assert(/תחת התקפה/.test(calls()), 'הנושאת לא קראה לעזרה');
  G.enemies.length = 0; G.radio.list.length = 0;
  P.x = G.carrier.x + G.carrier.len/2 - 400; P.y = SEA - 120; P.f = 1; P.speed = 260; radioUpdate(1/60);
  assert(/מהר מדי/.test(calls()), 'קצין הנחיתה לא הזהיר על מהירות: ' + calls());
  render(ctx, CW || 320, CH || 180);
  // back in the menus the flight score stops
  G = null; UI.mainMenu(); assert(!FlightMusic.playing, 'מוזיקת הטיסה ממשיכה בתפריט');
  return 'שכבות, עוצמה, 3 סוגי קריאות';
});
test('מגע: לחיצה, החלקה בין כפתורים, שתי אצבעות, ושחרור כשהמשטחים נעלמים', async () => {
  freshSave(); launch(0); fly(); for(const k in keys) keys[k] = false;
  const btn = k => { const b = document.createElement('button'); b.dataset.k = k; return b; };
  const up = btn('ArrowUp'), down = btn('ArrowDown'), fire = btn('Space'), cmd = btn('KeyC');
  // finger 1 on ▲, then slides to ▼
  TOUCH.fingers.set(1, up); touchPress(up);
  assert(keys.ArrowUp && up.classList.contains('on'), 'לחיצה על ▲ לא נרשמה');
  touchSlide(1, down);
  assert(!keys.ArrowUp && keys.ArrowDown && !up.classList.contains('on'), 'החלקה מ-▲ ל-▼ לא החליפה מקש');
  // finger 2 fires at the same time; lifting it leaves the stick alone
  TOUCH.fingers.set(2, fire); touchPress(fire); assert(keys.Space && keys.ArrowDown, 'שתי אצבעות לא עובדות יחד');
  touchLift(2); assert(!keys.Space && keys.ArrowDown, 'הרמת אצבע שחררה מקש של אצבע אחרת');
  // sliding onto the wingmen order does nothing (it acts only when touched)
  const mode = G.wingMode; touchSlide(1, cmd); assert(G.wingMode === mode && keys.ArrowDown, 'החלקה הפעילה פקודה');
  // sliding off the buttons lets go
  touchSlide(1, null); assert(!keys.ArrowDown, 'יציאה מהכפתורים לא שחררה');
  // the pads hide over a menu and release every finger
  TOUCH.fingers.set(3, up); touchPress(up); touchShown = null; UI.pause(); touchSync();
  assert(!keys.ArrowUp && !TOUCH.fingers.size && !document.body.classList.contains('flying'), 'המשטחים לא שחררו בתפריט');
  UI.act('resume'); touchSync(); assert(document.body.classList.contains('flying'), 'המשטחים לא חזרו אחרי ההפסקה');
  document.body.classList.remove('flying');
  return 'לחיצה, החלקה, 2 אצבעות, הסתרה';
});
test('מערכה: מפה, והתוצאה של משימה עוברת לבאה', async () => {
  freshSave(); SAVE.unlocked = 3; SAVE.best = {0:true, 1:true};
  // mission 1 with both extra stars, mission 2 with only one
  SAVE.stars = {0:3, 1:2}; SAVE.starsDetail = {1:{s2:true, s3:false}};
  assert(campaignIntel(0) === null, 'למשימה הראשונה אין משימה קודמת');
  const a = campaignIntel(1), b = campaignIntel(2);
  assert(a.supply && a.veterans, 'שלושה כוכבים בשמירה ישנה לא נחשבים לשני היעדים');
  assert(!b.supply && b.veterans, 'פרטי הכוכבים של משימה 2 שגויים');
  // the effect on the mission itself
  const base = (() => { SAVE.best = {}; launch(1); return {lives: G.lives, every: G.def.zeroEvery}; })();
  SAVE.best = {0:true, 1:true}; launch(1);
  assert(G.lives === base.lives + 1 && Math.abs(G.def.zeroEvery - base.every*1.25) < 1e-6, `ההשפעה לא חלה: ${G.lives}/${base.lives}, ${G.def.zeroEvery}/${base.every}`);
  assert(LEVELS[1].zeroEvery === base.every, 'הגדרת המשימה המקורית השתנתה');
  // a star won once is remembered even after a worse replay
  G = null; launch(2); SAVE.starsDetail[2] = {s2:true, s3:false}; G.lost = 3; G.structures.forEach(s => s.dead = true);
  rateMission(2); assert(SAVE.starsDetail[2].s2 && SAVE.starsDetail[2].s3, 'כוכב שהושג פעם נשכח');
  // the map: one node per mission, the next one pulsing, locked ones not clickable
  G = null; UI.homePanel = 'camp'; UI.mainMenu();
  const nodes = UI.root.querySelectorAll('.cmap .mnode');
  assert(nodes.length === LEVELS.length, 'מספר הנקודות במפה שגוי');
  assert(UI.root.querySelectorAll('.cmap .mnode.next').length === 1, 'אין משימה הבאה מסומנת');
  assert(!nodes[LEVELS.length-1].dataset.act, 'משימה נעולה לחיצה במפה');
  UI.briefing(1); assert(/מצב המערכה/.test(UI.root.textContent), 'אין מצב מערכה בתדריך');
  UI.homePanel = null;
  return 'מפה, ספירת כוכבים, השפעה על משימה';
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
  // crashes at sea level: too low to bail out, so no pilot comes back
  await sim(200, () => { const P = G.player; if(!P.dead && !P.onDeck){ P.y = groundY(P.x) - 20; crashPlayer('בדיקה'); } if(G.state==='rearm') UI.act('takeoff'); if(P.onDeck) fly(); }, 0);
  assert(/נכשלה/.test(resultTitle()), resultTitle() || 'לא הסתיים'); return resultTitle();
});
test('מצנח: קפיצה, חילוץ בסירה מחזיר מטוס, שבי מעל אי, זירו יורה על הטייס', async () => {
  // shot down high over the sea: he jumps, lands in the water, the launch picks him up and the plane comes back
  freshSave(); launch(0); fly(G.carrier.x + 1100, 200);
  const lives = G.lives; crashPlayer('בדיקה');
  assert(G.chutes && G.chutes.length === 1 && G.chutes[0].state === 'air', 'הטייס לא קפץ');
  assert(G.lives === lives - 1, 'מספר המטוסים לא ירד');
  await sim(60, () => { if(G.state==='rearm') return true; }, 10);       // the deck menu opens after the crash
  UI.act('takeoff'); fly(G.carrier.x + 300, -600); G.enemies.length = 0;
  let sawWater = false;
  await sim(60, () => { god(); G.enemies.length = 0; if(G.chutes[0] && G.chutes[0].state==='water') sawWater = true; return !chutePending(); }, 10);
  assert(sawWater, 'הטייס לא נחת במים');
  assert(!chutePending() && G.lives === lives && G.rescued === 1, `החילוץ לא החזיר מטוס (${G.lives}/${lives})`);
  // shot down over an island: taken prisoner
  const is = G.islands[0]; fly((is.x0 + is.x1)/2, groundY((is.x0 + is.x1)/2) - 160); god(); G.player.inv = 0;
  crashPlayer('בדיקה'); G.endT = 1e9; G.chutes[0].vx = 0; G.weather.wind = 0;
  await sim(20, () => { G.weather.wind = 0; return !chutePending(); }, 0);
  assert(G.captured === 1, 'הטייס לא נפל בשבי מעל האי');
  // a pilot in the water, a Zero low overhead: he gets shot unless covered
  freshSave(); launch(0); fly(G.carrier.x + 4000, -700); god();
  G.chutes = [{x: G.carrier.x + 1500, y: SEA, vx: 0, state: 'water', hp: CHUTE.hp, t: 0, open: 1, hit: 0, boat: {x: G.carrier.x - 9000}}];
  const c = G.chutes[0];
  await sim(30, () => { god(); G.player.x = G.carrier.x + 4000; G.player.y = -700;
    G.enemies = G.enemies.filter(e => e.zz); if(!G.enemies.length) G.enemies.push({zz:true, type:'zero', x:c.x - 200, y:SEA - 150, a:0, speed:0, full:240, hp:999, max:999, size:16, cool:99, burst:0, evade:0, dead:false, hpScaled:true});
    G.enemies[0].x = c.x - 200; G.enemies[0].y = SEA - 150; return c.state === 'gone'; }, 15);
  assert(c.hp <= 0, 'הזירו לא פגע בטייס שבמים: ' + c.hp);
  // the last aircraft lost with a pilot still in the air: the mission waits for him
  freshSave(); launch(0); G.lives = 1; fly(G.carrier.x + 900, 150); crashPlayer('בדיקה');
  await sim(5); assert(G.state !== 'over' && chutePending(), 'המשימה הסתיימה לפני שהטייס חולץ');
  return 'חילוץ, שבי, ירי על הטייס, המתנה לחילוץ';
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
