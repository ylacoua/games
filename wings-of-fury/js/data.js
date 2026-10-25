// ---- Static game data: planes, ordnance, upgrades, wingmen, levels ----
// Game version: bumped with every requested change (shown on the title screen)
const GAME_VERSION = '1.51';
const GAME_SPEED = 0.85;     // overall pace of the game (1 = original speed)

const H = 600;          // logical world height
const SEA = 520;        // sea level (y grows downward)
const DECK_Y = SEA - 34;
const CEIL = -1300;     // highest altitude any aircraft can reach (world y), about 5,400 ft
const SMALL_ARMS_ALT = 110;   // soldiers can only hit aircraft flying lower than this above the ground (about 330 ft)
const TORPEDO_ARM = 170;      // a torpedo must run this far through the water before it arms
const PLAYER_DAMAGE = 0.55;  // share of incoming damage the player's aircraft takes (raised from 0.45 in v1.43)

const PLANES = {
  hellcat:  {name:'F6F הלקט',   desc:'מטוס קרב מאוזן ואמין. נקודת הפתיחה של כל טייס.', price:0,    speed:280, turn:1.9,  hp:100, gun:1.0, rate:11, fuel:100, ord:{bomb:8,rocket:12,torpedo:1}, gunner:false, color:'#3d5c7c', shape:'fighter'},
  corsair:  {name:'F4U קורסייר', desc:'מהיר וחזק עם כנפי שחף. מצטיין ברקטות.',          price:3000, speed:325, turn:1.95, hp:110, gun:1.3, rate:12, fuel:110, ord:{bomb:8,rocket:16,torpedo:1}, gunner:false, color:'#25476c', shape:'corsair'},
  dauntless:{name:'SBD דונטלס',  desc:'מפציץ צלילה עם תותחן אחורי שמגן על הזנב.',       price:2500, speed:245, turn:1.6,  hp:125, gun:0.8, rate:9,  fuel:120, ord:{bomb:16,rocket:8,torpedo:1}, gunner:true,  color:'#586f87', shape:'bomber'},
  avenger:  {name:'TBF אוונג׳ר', desc:'מפציץ טורפדו כבד ומשוריין. נושא שני טורפדו.',    price:4000, speed:230, turn:1.4,  hp:170, gun:0.9, rate:9,  fuel:140, ord:{bomb:12,rocket:12,torpedo:2}, gunner:true,  color:'#4b6479', shape:'heavy'},
  bearcat:  {name:'F8F בירקט',   desc:'מטוס הקרב המהיר והזריז ביותר בצי.',               price:6500, speed:340, turn:2.0,  hp:115, gun:1.6, rate:14, fuel:100, ord:{bomb:8,rocket:16,torpedo:1}, gunner:false, color:'#1e3b5d', shape:'fighter'}
};

const ORD = {
  bomb:   {name:'פצצות',  dmg:75,  radius:56, note:'נופלות עם תנופת המטוס. חזקות נגד בונקרים.'},
  rocket: {name:'רקטות',  dmg:48,  radius:34, note:'טסות ישר קדימה. מדויקות נגד נ"מ וספינות.'},
  torpedo:{name:'טורפדו', dmg:240, radius:34, note:'הטל מעל הים מגובה נמוך (עד כ-450 רגל). שט ישר מתחת למים: אחד מטביע משחתת, שניים נושאת או אוניית מערכה.'}
};

const UPGRADES = {
  engine: {name:'מנוע',        desc:'+8% מהירות',          costs:[600,1300,2400]},
  armor:  {name:'שריון',       desc:'+20% חוזק מבנה',      costs:[500,1100,2100]},
  guns:   {name:'מקלעים',      desc:'+25% נזק וקצב ירי',   costs:[700,1400,2600]},
  payload:{name:'מתלי חימוש',  desc:'+1 פצצה / +2 רקטות', costs:[800,1600,2800]},
  fuel:   {name:'מכל דלק',     desc:'+25% דלק',            costs:[400,900,1700]}
};

const WINGMEN = {
  wildcat:  {name:'FM-2 ווילדקט',  role:'fighter', desc:'ליווי וחיפוי: יורט מטוסי אויב שמתקרבים אליך.', cost:350, hp:95, speed:255, color:'#5b7691'},
  helldiver:{name:'SB2C הלדייבר', role:'bomber',  desc:'תוקף נוסף: מפציץ בונקרים, נ"מ וספינות.',      cost:550, hp:120, speed:215, color:'#4f677d'}
};
const MAX_WINGMEN = 3;
const WING_AMMO = 260;       // rounds a wingman fighter carries before it must land and rearm

// time: day | dawn | dusk | night ; rain 0..1 ; wind px/s ; storm = lightning
const LEVELS = [
  {name:'איי מרשל',         brief:'פשיטה ראשונה על שני איים מבוצרים. השמד את הבונקרים ואת סוללות הנ"מ. כל עוד יש באי מבנים פעילים, מטוסי זירו ימריאו ממנו.',
   goals:['השמד את כל הבונקרים וסוללות הנ"מ בשני האיים','הטבע את המשחתת היפנית שבין האיים','חזור לנושאת ונחת כדי לסיים את המשימה'],
   tip:'פצצות הן הנשק הטוב ביותר נגד בונקרים. צריפים ומכלי דלק אינם חובה, אבל מזכים בכסף.',
   time:'day',  rain:0,   wind:0,   storm:false, islands:2, ships:1, zeroEvery:22, bombers:false, boss:null,         reward:1000},
  {name:'שחר מעל סאיפן',     brief:'תקיפה עם עלות השחר. רוח צד חזקה מסיטה את הפצצות. נושאת מטוסים יפנית מאחורי האי האחרון משגרת מטוסי זירו.',
   goals:['השמד את הבונקרים וסוללות הנ"מ בשלושת האיים','הטבע את המשחתת ואת נושאת המטוסים היפנית','חזור לנושאת ונחת כדי לסיים את המשימה'],
   tip:'הרוח מסיטה את הפצצות לכיוונה. שחרר אותן מוקדם או מאוחר יותר בהתאם.',
   time:'dawn', rain:0,   wind:35,  storm:false, islands:3, ships:1, zeroEvery:16, bombers:false, boss:null, jcarrier:true,         reward:1400},
  {name:'סערה בים הפיליפינים', brief:'אוניית מערכה ענקית מסתתרת בסערה. השמד את הצריחים ואז הטבע אותה בטורפדו.',
   goals:['השמד את הבונקרים וסוללות הנ"מ בשני האיים','הטבע את שתי המשחתות','השמד את צריחי אוניית המערכה והטבע אותה','חזור לנושאת ונחת כדי לסיים את המשימה'],
   tip:'טורפדו מוטל מעל הים מגובה נמוך. מטוס האוונג׳ר נושא שניים, ושניים מטביעים אוניית מערכה.',
   time:'day',  rain:0.9, wind:-45, storm:true,  islands:2, ships:2, zeroEvery:15, bombers:false, boss:'battleship', reward:2500},
  {name:'פשיטת לילה',        brief:'לילה ללא ירח. זרקורים מכוונים את הנ"מ, ומפציצי אויב מנסים לפגוע בנושאת.',
   goals:['השמד את הבונקרים וסוללות הנ"מ בשלושת האיים','הטבע את המשחתות ואת נושאת המטוסים היפנית','יירט את מפציצי האויב לפני שיגיעו לנושאת שלך','חזור לנושאת ונחת כדי לסיים את המשימה'],
   tip:'השמד קודם את הזרקורים: בלעדיהם הנ"מ כמעט עיוור בחושך.',
   time:'night',rain:0,   wind:10,  storm:false, islands:3, ships:2, zeroEvery:14, bombers:true,  boss:null, jcarrier:true,         reward:2200},
  {name:'שקיעה מעל איוו ג׳ימה', brief:'סירה מעופפת ענקית מסוג "אמילי" מובילה את הגנת האי. הפל אותה.',
   goals:['הפל את הסירה המעופפת "אמילי"','השמד את הבונקרים וסוללות הנ"מ בשלושת האיים','הטבע את המשחתת ואת נושאת המטוסים היפנית','חזור לנושאת ונחת כדי לסיים את המשימה'],
   tip:'"אמילי" עמידה מאוד. צרף מטוסי כנף מסוג ווילדקט שיעזרו לך להפיל אותה.',
   time:'dusk', rain:0,   wind:25,  storm:false, islands:3, ships:1, zeroEvery:12, bombers:true,  boss:'emily', jcarrier:true,      reward:3200},
  {name:'מבצר אוקינאווה',     brief:'המשימה האחרונה: מבצר החוף עם תותחי ענק, בלילה סוער.',
   goals:['השמד את מבצר החוף: תותחי הענק והמפקדה המבוצרת','השמד את הבונקרים וסוללות הנ"מ בשאר האיים','הטבע את המשחתות ואת נושאת המטוסים היפנית','חזור לנושאת ונחת כדי לסיים את המשימה'],
   tip:'תותחי הענק עמידים מאוד. קח את החימוש הכבד ביותר, ושדרג "מתלי חימוש" לפני המשימה.',
   time:'night',rain:0.7, wind:-30, storm:true,  islands:3, ships:2, zeroEvery:10, bombers:true,  boss:'fortress', jcarrier:true,   reward:5000}
];

const SCORE = {bunker:150, aa:120, barracks:100, fuel:80, light:60, soldier:10, zero:100, betty:150, val:150, chiha:200, arty:180, jcarrier:1200,
  destroyer:300, battleship:1500, turret:200, emily:1500, biggun:300, core:2000,
  radar:250, boat:150, sub:300, train:600, bridge:1500};

const SAVE_KEY = 'wof1944-save';
// Paint schemes ("skins") for the player's aircraft. Winning a mission makes its skin available to buy
// (campaign missions 0-5, 'def' = Carrier Defense, 'gnd' = Ground Support); 'standard' is each type's own
// 1944 Navy scheme. s: fuselage colours, wing: near-wing colour, cowl: engine cowling, flat: no light
// underside on the wing, deco: extra markings drawn by drawPlane.
const SKINS = {
  standard:   {name:'צבע תקני 1944', desc:'צבעי הצי של כל דגם: כחול ים מבריק או שלושה גוונים.', price:0},
  olive:      {name:'ירוק זית – הנחתים', desc:'ירוק זית מעל אפור בהיר, כמו טייסות הנחתים באיי שלמה.', price:600, unlock:0,
               s:{top:'#4b5133', side:'#565d3b', under:'#b9bcb2', hi:'rgba(200,210,160,.25)'}, wing:'#4f5636'},
  checker:    {name:'אף משובץ', desc:'מכסה מנוע משובץ בצהוב ושחור של טייסת קרב מצטיינת.', price:900, unlock:1, deco:'checker'},
  storm:      {name:'אפור סערה', desc:'אפור כהה מעל לבן, צבעי מטוסי הסיור מעל האוקיינוס.', price:1200, unlock:2,
               s:{top:'#4d5862', side:'#6c7782', under:'#eef0f0', hi:'rgba(230,235,240,.3)'}, wing:'#5b6670'},
  blackcat:   {name:'החתולים השחורים', desc:'שחור מט לטיסות לילה, עם טבעת אדומה על מכסה המנוע.', price:1500, unlock:3,
               s:{top:'#16181c', side:'#1c1f24', under:'#202329', hi:'rgba(120,130,150,.25)'}, wing:'#1a1d22', cowl:'#a8231c', flat:true},
  shark:      {name:'פה של כריש', desc:'שיני כריש ועין על האף, בסגנון "הנמרים המעופפים".', price:2000, unlock:4,
               s:{top:'#5a5a3a', side:'#66664a', under:'#a9b1b0', hi:'rgba(210,210,170,.25)'}, wing:'#5d5d3e', deco:'shark'},
  blueangels: {name:'הבלו אנג׳לס', desc:'כחול כהה עם עיטורי זהב, כמו צוות הראווה האווירית של הצי.', price:3000, unlock:5,
               s:{top:'#0e2a66', side:'#123375', under:'#0f2d6c', hi:'rgba(150,180,240,.35)'}, wing:'#123170', cowl:'#e8b923', flat:true, deco:'blueangels'},
  invasion:   {name:'פסי פלישה', desc:'פסים שחורים ולבנים סביב הגוף, כמו ביום הפלישה.', price:1500, unlock:'def', deco:'invasion'},
  metal:      {name:'מתכת חשופה', desc:'אלומיניום מבריק עם אף אדום, כמו מטוסי האסים בסוף המלחמה.', price:2500, unlock:'gnd',
               s:{top:'#aeb6bd', side:'#c3cad0', under:'#d0d5d9', hi:'rgba(255,255,255,.55)'}, wing:'#b4bcc3', cowl:'#c0281f'},
  // special missions (specials.js)
  rescue:     {name:'חילוץ ים', desc:'כחול אפור עם אף וזנב צהובים, כמו מטוסי החילוץ הימי.', price:1800, unlock:'rescue',
               s:{top:'#3b5a7a', side:'#4a6a8a', under:'#dfe3e6', hi:'rgba(200,220,240,.3)'}, wing:'#42617f', cowl:'#f2c419', fin:'#f2c419'},
  nightfighter:{name:'לוחם לילה', desc:'אפור צפחה כהה עם ברק צהוב על הגוף.', price:2200, unlock:'dark',
               s:{top:'#22282f', side:'#2a3139', under:'#2a3139', hi:'rgba(140,150,170,.25)'}, wing:'#262c33', flat:true, deco:'lightning'},
  atlantic:   {name:'מלווה השיירות', desc:'אפור כחלחל מעל לבן, צבעי מטוסי הליווי של האטלנטי.', price:2000, unlock:'convoy',
               s:{top:'#6f8193', side:'#8a9bac', under:'#f1f2f2', hi:'rgba(240,245,250,.3)'}, wing:'#73879a'},
  desert:     {name:'חום מדבר', desc:'חום חול מעל תכלת, כמו המטוסים שתקפו גשרים ומסילות.', price:2200, unlock:'bridge',
               s:{top:'#a88f62', side:'#b39a6c', under:'#9fbad0', hi:'rgba(250,235,200,.3)'}, wing:'#a48b5e'},
  redcowl:    {name:'אף אדום', desc:'הצבעים המקוריים עם אף וזנב אדומים, סימן של טייסת מהירה.', price:1600, unlock:'clock', cowl:'#c42a1f', fin:'#c42a1f'},
  ace:        {name:'צבעי האס (שלל)', desc:'ירוק כהה עם פסים צהובים וזנב אדום, כמו המטוס של האס היפני.', price:3500, unlock:'ace',
               s:{top:'#3f4a33', side:'#4a553b', under:'#c9c7b4', hi:'rgba(200,210,170,.25)'}, wing:'#44503a', cowl:'#151515', fin:'#a52a1e', deco:'acebands'},
  phoenix:    {name:'עוף החול', desc:'שחור עם להבות כתומות על האף, למי שנחת על נושאת בוערת.', price:2800, unlock:'burning',
               s:{top:'#1c1a1a', side:'#252121', under:'#2c2626', hi:'rgba(180,140,120,.25)'}, wing:'#211e1e', cowl:'#e0601c', flat:true, deco:'flames'},
  victory:    {name:'ניצחון', desc:'לבן עם פסי אדום-לבן-כחול על הזנב, למי שהוביל את הפלישה הגדולה.', price:4000, unlock:'assault',
               s:{top:'#e8e6df', side:'#dcd9cf', under:'#c8c5ba', hi:'rgba(255,255,255,.5)'}, wing:'#d5d2c8', cowl:'#1d3566', deco:'tailstripes'}
};
for(const [id,k] of Object.entries(SKINS)) k.id = id;
const skinFor = key => Object.values(SKINS).find(k => k.unlock === key);      // the skin a mission awards
function skinUnlocked(id){
  const k = SKINS[id]; if(!k || k.unlock == null) return true;
  if(typeof k.unlock==='string') return !!(SAVE.won && SAVE.won[k.unlock]);   // 'def', 'gnd' or a special mission
  return !!SAVE.best[k.unlock];
}
function skinUnlockText(id){
  const u = SKINS[id].unlock;
  if(u==='def') return 'נפתח בניצחון במשימת ההגנה על הנושאת';
  if(u==='gnd') return 'נפתח בניצחון במשימת הסיוע לכוחות היבשה';
  if(typeof u==='string') return `נפתח בניצחון במשימה "${SPECIALS[u].name}"`;
  return `נפתח בסיום משימה ${u+1}`;
}
// the skin object to paint the player's aircraft with (null = the type's standard scheme)
const playerSkin = () => (SAVE.skin && SAVE.skin !== 'standard' && SAVE.skins && SAVE.skins[SAVE.skin]) ? SKINS[SAVE.skin] : null;

function defaultSave(){ return {money:0, owned:{hellcat:true}, plane:'hellcat', up:{engine:0,armor:0,guns:0,payload:0,fuel:0}, unlocked:1, best:{},
  skins:{standard:true}, skin:'standard', won:{}}; }
function loadSave(){
  try{ const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if(s && s.owned) return Object.assign(defaultSave(), s); }catch(e){}
  return defaultSave();
}
function storeSave(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); }catch(e){} }
let SAVE = loadSave();

// effective stats of a plane with upgrades
function planeStats(id, up){
  const b = PLANES[id], u = up || SAVE.up;
  return {
    speed: b.speed*(1+0.08*u.engine), turn:b.turn, hp: Math.round(b.hp*(1+0.2*u.armor)),
    gun: b.gun*(1+0.25*u.guns), rate: b.rate*(1+0.1*u.guns), fuel: b.fuel*(1+0.25*u.fuel),
    ord: {bomb:b.ord.bomb+u.payload, rocket:b.ord.rocket+2*u.payload, torpedo:b.ord.torpedo},
    gunner:b.gunner, color:b.color, shape:b.shape, type:id, name:b.name
  };
}

// small math helpers
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rnd=(a,b)=>a+Math.random()*(b-a);
const wrapA=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
const dist2=(ax,ay,bx,by)=>(ax-bx)*(ax-bx)+(ay-by)*(ay-by);

// Training sortie: everything is free and nothing is saved
function trainingDef(t){
  return {name:'משימת אימון', brief:'אימון חופשי. כל המטוסים, השדרוגים והכנפיים זמינים ללא עלות, וההתקדמות לא נשמרת.',
    time:t.time, rain:t.rain?0.8:0, wind:t.wind, storm:t.storm, islands:3, ships:2, zeroEvery:t.zeros?16:9999,
    bombers:t.bombers, boss:t.boss||null, jcarrier:t.jcarrier, reward:0, training:true};
}