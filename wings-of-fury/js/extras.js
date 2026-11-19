// ---- Mission extras: star ratings, the counter-attack that ends every campaign mission, enemy repair crews,
// and escalation as a mission drags on ----

// Campaign: enemy fighters launch more often the longer a mission lasts (down to 60% of the interval)
function escalation(){
  if(!G || G.special || G.defense || G.ground || G.training || G.tutorial) return 1;
  return Math.max(0.6, 1 - G.time/900);
}

// ---------- star ratings ----------
// ★ mission won · ★★ at most one aircraft lost · ★★★ the mission's own extra objective (listed in the briefing)
// ok: the objective holds right now · p: short progress for the in-flight star strip · fail: it can no longer be met
// · gain: worth announcing the moment it is reached (objectives that start out true are not)
const usCount = type => (type==='tank' ? G.ground.tanks : G.ground.inf) + usUnits().filter(u=>u.type===type).length;
const hpPct = (a, b) => Math.max(0, Math.round(100*a/b)) + '%';
const STAR3 = {
  campaign: {t:'השמד גם את כל המבנים המשניים (צריפים, מחסני דלק, זרקורים)', ok:()=>G.structures.every(s=>s.dead), gain:true,
             p:()=>{ const o = G.structures.filter(s=>!s.primary); return `מבנים משניים ${o.filter(s=>s.dead).length}/${o.length}`; }},
  def:      {t:'הנושאת שורדת עם לפחות חצי מהחוזק שלה', ok:()=>G.carrier.hp >= G.carrier.max*0.5, p:()=>`נושאת ${hpPct(G.carrier.hp, G.carrier.max)} (צריך 50%)`},
  gnd:      {t:'לפחות 3 טנקים שורדים', ok:()=>usCount('tank') >= 3, fail:()=>usCount('tank') < 3, p:()=>`טנקים ${usCount('tank')} (צריך 3)`},
  rescue:   {t:'שני הטייסים נאספים עם יותר מחצי בריאות', ok:()=>G.special.pilots.every(p=>p.hp > p.max*0.5),
             p:()=>`טייסים ${G.special.pilots.map(p=>hpPct(p.hp, p.max)).join(' / ')}`},
  dark:     {t:'השמד גם את כל הזרקורים', ok:()=>G.structures.filter(s=>s.type==='light').every(s=>s.dead), gain:true,
             p:()=>{ const l = G.structures.filter(s=>s.type==='light'); return `זרקורים ${l.filter(s=>s.dead).length}/${l.length}`; }},
  convoy:   {t:'כל ארבע הספינות מגיעות', ok:()=>G.special.convoy.every(s=>!s.dead), fail:()=>G.special.convoy.some(s=>s.dead),
             p:()=>`ספינות ${G.special.convoy.filter(s=>!s.dead).length}/4`},
  bridge:   {t:'הפל את הגשר בזמן שרכבת חוצה אותו', ok:()=>!!G.special.perfect, gain:true, fail:()=>!!(G.special.bridge && G.special.bridge.dead && !G.special.perfect),
             p:()=>G.special.perfect ? 'גשר ורכבת ✓' : 'גשר עם רכבת עליו'},
  clock:    {t:'השמד את כל ארבעת השדות לפני שהשעון נגמר', ok:()=>G.special.phase===1, fail:()=>G.special.phase===2, p:()=>'שדות לפני השעון'},
  ace:      {t:'נצח בשלושת הסיבובים תוך 7 דקות', ok:()=>G.special.t < 420, fail:()=>G.special.t >= 420,
             p:()=>`זמן ${mmss(Math.max(0, 420 - G.special.t))}`},
  burning:  {t:'הנושאת הבוערת שורדת עם לפחות חצי מהחוזק', ok:()=>G.carrier.hp >= G.carrier.max*0.5, p:()=>`נושאת ${hpPct(G.carrier.hp, G.carrier.max)} (צריך 50%)`},
  assault:  {t:'לפחות 12 חיילים שורדים', ok:()=>usCount('inf') >= 12, fail:()=>usCount('inf') < 12, p:()=>`חיילים ${usCount('inf')} (צריך 12)`}
};
const starMissionKey = () => !G || G.training || G.tutorial ? null : G.special ? G.special.id : G.defense ? 'def' : G.ground ? 'gnd' : G.idx;

// ---------- live star status during a mission ----------
// s1: mission complete (target), s2: still at most one plane lost, s3: 'ok' | 'fail' | 'open'; p: progress text.
// Each check runs safely: a mission still setting up simply reads as 'open'.
function starStatus(){
  const key = starMissionKey(); if(key == null) return null;
  const d = STAR3[starKey(key)], safe = f => { try{ return f(); }catch(e){ return undefined; } };
  const fail = d && d.fail && safe(d.fail), ok = d && safe(d.ok);
  return {s1: !!G.complete, s2: (G.lost||0) <= 1, s3: fail ? 'fail' : ok ? 'ok' : 'open', p: (d && d.p && safe(d.p)) || '', d};
}
// called every update: announces a star as it is won or lost (once each)
function starTick(){
  const st = starStatus(); if(!st) return;
  const T = G.starT || (G.starT = {s2:true, fail:false, got:false});
  if(T.s2 && !st.s2){ T.s2 = false; say('☆ הכוכב השני אבד: איבדת יותר ממטוס אחד', 4); }
  if(!T.fail && st.s3==='fail'){ T.fail = true; say(`☆ הכוכב השלישי אבד: ${st.d.t}`, 4.5); }
  if(!T.got && !T.fail && st.s3==='ok' && st.d.gain){ T.got = true; say(`★ יעד הכוכב השלישי הושג! ${st.d.t}`, 4); SFX.pickup(); }
}
// the strip under the mission panel: three stars (gold = held, red = lost, grey = still to win) and the progress
function drawStarStrip(ctx){
  const st = starStatus(); if(!st) return;
  ctx.fillStyle='rgba(8,16,28,.5)'; ctx.fillRect(8, 116, 178, 20);
  const col = s => s===true || s==='ok' ? '#f2c14e' : s==='fail' || s===false ? '#b8473a' : 'rgba(239,230,207,.38)';
  const glyph = s => s===false || s==='fail' ? '☆' : '★';
  ctx.font='14px Rubik, sans-serif'; ctx.textBaseline='middle';
  const rtl = !isEn(), x0 = rtl ? 178 : 16, dx = rtl ? -15 : 15;
  ctx.textAlign = rtl ? 'right' : 'left';
  [st.s1 ? true : 'open', st.s2, st.s3].forEach((s, i) => { ctx.fillStyle = col(s); ctx.fillText(glyph(s), x0 + dx*i, 126); });
  ctx.font='11px Rubik, sans-serif'; ctx.fillStyle = st.s3==='fail' ? 'rgba(239,230,207,.5)' : '#efe6cf';
  ctx.fillText(st.p, x0 + dx*3 + (rtl ? -4 : 4), 126.5);
}

// ---------- medals for the stars collected over all missions ----------
const MEDALS = [
  {n:12, name:'מדליית ארד',      icon:'🥉', r:1500},
  {n:24, name:'מדליית כסף',      icon:'🥈', r:3000},
  {n:36, name:'מדליית זהב',      icon:'🥇', r:5000},
  {n:48, name:'צלב חיל הים',     icon:'🎖️', r:10000}
];
const starsMax = () => (LEVELS.length + 2 + SPECIAL_ORDER.length) * 3;
const starsTotal = () => Object.values(SAVE.stars || {}).reduce((a, n) => a + (+n || 0), 0);
const medalsHeld = () => MEDALS.filter(m => SAVE.medals && SAVE.medals[m.n]);
const nextMedal = () => MEDALS.find(m => !(SAVE.medals && SAVE.medals[m.n]));
// award every medal the star total has reached and not yet been paid for; returns the new ones
function awardMedals(){
  SAVE.medals = SAVE.medals || {};
  const tot = starsTotal(), got = [];
  for(const m of MEDALS) if(tot >= m.n && !SAVE.medals[m.n]){ SAVE.medals[m.n] = true; SAVE.money += m.r; got.push(m); }
  return got;
}
// the line on the home screen: stars collected, medals held, and how far the next one is
function starSummaryHTML(){
  const tot = starsTotal(), nx = nextMedal();
  const held = medalsHeld().map(m => `<span title="${m.name}">${m.icon}</span>`).join('');
  return `<div class="starsum" title="כוכבים מכל המשימות"><span class="stars">★ ${tot}/${starsMax()}</span>${held}
    ${nx ? `<small>${nx.name} ב-${nx.n} כוכבים (+$${nx.r.toLocaleString('en-US')})</small>` : '<small>כל המדליות נאספו!</small>'}</div>`;
}
const STAR2_TEXT = 'אבדת לכל היותר מטוס אחד';
const starKey = k => typeof k==='number' ? 'campaign' : k;
const starStr = n => '★'.repeat(n) + '☆'.repeat(3-n);
const savedStars = k => (SAVE.stars && SAVE.stars[k]) || 0;

// rate a won mission: adds the star bonuses to the money and keeps the best rating
function rateMission(key){
  const d = STAR3[starKey(key)];
  const s2 = (G.lost||0) <= 1;
  let s3 = false; try{ s3 = !!(d && d.ok()); }catch(e){}
  const n = 1 + (s2?1:0) + (s3?1:0), bonus = payout((s2 ? 500 : 0) + (s3 ? 1000 : 0));
  SAVE.stars = SAVE.stars || {};
  const prev = SAVE.stars[key] || 0; if(n > prev) SAVE.stars[key] = n;
  SAVE.starsDetail = SAVE.starsDetail || {};                         // which stars were ever won here (campaign carry-over)
  { const o = starDetail(key); SAVE.starsDetail[key] = {s2: !!(o.s2 || s2), s3: !!(o.s3 || s3)}; }
  SAVE.money += bonus;
  const medals = awardMedals(); storeSave();
  return {n, s2, s3, bonus, t3: d ? d.t : '', best: Math.max(n, prev), medals, total: starsTotal()};
}
// the stars block of a result screen
function starsHTML(r){
  const line = (ok, t, b) => `<li class="${ok?'ok':''}">${ok?'★':'☆'} ${t}${ok && b ? ` · +$${b}` : ''}</li>`;
  return `<div class="stars-res"><div class="big">${starStr(r.n)}</div><ul>
    ${line(true, 'המשימה הושלמה')}${line(r.s2, STAR2_TEXT, payout(500))}${line(r.s3, r.t3, payout(1000))}</ul>
    ${r.bonus ? `<p class="note">בונוס כוכבים: $${r.bonus}</p>` : ''}${r.best > r.n ? `<p class="note">השיא שלך במשימה: ${starStr(r.best)}</p>` : ''}
    ${(r.medals||[]).map(m => `<p class="tip medal"><b>${m.icon} קיבלת ${m.name}!</b> אספת ${m.n} כוכבים · +$${m.r.toLocaleString('en-US')}</p>`).join('')}
    ${r.total != null ? `<p class="note">סך הכוכבים שלך: ${r.total}/${starsMax()}</p>` : ''}</div>`;
}
// the star objectives, for a briefing
function starGoalsHTML(key){
  const d = STAR3[starKey(key)];
  return `<h3 style="margin-top:12px">כוכבים ${savedStars(key) ? `<span class="pill">השיא שלך: ${starStr(savedStars(key))}</span>` : ''}</h3>
    <ul class="goals stars-goals"><li>★ השלם את המשימה</li><li>★★ ${STAR2_TEXT} (+$500)</li>${d ? `<li>★★★ ${d.t} (+$1,000)</li>` : ''}</ul>`;
}

// ---------- campaign: what each mission's result carries into the next one ----------
// The best result of the mission before counts (so replaying it for more stars pays off):
//   its third star (every side building destroyed) cuts the enemy's supply: Zeros launch 20% less often
//   its second star (at most one plane lost) means a near-whole squadron: one spare aircraft more
// Which of the two stars were won is kept per mission (starsDetail); a save from before this knew only the
// count, and three stars there means both.
function starDetail(key){
  const d = SAVE.starsDetail && SAVE.starsDetail[key]; if(d) return d;
  return savedStars(key) === 3 ? {s2: true, s3: true} : {s2: false, s3: false};
}
function campaignIntel(idx){
  if(typeof idx !== 'number' || idx <= 0 || !SAVE.best[idx-1]) return null;
  const d = starDetail(idx-1);
  return {prev: LEVELS[idx-1].name, supply: !!d.s3, veterans: !!d.s2};
}
function intelHTML(idx){
  const I = campaignIntel(idx); if(!I) return '';
  const li = (ok, good, bad) => `<li class="${ok?'ok':''}">${ok?'✓':'✗'} ${ok ? good : bad}</li>`;
  return `<h3 style="margin-top:12px">מצב המערכה אחרי "${I.prev}"</h3><ul class="intel">
    ${li(I.supply, 'קווי האספקה של האויב נותקו: מטוסי זירו ממריאים לאט יותר ב-20%', 'מבני האספקה במשימה הקודמת לא הושמדו כולם: האויב מתוגבר כרגיל (כוכב שלישי שם ינתק אותם)')}
    ${li(I.veterans, 'הטייסת חזרה כמעט שלמה: מטוס חלופי נוסף', 'הטייסת ספגה אבדות: אין מטוס חלופי נוסף (כוכב שני שם יביא אותו)')}</ul>`;
}
// called right after a campaign mission is built (ui.js 'launch')
function applyCampaignIntel(){
  const I = campaignIntel(G.idx); if(!I) return;
  if(I.supply){ G.def = {...G.def, zeroEvery: G.def.zeroEvery*1.25}; G.zeroT *= 1.25; }
  if(I.veterans) G.lives++;
  G.intel = I;
  if(I.supply) say('מודיעין: האספקה של האויב נותקה במשימה הקודמת – פחות מטוסי זירו', 5);
  if(I.veterans) say('הטייסת חזרה כמעט שלמה – יש לך מטוס חלופי נוסף', 5);
}

// the campaign map: a stylised western Pacific, the route from the Marshalls to Okinawa, and each mission's stars
const CAMP_POS = [[540,168], [392,150], [250,196], [300,128], [372,74], [196,92]];
function campaignMapHTML(){
  const node = (i) => {
    const [x, y] = CAMP_POS[i], locked = i >= SAVE.unlocked, done = !!SAVE.best[i], next = !locked && !done, n = savedStars(i);
    const fill = done ? '#e8b33a' : next ? '#f2efe6' : '#3b4c63', ink = done || next ? '#0e1a2b' : '#8fa3b8';
    return `<g class="mnode ${next?'next':''} ${locked?'locked':''}" ${locked ? '' : `data-act="brief" data-v="${i}"`} tabindex="-1">
      <title>${LEVELS[i].name}</title>
      ${next ? `<circle cx="${x}" cy="${y}" r="15" class="pulse"/>` : ''}
      <circle cx="${x}" cy="${y}" r="11" fill="${fill}" stroke="#0e1a2b" stroke-width="2"/>
      <text x="${x}" y="${y+4.5}" text-anchor="middle" font-size="13" font-weight="700" fill="${ink}">${locked ? '🔒' : i+1}</text>
      <text x="${x}" y="${y+27}" text-anchor="middle" font-size="11" fill="${locked ? '#6d7f94' : '#efe6cf'}">${LEVELS[i].name}</text>
      ${n ? `<text x="${x}" y="${y-16}" text-anchor="middle" font-size="11" fill="#f2c14e" letter-spacing="1">${starStr(n)}</text>` : ''}</g>`;
  };
  const route = CAMP_POS.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const doneUpTo = Math.max(0, Math.min(LEVELS.length, SAVE.unlocked) - 1);
  const flown = CAMP_POS.slice(0, doneUpTo + 1).map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  return `<svg class="cmap" viewBox="0 0 600 240" role="img" aria-label="מפת המערכה באוקיינוס השקט" dir="ltr">
    <defs><linearGradient id="cmapSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16314f"/><stop offset="1" stop-color="#0f2238"/></linearGradient></defs>
    <rect width="600" height="240" fill="url(#cmapSea)"/>
    <g stroke="rgba(143,163,184,.12)" stroke-width="1">${[60,120,180].map(y=>`<line x1="0" y1="${y}" x2="600" y2="${y}"/>`).join('')}${[100,200,300,400,500].map(x=>`<line x1="${x}" y1="0" x2="${x}" y2="240"/>`).join('')}</g>
    <g fill="#5f6b4e" stroke="#7d8762" stroke-width="1">
      <path d="M150 0 L175 0 L168 22 L150 40 L128 52 L104 58 L92 50 L110 40 L132 26 Z"/>
      <path d="M60 0 L96 0 L80 18 L58 24 Z"/>
      <path d="M118 140 L132 148 L128 170 L140 188 L132 214 L118 206 L112 186 L106 162 Z"/>
      <path d="M140 196 L158 204 L152 226 L136 232 L128 218 Z"/>
      <path d="M90 104 L100 108 L98 128 L88 126 Z"/>
      <circle cx="196" cy="98" r="3.5"/><circle cx="372" cy="80" r="2.5"/><circle cx="392" cy="156" r="3"/>
      <circle cx="532" cy="174" r="2"/><circle cx="548" cy="164" r="2"/><circle cx="540" cy="180" r="1.6"/><circle cx="300" cy="134" r="2.5"/>
    </g>
    <text x="70" y="70" font-size="11" fill="#8fa3b8" font-style="italic">יפן</text>
    <text x="70" y="200" font-size="11" fill="#8fa3b8" font-style="italic">הפיליפינים</text>
    <text x="470" y="228" font-size="11" fill="#8fa3b8" font-style="italic">האוקיינוס השקט · 1944</text>
    <path d="${route}" fill="none" stroke="rgba(239,230,207,.28)" stroke-width="2" stroke-dasharray="5 6"/>
    ${doneUpTo ? `<path d="${flown}" fill="none" stroke="#e8b33a" stroke-width="2.5" stroke-dasharray="5 6"/>` : ''}
    ${CAMP_POS.map((_, i) => node(i)).join('')}
  </svg>`;
}

// ---------- campaign: the counter-attack on the carrier once every target is destroyed ----------
function campaignEndgame(){
  if(G.training || G.defense){ G.complete = true; SFX.pickup(); say('כל המטרות הושמדו! חזור לנושאת ונחת כדי לסיים', 6); return; }
  if(!G.counter){
    const lvl = G.idx, list = [];
    const nv = 2 + Math.floor(lvl/2);
    for(let v=0; v<nv; v++){
      const val = {type:'val', x:G.L + 260 + v*170, y:DECK_Y - 320 - v*30, a:Math.PI, speed:185, full:185, hp:45, max:45, size:18, cool:0, dead:false, cruiseY:DECK_Y - 300 - v*30};
      G.enemies.push(val); list.push(val);
      const nz = Math.ceil((3 + lvl)/nv);
      for(let k=0;k<nz;k++){
        const z = {type:'zero', x:val.x + 60 + k*40, y:val.y - 40 - k*25, a:Math.PI, speed:240, full:240, hp:34+5*lvl, max:34+5*lvl, size:16, cool:1, burst:0, evade:0, dead:false, escort:val, eslot:k};
        G.enemies.push(z); list.push(z);
      }
    }
    G.counter = list;
    say(`כל המטרות הושמדו – אבל האויב מגיב! מתקפת נגד של ${list.length} מטוסים בדרך לנושאת. הדוף אותה לפני הנחיתה`, 6); SFX.alarm();
    return;
  }
  if(!G.counter.some(e=>!e.dead && G.enemies.includes(e))){
    G.complete = true; SFX.pickup();
    say('מתקפת הנגד נהדפה! חזור לנושאת ונחת כדי לסיים', 6);
  }
}
const counterLeft = () => G.counter ? G.counter.filter(e=>!e.dead && G.enemies.includes(e)).length : 0;

// ---------- repair crews ----------
// Campaign missions 4-6: a destroyed AA gun is rebuilt after 90 s while a bunker still stands on its island.
// "Dark Game": a destroyed searchlight is back after 60 s while a radar (or the mobile radar) still works there.
function repairCrews(){
  if(!G || G.complete) return;
  const campaign = !G.special && !G.defense && !G.ground && !G.training && !G.tutorial && G.idx >= 3;
  const dark = G.special && G.special.id==='dark';
  if(!campaign && !dark) return;
  for(const s of G.structures){
    if(!s.dead || s.deadT == null) continue;
    if(campaign && s.type==='aa' && G.time - s.deadT > 90 && G.structures.some(b=>!b.dead && b.island===s.island && b.type==='bunker'))
      reviveStruct(s, 'צוות תיקון שיקם תותח נ"מ! השמד את הבונקרים באי כדי לעצור אותם');
    if(dark && s.type==='light' && G.time - s.deadT > 60 && darkRadarOn(s.island))
      reviveStruct(s, 'צוות תיקון החזיר זרקור לפעולה!');
  }
}
function reviveStruct(s, msg){ s.dead = false; s.hp = s.max; s.deadT = null; s.flash = 0.4; say(msg, 3.5); }
function darkRadarOn(island){
  const S = G.special;
  return G.structures.some(r=>r.type==='radar' && !r.dead && r.island===island) || !!(S && S.truck && !S.truck.dead && S.truck.island===island);
}
