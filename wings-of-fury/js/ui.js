// ---- Menus (DOM overlays, RTL) and the in-flight HUD (canvas) ----
// a mission key from a button: campaign index (number), 'def', 'gnd' or a special mission id
const missionKey = v => (v==='def' || v==='gnd' || SPECIALS[v]) ? v : +v;
const missionDef = k => k==='def' ? DEFENSE : k==='gnd' ? GROUND : SPECIALS[k] || LEVELS[k];
const UI = {
  root: null, tab:'mission', level:0, lo:null, confirmReset:false,
  init(){ this.root = document.getElementById('ui'); },
  show(html){ this.root.innerHTML = `<div class="screen"><div class="board">${html}</div></div>`; this.bind(); },
  hide(){ this.root.innerHTML=''; },
  open(){ return this.root.innerHTML!==''; },
  bind(){
    this.root.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click', e=>{
      SFX.init(); const a=b.dataset.act, v=b.dataset.v; this.act(a, v);
    }));
  },
  money(){ return `<span class="money">$${SAVE.money.toLocaleString('en-US')}</span>`; },

  keysHTML(){
    return `<div class="keys">
      <b>↑ ↓</b><span>טיפוס / צלילה</span>
      <b>↑ ארוך</b><span>לופ: המשך למשוך כשהאף כבר פונה למעלה, ותגיע מאחורי מטוס שתוקף אותך</span>
      <b>← →</b><span>פנייה ימינה / שמאלה באותו גובה (לחיצה לכיוון הטיסה מגבירה מהירות)</span>
      <b>W / S</b><span>הגברה / הורדה של המצערת</span>
      <b>רווח</b><span>מקלעים</span>
      <b>X</b><span>הטלת חימוש (פצצה / רקטה / טורפדו)</span>
      <b>C</b><span>פקודה לכנפיים: ליווי ← תקיפה חופשית ← הגנה על הנושאת</span>
      <b>Z</b><span>גלגול חבית</span>
      <b>Esc</b><span>עצירה · <b>M</b> השתקה</span>
    </div>
    <p class="note">נחיתה: התקרב לנושאת נמוך, במצערת נמוכה ובאף כמעט ישר. מהירות מתחת ל-225 וזווית קטנה.</p>`;
  },
  // combat manoeuvres: the key combinations and what each one is good for
  maneuversHTML(){
    return `<div class="keys">
      <b>↑ ארוך</b><span><b class="mv">לופ</b> · המשך למשוך כשהאף כבר פונה למעלה. מסיים מאחורי מי שרדף אחריך.</span>
      <b>↑ ארוך ואז ← / →</b><span><b class="mv">אימלמן</b> · באמצע הלופ לחץ על החץ לכיוון ההפוך: בפסגה המטוס מתיישר בחצי גלגול וטס חזרה, גבוה יותר.</span>
      <b>↓ ארוך</b><span><b class="mv">ספליט S</b> · המשך לדחוף כשהאף כבר פונה למטה: חצי גלגול על הגב וחצי לופ כלפי מטה. בורחים מהר וצוברים מהירות, אבל מאבדים גובה.</span>
      <b>↑ ארוך + S</b><span><b class="mv">פניית פטיש</b> · עם מצערת נמוכה: טיפוס אנכי עד שהמטוס כמעט עוצר, סיבוב על המקום וצלילה חזרה. רגע פגיע בפסגה.</span>
      <b>Z</b><span><b class="mv">גלגול חבית</b> · גלגול מהיר מסביב לציר. רוב הכדורים מחטיאים אותך בזמן הגלגול. אפשר שוב אחרי כ-2 שניות.</span>
      <b>S S</b><span><b class="mv">בלימת אוויר</b> · לחיצה כפולה מהירה: המטוס מאט בבת אחת והרודף עוקף אותך. אפשר שוב אחרי כ-2.5 שניות.</span>
      <b>↓ + S</b><span><b class="mv">צלילת הפצצה</b> · רק במפציצי צלילה (דונטלס): בצלילה תלולה נפתחים בלמי הצלילה, המהירות נשארת יציבה, והמטוס מושך לבד מעל הקרקע.</span>
    </div>
    <p class="note">גם מטוסי הכנף שלך ומטוסי הזירו משתמשים בתמרונים האלה כשמישהו יושב להם על הזנב.</p>`;
  },

  // Home screen: the sunset sky with flying planes stays visible behind it (drawn on the canvas);
  // a side menu on the right opens one panel at a time next to it.
  homePanel: null,
  mainMenu(){
    this.confirmReset=false; Music.start();
    const p = this.homePanel;
    const nav = [['tut','משימות הדרכה','שיעורי טיסה ואימון חופשי'],['camp','משימות הקמפיין','משימות 1 עד 6'],
                 ['extra','משימות נוספות','10 משימות מיוחדות'],['keys','תפעול המשחק','מקשים ולחצנים']]
      .map(([k,t,s])=>`<button class="navbtn ${p===k?'on':''}" data-act="home" data-v="${k}" aria-expanded="${p===k}"><b>${t}</b><small>${s}</small></button>`).join('');
    const reset = `<button class="link" data-act="reset">איפוס התקדמות</button>`;
    this.root.innerHTML = `<div class="home">
      <header class="home-title"><h1>כנפי הרעם</h1><p class="welcome">ברוכים הבאים טייסים</p></header>
      <nav class="home-nav" aria-label="תפריט ראשי">${this.money()}${nav}${reset}</nav>
      ${p ? `<section class="home-panel" aria-live="polite">${this.homePanelHTML(p)}</section>` : ''}
    </div>`;
    this.bind();
  },
  homePanelHTML(p){
    const time = {day:'יום',dawn:'שחר',dusk:'שקיעה',night:'לילה'};
    if(p==='tut'){
      const rows = LESSONS.map((L,i)=>`<button class="item" data-act="lesson" data-v="${i}">
        <span class="num">${i+1}</span><span class="txt"><b>${L.name}</b><small>${L.desc}</small></span><span class="pill">${PLANES[L.plane].name}</span></button>`).join('');
      return `<h2>משימות הדרכה</h2><p class="sub">שיעורים קצרים. ההוראות מופיעות בראש המסך ומתקדמות לבד כשאתה מבצע כל שלב.</p>
        <div class="list">${rows}
        <button class="item" data-act="training"><span class="num">✦</span><span class="txt"><b>אימון חופשי</b><small>כל המטוסים, השדרוגים ותנאי מזג האוויר, ללא עלות. ההתקדמות לא נשמרת.</small></span></button></div>`;
    }
    if(p==='camp'){
      const rows = LEVELS.map((L,i)=>{
        const locked = i >= SAVE.unlocked, done = SAVE.best[i], next = !locked && !done;
        return `<button class="item ${next?'next':''}" data-act="brief" data-v="${i}" ${locked?'disabled':''}>
          <span class="num">${i+1}</span><span class="txt"><b>${L.name}</b>
          <small>${time[L.time]}${L.rain?' · גשם':''}${L.wind?' · רוח':''}${L.storm?' · סערה':''} · תגמול $${L.reward}</small></span>
          ${L.boss?'<span class="pill boss">בוס</span>':''}${savedStars(i)?`<span class="stars" title="הכוכבים שלך">${starStr(savedStars(i))}</span>`:''}${done?'<span class="pill ok">✓ הושלמה</span>':locked?'<span class="pill">🔒 נעולה</span>':''}</button>`;}).join('');
      return `<h2>משימות הקמפיין</h2><p class="sub">האוקיינוס השקט, 1944. כל משימה שמושלמת פותחת את הבאה.</p><div class="list">${rows}</div>`;
    }
    if(p==='extra'){
      const row = (k, L, icon) => `<button class="item" data-act="brief" data-v="${k}"><span class="num">${icon}</span>
        <span class="txt"><b>${L.name}</b><small>${L.goals[0]} · תגמול $${L.reward}</small></span>${savedStars(k)?`<span class="stars">${starStr(savedStars(k))}</span>`:''}</button>`;
      const won = k => SAVE.won && SAVE.won[k] ? ' ✓' : '';
      return `<h2>משימות נוספות</h2><p class="sub">משימות מיוחדות שאפשר לשחק בכל שלב, וכל הכסף שמרוויחים בהן נשמר. כל ניצחון פותח סקין.</p>
        <div class="list">${row('def', DEFENSE, '⚓')}${row('gnd', GROUND, '⚑')}
        ${SPECIAL_ORDER.map(k=>row(k, {...SPECIALS[k], name:SPECIALS[k].name + won(k)}, SPECIALS[k].icon)).join('')}</div>`;
    }
    return `<h2>תפעול המשחק</h2><p class="sub">מקלדת. במסך מגע מופיעים לחצנים בתחתית המסך.</p>${this.keysHTML()}
      <h3 style="margin:16px 0 8px">תמרוני קרב</h3>${this.maneuversHTML()}
      <h3 style="margin:16px 0 8px">לחצני מסך מגע</h3>
      <div class="keys"><b>▲ ▼ ◀ ▶</b><span>כמו מקשי החיצים (כולל לחיצה ארוכה לתמרונים)</span><b>⇧ / ⇩</b><span>הגברה / הורדה של המצערת · ⇩ פעמיים = בלימת אוויר</span>
      <b>↻</b><span>גלגול חבית</span><b>✸</b><span>מקלעים</span><b>💣</b><span>הטלת חימוש</span><b>⚑</b><span>פקודה לכנפיים</span><b>II</b><span>עצירה</span></div>`;
  },

  // Short mission briefing between choosing a mission and the hangar: the situation, what must be done, a tip
  briefing(k){
    Music.start();
    const L = missionDef(k);
    const time = {day:'יום',dawn:'שחר',dusk:'שקיעה',night:'לילה'};
    const tag = typeof k==='number' ? `משימה ${k+1} מתוך ${LEVELS.length}` : SPECIALS[k] ? 'משימה מיוחדת' : 'משימה נוספת';
    const cond = typeof k==='number'
      ? [time[L.time], L.rain?'גשם':'', L.storm?'סערה וברקים':'', L.wind?`רוח ${L.wind>0?'ימינה':'שמאלה'}`:'', L.bombers?'מפציצי אויב':''].filter(Boolean)
      : SPECIALS[k] ? [L.time && L.time!=='day' ? time[L.time] : '', L.lives ? `${L.lives} מטוסים בלבד` : '', L.noWing ? 'בלי מטוסי כנף' : ''].filter(Boolean)
      : [];
    this.show(`<div class="spread"><span class="pill">${tag}</span>${this.money()}</div>
      <h2 style="margin-top:8px">תדריך: ${L.name}</h2>
      <div class="row" style="margin:8px 0">${cond.map(c=>`<span class="pill">${c}</span>`).join('')}${L.boss?'<span class="pill boss">משימת בוס</span>':''}<span class="pill">תגמול $${L.reward}</span>${skinFor(k) ? `<span class="pill">🎨 פותח סקין: ${skinFor(k).name}</span>` : ''}</div>
      <p class="sub">${L.brief}</p>
      <h3>מה צריך לעשות</h3><ol class="goals">${this.goalsFor(k, L).map(g=>`<li>${g}</li>`).join('')}</ol>
      ${starGoalsHTML(k)}
      ${L.tip?`<p class="tip"><b>טיפ:</b> ${L.tip}</p>`:''}
      <div class="row" style="margin-top:16px;justify-content:flex-end"><button data-act="menu">חזרה</button><button class="primary" data-act="hangar" data-v="${k}">המשך לחדר התדריכים</button></div>`);
  },
  // campaign missions also end with the counter-attack, and from mission 4 the enemy repairs its AA
  goalsFor(k, L){
    if(typeof k!=='number') return L.goals;
    const g = L.goals.slice(0, -1);
    g.push('כשכל המטרות הושמדו – מתקפת נגד של מפציצים וזירו יוצאת לנושאת: הדוף אותה');
    if(k >= 3) g.push('מהר: תותח נ"מ שהושמד משוקם אחרי דקה וחצי, כל עוד יש בונקר באותו אי');
    g.push(L.goals[L.goals.length-1]);
    return g;
  },

  hangar(i){
    this.level = i; Music.start();
    if(!this.lo) this.lo = {plane:SAVE.plane, ord:'bomb', wing:[]};
    if(!SAVE.owned[this.lo.plane]) this.lo.plane='hellcat';
    const def = typeof i==='string', L = missionDef(i), tab=this.tab, free = i==='def', noWing = !!L.noWing;
    const tabs = [['mission','תדריך וחימוש'],['planes','מטוסים'],['upgrades','שדרוגים'],['skins','סקינים']]
      .map(([k,t])=>`<button class="${tab===k?'on':''}" data-act="tab" data-v="${k}">${t}</button>`).join('');
    let body='';
    if(tab==='mission'){
      const st = planeStats(this.lo.plane);
      const ords = Object.keys(ORD).map(k=>`<button class="card ${this.lo.ord===k?'sel':''}" data-act="ord" data-v="${k}" style="text-align:right">
        <b>${ORD[k].name} ×${st.ord[k]}</b><p>${ORD[k].note}</p></button>`).join('');
      // in Carrier Defense the wingmen are free
      const wprice = k => free ? 0 : WINGMEN[k].cost;
      if(noWing) this.lo.wing = [];
      const wcost = this.lo.wing.reduce((s,w)=>s+wprice(w),0);
      const wings = Object.keys(WINGMEN).map(k=>{const d=WINGMEN[k], n=this.lo.wing.filter(x=>x===k).length;
        return `<div class="card"><div class="spread"><b>${d.name}</b><span class="pill">${free ? 'חינם' : '$'+d.cost}</span></div><p>${d.desc}</p>
        <div class="row"><button data-act="wadd" data-v="${k}" ${this.lo.wing.length>=MAX_WINGMEN||SAVE.money<wcost+wprice(k)?'disabled':''}>+ הוסף</button>
        <button data-act="wdel" data-v="${k}" ${n?'':'disabled'}>− הסר</button><span class="note">בטייסת: ${n}</span></div></div>`;}).join('');
      body = `<h2>${def ? L.name : (i+1)+'. '+L.name}</h2><p class="sub">${L.brief}</p>
        <div class="row" style="margin-bottom:12px">${L.boss?'<span class="pill boss">משימת בוס</span>':''}<span class="pill">תגמול $${L.reward}</span>
        <span class="pill">מטוס: ${PLANES[this.lo.plane].name}</span>${L.bombers?'<span class="pill">מפציצי אויב</span>':''}</div>
        <h3>חימוש לגיחה הראשונה</h3><p class="note">אפשר להחליף חימוש בכל נחיתה על הנושאת.</p><div class="grid">${ords}</div>
        <h3 style="margin-top:16px">כנפיים (עד ${MAX_WINGMEN} מטוסים בשליטת המחשב)</h3>
        ${noWing ? '<p class="note">במשימה הזו אתה טס לבד – אין מטוסי כנף.</p>' : `<div class="grid">${wings}</div>`}
        <div class="spread" style="margin-top:18px"><span class="note">${free ? 'במשימת ההגנה מטוסי הכנף ניתנים בחינם' : noWing ? '' : 'עלות הכנפיים למשימה: $'+wcost}</span>
        <div class="row"><button data-act="menu">חזרה</button><button class="primary" data-act="launch">יציאה למשימה</button></div></div>`;
    } else if(tab==='planes'){
      const maxS = 480, maxH = 200;
      body = `<div class="grid">${Object.keys(PLANES).map(k=>{const b=PLANES[k], own=SAVE.owned[k], sel=this.lo.plane===k;
        return `<div class="card ${sel?'sel':''} ${own?'':'locked'}"><div class="spread"><b>${b.name}</b>${own?(sel?'<span class="pill">נבחר</span>':''):`<span class="pill">$${b.price}</span>`}</div>
        <p>${b.desc}</p><div class="stats"><span>מהירות</span><span class="bar"><i style="width:${b.speed/maxS*100}%"></i></span>
        <span>תמרון</span><span class="bar"><i style="width:${b.turn/2.4*100}%"></i></span><span>חוזק</span><span class="bar"><i style="width:${b.hp/maxH*100}%"></i></span>
        <span>חימוש</span><span>${b.ord.bomb} פצצות · ${b.ord.rocket} רקטות · ${b.ord.torpedo} טורפדו${b.gunner?' · תותחן אחורי':''}</span></div>
        ${own?`<button data-act="pick" data-v="${k}" ${sel?'disabled':''}>בחר</button>`:`<button class="primary" data-act="buy" data-v="${k}" ${SAVE.money<b.price?'disabled':''}>קנה</button>`}</div>`;}).join('')}</div>`;
    } else if(tab==='skins'){
      // paint schemes: each mission won makes one available to buy; the chosen one is used on every plane
      const cards = Object.values(SKINS).map(k=>{
        const own = SAVE.skins[k.id], sel = (SAVE.skin||'standard')===k.id, open = skinUnlocked(k.id);
        const action = sel ? '<span class="pill ok">✓ בשימוש</span>'
          : own ? `<button data-act="skin" data-v="${k.id}">בחר</button>`
          : open ? `<button class="primary" data-act="buyskin" data-v="${k.id}" ${SAVE.money<k.price?'disabled':''}>קנה · $${k.price.toLocaleString('en-US')}</button>`
          : `<span class="pill">🔒 ${skinUnlockText(k.id)}</span>`;
        return `<div class="card ${sel?'sel':''} ${open||own?'':'locked'}"><canvas class="skinprev" data-skin="${k.id}" width="360" height="140" aria-label="${k.name}"></canvas>
          <div class="spread"><b>${k.name}</b>${!own && open ? `<span class="pill">$${k.price.toLocaleString('en-US')}</span>` : ''}</div><p>${k.desc}</p>${action}</div>`;}).join('');
      body = `<p class="sub">כל משימה שמסיימים בהצלחה פותחת סקין חדש לרכישה. הסקין שנבחר צובע את המטוס שלך, בכל דגם.</p><div class="grid">${cards}</div>`;
    } else {
      body = `<div class="grid">${Object.keys(UPGRADES).map(k=>{const u=UPGRADES[k], lv=SAVE.up[k], c=u.costs[lv];
        return `<div class="card"><div class="spread"><b>${u.name}</b><span class="pill">דרגה ${lv}/3</span></div><p>${u.desc} לכל דרגה. חל על כל המטוסים.</p>
        <div class="bar"><i style="width:${lv/3*100}%"></i></div>
        ${c?`<button data-act="up" data-v="${k}" ${SAVE.money<c?'disabled':''}>שדרג · $${c}</button>`:'<span class="note">דרגה מרבית</span>'}</div>`;}).join('')}</div>`;
    }
    this.show(`<div class="spread"><h2>חדר התדריכים</h2>${this.money()}</div><div class="tabs">${tabs}</div>${body}`);
    if(tab==='skins') this.drawSkinPreviews(this.lo.plane);
  },
  // the selected plane, painted in each skin, on the skin cards
  drawSkinPreviews(type){
    this.root.querySelectorAll('canvas[data-skin]').forEach(c=>{
      const x = c.getContext('2d'), k = SKINS[c.dataset.skin];
      x.clearRect(0, 0, c.width, c.height);
      x.save(); x.translate(c.width/2 - 4, c.height/2 - 4); x.scale(3.3, 3.3);
      drawPlane(x, type, k.id==='standard' ? null : k, null, 1, false, false, 0);
      x.restore();
    });
  },
  // line for a result screen when a win has just made a new skin available
  newSkinNote(key, wasOpen){
    const k = skinFor(key);
    if(!k || wasOpen || !skinUnlocked(k.id) || SAVE.skins[k.id]) return '';
    return `<p class="tip"><b>סקין חדש זמין:</b> ${k.name} · $${k.price.toLocaleString('en-US')} – בחדר התדריכים, בלשונית "סקינים".</p>`;
  },

  // Training: every plane, upgrade, wingman and weather option, free and unsaved
  trainingHangar(){
    Music.start();
    if(!this.tr) this.tr = {plane:'hellcat', ord:'bomb', wing:[], up:{engine:3,armor:3,guns:3,payload:3,fuel:3},
      time:'day', rain:false, storm:false, wind:0, boss:'', bombers:false, zeros:true, jcarrier:false};
    const t = this.tr, st = planeStats(t.plane, t.up);
    const opt = (act, v, on, label) => `<button class="${on?'on':''}" data-act="${act}" data-v="${v}">${label}</button>`;
    const planes = Object.keys(PLANES).map(k=>`<button class="card ${t.plane===k?'sel':''}" data-act="tplane" data-v="${k}" style="text-align:right">
      <b>${PLANES[k].name}</b><p>${PLANES[k].desc}</p></button>`).join('');
    const ords = Object.keys(ORD).map(k=>`<button class="card ${t.ord===k?'sel':''}" data-act="tord" data-v="${k}" style="text-align:right"><b>${ORD[k].name} ×${st.ord[k]}</b><p>${ORD[k].note}</p></button>`).join('');
    const wings = Object.keys(WINGMEN).map(k=>{const n=t.wing.filter(x=>x===k).length;
      return `<div class="card"><b>${WINGMEN[k].name}</b><p>${WINGMEN[k].desc}</p><div class="row">
      <button data-act="twadd" data-v="${k}" ${t.wing.length>=MAX_WINGMEN?'disabled':''}>+ הוסף</button><button data-act="twdel" data-v="${k}" ${n?'':'disabled'}>− הסר</button><span class="note">בטייסת: ${n}</span></div></div>`;}).join('');
    const ups = Object.keys(UPGRADES).map(k=>`<div class="card"><b>${UPGRADES[k].name}</b><div class="tabs" style="margin:0">
      ${[0,1,2,3].map(l=>opt('tup', k+':'+l, t.up[k]===l, String(l))).join('')}</div></div>`).join('');
    this.show(`<div class="spread"><h2>משימת אימון</h2><span class="pill">ללא עלות · לא נשמר</span></div>
      <p class="sub">בחר כל מטוס, שדרוג, כנפיים ותנאי מזג אוויר. יש מטוסים ללא הגבלה.</p>
      <h3>מטוס</h3><div class="grid" style="margin:8px 0 16px">${planes}</div>
      <h3>חימוש</h3><div class="grid" style="margin:8px 0 16px">${ords}</div>
      <h3>כנפיים (עד ${MAX_WINGMEN})</h3><div class="grid" style="margin:8px 0 16px">${wings}</div>
      <h3>דרגות שדרוג</h3><div class="grid" style="margin:8px 0 16px">${ups}</div>
      <h3>סביבה ואויבים</h3>
      <div class="tabs">${[['day','יום'],['dawn','שחר'],['dusk','שקיעה'],['night','לילה']].map(([k,l])=>opt('ttime',k,t.time===k,l)).join('')}</div>
      <div class="tabs">${opt('ttog','rain',t.rain,'גשם')}${opt('ttog','storm',t.storm,'ברקים')}${opt('ttog','zeros',t.zeros,'מטוסי זירו')}${opt('ttog','bombers',t.bombers,'מפציצי אויב')}${opt('ttog','jcarrier',t.jcarrier,'נושאת יפנית')}</div>
      <div class="tabs"><span class="note" style="align-self:center">רוח:</span>${[[-45,'חזקה שמאלה'],[0,'ללא'],[45,'חזקה ימינה']].map(([k,l])=>opt('twind',k,t.wind===k,l)).join('')}</div>
      <div class="tabs"><span class="note" style="align-self:center">בוס:</span>${[['','ללא'],['battleship','אוניית מערכה'],['emily','"אמילי"'],['fortress','מבצר חוף']].map(([k,l])=>opt('tboss',k,t.boss===k,l)).join('')}</div>
      <div class="row" style="margin-top:14px"><button data-act="menu">חזרה</button><button class="primary" data-act="tlaunch">התחל אימון</button></div>`);
  },

  // end of a Carrier Defense game: all money earned is kept (wave bonuses are part of it)
  defenseResult(win, reason){
    const D = G.defense, gain = G.earned + (win ? DEFENSE.reward : 0);
    const skinWasOpen = skinUnlocked(skinFor('def').id);
    SAVE.money += gain; if(win){ SAVE.won = SAVE.won || {}; SAVE.won.def = true; } storeSave();
    const waves = D.phase===2 ? DEFENSE_WAVES : Math.max(0, D.state==='between' ? D.wave : D.wave-1);
    this.show(`<h1 style="font-size:40px">${win ? 'ניצחון! כוח המשימה היפני הושמד' : 'המשימה הסתיימה'}</h1>
      <p class="sub">${win ? 'שרדת עשרה גלים והטבעת את הנושאת היפנית ואת משחתות הליווי שלה.' : reason}</p>
      <div class="stats" style="font-size:15px;margin-bottom:16px"><span>גלים ששרדת</span><span>${waves} מתוך ${DEFENSE_WAVES}</span>
      <span>בונוסי גלים</span><span>$${D.bonus}</span><span>השמדות</span><span>${G.kills}</span>
      ${win ? `<span>תגמול ניצחון</span><span>$${DEFENSE.reward}</span>` : ''}<span>סה"כ הרווחת</span><span>$${gain}</span></div>
      ${win ? starsHTML(rateMission('def')) + this.newSkinNote('def', skinWasOpen) : ''}
      <div class="row"><button class="primary" data-act="defense">שחק שוב</button><button data-act="menu">תפריט ראשי</button></div>`);
  },

  // end of a special mission: reward and mission bonus on a win (half the loot otherwise), and its skin
  specialResult(win, reason){
    const S = G.special, M = S.M, gain = win ? G.earned + M.reward : Math.round(G.earned*0.5);
    const sk = skinFor(S.id), skinWasOpen = !sk || skinUnlocked(sk.id);
    SAVE.money += gain; if(win){ SAVE.won = SAVE.won || {}; SAVE.won[S.id] = true; } storeSave();
    this.show(`<h1 style="font-size:40px">${win ? 'המשימה הושלמה!' : 'המשימה נכשלה'}</h1>
      <p class="sub">${M.icon} ${M.name} · ${win ? (S.reason || '') : reason}</p>
      <div class="stats" style="font-size:15px;margin-bottom:16px"><span>שלל מהמשימה</span><span>$${G.earned}</span>
      ${S.bonus ? `<span>מתוכו בונוסים</span><span>$${S.bonus}</span>` : ''}
      ${win ? `<span>תגמול</span><span>$${M.reward}</span>` : '<span>שלל שנשמר</span><span>50%</span>'}<span>השמדות</span><span>${G.kills}</span>
      <span>סה"כ הרווחת</span><span>$${gain}</span></div>
      ${win ? starsHTML(rateMission(S.id)) + this.newSkinNote(S.id, skinWasOpen) : ''}
      <div class="row" style="margin-top:12px"><button class="primary" data-act="hangar" data-v="${S.id}">${win ? 'שחק שוב' : 'נסה שוב'}</button><button data-act="menu">תפריט ראשי</button></div>`);
  },

  // end of a Ground Support game: money earned is kept, the victory reward is added on success
  groundResult(win, reason){
    const S = G.ground, gain = win ? G.earned + GROUND.reward : Math.round(G.earned*0.5);
    const skinWasOpen = skinUnlocked(skinFor('gnd').id);
    SAVE.money += gain; if(win){ SAVE.won = SAVE.won || {}; SAVE.won.gnd = true; } storeSave();
    const taken = G.islands.filter(is=>is.captured).length;
    const left = S.inf + S.tanks + usUnits().length;
    this.show(`<h1 style="font-size:40px">${win ? 'ניצחון! שלושת האיים נכבשו' : 'המשימה נכשלה'}</h1>
      <p class="sub">${win ? 'הדגל האמריקאי מתנופף על שלושת האיים.' : reason}</p>
      <div class="stats" style="font-size:15px;margin-bottom:16px"><span>איים שנכבשו</span><span>${taken} מתוך 3</span>
      <span>כוחות ששרדו</span><span>${S.inf + usUnits().filter(u=>u.type==='inf').length} חיילים, ${S.tanks + usUnits().filter(u=>u.type==='tank').length} טנקים</span>
      <span>השמדות</span><span>${G.kills}</span>${win ? `<span>תגמול ניצחון</span><span>$${GROUND.reward}</span>` : '<span>שלל שנשמר</span><span>50%</span>'}
      <span>סה"כ הרווחת</span><span>$${gain}</span></div>
      ${win ? starsHTML(rateMission('gnd')) + this.newSkinNote('gnd', skinWasOpen) : ''}
      <div class="row"><button class="primary" data-act="ground">שחק שוב</button><button data-act="menu">תפריט ראשי</button></div>`);
  },

  // flight-school lesson list
  tutorialMenu(){
    Music.start();
    const cards = LESSONS.map((L,i)=>`<div class="card"><div class="spread"><b>${i+1}. ${L.name}</b><span class="pill">${PLANES[L.plane].name}</span></div>
      <p>${L.desc}</p><button class="primary" data-act="lesson" data-v="${i}">התחל שיעור</button></div>`).join('');
    this.show(`<h2>הדרכה</h2><p class="sub">חמישה שיעורים קצרים. ההוראות מופיעות בראש המסך ומתקדמות לבד כשאתה מבצע כל שלב. התרסקות מחזירה אותך לתחילת השיעור.</p>
      <div class="grid">${cards}</div><div class="row" style="margin-top:16px"><button data-act="menu">תפריט ראשי</button></div>`);
  },
  tutorialDone(){
    const i = G.tutorial.i; G.state='over'; SFX.setEngine(false,0); SFX.pickup();
    const next = i+1 < LESSONS.length;
    this.show(`<h1 style="font-size:44px">השיעור הושלם</h1><p class="sub">${LESSONS[i].name}: כל הכבוד!</p>
      <div class="row">${next?`<button class="primary" data-act="lesson" data-v="${i+1}">לשיעור הבא: ${LESSONS[i+1].name}</button>`:''}
      <button data-act="lesson" data-v="${i}">שוב</button><button data-act="tutorial">רשימת השיעורים</button><button data-act="menu">תפריט ראשי</button></div>`);
  },

  // Carrier deck panel: after a landing, or with a replacement aircraft after a crash.
  // The pilot may switch to any plane they own (any plane in training) before taking off.
  openDeck(crashed){
    SFX.setEngine(false,0);
    if(G.tutorial && G.tutorial.lesson.id==='landing' && crashed===false){ G.tutorial.landed = true; this.tutorialDone(); return; }
    if(crashed !== undefined) this.crashed = crashed;
    const lo = G.loadout, st = planeStats(lo.plane, lo.up), done = G.complete, left = primariesLeft();
    const avail = Object.keys(PLANES).filter(k=>G.training || SAVE.owned[k]);
    const planes = avail.map(k=>{const b=PLANES[k];
      return `<button class="card ${lo.plane===k?'sel':''}" data-act="dplane" data-v="${k}" style="text-align:right">
      <b>${b.name}</b><p>${b.desc}</p></button>`;}).join('');
    const ords = Object.keys(ORD).map(k=>`<button class="card ${lo.ord===k?'sel':''}" data-act="dord" data-v="${k}" style="text-align:right"><b>${ORD[k].name} ×${st.ord[k]}</b><p>${ORD[k].note}</p></button>`).join('');
    const livesTxt = G.training ? 'ללא הגבלה' : `${G.lives} מתוך 5`;
    this.show(`<h2>${this.crashed?'מטוס חלופי':'על סיפון הנושאת'}</h2>
      <p class="sub">${this.crashed?'הטייס חולץ מהמים. בחר מטוס חלופי מהסיפון.':'המטוס תוקן, תודלק וחומש מחדש.'}
      ${done?'כל המטרות הושמדו!':`נותרו ${left} מטרות.`} מטוסים שנותרו: ${livesTxt} · נושאת: ${Math.round(G.carrier.hp/G.carrier.max*100)}%</p>
      <h3>בחר מטוס</h3><div class="grid" style="margin:8px 0 16px">${planes}</div>
      <h3>בחר חימוש</h3><div class="grid" style="margin:8px 0 16px">${ords}</div>
      <div class="row">${done?'<button class="primary" data-act="finish">סיים משימה</button>':''}
      <button class="${done?'':'primary'}" data-act="takeoff">המראה</button><button data-act="abort">נטוש משימה</button></div>`);
  },

  pause(){
    if(!G || G.state==='rearm' || G.state==='over') return;
    G.paused = true; SFX.setEngine(false,0);
    this.show(`<h2>הפסקה</h2><p class="sub">${G.def.name} · נותרו ${primariesLeft()} מטרות · שלל $${G.earned}</p>
      ${this.keysHTML()}<h3 style="margin:14px 0 8px">תמרוני קרב</h3>${this.maneuversHTML()}<div class="row" style="margin-top:14px"><button class="primary" data-act="resume">המשך</button><button data-act="abort">נטוש משימה</button></div>`);
  },

  result(win, reason){
    G.state='over'; SFX.setEngine(false,0);
    if(G.tutorial){ this.tutorialMenu(); return; }
    if(G.training){
      this.show(`<h1 style="font-size:44px">${win?'האימון הושלם':'סוף האימון'}</h1><p class="sub">${win?'כל המטרות הושמדו.':reason}</p>
        <div class="stats" style="font-size:15px;margin-bottom:16px"><span>השמדות</span><span>${G.kills}</span><span>ניקוד</span><span>$${G.earned} (לא נשמר)</span></div>
        <div class="row"><button class="primary" data-act="training">אימון נוסף</button><button data-act="menu">תפריט ראשי</button></div>`);
      return;
    }
    if(G.special){ this.specialResult(win, reason); return; }
    if(G.defense){ this.defenseResult(win, reason); return; }
    if(G.ground){ this.groundResult(win, reason); return; }
    const L = G.def, gain = win ? G.earned + L.reward : Math.round(G.earned*0.5);
    SAVE.money += gain;
    const sk = skinFor(G.idx), skinWasOpen = !sk || skinUnlocked(sk.id);
    if(win){ SAVE.best[G.idx]=true; SAVE.unlocked = Math.max(SAVE.unlocked, Math.min(LEVELS.length, G.idx+2)); }
    storeSave();
    const last = win && G.idx===LEVELS.length-1;
    this.show(`<h1 style="font-size:44px">${last?'ניצחון במלחמה!':win?'המשימה הושלמה':'המשימה נכשלה'}</h1>
      <p class="sub">${last?'מבצר אוקינאווה נפל. הטייסת חוזרת הביתה.':win?L.name:reason}</p>
      <div class="stats" style="font-size:15px;margin-bottom:16px"><span>שלל מהמשימה</span><span>$${G.earned}</span>
      ${win?`<span>תגמול</span><span>$${L.reward}</span>`:'<span>שלל שנשמר</span><span>50%</span>'}<span>השמדות</span><span>${G.kills}</span>
      <span>כנפיים ששרדו</span><span>${G.wingmen.filter(w=>!w.dead).length}/${G.wingmen.length}</span><span>סה"כ הרווחת</span><span>$${gain}</span></div>
      ${win ? starsHTML(rateMission(G.idx)) + this.newSkinNote(G.idx, skinWasOpen) : ''}
      <div class="row" style="margin-top:12px">${win&&!last?`<button class="primary" data-act="level" data-v="${G.idx+1}">למשימה הבאה</button>`:''}
      <button class="${win?'':'primary'}" data-act="level" data-v="${G.idx}">${win?'שחק שוב':'נסה שוב'}</button><button data-act="menu">תפריט ראשי</button></div>`);
  },

  act(a, v){
    const lo = this.lo;
    switch(a){
      case 'menu': G=null; this.mainMenu(); break;
      case 'reset':
        if(!this.confirmReset){ this.confirmReset=true; const b=this.root.querySelector('[data-act="reset"]'); b.textContent='לחץ שוב לאישור המחיקה'; return; }
        SAVE = defaultSave(); storeSave(); this.lo=null; this.mainMenu(); break;
      case 'home': this.homePanel = this.homePanel===v ? null : v; this.mainMenu(); break;
      case 'brief': G=null; this.briefing(missionKey(v)); break;
      case 'level': G=null; this.briefing(+v); break;          // e.g. "next mission" after a win: briefing first
      case 'hangar': G=null; this.tab='mission'; if(this.lo) this.lo.wing=[]; this.hangar(missionKey(v)); break;
      case 'tab': this.tab=v; this.hangar(this.level); break;
      case 'skin': if(SAVE.skins[v]){ SAVE.skin=v; storeSave(); } this.hangar(this.level); break;
      case 'buyskin': { const k=SKINS[v];
        if(k && skinUnlocked(v) && !SAVE.skins[v] && SAVE.money>=k.price){ SAVE.money-=k.price; SAVE.skins[v]=true; SAVE.skin=v; storeSave(); SFX.pickup(); }
        this.hangar(this.level); break; }
      case 'ord': lo.ord=v; this.hangar(this.level); break;
      case 'wadd': if(lo.wing.length<MAX_WINGMEN) lo.wing.push(v); this.hangar(this.level); break;
      case 'wdel': { const k=lo.wing.lastIndexOf(v); if(k>=0) lo.wing.splice(k,1); this.hangar(this.level); break; }
      case 'pick': lo.plane=v; SAVE.plane=v; storeSave(); this.hangar(this.level); break;
      case 'buy': { const p=PLANES[v]; if(SAVE.money>=p.price){ SAVE.money-=p.price; SAVE.owned[v]=true; lo.plane=v; SAVE.plane=v; storeSave(); SFX.pickup(); } this.hangar(this.level); break; }
      case 'up': { const c=UPGRADES[v].costs[SAVE.up[v]]; if(c && SAVE.money>=c){ SAVE.money-=c; SAVE.up[v]++; storeSave(); SFX.pickup(); } this.hangar(this.level); break; }
      case 'launch': {
        if(SPECIALS[this.level] && SPECIALS[this.level].noWing) lo.wing = [];
        const cost = this.level==='def' ? 0 : lo.wing.reduce((s,w)=>s+WINGMEN[w].cost,0);   // free in Carrier Defense
        if(cost>SAVE.money) return;
        SAVE.money -= cost; storeSave();
        if(this.level==='def'){ newLevel(2, {plane:lo.plane, ord:lo.ord, wing:lo.wing.slice()}, {...DEFENSE}); defenseSetup(); }
        else if(this.level==='gnd'){ newLevel(2, {plane:lo.plane, ord:lo.ord, wing:lo.wing.slice()}, {...GROUND}); groundSetup(); }
        else if(SPECIALS[this.level]){ newLevel(2, {plane:lo.plane, ord:lo.ord, wing:lo.wing.slice()}, specialDef(this.level)); specialSetup(this.level); }
        else newLevel(this.level, {plane:lo.plane, ord:lo.ord, wing:lo.wing.slice()});
        this.hide(); break;
      }
      case 'dord': G.loadout.ord=v; this.openDeck(); break;
      case 'dplane': G.loadout.plane=v; this.openDeck(); break;
      case 'takeoff': {
        G.stats = planeStats(G.loadout.plane, G.loadout.up);
        if(this.crashed) restoreWingmen();
        const lives=G.lives; resetPlayer(); G.lives=lives; this.crashed=false; this.hide();
        say(`${G.stats.name} מוכן להמראה. W / → להגברת מצערת`,3); break; }
      case 'finish': this.result(true); break;
      case 'abort': this.result(false, 'נטשת את המשימה.'); break;
      case 'resume': G.paused=false; this.hide(); break;
      case 'training': G=null; this.trainingHangar(); break;
      case 'tutorial': G=null; this.tutorialMenu(); break;
      case 'defense': G=null; this.tab='mission'; if(this.lo) this.lo.wing=[]; this.hangar('def'); break;
      case 'ground': G=null; this.tab='mission'; if(this.lo) this.lo.wing=[]; this.hangar('gnd'); break;
      case 'lesson': this.hide(); startLesson(+v); break;
      case 'tplane': this.tr.plane=v; this.trainingHangar(); break;
      case 'tord': this.tr.ord=v; this.trainingHangar(); break;
      case 'twadd': if(this.tr.wing.length<MAX_WINGMEN) this.tr.wing.push(v); this.trainingHangar(); break;
      case 'twdel': { const k=this.tr.wing.lastIndexOf(v); if(k>=0) this.tr.wing.splice(k,1); this.trainingHangar(); break; }
      case 'tup': { const [k,l]=v.split(':'); this.tr.up[k]=+l; this.trainingHangar(); break; }
      case 'ttime': this.tr.time=v; this.trainingHangar(); break;
      case 'ttog': this.tr[v]=!this.tr[v]; this.trainingHangar(); break;
      case 'twind': this.tr.wind=+v; this.trainingHangar(); break;
      case 'tboss': this.tr.boss=v; this.trainingHangar(); break;
      case 'tlaunch': { const t=this.tr;
        newLevel(2, {plane:t.plane, ord:t.ord, wing:t.wing.slice(), up:Object.assign({},t.up)}, trainingDef(t));
        this.hide(); break; }
    }
  }
};

// ---- HUD on the canvas (logical coordinates) ----
function drawHUD(ctx, vw, worldVW){
  const P = G.player;
  ctx.save(); ctx.direction='rtl'; ctx.textAlign='right'; ctx.textBaseline='middle';
  const panel=(x,y,w,h)=>{ ctx.fillStyle='rgba(8,16,28,.62)'; ctx.fillRect(x,y,w,h); };
  const bar=(x,y,label,val,col)=>{ ctx.fillStyle='#c9d4df'; ctx.font='13px Rubik, sans-serif'; ctx.fillText(label,x,y);
    ctx.fillStyle='#22344d'; ctx.fillRect(x-150,y-5,90,10); ctx.fillStyle=col; ctx.fillRect(x-150+90*(1-clamp(val,0,1)),y-5,90*clamp(val,0,1),10); };
  // right block: aircraft state
  const rx = vw-12;
  panel(rx-170, 8, 170, 104);
  bar(rx-8, 22, 'מבנה', P.hp/P.max, P.hp<P.max*0.35?'#c8402f':'#5fae6b');
  bar(rx-8, 40, 'דלק', P.fuel/P.maxFuel, P.fuel<P.maxFuel*0.2?'#c8402f':'#e8b33a');
  bar(rx-8, 58, 'מצערת', P.throttle, '#8fa3b8');
  ctx.fillStyle='#efe6cf'; ctx.font='13px Rubik, sans-serif';
  ctx.fillText(`תחמושת ${P.ammo} · ${ORD[P.ordType].name} ${P.ord}/${P.ordMax}`, rx-8, 78);
  ctx.fillText(`מהירות ${Math.round(P.speed)} · גובה ${Math.max(0,Math.round((SEA-P.y)*3))} רגל`, rx-8, 96);
  // left block: mission
  panel(8, 8, 178, 104);
  ctx.textAlign='left'; ctx.direction='ltr'; ctx.fillStyle='#e8b33a'; ctx.font='18px "Secular One", Rubik, sans-serif'; ctx.fillText('$'+G.earned, 18, 24);
  ctx.textAlign='right'; ctx.direction='rtl'; ctx.font='13px Rubik, sans-serif'; ctx.fillStyle='#efe6cf';
  ctx.fillText(G.training ? 'אימון · מטוסים: ∞' : `מטוסים: ${'✈'.repeat(Math.max(0,G.lives))}`, 178, 44);
  ctx.fillText(G.complete ? 'חזור לנושאת ונחת!' : G.special ? G.special.M.short(G.special) : G.counter ? `מתקפת נגד: ${counterLeft()} מטוסים` : G.defense && G.defense.phase===1 ? `גל ${Math.max(1,G.defense.wave)} מתוך ${DEFENSE_WAVES}` : G.ground ? `איים שנכבשו: ${G.islands.filter(is=>is.captured).length}/3` : `מטרות נותרו: ${primariesLeft()}`, 178, 62);
  if(G.wingmen.length){ const alive=G.wingmen.filter(w=>!w.dead).length; ctx.fillText(`כנפיים ${alive}/${G.wingmen.length}: ${({escort:'ליווי', attack:'תקיפה', defend:'הגנת נושאת'})[G.wingMode]} (C)`, 178, 80); }
  { // carrier strength gauge: green, amber below 60%, red below 30%
    const k = clamp(G.carrier.hp/G.carrier.max, 0, 1);
    bar(178, 98, 'נושאת', k, k < 0.3 ? '#c8402f' : k < 0.6 ? '#e8b33a' : '#5fae6b');
    ctx.textAlign='left'; ctx.direction='ltr'; ctx.font='11px Rubik, sans-serif'; ctx.fillStyle='#efe6cf';
    ctx.fillText(Math.round(k*100)+'%', 14, 98); ctx.textAlign='right'; ctx.direction='rtl';
  }
  // minimap
  // Radar: one linear scale for everything, in both axes, over the whole area things can be in
  // (left of our carrier to beyond the furthest enemy ship), so positions line up with each other.
  const mw = Math.min(400, vw-400), mx = (vw-mw)/2, my = 8, mh = 42;
  if(mw>120){
    ctx.fillStyle='rgba(8,16,28,.22)'; ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=1; ctx.strokeRect(mx+0.5, my+0.5, mw-1, mh-1);
    let x0 = -450, x1 = G.L + 450;
    for(const sh of G.ships) x1 = Math.max(x1, sh.x + sh.w/2 + 150);
    const kx = mw/(x1-x0), ky = (mh-6)/(SEA+12-CEIL);
    const sx = x=>mx + (clamp(x, x0, x1)-x0)*kx, sy = y=>my + 3 + (clamp(y, CEIL, SEA+12)-CEIL)*ky;
    ctx.fillStyle='rgba(120,170,210,.35)'; ctx.fillRect(mx+1, sy(SEA), mw-2, 1);                                   // sea level
    for(const is of G.islands){ ctx.fillStyle='rgba(170,150,95,.75)'; ctx.fillRect(sx(is.x0), sy(SEA-is.h), (is.x1-is.x0)*kx, Math.max(2, is.h*ky)); }
    for(const C of [G.carrier, G.carrier2]) if(C){ ctx.fillStyle='rgba(170,190,210,.9)'; ctx.fillRect(sx(C.x), sy(DECK_Y)-1, Math.max(3, C.len*kx), 3); }
    for(const s of G.structures) if(s.primary && !s.dead){ ctx.fillStyle='#e8b33a'; ctx.fillRect(sx(s.x)-1, sy(s.y-s.h)-1, 2, 2); }
    for(const sh of G.ships) if(!sh.dead){ ctx.fillStyle='#e8b33a'; ctx.fillRect(sx(sh.x-sh.w/2), sy(SEA-sh.h*0.6)-1, Math.max(3, sh.w*kx), 2.5); }
    for(const e of G.enemies){ if(e.dead) continue; ctx.fillStyle = e.type==='zero' ? '#e0503c' : '#ff9b5a'; const s = e.type==='emily' ? 4 : 2.5; ctx.fillRect(sx(e.x)-s/2, sy(e.y)-s/2, s, s); }
    for(const w of G.wingmen) if(!w.dead){ ctx.fillStyle='#9fd0ff'; ctx.fillRect(sx(w.x)-1.25, sy(w.y)-1.25, 2.5, 2.5); }
    if(!P.dead){                                                                                                    // the player: a small arrow showing direction
      const px = sx(P.x), py = sy(P.y); ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.moveTo(px+P.f*3.5, py); ctx.lineTo(px-P.f*2.5, py-2.5); ctx.lineTo(px-P.f*2.5, py+2.5); ctx.closePath(); ctx.fill();
    }
    const vm = viewMetrics(CW, CH);                                                                                 // exactly what is on screen
    ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.strokeRect(sx(G.cam.x), sy(vm.top), worldVW*kx, Math.max(4, sy(vm.top+vm.viewH)-sy(vm.top)));
  }
  // boss health
  let boss=null, bname='';
  if(G.boss && !G.boss.dead){ boss=G.boss; bname='"אמילי"'; }
  const bs = G.ships.find(s=>s.type==='battleship' && !s.dead); if(bs && Math.abs(bs.x-P.x)<1600){ boss=bs; bname='אוניית מערכה'; }
  const core = G.structures.find(s=>s.type==='core' && !s.dead); if(core && Math.abs(core.x-P.x)<1800){ boss=core; bname='מבצר החוף'; }
  if(boss){
    const bw = Math.min(360, vw-60), bx=(vw-bw)/2, by=56;   // just below the radar
    ctx.fillStyle='rgba(8,16,28,.7)'; ctx.fillRect(bx,by,bw,16); ctx.fillStyle='#c8402f'; ctx.fillRect(bx+2,by+2,(bw-4)*clamp(boss.hp/boss.max,0,1),12);
    ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font='12px Rubik, sans-serif'; ctx.fillText(bname, vw/2, by+8.5);
  }
  // warnings
  ctx.textAlign='center'; ctx.font='20px "Secular One", Rubik, sans-serif';
  const blink = Math.floor(G.time*4)%2===0;
  let wy = 130;
  if(P.stall && !P.dead && blink){ ctx.fillStyle='#ff6b4a'; ctx.fillText('הזדקרות! הורד אף והגבר מצערת', vw/2, wy); wy+=26; }
  if(!P.dead && P.fuel<P.maxFuel*0.2 && blink){ ctx.fillStyle='#e8b33a'; ctx.fillText('דלק נמוך', vw/2, wy); wy+=26; }
  if(P.lit && !P.dead){ ctx.fillStyle='#ffe9a0'; ctx.fillText('זרקור נעל עליך!', vw/2, wy); wy+=26; }
  // nearing the carrier: landing guide
  if(!P.dead && !P.onDeck && Math.abs(P.x-(G.carrier.x+G.carrier.len/2))<700 && P.y>SEA-200){
    const ok = Math.abs(P.p)<0.32 && P.speed<225;
    ctx.font='14px Rubik, sans-serif'; ctx.fillStyle = ok?'#7fd08a':'#ff9b5a';
    ctx.fillText(ok?'מוכן לנחיתה':'לנחיתה: האט (S) ויישר את האף', vw/2, wy);
  }
  // messages
  ctx.font='16px Rubik, sans-serif';
  G.msg.forEach((m,i)=>{ m.t -= 1/60; ctx.globalAlpha=clamp(m.t,0,1); ctx.fillStyle='rgba(8,16,28,.6)';
    const w = ctx.measureText(m.text).width+24, my = H - 20 - (G.msg.length-1-i)*25; ctx.fillRect(vw/2-w/2, my-11, w, 22); ctx.fillStyle='#efe6cf'; ctx.fillText(m.text, vw/2, my); });
  ctx.globalAlpha=1;
  G.msg = G.msg.filter(m=>m.t>0);
  ctx.restore();
}
