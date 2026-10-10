// ---- Static game data: planes, ordnance, upgrades, wingmen, levels ----
const H = 600;          // logical world height
const SEA = 520;        // sea level (y grows downward)
const DECK_Y = SEA - 34;
const CEIL = -700;
const PLAYER_DAMAGE = 0.45;  // the player's aircraft takes less than half of incoming damage      // highest altitude the player can reach (world y)

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
  torpedo:{name:'טורפדו', dmg:240, radius:34, note:'הטל נמוך מעל הים (פחות מ-60 מטר). משמיד ספינות.'}
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

// time: day | dawn | dusk | night ; rain 0..1 ; wind px/s ; storm = lightning
const LEVELS = [
  {name:'איי מרשל',         brief:'פשיטה ראשונה על שני איים מבוצרים. השמד את הבונקרים ואת סוללות הנ"מ. כל עוד יש באי מבנים פעילים, מטוסי זירו ימריאו ממנו.',
   time:'day',  rain:0,   wind:0,   storm:false, islands:2, ships:1, zeroEvery:22, bombers:false, boss:null,         reward:1000},
  {name:'שחר מעל סאיפן',     brief:'תקיפה עם עלות השחר. רוח צד חזקה מסיטה את הפצצות. נושאת מטוסים יפנית מאחורי האי האחרון משגרת מטוסי זירו.',
   time:'dawn', rain:0,   wind:35,  storm:false, islands:3, ships:1, zeroEvery:16, bombers:false, boss:null, jcarrier:true,         reward:1400},
  {name:'סערה בים הפיליפינים', brief:'אוניית מערכה ענקית מסתתרת בסערה. השמד את הצריחים ואז הטבע אותה בטורפדו.',
   time:'day',  rain:0.9, wind:-45, storm:true,  islands:2, ships:2, zeroEvery:15, bombers:false, boss:'battleship', reward:2500},
  {name:'פשיטת לילה',        brief:'לילה ללא ירח. זרקורים מכוונים את הנ"מ, ומפציצי אויב מנסים לפגוע בנושאת.',
   time:'night',rain:0,   wind:10,  storm:false, islands:3, ships:2, zeroEvery:14, bombers:true,  boss:null, jcarrier:true,         reward:2200},
  {name:'שקיעה מעל איוו ג׳ימה', brief:'סירה מעופפת ענקית מסוג "אמילי" מובילה את הגנת האי. הפל אותה.',
   time:'dusk', rain:0,   wind:25,  storm:false, islands:3, ships:1, zeroEvery:12, bombers:true,  boss:'emily', jcarrier:true,      reward:3200},
  {name:'מבצר אוקינאווה',     brief:'המשימה האחרונה: מבצר החוף עם תותחי ענק, בלילה סוער.',
   time:'night',rain:0.7, wind:-30, storm:true,  islands:3, ships:2, zeroEvery:10, bombers:true,  boss:'fortress', jcarrier:true,   reward:5000}
];

const SCORE = {bunker:150, aa:120, barracks:100, fuel:80, light:60, soldier:10, zero:100, betty:150, jcarrier:1200,
  destroyer:300, battleship:1500, turret:200, emily:1500, biggun:300, core:2000};

const SAVE_KEY = 'wof1944-save';
function defaultSave(){ return {money:0, owned:{hellcat:true}, plane:'hellcat', up:{engine:0,armor:0,guns:0,payload:0,fuel:0}, unlocked:1, best:{}}; }
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