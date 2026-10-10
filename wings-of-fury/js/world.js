// ---- Level construction, terrain and the global game state G ----
let G = null;

const STRUCT = {
  bunker:  {w:60,  h:26, hp:110, primary:true},
  aa:      {w:34,  h:22, hp:55,  primary:true},
  barracks:{w:72,  h:34, hp:70,  primary:false},
  fuel:    {w:36,  h:30, hp:30,  primary:false},
  light:   {w:22,  h:26, hp:25,  primary:false},
  biggun:  {w:84,  h:42, hp:320, primary:true},
  core:    {w:130, h:72, hp:900, primary:true}
};

function makeStruct(type, x){
  const d = STRUCT[type];
  return {type, x, w:d.w, h:d.h, hp:d.hp, max:d.hp, primary:d.primary, dead:false, cool:rnd(1,3), y:groundY(x), aim:-Math.PI/2, spawn:0};
}

function groundY(x){
  if(!G) return SEA;
  for(const is of G.islands){
    if(x>is.x0 && x<is.x1){
      const t = Math.min(x-is.x0, is.x1-x)/is.slope;
      const s = t>=1 ? 1 : t*t*(3-2*t);
      return SEA - is.h*s - (t>=1 ? Math.sin(x*0.013+is.seed)*3 : 0);
    }
  }
  return SEA;
}
function overSea(x){ return groundY(x) >= SEA-0.5; }

function newLevel(idx, loadout, def){
  const L = def || LEVELS[idx];
  const st = planeStats(loadout.plane, loadout.up);
  G = {
    idx, def:L, time:0, cam:{x:0, top:0}, islands:[], structures:[], ships:[], soldiers:[], enemies:[], wingmen:[],
    shots:[], drops:[], flak:[], fx:[], debris:[], clouds:[], rain:[],
    carrier:{x:150, len:520, hp:400, max:400, hit:0},
    weather:{time:L.time, rain:L.rain, wind:L.wind, storm:L.storm, flash:0, gust:0},
    earned:0, kills:0, lives:L.training?99:5, training:!!L.training, state:'deck', msg:[], zeroT:L.zeroEvery*0.8, bomberT:30, bossSpawned:false, boss:null,
    complete:false, wingMode:'escort', loadout, stats:st, paused:false, endT:0
  };
  // islands
  let x = 2300;
  for(let i=0;i<L.islands;i++){
    const last = i===L.islands-1;
    const w = (L.boss==='fortress' && last) ? 1700 : rnd(950,1350);
    G.islands.push({x0:x, x1:x+w, h:(L.boss==='fortress'&&last)?95:rnd(42,64), slope:130, seed:rnd(0,9), palms:[]});
    x += w + rnd(1500,2100);
  }
  G.L = x + 900;
  // structures per island
  G.islands.forEach((is,i)=>{
    const fortress = L.boss==='fortress' && i===G.islands.length-1;
    const a = is.x0+is.slope+40, b = is.x1-is.slope-40;
    let types;
    if(fortress) types=['aa','biggun','light','bunker','biggun','core','biggun','aa','light','fuel'];
    else {
      types=['bunker','aa','barracks','bunker','fuel'];
      if(idx>0) types.push('aa');
      if(idx>2) types.splice(2,0,'bunker');
      if(L.time==='night') { types.splice(1,0,'light'); types.push('light'); }
      types.sort(()=>Math.random()-0.5);
    }
    const step = (b-a)/types.length;
    types.forEach((t,k)=>G.structures.push(makeStruct(t, a+step*(k+0.5)+rnd(-step*0.15,step*0.15))));
    for(let p=0;p<Math.floor((b-a)/180);p++) is.palms.push({x:rnd(a-60,b+60), s:rnd(0.8,1.3)});
  });
  // ships between islands
  for(let i=0;i<L.ships;i++){
    const gapStart = i < G.islands.length ? G.islands[i].x1 : G.L-1500;
    const gapEnd = i+1 < G.islands.length ? G.islands[i+1].x0 : gapStart+1200;
    const cx = (gapStart+gapEnd)/2;
    G.ships.push(makeShip('destroyer', cx, gapStart+250, gapEnd-250));
  }
  if(L.boss==='battleship'){
    const lastIs = G.islands[G.islands.length-1];
    G.L += 1400;
    G.ships.push(makeShip('battleship', lastIs.x1+900, lastIs.x1+500, G.L-500));
  }
  // clouds
  for(let i=0;i<Math.ceil(G.L/500);i++) G.clouds.push({x:rnd(-500,G.L+500), y:rnd(CEIL-100,280), s:rnd(0.6,1.6), par:rnd(0.3,0.8)});
  for(let i=0;i<220;i++) G.rain.push({x:Math.random(), y:Math.random(), v:rnd(0.8,1.2)});
  // wingmen
  loadout.wing.forEach((w,i)=>{
    const d = WINGMEN[w];
    G.wingmen.push({kind:w, role:d.role, x:G.carrier.x+100+i*90, y:DECK_Y-60-i*40, a:0, speed:d.speed, hp:d.hp, max:d.hp,
      cool:0, bombs:4, state:'wait', color:d.color, slot:i, dead:false, team:'p'});
  });
  Music.stop();
  resetPlayer();
  say('המטוס על הסיפון. הגבר מצערת (W / →) ומשוך ↑ כדי להמריא');
}

function makeShip(type, x, minX, maxX){
  if(type==='battleship'){
    return {type, x, minX, maxX, dir:-1, speed:12, w:440, h:48, hp:1400, max:1400, dead:false, sink:0, primary:true,
      turrets:[-160,-80,90,170].map(dx=>({dx, hp:170, max:170, cool:rnd(1,3), dead:false}))};
  }
  return {type, x, minX, maxX, dir:Math.random()<.5?1:-1, speed:22, w:170, h:26, hp:300, max:300, dead:false, sink:0, primary:true,
    turrets:[{dx:20, hp:60, max:60, cool:rnd(1,3), dead:false}]};
}

function resetPlayer(){
  const st = G.stats, lo = G.loadout;
  G.player = {x:G.carrier.x+70, y:DECK_Y-9, f:1, p:0, loop:null, speed:0, throttle:0, hp:st.hp, max:st.hp, fuel:st.fuel, maxFuel:st.fuel,
    ammo:500, ordType:lo.ord, ord:st.ord[lo.ord], ordMax:st.ord[lo.ord], onDeck:true, cool:0, ordCool:0, gunnerCool:0, inv:2, dead:false, stall:false, hitT:0, smoke:0, gear:1, gearWant:1, airT:0};
  G.state='deck';
  SFX.setEngineProfile(G.loadout.plane);
}

function say(text, t=4){ G.msg.push({text, t}); if(G.msg.length>3) G.msg.shift(); }

function primariesLeft(){
  let n=0;
  for(const s of G.structures) if(s.primary && !s.dead) n++;
  for(const s of G.ships) if(!s.dead) n++;
  if(G.def.boss==='emily' && !(G.boss && G.boss.dead)) n++;
  return n;
}
