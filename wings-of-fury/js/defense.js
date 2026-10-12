// ---- "Carrier Defense": survive ten attack waves, then strike the Japanese task force ----
// Phase 1: our carrier has been found. Wave N launches 5N Zeros and 2N Val dive bombers from a Japanese carrier
// beyond our reach; they fly in to sink our carrier. Clearing a wave repairs the carrier a little and returns a
// spare aircraft. Phase 2 (after wave 10): a second US carrier arrives with its air group, the map opens up,
// and the player leads the strike on the enemy carrier and its escorts.

const DEFENSE_WAVES = 10;
const DEFENSE = {
  name:'הגנה על הנושאת', mode:'defense',
  brief:'הצי היפני גילה את הנושאת שלנו. גלי תקיפה של מטוסי זירו ומפציצי צלילה "ואל" ממריאים מנושאת יפנית ומנסים להטביע אותה, וכל גל גדול מהקודם. שרוד עשרה גלים, ואז תגיע נושאת אמריקאית נוספת ותצא להשמיד את כוח המשימה היפני.',
  time:'day', rain:0, wind:10, storm:false, islands:0, ships:0, zeroEvery:1e9, bombers:false, boss:null, jcarrier:false, reward:5000
};

function defenseSetup(){
  G.L = 5000;                                              // a wide stretch of ocean: raids take a while to arrive
  G.carrier.hp = G.carrier.max = 1200;
  // the enemy task force waits beyond the edge of the map (out of reach) until the strike phase
  const jc = makeShip('jcarrier', G.L+900, G.L+900, G.L+900); jc.speed = 0; jc.dir = -1;
  const d1 = makeShip('destroyer', G.L+450, G.L+350, G.L+600), d2 = makeShip('destroyer', G.L+1350, G.L+1250, G.L+1500);
  for(const sh of [jc, d1, d2]){ sh.turrets.forEach(t=>t.cool = 1e9); G.ships.push(sh); }
  G.jc = jc;
  G.defense = {wave:0, phase:1, state:'between', t:5, queue:[], live:[], spawnT:0, bonus:0};
  say('הנושאת זוהתה! גל התקיפה הראשון בדרך', 4);
}

function startWave(n){
  const D = G.defense; D.wave = n; D.state = 'launching'; D.live = []; D.spawnT = 0;
  const zeros = 5*n, vals = 2*n, q = [];
  // A wave is made of n strike groups, launched several seconds apart so they arrive one after another:
  // each group is a pair of Vals (spaced out on the deck), three Zeros flying close escort on them,
  // and two Zeros sweeping ahead for fighters.
  for(let g=0; g<n; g++){
    const grp = {vals:[], high: g%2===1};                    // every other group comes in at high altitude
    q.push({type:'val',  grp, vIdx:0, next:1.6});
    q.push({type:'val',  grp, vIdx:1, next:1.0});
    for(let k=0;k<5;k++) q.push({type:'zero', grp, escortOf:0, slot:k, next: k<4 ? 0.7 : (g<n-1 ? 10 : 0)});
  }
  D.queue = q;
  say(`גל ${n} מתוך ${DEFENSE_WAVES}: ${zeros} מטוסי זירו ו-${vals} מפציצי צלילה ממריאים מהנושאת היפנית!`, 4); SFX.alarm();
}

function defenseUpdate(dt){
  const D = G.defense; if(!D) return;
  if(D.phase===1){
    if(D.state==='between'){ D.t -= dt; if(D.t<=0) startWave(D.wave+1); return; }
    if(D.state==='launching'){
      D.spawnT -= dt;
      if(D.spawnT<=0 && D.queue.length){
        const it = D.queue.shift();
        const e = launchFrom({kind:'carrier', sh:G.jc, x:G.jc.x}, it.type);
        if(it.type==='val'){                                  // the pair flies stepped up, low or high
          it.grp.vals[it.vIdx] = e;
          e.cruiseY = it.grp.high ? CEIL + 220 + it.vIdx*45 : DECK_Y - 300 - it.vIdx*45;
        }
        else if(it.grp){
          e.escort = it.grp.vals[it.escortOf] || it.grp.vals[0]; e.eslot = it.slot;
          e.role = it.slot%2===0 ? 'strike' : 'fighter';   // about half of each flight goes for the carrier, half fights in the air
        }
        D.live.push(e); D.spawnT = it.next;
      }
      if(!D.queue.length) D.state = 'fighting';
    }
    // a wave is over when every attacker has been shot down, crashed or flown home
    const left = D.live.filter(e=>!e.dead && G.enemies.includes(e)).length;
    if(D.state==='fighting' && left===0){
      const bonus = 300*D.wave; G.earned += bonus; D.bonus += bonus;
      G.carrier.hp = Math.min(G.carrier.max, G.carrier.hp + G.carrier.max*0.15);
      G.lives = Math.min(5, G.lives+1);
      SFX.pickup();
      if(D.wave >= DEFENSE_WAVES){ startStrike(); return; }
      say(`גל ${D.wave} הושמד! בונוס $${bonus}, הנושאת תוקנה חלקית ונוסף מטוס. הגל הבא בעוד כמה שניות`, 4);
      D.state = 'between'; D.t = 7;
    }
  }
}

function startStrike(){
  const D = G.defense, C = G.carrier;
  D.phase = 2; D.state = 'strike';
  G.L += 1900;                                              // the Japanese task force is now within reach
  for(const sh of G.ships) sh.turrets.forEach(t=>t.cool = rnd(1,3));
  G.jc.speed = 8;  G.jc.minX = G.jc.x - 300; G.jc.maxX = G.jc.x + 300;
  // reinforcements: a second carrier and its air group, launching from its own deck
  G.carrier2 = {x:C.x + C.len + 260, len:C.len, hp:1200, max:1200, hit:0};
  const n0 = G.wingmen.length;
  ['wildcat','helldiver','wildcat','helldiver'].forEach((k,i)=>{
    const d = WINGMEN[k];
    const wm = {kind:k, role:d.role, x:0, y:0, a:0, speed:0, hp:d.hp, max:d.hp, cool:0, bombs:4, state:'launch', color:d.color, slot:n0+i, dead:false, team:'p'};
    startWingLaunch(wm, 0.6 + (3-i)*1.4, G.carrier2.x + 170 + i*80);
    G.wingmen.push(wm);
  });
  G.wingMode = 'attack';
  G.def.zeroEvery = 16; G.zeroT = 10;                        // the enemy carrier keeps launching fighters while afloat
  say('שרדת עשרה גלים! נושאת אמריקאית נוספת הגיעה עם כנפיים. צא להטביע את הנושאת היפנית ואת המשחתות שלה', 6);
}

// wave status under the mini-map
function drawDefenseHUD(ctx, vw){
  const D = G.defense; if(!D) return;
  let text;
  if(D.phase===2){ const n = G.ships.filter(s=>!s.dead).length; text = n ? `מתקפת נגד: נותרו ${n} ספינות אויב` : 'כוח המשימה היפני הושמד! נחת על הנושאת'; }
  else if(D.state==='between') text = D.wave ? `גל ${D.wave} הושמד · הגל הבא בעוד ${Math.ceil(D.t)}` : `גל התקיפה הראשון בעוד ${Math.ceil(D.t)}`;
  else { const left = D.live.filter(e=>!e.dead && G.enemies.includes(e)).length + D.queue.length; text = `גל ${D.wave} מתוך ${DEFENSE_WAVES} · נותרו ${left} מטוסי אויב`; }
  ctx.save(); ctx.direction='rtl'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font='15px Rubik, sans-serif';
  const w = ctx.measureText(text).width + 30, y = 76;
  ctx.fillStyle='rgba(20,34,52,.45)'; ctx.fillRect(vw/2-w/2, y-13, w, 26);
  ctx.shadowColor='rgba(0,0,0,.7)'; ctx.shadowBlur=3; ctx.fillStyle='#f2d58a'; ctx.fillText(text, vw/2, y);
  ctx.restore();
}

// Aichi D3A "Val": climbs out at altitude, rolls into a steep dive on the carrier, releases low and pulls out
function valAI(e, dt){
  const C = G.carrier, cx = C.x + C.len*0.5;
  if(!e.ph) e.ph = 'cruise';
  if(e.ph==='cruise'){
    e.speed += (e.full - e.speed)*Math.min(1, dt);
    steer(e, cx + 180, e.cruiseY || DECK_Y-300, 1.0, dt);
    if(Math.abs(e.x - cx) < 240 && e.y < DECK_Y-200) e.ph = 'dive';
  } else if(e.ph==='dive'){
    // steep dive straight at the deck (no terrain avoidance: it is aiming for the ship)
    e.speed = Math.min(e.full*1.5, e.speed + 140*dt);
    const want = Math.atan2(DECK_Y-5 - e.y, cx - e.x), d = wrapA(want - e.a);
    e.a = wrapA(e.a + clamp(d, -2.4*dt, 2.4*dt));
    e.x += Math.cos(e.a)*e.speed*dt; e.y += Math.sin(e.a)*e.speed*dt;
    if(DECK_Y - e.y < 170){
      G.drops.push({kind:'bomb', x:e.x, y:e.y+8, vx:Math.cos(e.a)*e.speed*0.9, vy:Math.sin(e.a)*e.speed*0.9, team:'e', dmg:90, r:55});
      SFX.drop(); e.ph = 'pull'; e.t = 1.3;
    }
  } else if(e.ph==='pull'){
    const want = Math.cos(e.a) >= 0 ? -0.9 : -Math.PI+0.9, d = wrapA(want - e.a);
    e.a = wrapA(e.a + clamp(d, -2.8*dt, 2.8*dt));
    e.x += Math.cos(e.a)*e.speed*dt; e.y += Math.sin(e.a)*e.speed*dt;
    e.t -= dt; if(e.t<=0) e.ph = 'home';
  } else {
    e.speed += (e.full - e.speed)*Math.min(1, dt);
    steer(e, G.L + 1150, 160, 1.2, dt);                     // flies home and leaves the area
  }
  // rear gunner
  const P = G.player;
  if(!P.dead && !P.onDeck && dist2(e.x,e.y,P.x,P.y) < 300*300 && Math.random() < dt*2){
    const a = Math.atan2(P.y-e.y, P.x-e.x) + rnd(-0.12,0.12);
    G.shots.push({x:e.x, y:e.y, vx:Math.cos(a)*700, vy:Math.sin(a)*700, team:'e', dmg:2.5, life:0.55});
  }
}
