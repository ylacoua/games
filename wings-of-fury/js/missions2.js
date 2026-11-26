// ---- Three more special missions: supply drop, photo reconnaissance, transport escort ----
// Built on the same hooks as specials.js (setup / update / draw / over / hud / short / air / friend / drop).

// marines holding the western end of an island: a few figures, a flag and green smoke over the drop zone
function drawMarines(ctx, S){
  const z = S.zone, y = x => groundY(x);
  drawUSFlag(ctx, z.x0 - 30, y(z.x0 - 30) - 34, 0.6);
  ctx.strokeStyle = '#3a3a30'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(z.x0 - 30, y(z.x0 - 30)); ctx.lineTo(z.x0 - 30, y(z.x0 - 30) - 34); ctx.stroke();
  for(let i = 0; i < 7; i++){
    const x = z.x0 + 20 + i*(z.x1 - z.x0 - 40)/6, gy = y(x), wave = Math.sin(G.time*5 + i)*2;
    ctx.fillStyle = '#5c6440'; ctx.fillRect(x - 1.5, gy - 8, 3, 8);
    ctx.fillStyle = '#4b5236'; ctx.beginPath(); ctx.arc(x, gy - 9.5, 2.1, Math.PI, 0); ctx.fill();          // helmet
    if(i % 2){ ctx.strokeStyle = '#d9b48a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 1, gy - 7); ctx.lineTo(x + 4, gy - 12 + wave); ctx.stroke(); }
  }
  // the drop zone: white panels on the ground and green smoke drifting up
  ctx.fillStyle = 'rgba(245,245,235,.85)';
  for(const x of [z.x0 + 30, (z.x0 + z.x1)/2, z.x1 - 30]) ctx.fillRect(x - 9, y(x) - 1.5, 18, 2.5);
  for(let k = 0; k < 5; k++){
    const ph = (G.time*0.35 + k/5) % 1, sx = (z.x0 + z.x1)/2 + ph*G.weather.wind*2 + Math.sin(ph*6 + k)*6;
    softSmoke(ctx, '#7fbf7a', sx, y((z.x0 + z.x1)/2) - 6 - ph*90, 8 + ph*16, 0.45*(1 - ph));
  }
}
function drawCanister(ctx, c){
  ctx.save(); ctx.translate(c.x, c.y);
  if(c.open > 0.05){
    const r = 3 + 9*c.open; ctx.rotate(Math.sin(c.t*2)*0.12);
    ctx.fillStyle = '#e9e3cf'; ctx.beginPath(); ctx.arc(0, -20, r, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,40,40,.5)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-r, -20); ctx.lineTo(0, -5); ctx.moveTo(r, -20); ctx.lineTo(0, -5); ctx.stroke();
  }
  ctx.fillStyle = '#566043'; ctx.fillRect(-3, -6, 6, 9); ctx.fillStyle = '#c9b46a'; ctx.fillRect(-3, -3, 6, 1.5);
  ctx.restore();
}

// the C-47 transport: an Avenger airframe drawn larger in olive drab, with a second engine nacelle
const TR_SKIN = {s: {top: '#5d6142', side: '#686d4a', under: '#a9ab9a', hi: 'rgba(220,220,190,.25)'}, wing: '#5a5e40'};
function drawTransport(ctx, v){
  ctx.save(); ctx.translate(v.x, v.y); ctx.scale(v.dir, 1); ctx.rotate(-(v.pitch || 0));
  drawPlane(ctx, 'avenger', TR_SKIN, null, 1.4, v.flash > 0, true, v.gear || 0);
  ctx.fillStyle = v.flash > 0 ? '#fff' : '#4f5338'; ctx.beginPath(); ctx.ellipse(12, 5, 9, 3.2, 0, 0, 7); ctx.fill();   // the far engine
  ctx.restore();
  const k = v.hp/v.max; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(v.x - 22, v.y - 32, 44, 4);
  ctx.fillStyle = k < 0.35 ? '#c8402f' : k < 0.67 ? '#e8b33a' : '#7fd0ff'; ctx.fillRect(v.x - 22, v.y - 32, 44*k, 4);
  if(k < 0.5 && Math.random() < 0.3) puff(v.x - v.dir*20, v.y, '#3a3835', 7, 1.2);
}

Object.assign(SPECIALS, {

// 9. ---------------------------------------------------------------------------------------------------
supply:{
  name:'אספקה למכותרים', icon:'📦', reward:5000, zeroEvery:28, wind:-8,
  brief:'כוח נחתים מחזיק את הקצה המערבי של אי, מוקף בכוחות יפניים, ונגמרים לו התחמושת והמים. על הנושאת מחכים עשרה מכלי אספקה עם מצנחים. המטוס שלך נושא ארבעה בכל גיחה. כשאתה מעל אזור ההטלה, X מטיל מכל במקום פצצה. המכל צונח לאט ונסחף ברוח, אז צריך להטיל לפני המטרה. מכל שנופל מחוץ לאזור הולך לים או לאויב.',
  goals:['טוס לאזור ההטלה (עשן ירוק ולוחות לבנים) ליד הנחתים','מעל האזור: X מטיל מכל אספקה. צריך שישה מכלים בתוך האזור','נ"מ יפני בצד המזרחי של האי. אפשר להשמיד אותו בפצצות בגיחה נפרדת','חזור לנושאת לעוד מכלים, ובסוף נחת כדי לסיים'],
  tip:'הרוח נושבת מערבה ומסיטה את המכלים. הטל כשאתה מעט ממזרח לעשן, נמוך ולאט.',
  setup(S){
    G.L = 6600;
    specIsland(3100, 1900, 60, [['aa',4150],['bunker',4320],['aa',4480],['barracks',4640],['aa',4800]], {soldiers:10, sx0:3950, sx1:4800});
    S.zone = {x0:3380, x1:3720}; S.stock = 10; S.carry = 0; S.del = 0; S.need = 6; S.cans = []; S.plane = null;
    say('הנחתים במערב האי צריכים אספקה. טוס אל העשן הירוק', 5);
  },
  // X near the drop zone releases a canister instead of the aircraft's own ordnance
  drop(S, P){
    if(S.carry <= 0 || Math.abs(P.x - (S.zone.x0 + S.zone.x1)/2) > 700) return false;
    if(P.ordCool > 0) return true;
    const v = playerVel(P); S.carry--; P.ordCool = 0.6;
    S.cans.push({x: P.x, y: P.y + 8, vx: v.vx*0.6, vy: Math.max(0, v.vy*0.5), t: 0, open: 0});
    SFX.drop(); return true;
  },
  update(S, dt){
    const P = G.player;
    if(S.plane !== P){                                             // a new aircraft on the deck: load it
      if(S.plane && !S.plane.dead) S.stock += S.carry;           // what came back goes back on the shelf
      S.plane = P; S.carry = Math.min(4, S.stock); S.stock -= S.carry;
    }
    for(const c of S.cans){
      c.t += dt; c.open = clamp((c.t - 0.4)/0.6, 0, 1);
      c.vx += (G.weather.wind*0.9 - c.vx)*Math.min(1, dt*(0.5 + c.open)); c.x += c.vx*dt;
      c.vy = c.open > 0.5 ? Math.min(c.vy + 60*dt, 38) : c.vy + 250*dt; c.y += c.vy*dt;
      if(c.y >= groundY(c.x) - 3){
        c.done = true;
        if(c.x >= S.zone.x0 && c.x <= S.zone.x1){ S.del++; SFX.pickup(); say(`המכל הגיע לנחתים! ${S.del} מתוך ${S.need}`, 2.5); }
        else if(overSea(c.x)){ splash(c.x); say('המכל נפל לים', 2); }
        else say('המכל נפל לידי האויב', 2);
      }
    }
    S.cans = S.cans.filter(c => !c.done);
    if(!G.complete && S.del >= S.need) specialLandToFinish('האספקה הגיעה לנחתים! חזור לנושאת ונחת כדי לסיים');
    if(!G.complete && S.del + S.stock + S.carry + S.cans.length < S.need) specialEnd(false, 'לא נשארו מספיק מכלי אספקה.');
  },
  draw(ctx, S){ drawMarines(ctx, S); for(const c of S.cans) drawCanister(ctx, c); },
  hud(S){
    const P = G.player, near = !P.dead && !P.onDeck && S.carry > 0 && Math.abs(P.x - (S.zone.x0 + S.zone.x1)/2) < 700;
    return [`מכלים שהגיעו: ${S.del} מתוך ${S.need} · על המטוס: ${S.carry} · על הנושאת: ${S.stock}`, near ? 'מעל אזור ההטלה: X מטיל מכל' : ''];
  },
  short: S => `אספקה ${S.del}/${S.need}`
},

// 10. --------------------------------------------------------------------------------------------------
recon:{
  name:'עין בשמיים', icon:'📷', reward:4500, zeroEvery:1e9, time:'dawn',
  brief:'לפני הפלישה צריך צילומים עדכניים של שני איים: שתי תחנות מכ"ם ושני מחסני דלק. טוס מעליהם ישר ויציב, בגובה 400 עד 1,200 רגל מעל הקרקע, והמצלמה תצלם לבד. כל עוד האויב לא יודע שאתה שם, לא ימריאו מטוסים. ירי, הטלת חימוש או טיסה נמוכה מעל אי יפעילו אזעקה, ומטוסי זירו יזנקו אחריך.',
  goals:['צלם את ארבע המטרות המסומנות: טוס מעליהן ישר, בגובה 400 עד 1,200 רגל','אל תירה ואל תטיל חימוש, ואל תטוס נמוך מעל האיים, כדי לא להפעיל אזעקה','חזור לנושאת ונחת עם הסרט'],
  tip:'שמור על האף ישר מעל המטרה. אם הופעלה אזעקה, עדיף להשלים את הצילומים מהר ולברוח לנושאת.',
  setup(S){
    G.L = 6800;
    specIsland(2200, 1500, 58, [['radar',2480],['barracks',2700],['fuel',2920],['bunker',3150],['aa',3400]], {soldiers:6});
    specIsland(4500, 1500, 62, [['bunker',4720],['fuel',4950],['aa',5150],['barracks',5300],['radar',5520]], {soldiers:6});
    S.marks = G.structures.filter(s => s.type === 'radar' || s.type === 'fuel').map(s => ({s, prog: 0, done: false}));
    S.alarm = false; S.lowT = 0;
    say('משימת צילום. טוס ישר מעל המטרות המסומנות, בלי לירות', 5);
  },
  raise(S, why){
    if(S.alarm) return;
    S.alarm = true; G.def.zeroEvery = 15; G.zeroT = 3; SFX.alarm();
    say(`אזעקה! ${why} – מטוסי זירו בדרך`, 4); radio('נושאת', 'גילו אותך! סיים את הצילומים ותחזור מהר', null);
  },
  drop(S){ SPECIALS.recon.raise(S, 'הטלת חימוש'); return false; },
  update(S, dt){
    const P = G.player, M = SPECIALS.recon;
    if(P.dead || P.onDeck) return;
    if(keys.Space && P.ammo > 0) M.raise(S, 'פתחת באש');
    const overIsland = G.islands.some(is => P.x > is.x0 && P.x < is.x1), alt = groundY(P.x) - P.y;
    S.lowT = overIsland && alt < 100 ? S.lowT + dt : 0;
    if(S.lowT > 1.2) M.raise(S, 'טסת נמוך מדי מעל האי');
    for(const m of S.marks){
      if(m.done) continue;
      const inside = Math.abs(P.x - m.s.x) < 70 && alt > 130 && alt < 400 && Math.abs(P.p) < 0.3 && !P.loop && !P.mv && !P.vl;
      m.prog = inside ? m.prog + dt/1.2 : Math.max(0, m.prog - dt*0.5);
      if(m.prog >= 1){
        m.done = true; SFX.tone(1800, 1800, 0.05, 0.06, 'square'); SFX.tone(900, 600, 0.12, 0.05, 'square');
        G.fx.push({type:'text', x: P.x, y: P.y + 30, t: 0, max: 1.2, text: '📸'});
        const left = S.marks.filter(q => !q.done).length;
        say(left ? `צילום! נותרו ${left}` : 'כל הצילומים נלקחו!', 2.5);
      }
    }
    if(!G.complete && S.marks.every(m => m.done)) specialLandToFinish('כל הצילומים נלקחו! חזור לנושאת ונחת עם הסרט');
  },
  over(ctx, S){
    for(const m of S.marks){
      if(m.done) continue;
      const x = m.s.x, y = m.s.y - m.s.h - 30, r = 16, c = 'rgba(255,230,120,.9)';
      ctx.strokeStyle = c; ctx.lineWidth = 2;
      ctx.beginPath();
      for(const [sx, sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ ctx.moveTo(x + sx*r, y + sy*(r - 6)); ctx.lineTo(x + sx*r, y + sy*r); ctx.lineTo(x + sx*(r - 6), y + sy*r); }
      ctx.stroke();
      if(m.prog > 0){ ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - 18, y + r + 5, 36, 4); ctx.fillStyle = '#ffe27a'; ctx.fillRect(x - 18, y + r + 5, 36*Math.min(1, m.prog), 4); }
      ctx.fillStyle = c; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('📷', x, y + 4);
    }
  },
  hud(S){
    const n = S.marks.filter(m => m.done).length;
    return [`צילומים: ${n} מתוך ${S.marks.length} · ${S.alarm ? 'אזעקה! מטוסי זירו בדרך' : 'האויב עוד לא יודע שאתה כאן'}`, 'טוס ישר מעל המטרה, בגובה 400 עד 1,200 רגל מעל הקרקע'];
  },
  short: S => `צילומים ${S.marks.filter(m => m.done).length}/${S.marks.length}`
},

// 11. --------------------------------------------------------------------------------------------------
escort:{
  name:'ליווי התובלה', icon:'🛩', reward:5000, zeroEvery:24, wind:4,
  brief:'מטוס תובלה כבד עם רופאים ותרופות טס מהנושאת לשדה תעופה אמריקאי על אי רחוק. הדרך עוברת ליד אי יפני עם שדה תעופה, ומטוסי זירו יתקפו את התובלה בגלים. התובלה איטית, גדולה ובלי נשק. הישאר לידה והפל כל מי שמתקרב.',
  goals:['לווה את מטוס התובלה עד שינחת בשדה התעופה האמריקאי במזרח','הפל את מטוסי הזירו לפני שיגיעו אליה. הם יבואו בגלים','אם התובלה מופלת, המשימה נכשלת'],
  tip:'מטוסי הזירו ממריאים מהאי שבאמצע הדרך. פצצות על המסלול שלו יעצרו את ההמראות לדקה.',
  setup(S){
    G.L = 7800;
    specIsland(3300, 1300, 58, [['aa',3520],['bunker',3700],['barracks',3900],['aa',4080],['fuel',4250]], {soldiers:5});
    const home = specIsland(6300, 1300, 50, []); home.captured = true; home.friendly = true;
    S.home = home; S.wave = 0;
    const C = G.carrier;
    S.tr = {x: C.x + C.len + 60, y: DECK_Y - 60, dir: 1, speed: 78, hp: 170, max: 170, flash: 0, dead: false, pitch: 0.06, ph: 'climb', gear: 0};
    say('מטוס התובלה ממריא. הישאר לידו', 4);
  },
  update(S, dt){
    const v = S.tr, M = SPECIALS.escort; if(v.dead) return;
    v.flash = Math.max(0, v.flash - dt);
    const landX = (S.home.x0 + S.home.x1)/2;
    if(v.ph === 'climb'){ v.x += v.speed*dt; v.y += (170 - v.y)*Math.min(1, dt*0.4); v.pitch = (v.y - 170)*0.002; if(Math.abs(v.y - 170) < 6) v.ph = 'cruise'; }
    else if(v.ph === 'cruise'){
      v.x += v.speed*dt; v.y = 170 + Math.sin(S.t*0.7)*4; v.pitch = 0;
      if(v.x > landX - 900) v.ph = 'land';
    } else if(v.ph === 'land'){
      const gy = groundY(landX) - 12, d = Math.max(1, landX - v.x);
      v.speed = Math.max(55, v.speed - 6*dt); v.x += v.speed*dt; v.y += (gy - v.y)*Math.min(1, v.speed*dt/d*1.3); v.pitch = -0.08; v.gear = Math.min(1, v.gear + dt);
      if(v.y >= gy - 2 || v.x >= landX){ v.ph = 'down'; v.y = gy; specialEnd(true, 'מטוס התובלה נחת בשלום! הרופאים והתרופות הגיעו'); }
    }
    // waves of Zeros from the island airfield, aimed at the transport
    const waveAt = [14, 38, 62, 86];
    if(S.wave < waveAt.length && S.t > waveAt[S.wave]){
      const is = G.islands[0], site = {kind: 'island', x: (is.strip.x0 + is.strip.x1)/2, is};
      if(!stripCratered(is) && G.structures.some(s => s.island === 0 && !s.dead)){
        const n = 2 + Math.min(2, S.wave);
        for(let k = 0; k < n; k++){ const e = launchFrom(site, 'zero', k*1.3); e.tgtO = v; e.tgtT = 12; }
        say(`גל ${S.wave + 1}: ${n} מטוסי זירו ממריאים לעבר התובלה!`, 3); SFX.alarm();
      }
      S.wave++;
    }
  },
  air(S){ const v = S.tr; return !v.dead && v.ph !== 'down' ? [{o: v, x: v.x, y: v.y, vx: v.dir*v.speed, vy: 0}] : []; },
  friend(S, s){
    const v = S.tr; if(v.dead || Math.abs(s.x - v.x) > 30 || Math.abs(s.y - v.y) > 12) return false;
    s.life = 0; v.hp -= s.dmg*0.8; v.flash = 0.1; spark(s.x, s.y);
    if(v.hp <= 0){ v.dead = true; boom(v.x, v.y, 50, true); specialEnd(false, 'מטוס התובלה הופל.'); }
    return true;
  },
  draw(ctx, S){
    const h = S.home, x = h.x0 + 200;
    drawUSFlag(ctx, x, groundY(x) - 34, 0.6);
    ctx.strokeStyle = '#3a3a30'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, groundY(x)); ctx.lineTo(x, groundY(x) - 34); ctx.stroke();
    if(!S.tr.dead) drawTransport(ctx, S.tr);
  },
  hud(S){
    const v = S.tr, landX = (S.home.x0 + S.home.x1)/2, start = G.carrier.x + G.carrier.len;
    const prog = Math.round(clamp((v.x - start)/(landX - start), 0, 1)*100);
    return [`מטוס התובלה: ${pct(v.hp, v.max)} · הדרך: ${prog}%`, v.ph === 'land' ? 'התובלה יורדת לנחיתה – עוד רגע!' : ''];
  },
  short: S => `התובלה ${pct(S.tr.hp, S.tr.max)}`
}
});
SPECIAL_ORDER.push('supply', 'recon', 'escort');

// third stars
Object.assign(STAR3, {
  supply: {t:'לפחות 8 מכלים מגיעים לנחתים', ok:()=>G.special.del >= 8, gain:true,
           fail:()=>{ const S = G.special; return S.del + S.stock + S.carry + S.cans.length < 8; }, p:()=>`מכלים ${G.special.del}/8`},
  recon:  {t:'צלם הכול בלי להפעיל אזעקה', ok:()=>!G.special.alarm, fail:()=>!!G.special.alarm, p:()=>G.special.alarm ? 'הופעלה אזעקה' : 'בלי אזעקה'},
  escort: {t:'התובלה מגיעה עם יותר משני שלישים מהחוזק', ok:()=>G.special.tr.hp > G.special.tr.max*0.67, p:()=>`תובלה ${pct(G.special.tr.hp, G.special.tr.max)}`}
});

// a paint scheme for each
Object.assign(SKINS, {
  paradrop: {name:'נחתים', desc:'ירוק זית עם פס צהוב על הגוף, כמו מטוסי האספקה של הנחתים.', price:2000, unlock:'supply', cowl:'#e0b93a',
             s:{top:'#5b6140', side:'#666c49', under:'#a7a996', hi:'rgba(220,220,180,.25)'}, wing:'#585e3e'},
  photo:    {name:'כחול צילום', desc:'כחול אחיד ומט, כמו מטוסי הסיור והצילום.', price:2200, unlock:'recon', flat:true,
             s:{top:'#5f7f9f', side:'#6888a8', under:'#7090ae', hi:'rgba(220,235,250,.2)'}, wing:'#62829f'},
  shepherd: {name:'הרועה', desc:'אפור כחול עם אף לבן וזנב כחול, לטייסת הליווי.', price:2400, unlock:'escort', cowl:'#f2efe6', fin:'#1d3566',
             s:{top:'#59708a', side:'#68809a', under:'#e3e6e8', hi:'rgba(230,240,250,.3)'}, wing:'#5c738c'}
});
for(const id of ['paradrop', 'photo', 'shepherd']) SKINS[id].id = id;

// ---------- English (combat.js and this file) ----------
Object.assign(LANG_EN, {
// combat.js
'הפלה כפולה!':'Double kill!', 'הפלה משולשת!':'Triple kill!', 'הפלה מרובעת!':'Quad kill!', 'רצף של {0} הפלות!':'{0}-kill streak!',
'אס ביום אחד! חמש הפלות בגיחה אחת +${0}':'Ace in a day! Five kills in one sortie +${0}',
'הפלה בתמרון!':'Kill mid-manoeuvre!', 'טיסה על הגלים!':'Wave-top flying!', 'כמעט התנגשות!':'Near miss!',
'המנוע נדם! גלוש לנושאת ונחת בלי מנוע':'Engine dead! Glide to the carrier and land without power',
'המנוע שלך נדם – גלוש אלינו, אנחנו מוכנים':'Your engine is dead – glide in to us, we\'re ready',
'המנוע נפגע! פחות כוח':'Engine hit! Less power', 'ההגאים נפגעו! המטוס מגיב לאט יותר':'Controls hit! The aircraft responds more slowly',
'מיכל הדלק נפגע ודולף!':'Fuel tank hit and leaking!', 'נחיתת חירום בלי מנוע! +${0}':'Dead-stick landing! +${0}',
'בתוך הענן – האויב לא רואה אותך':'Inside the cloud – the enemy can\'t see you',
'תחמושת כבדה':'Heavy rounds', 'מנוע מוגבר':'Engine boost', 'תיקון':'Repair', 'תחמושת וחימוש':'Ammo and ordnance',
'ארגז אספקה צנח! טוס דרכו כדי לקבל אותו':'A supply crate is coming down! Fly through it to collect it',
'{0} שניות':'{0} seconds',
'מטוס ימי יפני ממריא מהמים!':'A Japanese floatplane is taking off from the water!',
'קמיקזה! שני מטוסים ממריאים לצלול על הנושאת – יירט אותם!':'Kamikaze! Two aircraft taking off to dive on the carrier – intercept them!',
'מטוסי קמיקזה בדרך אלינו! יירט אותם לפני שיגיעו':'Kamikazes inbound! Intercept them before they get here',
'המסלול חורר! לא ימריאו ממנו מטוסים במשך דקה':'Airstrip cratered! No take-offs from it for a minute',
'מנוע: נדם':'Engine: dead', 'מנוע: פגוע':'Engine: hit', 'הגאים: פגועים':'Controls: hit', 'דליפת דלק':'Fuel leak',
'במלאי הנושאת: {0} {1}':'On the carrier: {0} {1}', 'במלאי הנושאת: {0}':'On the carrier: {0}', 'המלאי נגמר':'None left',
'{0} משימות מיוחדות':'{0} special missions', 'ספינת הנ"מ הוטבעה!':'Flak ship sunk!',
// missions2.js
'אספקה למכותרים':'Supplies for the Besieged', 'עין בשמיים':'Eye in the Sky', 'ליווי התובלה':'Transport Escort',
'כוח נחתים מחזיק את הקצה המערבי של אי, מוקף בכוחות יפניים, ונגמרים לו התחמושת והמים. על הנושאת מחכים עשרה מכלי אספקה עם מצנחים. המטוס שלך נושא ארבעה בכל גיחה. כשאתה מעל אזור ההטלה, X מטיל מכל במקום פצצה. המכל צונח לאט ונסחף ברוח, אז צריך להטיל לפני המטרה. מכל שנופל מחוץ לאזור הולך לים או לאויב.':
  'A Marine force holds the western end of an island, surrounded by Japanese troops, and is running out of ammunition and water. Ten parachute supply canisters wait on the carrier. Your aircraft carries four per sortie. Over the drop zone, X releases a canister instead of a bomb. It comes down slowly and drifts with the wind, so release ahead of the target. A canister that lands outside the zone goes into the sea or to the enemy.',
'טוס לאזור ההטלה (עשן ירוק ולוחות לבנים) ליד הנחתים':'Fly to the drop zone (green smoke and white panels) by the Marines',
'מעל האזור: X מטיל מכל אספקה. צריך שישה מכלים בתוך האזור':'Over the zone: X drops a supply canister. Six must land inside the zone',
'נ"מ יפני בצד המזרחי של האי. אפשר להשמיד אותו בפצצות בגיחה נפרדת':'Japanese AA on the eastern side of the island. You can bomb it on a separate sortie',
'חזור לנושאת לעוד מכלים, ובסוף נחת כדי לסיים':'Return to the carrier for more canisters, and land at the end to finish',
'הרוח נושבת מערבה ומסיטה את המכלים. הטל כשאתה מעט ממזרח לעשן, נמוך ולאט.':'The wind blows west and carries the canisters. Release a little east of the smoke, low and slow.',
'הנחתים במערב האי צריכים אספקה. טוס אל העשן הירוק':'The Marines in the west of the island need supplies. Fly to the green smoke',
'המכל הגיע לנחתים! {0} מתוך {1}':'The canister reached the Marines! {0} of {1}', 'המכל נפל לים':'The canister fell into the sea', 'המכל נפל לידי האויב':'The canister fell to the enemy',
'האספקה הגיעה לנחתים! חזור לנושאת ונחת כדי לסיים':'The supplies reached the Marines! Return to the carrier and land to finish',
'לא נשארו מספיק מכלי אספקה.':'Not enough supply canisters left.',
'מכלים שהגיעו: {0} מתוך {1} · על המטוס: {2} · על הנושאת: {3}':'Canisters delivered: {0} of {1} · On the aircraft: {2} · On the carrier: {3}',
'מעל אזור ההטלה: X מטיל מכל':'Over the drop zone: X drops a canister', 'אספקה {0}':'Supplies {0}',
'לפני הפלישה צריך צילומים עדכניים של שני איים: שתי תחנות מכ"ם ושני מחסני דלק. טוס מעליהם ישר ויציב, בגובה 400 עד 1,200 רגל מעל הקרקע, והמצלמה תצלם לבד. כל עוד האויב לא יודע שאתה שם, לא ימריאו מטוסים. ירי, הטלת חימוש או טיסה נמוכה מעל אי יפעילו אזעקה, ומטוסי זירו יזנקו אחריך.':
  'Before the invasion we need fresh photographs of two islands: two radar stations and two fuel depots. Fly over them straight and level, 400 to 1,200 feet above the ground, and the camera takes the picture by itself. As long as the enemy doesn\'t know you are there, no aircraft take off. Firing, dropping ordnance or flying low over an island raises the alarm, and Zeros scramble after you.',
'צלם את ארבע המטרות המסומנות: טוס מעליהן ישר, בגובה 400 עד 1,200 רגל':'Photograph the four marked targets: fly over them straight, at 400 to 1,200 feet',
'אל תירה ואל תטיל חימוש, ואל תטוס נמוך מעל האיים, כדי לא להפעיל אזעקה':'Don\'t fire, don\'t drop ordnance and don\'t fly low over the islands, or the alarm goes up',
'חזור לנושאת ונחת עם הסרט':'Return to the carrier and land with the film',
'שמור על האף ישר מעל המטרה. אם הופעלה אזעקה, עדיף להשלים את הצילומים מהר ולברוח לנושאת.':'Keep the nose level over the target. If the alarm goes up, finish the photographs quickly and run for the carrier.',
'משימת צילום. טוס ישר מעל המטרות המסומנות, בלי לירות':'Photo mission. Fly straight over the marked targets, without firing',
'אזעקה! {0} – מטוסי זירו בדרך':'Alarm! {0} – Zeros on the way', 'הטלת חימוש':'Ordnance dropped', 'פתחת באש':'You opened fire', 'טסת נמוך מדי מעל האי':'You flew too low over the island',
'גילו אותך! סיים את הצילומים ותחזור מהר':'You\'ve been spotted! Finish the photographs and get back fast',
'צילום! נותרו {0}':'Photo taken! {0} left', 'כל הצילומים נלקחו!':'All photographs taken!',
'כל הצילומים נלקחו! חזור לנושאת ונחת עם הסרט':'All photographs taken! Return to the carrier and land with the film',
'צילומים: {0} מתוך {1}':'Photographs: {0} of {1}', 'אזעקה! מטוסי זירו בדרך':'Alarm! Zeros on the way', 'האויב עוד לא יודע שאתה כאן':'The enemy doesn\'t know you\'re here yet',
'טוס ישר מעל המטרה, בגובה 400 עד 1,200 רגל מעל הקרקע':'Fly straight over the target, 400 to 1,200 feet above the ground', 'צילומים {0}':'Photos {0}',
'מטוס תובלה כבד עם רופאים ותרופות טס מהנושאת לשדה תעופה אמריקאי על אי רחוק. הדרך עוברת ליד אי יפני עם שדה תעופה, ומטוסי זירו יתקפו את התובלה בגלים. התובלה איטית, גדולה ובלי נשק. הישאר לידה והפל כל מי שמתקרב.':
  'A heavy transport with doctors and medicine flies from the carrier to an American airfield on a distant island. The route passes a Japanese island with an airfield, and Zeros will attack the transport in waves. The transport is slow, big and unarmed. Stay close and shoot down anyone who comes near.',
'לווה את מטוס התובלה עד שינחת בשדה התעופה האמריקאי במזרח':'Escort the transport until it lands at the American airfield in the east',
'הפל את מטוסי הזירו לפני שיגיעו אליה. הם יבואו בגלים':'Shoot down the Zeros before they reach it. They come in waves',
'אם התובלה מופלת, המשימה נכשלת':'If the transport is shot down, the mission fails',
'מטוסי הזירו ממריאים מהאי שבאמצע הדרך. פצצות על המסלול שלו יעצרו את ההמראות לדקה.':'The Zeros take off from the island halfway along. Bombs on its airstrip stop take-offs for a minute.',
'מטוס התובלה ממריא. הישאר לידו':'The transport is taking off. Stay with it',
'מטוס התובלה נחת בשלום! הרופאים והתרופות הגיעו':'The transport has landed safely! The doctors and medicine are through',
'גל {0}: {1} מטוסי זירו ממריאים לעבר התובלה!':'Wave {0}: {1} Zeros taking off after the transport!', 'מטוס התובלה הופל.':'The transport was shot down.',
'מטוס התובלה: {0} · הדרך: {1}':'Transport: {0} · Route: {1}', 'התובלה יורדת לנחיתה – עוד רגע!':'The transport is coming in to land – nearly there!', 'התובלה {0}':'Transport {0}',
'לפחות 8 מכלים מגיעים לנחתים':'At least 8 canisters reach the Marines', 'מכלים {0}':'Canisters {0}',
'צלם הכול בלי להפעיל אזעקה':'Photograph everything without raising the alarm', 'הופעלה אזעקה':'Alarm raised', 'בלי אזעקה':'No alarm',
'התובלה מגיעה עם יותר משני שלישים מהחוזק':'The transport arrives with more than two thirds of its strength', 'תובלה {0}':'Transport {0}',
'נחתים':'Marines', 'ירוק זית עם פס צהוב על הגוף, כמו מטוסי האספקה של הנחתים.':'Olive drab with a yellow band, like the Marines\' supply aircraft.',
'כחול צילום':'Photo blue', 'כחול אחיד ומט, כמו מטוסי הסיור והצילום.':'Flat matte blue, like the photo-reconnaissance aircraft.',
'הרועה':'The Shepherd', 'אפור כחול עם אף לבן וזנב כחול, לטייסת הליווי.':'Blue-grey with a white nose and blue tail, for the escort squadron.'
});
