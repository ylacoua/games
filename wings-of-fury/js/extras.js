// ---- Mission extras: star ratings, the counter-attack that ends every campaign mission, enemy repair crews,
// and escalation as a mission drags on ----

// Campaign: enemy fighters launch more often the longer a mission lasts (down to 60% of the interval)
function escalation(){
  if(!G || G.special || G.defense || G.ground || G.training || G.tutorial) return 1;
  return Math.max(0.6, 1 - G.time/900);
}

// ---------- star ratings ----------
// ★ mission won · ★★ at most one aircraft lost · ★★★ the mission's own extra objective (listed in the briefing)
const STAR3 = {
  campaign: {t:'השמד גם את כל המבנים המשניים (צריפים, מחסני דלק, זרקורים)', ok:()=>G.structures.every(s=>s.dead)},
  def:      {t:'הנושאת שורדת עם לפחות חצי מהחוזק שלה', ok:()=>G.carrier.hp >= G.carrier.max*0.5},
  gnd:      {t:'לפחות 3 טנקים שורדים', ok:()=>G.ground.tanks + usUnits().filter(u=>u.type==='tank').length >= 3},
  rescue:   {t:'שני הטייסים נאספים עם יותר מחצי בריאות', ok:()=>G.special.pilots.every(p=>p.hp > p.max*0.5)},
  dark:     {t:'השמד גם את כל הזרקורים', ok:()=>G.structures.filter(s=>s.type==='light').every(s=>s.dead)},
  convoy:   {t:'כל ארבע הספינות מגיעות', ok:()=>G.special.convoy.every(s=>!s.dead)},
  bridge:   {t:'הפל את הגשר בזמן שרכבת חוצה אותו', ok:()=>!!G.special.perfect},
  clock:    {t:'השמד את כל ארבעת השדות לפני שהשעון נגמר', ok:()=>G.special.phase===1},
  ace:      {t:'נצח בשלושת הסיבובים תוך 7 דקות', ok:()=>G.special.t < 420},
  burning:  {t:'הנושאת הבוערת שורדת עם לפחות חצי מהחוזק', ok:()=>G.carrier.hp >= G.carrier.max*0.5},
  assault:  {t:'לפחות 12 חיילים שורדים', ok:()=>G.ground.inf + usUnits().filter(u=>u.type==='inf').length >= 12}
};
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
  SAVE.money += bonus; storeSave();
  return {n, s2, s3, bonus, t3: d ? d.t : '', best: Math.max(n, prev)};
}
// the stars block of a result screen
function starsHTML(r){
  const line = (ok, t, b) => `<li class="${ok?'ok':''}">${ok?'★':'☆'} ${t}${ok && b ? ` · +$${b}` : ''}</li>`;
  return `<div class="stars-res"><div class="big">${starStr(r.n)}</div><ul>
    ${line(true, 'המשימה הושלמה')}${line(r.s2, STAR2_TEXT, payout(500))}${line(r.s3, r.t3, payout(1000))}</ul>
    ${r.bonus ? `<p class="note">בונוס כוכבים: $${r.bonus}</p>` : ''}${r.best > r.n ? `<p class="note">השיא שלך במשימה: ${starStr(r.best)}</p>` : ''}</div>`;
}
// the star objectives, for a briefing
function starGoalsHTML(key){
  const d = STAR3[starKey(key)];
  return `<h3 style="margin-top:12px">כוכבים ${savedStars(key) ? `<span class="pill">השיא שלך: ${starStr(savedStars(key))}</span>` : ''}</h3>
    <ul class="goals stars-goals"><li>★ השלם את המשימה</li><li>★★ ${STAR2_TEXT} (+$500)</li>${d ? `<li>★★★ ${d.t} (+$1,000)</li>` : ''}</ul>`;
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
