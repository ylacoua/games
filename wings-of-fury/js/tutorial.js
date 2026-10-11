// ---- Flight school: four guided lessons with step-by-step instructions ----
// A lesson builds its own small world, puts the player in the air (or on approach) and advances through
// steps as each step's check() passes. Crashes respawn at the lesson start; nothing is saved.

function tutIsland(x0, w, types){
  const is = {x0, x1:x0+w, h:52, slope:130, seed:1.7, palms:[]};
  G.islands.push(is);
  const i = G.islands.length-1, a = is.x0+is.slope+40, b = is.x1-is.slope-40;
  is.strip = {x0:a-30, x1:b+30};
  const step = (b-a)/types.length;
  types.forEach((t,k)=>{ const s = makeStruct(t, a+step*(k+0.5)); s.island = i; G.structures.push(s); });
  for(let p=0;p<5;p++) is.palms.push({x:a + (b-a)*(p+0.5)/5 + 20, s:1});
  return is;
}
const altFt = P => Math.max(0, Math.round((SEA - P.y)*3));

const LESSONS = [
  { id:'landing', name:'נחיתה על הנושאת', plane:'hellcat', ord:'bomb',
    desc:'גישה לנושאת, הורדת מצערת וגובה, ונחיתה עם וו הבלימה.',
    start:{x:2700, y:SEA-170, f:-1, speed:220, throttle:0.75},
    setup(T){ G.L = 3400; },
    steps:[
      {text:'הנושאת נמצאת משמאלך. הורד את המצערת עם S עד שמחוון "מצערת" למעלה מימין יורד מתחת לחצי.',
       check:()=> G.player.throttle < 0.5},
      {text:'הנמך בעדינות עם ↓ עד גובה של כ-250 רגל, והמשך לטוס ישר לעבר הנושאת.',
       check:()=> altFt(G.player) < 270},
      {text:'כשהגלגלים יורדים ומופיע "מוכן לנחיתה", יישר את האף עם ↑/↓ ושמור על מהירות מתחת ל-225. גע בסיפון.',
       check:T=> T.landed}
    ]},
  { id:'bombing', name:'הפצצה', plane:'dauntless', ord:'bomb',
    desc:'הטלת פצצות על בונקרים: איך הפצצה ממשיכה קדימה עם תנופת המטוס.',
    start:{x:800, y:SEA-260, f:1, speed:230, throttle:0.7},
    setup(T){ tutIsland(2100, 1150, ['bunker','barracks','bunker','bunker']); G.L = 3900; },
    steps:[
      {text:'טוס ימינה לעבר האי. הבונקרים מסומנים בצהוב במפה הקטנה בראש המסך.',
       check:()=> G.player.x > 1700},
      {text:'פצצה לא נופלת ישר למטה: היא ממשיכה קדימה עם תנופת המטוס. לחץ X קצת לפני שהבונקר מתחתיך. צלילה קלה משפרת את הדיוק.',
       check:()=> G.structures.some(s=>s.type==='bunker' && s.dead)},
      {text:'פגיעה! השמד את שני הבונקרים הנותרים. אם נגמרות הפצצות, נחת על הנושאת כדי לחמש מחדש. היזהר מחיילים: הם יורים על מטוס שטס נמוך מאוד.',
       check:()=> G.structures.filter(s=>s.type==='bunker').every(s=>s.dead)}
    ]},
  { id:'dogfight', name:'קרב אוויר', plane:'hellcat', ord:'rocket',
    desc:'יירוט מטוסי זירו: התקרבות, הובלת כוונה וירי, ושימוש בפנייה לאחור.',
    start:{x:1100, y:SEA-300, f:1, speed:240, throttle:0.75},
    setup(T){ tutIsland(2900, 1000, ['barracks','fuel']); G.L = 4400; G.player.max = G.player.hp = 400; T.spawnT = 2.5; },
    tick(T, dt){
      const alive = G.enemies.filter(e=>!e.dead && e.type==='zero').length;
      T.kills = T.launched - alive;
      T.spawnT -= dt;
      if(alive===0 && T.launched < 3 && T.spawnT<=0){
        const site = launchSites()[0];
        if(site){ launchFrom(site, 'zero'); T.launched++; T.spawnT = 3; say('מטוס זירו ממריא מהאי!',2); }
      }
    },
    steps:[
      {text:'מטוס זירו ממריא מהאי שמימין. טוס לעברו: ← → מפנים את המטוס, ↑ ↓ לטיפוס ולצלילה.',
       check:()=> G.enemies.some(e=>!e.dead && e.type==='zero' && !e.takeoff && dist2(e.x,e.y,G.player.x,G.player.y) < 420*420)},
      {text:'כוון את אף המטוס מעט לפני הזירו, לאן שהוא טס, ולחץ על רווח כדי לירות צרורות קצרים.',
       check:T=> (T.kills||0) >= 1},
      {text:'הופל! הפל עוד שניים. כשהזירו חולף על פניך, השתמש בפנייה לאחור (←/→) כדי להישאר מאחוריו.',
       check:T=> (T.kills||0) >= 3}
    ]},
  { id:'torpedo', name:'הטלת טורפדו', plane:'avenger', ord:'torpedo',
    desc:'גישה נמוכה מעל הים והטלה מטווח נכון, כדי שהטורפדו יצבור מהירות ויתחמש.',
    start:{x:700, y:SEA-230, f:1, speed:220, throttle:0.7},
    setup(T){
      const sh = makeShip('destroyer', 2700, 2700, 2700); sh.speed = 0; sh.dir = -1; sh.turrets.forEach(t=>t.cool = 1e9);
      G.ships.push(sh); G.L = 3600; G.player.ord = 4;
    },
    tick(T){
      // a torpedo that was wasted sends the lesson back to the drop step
      if(T.step===2 && !G.drops.some(d=>d.kind==='torpedo') && !G.ships[0].dead){ T.step = 1; }
    },
    steps:[
      {text:'רד לגובה נמוך מעל הים: פחות מ-450 רגל (מחוון "גובה" למעלה מימין). מגבוה מדי הטורפדו יישבר במים.',
       check:()=> altFt(G.player) < 450 && overSea(G.player.x)},
      {text:'טוס ישר לעבר המשחתת ולחץ X כשאתה עדיין רחוק ממנה. הטורפדו צריך לשוט מרחק מה במים כדי לצבור מהירות ולהתחמש, והוא לא יתפוצץ אם תטיל אותו ישר על הספינה.',
       check:()=> G.drops.some(d=>d.kind==='torpedo' && d.run)},
      {text:'הטורפדו שט ישר מתחת למים. חכה לפגיעה: טורפדו אחד מטביע משחתת.',
       check:()=> G.ships[0].dead}
    ]}
];

function lessonDef(L){
  return {name:'הדרכה: '+L.name, brief:L.desc, time:'day', rain:0, wind:0, storm:false, islands:0, ships:0,
    zeroEvery:1e9, bombers:false, boss:null, jcarrier:false, reward:0, training:true};
}

function tutorialPlace(){
  const T = G.tutorial, s = T.lesson.start, P = G.player;
  P.onDeck=false; P.landing=false; G.state='fly'; P.x=s.x; P.y=s.y; P.f=s.f; P.p=0; P.loop=null;
  P.speed=s.speed; P.throttle=s.throttle; P.gear=0; P.gearWant=0; P.airT=10; P.inv=1.5;
  if(T.lesson.id==='dogfight') P.max = P.hp = 400;
  if(T.lesson.id==='torpedo') P.ord = 4;
}

function startLesson(i){
  const L = LESSONS[i];
  newLevel(0, {plane:L.plane, ord:L.ord, wing:[], up:{engine:0,armor:0,guns:0,payload:0,fuel:0}}, lessonDef(L));
  G.tutorial = {i, lesson:L, steps:L.steps, step:0, done:false, launched:0, kills:0, spawnT:0, landed:false};
  L.setup(G.tutorial);
  tutorialPlace();
  G.msg = []; say('שיעור: '+L.name, 3);
}

function tutorialRespawn(){
  const l = G.lives; resetPlayer(); G.lives = l; tutorialPlace();
  say('נסה שוב – ההוראה הנוכחית מופיעה למעלה', 3);
}

function tutorialUpdate(dt){
  const T = G.tutorial; if(!T) return;
  if(T.done){ T.endT -= dt; if(T.endT <= 0) UI.tutorialDone(); return; }
  if(T.lesson.tick) T.lesson.tick(T, dt);
  const st = T.steps[T.step];
  if(st && st.check(T)){
    T.step++; SFX.pickup();
    if(T.step >= T.steps.length){ T.done = true; T.endT = 2.5; say('השיעור הושלם!', 3); }
  }
}

// instruction panel under the mini-map (screen space)
function drawTutorial(ctx, vw){
  const T = G.tutorial; if(!T) return;
  const w = Math.min(620, vw-40), x = (vw-w)/2, y = 120;   // below the side gauges, so nothing is covered on narrow screens
  const text = T.done ? 'כל הכבוד! השיעור הושלם.' : T.steps[T.step].text;
  ctx.save(); ctx.direction='rtl'; ctx.textAlign='right'; ctx.textBaseline='top';
  ctx.font='16px Rubik, sans-serif';
  // wrap the instruction to the panel width
  const words = text.split(' '), lines = []; let line = '';
  for(const wd of words){ const t2 = line ? line+' '+wd : wd; if(ctx.measureText(t2).width > w-28 && line){ lines.push(line); line = wd; } else line = t2; }
  if(line) lines.push(line);
  const hgt = 40 + lines.length*22;
  ctx.fillStyle='rgba(8,16,28,.82)'; ctx.fillRect(x, y, w, hgt);
  ctx.fillStyle='#e8b33a'; ctx.fillRect(x+w-4, y, 4, hgt);
  ctx.font='13px Rubik, sans-serif'; ctx.fillStyle='#e8b33a';
  ctx.fillText(`הדרכה · ${T.lesson.name} · שלב ${Math.min(T.step+1, T.steps.length)} מתוך ${T.steps.length}`, x+w-14, y+10);
  ctx.font='16px Rubik, sans-serif'; ctx.fillStyle='#efe6cf';
  lines.forEach((l,i)=>ctx.fillText(l, x+w-14, y+32+i*22));
  // progress pips
  for(let i=0;i<T.steps.length;i++){ ctx.fillStyle = i < T.step || T.done ? '#5fae6b' : i===T.step ? '#e8b33a' : '#3b4a60'; ctx.fillRect(x+14+i*16, y+12, 10, 4); }
  ctx.restore();
}
