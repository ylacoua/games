// ---- Menus (DOM overlays, RTL) and the in-flight HUD (canvas) ----
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
      <b>← →</b><span>פנייה ימינה / שמאלה באותו גובה (לחיצה לכיוון הטיסה מגבירה מהירות)</span>
      <b>W / S</b><span>הגברה / הורדה של המצערת</span>
      <b>רווח</b><span>מקלעים</span>
      <b>X</b><span>הטלת חימוש (פצצה / רקטה / טורפדו)</span>
      <b>C</b><span>פקודה לכנפיים: ליווי ↔ תקיפה</span>
      <b>Esc</b><span>עצירה · <b>M</b> השתקה</span>
    </div>
    <p class="note">נחיתה: התקרב לנושאת נמוך, במצערת נמוכה ובאף כמעט ישר. מהירות מתחת ל-225 וזווית קטנה.</p>`;
  },

  mainMenu(){
    this.confirmReset=false; Music.start();
    const lv = LEVELS.map((L,i)=>{
      const locked = i >= SAVE.unlocked;
      return `<button class="card lvl ${locked?'locked':''}" data-act="level" data-v="${i}" ${locked?'disabled':''}>
        <span class="spread"><b>${i+1}. ${L.name}</b>${L.boss?'<span class="pill boss">בוס</span>':''}</span>
        <small>${({day:'יום',dawn:'שחר',dusk:'שקיעה',night:'לילה'})[L.time]}${L.rain?' · גשם':''}${L.wind?' · רוח':''}${SAVE.best[i]?' · ✓ הושלם':''}</small>
      </button>`;}).join('');
    this.show(`
      <div class="spread"><div><h1>כנפי הרעם</h1><p class="sub">WINGS OF FURY · האוקיינוס השקט, 1944. טייס מנושאת מטוסים מול איים מבוצרים, ספינות ובוסים.</p></div>${this.money()}</div>
      <div class="row"><button class="primary" data-act="level" data-v="${Math.min(SAVE.unlocked, LEVELS.length)-1}">המשך למשימה ${Math.min(SAVE.unlocked, LEVELS.length)}</button>
      <button data-act="training">משימת אימון (הכול חינם)</button>
      <button data-act="reset">איפוס התקדמות</button></div>
      <h3 style="margin-top:18px">משימות</h3><div class="levels">${lv}</div>
      <h3 style="margin:18px 0 8px">שליטה</h3>${this.keysHTML()}`);
  },

  hangar(i){
    this.level = i; Music.start();
    if(!this.lo) this.lo = {plane:SAVE.plane, ord:'bomb', wing:[]};
    if(!SAVE.owned[this.lo.plane]) this.lo.plane='hellcat';
    const L = LEVELS[i], tab=this.tab;
    const tabs = [['mission','תדריך וחימוש'],['planes','מטוסים'],['upgrades','שדרוגים']]
      .map(([k,t])=>`<button class="${tab===k?'on':''}" data-act="tab" data-v="${k}">${t}</button>`).join('');
    let body='';
    if(tab==='mission'){
      const st = planeStats(this.lo.plane);
      const ords = Object.keys(ORD).map(k=>`<button class="card ${this.lo.ord===k?'sel':''}" data-act="ord" data-v="${k}" style="text-align:right">
        <b>${ORD[k].name} ×${st.ord[k]}</b><p>${ORD[k].note}</p></button>`).join('');
      const wcost = this.lo.wing.reduce((s,w)=>s+WINGMEN[w].cost,0);
      const wings = Object.keys(WINGMEN).map(k=>{const d=WINGMEN[k], n=this.lo.wing.filter(x=>x===k).length;
        return `<div class="card"><div class="spread"><b>${d.name}</b><span class="pill">$${d.cost}</span></div><p>${d.desc}</p>
        <div class="row"><button data-act="wadd" data-v="${k}" ${this.lo.wing.length>=MAX_WINGMEN||SAVE.money<wcost+d.cost?'disabled':''}>+ הוסף</button>
        <button data-act="wdel" data-v="${k}" ${n?'':'disabled'}>− הסר</button><span class="note">בטייסת: ${n}</span></div></div>`;}).join('');
      body = `<h2>${i+1}. ${L.name}</h2><p class="sub">${L.brief}</p>
        <div class="row" style="margin-bottom:12px">${L.boss?'<span class="pill boss">משימת בוס</span>':''}<span class="pill">תגמול $${L.reward}</span>
        <span class="pill">מטוס: ${PLANES[this.lo.plane].name}</span>${L.bombers?'<span class="pill">מפציצי אויב</span>':''}</div>
        <h3>חימוש לגיחה הראשונה</h3><p class="note">אפשר להחליף חימוש בכל נחיתה על הנושאת.</p><div class="grid">${ords}</div>
        <h3 style="margin-top:16px">כנפיים (עד ${MAX_WINGMEN} מטוסים בשליטת המחשב)</h3><div class="grid">${wings}</div>
        <div class="spread" style="margin-top:18px"><span class="note">עלות הכנפיים למשימה: $${wcost}</span>
        <div class="row"><button data-act="menu">חזרה</button><button class="primary" data-act="launch">יציאה למשימה</button></div></div>`;
    } else if(tab==='planes'){
      const maxS = 480, maxH = 200;
      body = `<div class="grid">${Object.keys(PLANES).map(k=>{const b=PLANES[k], own=SAVE.owned[k], sel=this.lo.plane===k;
        return `<div class="card ${sel?'sel':''} ${own?'':'locked'}"><div class="spread"><b>${b.name}</b>${own?(sel?'<span class="pill">נבחר</span>':''):`<span class="pill">$${b.price}</span>`}</div>
        <p>${b.desc}</p><div class="stats"><span>מהירות</span><span class="bar"><i style="width:${b.speed/maxS*100}%"></i></span>
        <span>תמרון</span><span class="bar"><i style="width:${b.turn/2.4*100}%"></i></span><span>חוזק</span><span class="bar"><i style="width:${b.hp/maxH*100}%"></i></span>
        <span>חימוש</span><span>${b.ord.bomb} פצצות · ${b.ord.rocket} רקטות · ${b.ord.torpedo} טורפדו${b.gunner?' · תותחן אחורי':''}</span></div>
        ${own?`<button data-act="pick" data-v="${k}" ${sel?'disabled':''}>בחר</button>`:`<button class="primary" data-act="buy" data-v="${k}" ${SAVE.money<b.price?'disabled':''}>קנה</button>`}</div>`;}).join('')}</div>`;
    } else {
      body = `<div class="grid">${Object.keys(UPGRADES).map(k=>{const u=UPGRADES[k], lv=SAVE.up[k], c=u.costs[lv];
        return `<div class="card"><div class="spread"><b>${u.name}</b><span class="pill">דרגה ${lv}/3</span></div><p>${u.desc} לכל דרגה. חל על כל המטוסים.</p>
        <div class="bar"><i style="width:${lv/3*100}%"></i></div>
        ${c?`<button data-act="up" data-v="${k}" ${SAVE.money<c?'disabled':''}>שדרג · $${c}</button>`:'<span class="note">דרגה מרבית</span>'}</div>`;}).join('')}</div>`;
    }
    this.show(`<div class="spread"><h2>חדר התדריכים</h2>${this.money()}</div><div class="tabs">${tabs}</div>${body}`);
  },

  // Training: every plane, upgrade, wingman and weather option, free and unsaved
  trainingHangar(){
    Music.start();
    if(!this.tr) this.tr = {plane:'hellcat', ord:'bomb', wing:[], up:{engine:3,armor:3,guns:3,payload:3,fuel:3},
      time:'day', rain:false, storm:false, wind:0, boss:'', bombers:false, zeros:true};
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
      <div class="tabs">${opt('ttog','rain',t.rain,'גשם')}${opt('ttog','storm',t.storm,'ברקים')}${opt('ttog','zeros',t.zeros,'מטוסי זירו')}${opt('ttog','bombers',t.bombers,'מפציצי אויב')}</div>
      <div class="tabs"><span class="note" style="align-self:center">רוח:</span>${[[-45,'חזקה שמאלה'],[0,'ללא'],[45,'חזקה ימינה']].map(([k,l])=>opt('twind',k,t.wind===k,l)).join('')}</div>
      <div class="tabs"><span class="note" style="align-self:center">בוס:</span>${[['','ללא'],['battleship','אוניית מערכה'],['emily','"אמילי"'],['fortress','מבצר חוף']].map(([k,l])=>opt('tboss',k,t.boss===k,l)).join('')}</div>
      <div class="row" style="margin-top:14px"><button data-act="menu">חזרה</button><button class="primary" data-act="tlaunch">התחל אימון</button></div>`);
  },

  // Carrier deck panel: after a landing, or with a replacement aircraft after a crash.
  // The pilot may switch to any plane they own (any plane in training) before taking off.
  openDeck(crashed){
    SFX.setEngine(false,0);
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
      ${this.keysHTML()}<div class="row" style="margin-top:14px"><button class="primary" data-act="resume">המשך</button><button data-act="abort">נטוש משימה</button></div>`);
  },

  result(win, reason){
    G.state='over'; SFX.setEngine(false,0);
    if(G.training){
      this.show(`<h1 style="font-size:44px">${win?'האימון הושלם':'סוף האימון'}</h1><p class="sub">${win?'כל המטרות הושמדו.':reason}</p>
        <div class="stats" style="font-size:15px;margin-bottom:16px"><span>השמדות</span><span>${G.kills}</span><span>ניקוד</span><span>$${G.earned} (לא נשמר)</span></div>
        <div class="row"><button class="primary" data-act="training">אימון נוסף</button><button data-act="menu">תפריט ראשי</button></div>`);
      return;
    }
    const L = G.def, gain = win ? G.earned + L.reward : Math.round(G.earned*0.5);
    SAVE.money += gain;
    if(win){ SAVE.best[G.idx]=true; SAVE.unlocked = Math.max(SAVE.unlocked, Math.min(LEVELS.length, G.idx+2)); }
    storeSave();
    const last = win && G.idx===LEVELS.length-1;
    this.show(`<h1 style="font-size:44px">${last?'ניצחון במלחמה!':win?'המשימה הושלמה':'המשימה נכשלה'}</h1>
      <p class="sub">${last?'מבצר אוקינאווה נפל. הטייסת חוזרת הביתה.':win?L.name:reason}</p>
      <div class="stats" style="font-size:15px;margin-bottom:16px"><span>שלל מהמשימה</span><span>$${G.earned}</span>
      ${win?`<span>תגמול</span><span>$${L.reward}</span>`:'<span>שלל שנשמר</span><span>50%</span>'}<span>השמדות</span><span>${G.kills}</span>
      <span>כנפיים ששרדו</span><span>${G.wingmen.filter(w=>!w.dead).length}/${G.wingmen.length}</span><span>סה"כ הרווחת</span><span>$${gain}</span></div>
      <div class="row">${win&&!last?`<button class="primary" data-act="level" data-v="${G.idx+1}">למשימה הבאה</button>`:''}
      <button class="${win?'':'primary'}" data-act="level" data-v="${G.idx}">${win?'שחק שוב':'נסה שוב'}</button><button data-act="menu">תפריט ראשי</button></div>`);
  },

  act(a, v){
    const lo = this.lo;
    switch(a){
      case 'menu': G=null; this.mainMenu(); break;
      case 'reset':
        if(!this.confirmReset){ this.confirmReset=true; const b=this.root.querySelector('[data-act="reset"]'); b.textContent='לחץ שוב לאישור המחיקה'; return; }
        SAVE = defaultSave(); storeSave(); this.lo=null; this.mainMenu(); break;
      case 'level': G=null; this.tab='mission'; if(this.lo) this.lo.wing=[]; this.hangar(+v); break;
      case 'tab': this.tab=v; this.hangar(this.level); break;
      case 'ord': lo.ord=v; this.hangar(this.level); break;
      case 'wadd': if(lo.wing.length<MAX_WINGMEN) lo.wing.push(v); this.hangar(this.level); break;
      case 'wdel': { const k=lo.wing.lastIndexOf(v); if(k>=0) lo.wing.splice(k,1); this.hangar(this.level); break; }
      case 'pick': lo.plane=v; SAVE.plane=v; storeSave(); this.hangar(this.level); break;
      case 'buy': { const p=PLANES[v]; if(SAVE.money>=p.price){ SAVE.money-=p.price; SAVE.owned[v]=true; lo.plane=v; SAVE.plane=v; storeSave(); SFX.pickup(); } this.hangar(this.level); break; }
      case 'up': { const c=UPGRADES[v].costs[SAVE.up[v]]; if(c && SAVE.money>=c){ SAVE.money-=c; SAVE.up[v]++; storeSave(); SFX.pickup(); } this.hangar(this.level); break; }
      case 'launch': {
        const cost = lo.wing.reduce((s,w)=>s+WINGMEN[w].cost,0);
        if(cost>SAVE.money) return;
        SAVE.money -= cost; storeSave();
        newLevel(this.level, {plane:lo.plane, ord:lo.ord, wing:lo.wing.slice()});
        this.hide(); break;
      }
      case 'dord': G.loadout.ord=v; this.openDeck(); break;
      case 'dplane': G.loadout.plane=v; this.openDeck(); break;
      case 'takeoff': {
        G.stats = planeStats(G.loadout.plane, G.loadout.up);
        const lives=G.lives; resetPlayer(); G.lives=lives; this.crashed=false; this.hide();
        say(`${G.stats.name} מוכן להמראה. W / → להגברת מצערת`,3); break; }
      case 'finish': this.result(true); break;
      case 'abort': this.result(false, 'נטשת את המשימה.'); break;
      case 'resume': G.paused=false; this.hide(); break;
      case 'training': G=null; this.trainingHangar(); break;
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
  ctx.fillText(G.complete ? 'חזור לנושאת ונחת!' : `מטרות נותרו: ${primariesLeft()}`, 178, 62);
  if(G.wingmen.length){ const alive=G.wingmen.filter(w=>!w.dead).length; ctx.fillText(`כנפיים ${alive}/${G.wingmen.length}: ${G.wingMode==='escort'?'ליווי':'תקיפה'} (C)`, 178, 80); }
  ctx.fillText(`נושאת ${Math.round(G.carrier.hp/G.carrier.max*100)}%`, 178, 98);
  // minimap
  const mw = Math.min(380, vw-400), mx = (vw-mw)/2, my = 10, mh = 30;
  if(mw>120){
    panel(mx, my, mw, mh);
    const sx = x=>mx + clamp(x/G.L,0,1)*mw, sy = y=>my + 4 + clamp((y-CEIL)/(SEA-CEIL),0,1)*(mh-8);
    ctx.fillStyle='#8fa3b8'; ctx.fillRect(sx(G.carrier.x), my+mh-6, Math.max(3,mw*G.carrier.len/G.L), 3);
    for(const is of G.islands){ ctx.fillStyle='#8a7a4a'; ctx.fillRect(sx(is.x0), my+mh-6, sx(is.x1)-sx(is.x0), 4); }
    for(const s of G.structures) if(s.primary && !s.dead){ ctx.fillStyle='#e8b33a'; ctx.fillRect(sx(s.x)-1, my+mh-10, 2, 3); }
    for(const sh of G.ships) if(!sh.dead){ ctx.fillStyle='#e8b33a'; ctx.fillRect(sx(sh.x)-2, my+mh-8, 4, 3); }
    for(const e of G.enemies){ ctx.fillStyle = e.type==='zero'?'#c8402f':'#ff9b5a'; ctx.fillRect(sx(e.x)-1.5, sy(e.y)-1.5, e.type==='emily'?5:3, 3); }
    for(const w of G.wingmen) if(!w.dead && w.state==='fly'){ ctx.fillStyle='#9fd0ff'; ctx.fillRect(sx(w.x)-1, sy(w.y)-1, 2, 2); }
    if(!P.dead){ ctx.fillStyle='#fff'; ctx.fillRect(sx(P.x)-2, sy(P.y)-2, 4, 4); }
    ctx.strokeStyle='rgba(255,255,255,.3)'; ctx.strokeRect(sx(G.cam.x), my, mw*(worldVW/G.L), mh);
  }
  // boss health
  let boss=null, bname='';
  if(G.boss && !G.boss.dead){ boss=G.boss; bname='"אמילי"'; }
  const bs = G.ships.find(s=>s.type==='battleship' && !s.dead); if(bs && Math.abs(bs.x-P.x)<1600){ boss=bs; bname='אוניית מערכה'; }
  const core = G.structures.find(s=>s.type==='core' && !s.dead); if(core && Math.abs(core.x-P.x)<1800){ boss=core; bname='מבצר החוף'; }
  if(boss){
    const bw = Math.min(360, vw-60), bx=(vw-bw)/2, by=48;
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
    const w = ctx.measureText(m.text).width+24; ctx.fillRect(vw/2-w/2, H-120+i*26-11, w, 22); ctx.fillStyle='#efe6cf'; ctx.fillText(m.text, vw/2, H-120+i*26); });
  ctx.globalAlpha=1;
  G.msg = G.msg.filter(m=>m.t>0);
  ctx.restore();
}
