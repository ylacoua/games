// ---- The aircraft carrier: detailed Essex-class drawing and its own anti-aircraft battery ----
// Guns are placed relative to the stern end of the flight deck (C.x) and the deck height (DECK_Y).
// '5in' = twin 5"/38 turrets beside the island firing proximity shells; '40mm' = Bofors quads on side sponsons.

function makeCarrierGuns(L){
  const ix = L*0.62;
  return [
    {kind:'40mm', dx:-6,      dy:7},
    {kind:'40mm', dx:110,     dy:7},
    {kind:'40mm', dx:250,     dy:7},
    {kind:'5in',  dx:ix-26,   dy:-5},
    {kind:'5in',  dx:ix+78,   dy:-5},
    {kind:'40mm', dx:L+22,    dy:7}
  ].map(g=>({...g, cool:rnd(0.2,1), aim:-1.2, flash:0, burst:0}));
}

function updateCarrierAA(dt){
  const C = G.carrier; if(C.hp<=0) return;
  if(!C.guns) C.guns = makeCarrierGuns(C.len);
  for(const g of C.guns){
    g.cool -= dt; g.flash = Math.max(0, g.flash-dt);
    const gx = C.x+g.dx, gy = DECK_Y+g.dy, big = g.kind==='5in';
    const range = big ? 950 : 640;
    let tg=null, bd=range*range;
    for(const e of G.enemies){
      if(e.dead || e.y > gy-25) continue;
      const d = dist2(gx,gy,e.x,e.y); if(d<bd){ bd=d; tg=e; }
    }
    if(!tg){ g.aim += (-1.2 - g.aim)*Math.min(1,dt*1.5); continue; }
    const sp = big ? 480 : 950, t = Math.sqrt(bd)/sp;
    const px = tg.x + Math.cos(tg.a)*tg.speed*t, py = tg.y + Math.sin(tg.a)*tg.speed*t;
    const want = Math.atan2(py-gy, px-gx);
    g.aim += clamp(wrapA(want-g.aim), -3*dt, 3*dt);
    if(g.cool>0 || Math.abs(wrapA(want-g.aim))>0.12) continue;
    const ca = Math.cos(g.aim), sa = Math.sin(g.aim), mx = gx+ca*(big?16:12), my = gy+sa*(big?16:12);
    if(big){
      G.flak.push({x:mx, y:my, vx:ca*sp, vy:sa*sp, fuse:t+rnd(-0.15,0.25), dmg:16, big:false, team:'p'});
      g.cool = rnd(1.8,2.6); SFX.noise(0.25, 700, 0.12);
    } else {
      const a = g.aim + rnd(-0.09,0.09);
      G.shots.push({x:mx, y:my, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, team:'p', dmg:3, life:t+0.25, aa:true});
      g.burst++; g.cool = g.burst%4===0 ? rnd(0.9,1.5) : 0.15;
      if(Math.random()<0.5) SFX.noise(0.08, 1200, 0.07, 'bandpass', 2);
    }
    g.flash = 0.06;
  }
}

function drawCarrier(ctx, C){
  const x=C.x, L=C.len, night = G.weather.time==='night', t = G.time;
  if(!C.guns) C.guns = makeCarrierGuns(L);
  const hullTop = DECK_Y+5, bottom = SEA+14;

  // --- hull with Measure-32 dazzle camouflage ---
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x-22,hullTop); ctx.lineTo(x+L+46,hullTop-2); ctx.quadraticCurveTo(x+L+20,SEA-4,x+L-14,bottom);
  ctx.lineTo(x+18,bottom); ctx.quadraticCurveTo(x-8,SEA,x-22,hullTop); ctx.closePath();
  const hg = ctx.createLinearGradient(0,hullTop,0,bottom); hg.addColorStop(0,'#6b737c'); hg.addColorStop(1,'#4a5159');
  ctx.fillStyle=hg; ctx.fill();
  ctx.clip();
  ctx.fillStyle='rgba(32,38,46,.55)';
  for(const [a,b,c,d] of [[0,0.12,0.05,0.2],[0.22,0.38,0.3,0.46],[0.55,0.64,0.6,0.76],[0.8,0.93,0.86,1.02]]){
    ctx.beginPath(); ctx.moveTo(x+L*a,hullTop); ctx.lineTo(x+L*b,hullTop); ctx.lineTo(x+L*d,bottom); ctx.lineTo(x+L*c,bottom); ctx.fill();
  }
  ctx.fillStyle='rgba(150,165,178,.35)';
  for(const [a,b] of [[0.14,0.2],[0.46,0.53],[0.76,0.8]]){ ctx.beginPath(); ctx.moveTo(x+L*a,hullTop); ctx.lineTo(x+L*b,hullTop); ctx.lineTo(x+L*(b+0.05),bottom); ctx.lineTo(x+L*(a+0.08),bottom); ctx.fill(); }
  // hangar deck openings (lit at night) and a row of portholes
  for(let i=0;i<9;i++){
    const hx = x+24+i*54;
    ctx.fillStyle = night ? 'rgba(255,196,110,.55)' : '#22282f'; ctx.fillRect(hx, hullTop+3, 34, 7);
    ctx.fillStyle = '#3a4048'; ctx.fillRect(hx+16, hullTop+3, 2, 7);
  }
  ctx.fillStyle = night ? 'rgba(255,220,150,.7)' : '#2a3038';
  for(let px=x+30; px<x+L; px+=17){ ctx.beginPath(); ctx.arc(px, hullTop+17, 1.3, 0, 7); ctx.fill(); }
  // hull plating seams and waterline boot-topping
  ctx.strokeStyle='rgba(20,24,30,.25)'; ctx.lineWidth=0.6;
  for(let px=x; px<x+L+40; px+=38){ ctx.beginPath(); ctx.moveTo(px,hullTop+12); ctx.lineTo(px,bottom); ctx.stroke(); }
  ctx.fillStyle='#1d2126'; ctx.fillRect(x-30,SEA-3,L+90,4);
  ctx.restore();
  // bow wave and wake foam
  ctx.fillStyle='rgba(235,245,250,.75)';
  for(let i=0;i<5;i++){ const w=Math.sin(t*3+i)*2; ctx.beginPath(); ctx.ellipse(x+L+18-i*7, SEA+1, 9-i, 2.2+w*0.3, 0, 0, 7); ctx.fill(); }
  ctx.fillStyle='rgba(235,245,250,.45)';
  for(let i=0;i<6;i++){ ctx.beginPath(); ctx.ellipse(x-20-i*16+Math.sin(t*2+i)*3, SEA+2, 10, 1.6, 0, 0, 7); ctx.fill(); }

  // --- side sponsons with 40mm mounts (drawn before the deck so the deck overhangs them) ---
  for(const g of C.guns) if(g.kind==='40mm'){
    const gx=x+g.dx, gy=DECK_Y+g.dy;
    ctx.fillStyle='#545c65'; ctx.beginPath(); ctx.moveTo(gx-12,gy+2); ctx.lineTo(gx+12,gy+2); ctx.lineTo(gx+6,gy+10); ctx.lineTo(gx-6,gy+10); ctx.fill();
    ctx.strokeStyle='#8c949c'; ctx.lineWidth=0.7; ctx.beginPath(); ctx.moveTo(gx-12,gy-2); ctx.lineTo(gx+12,gy-2); ctx.stroke();
  }

  // --- flight deck: steel edge, teak planking, markings ---
  ctx.fillStyle='#3f454c'; ctx.fillRect(x-26,DECK_Y-2,L+74,7);
  ctx.fillStyle='#8b7b5c'; ctx.fillRect(x-24,DECK_Y-3,L+70,3.5);
  ctx.strokeStyle='rgba(60,48,30,.35)'; ctx.lineWidth=0.5;
  for(let px=x-20; px<x+L+44; px+=7){ ctx.beginPath(); ctx.moveTo(px,DECK_Y-3); ctx.lineTo(px,DECK_Y+0.5); ctx.stroke(); }
  ctx.fillStyle='rgba(255,255,255,.8)'; ctx.fillRect(x-24,DECK_Y-3.5,L+70,0.8);
  ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1; ctx.setLineDash([9,7]);
  ctx.beginPath(); ctx.moveTo(x,DECK_Y+2); ctx.lineTo(x+L,DECK_Y+2); ctx.stroke(); ctx.setLineDash([]);
  // landing area stripes at the stern and the arresting wires with their sheaves
  ctx.fillStyle='#e8e2c8'; for(let i=0;i<3;i++) ctx.fillRect(x-18+i*6,DECK_Y-3,3,3.5);
  for(let i=0;i<5;i++){
    const wx = x+36+i*20;
    ctx.fillStyle='#c9a227'; ctx.fillRect(wx-1,DECK_Y-6,2,3);
    ctx.strokeStyle='#1d1d1d'; ctx.lineWidth=0.8; ctx.beginPath(); ctx.moveTo(wx-1,DECK_Y-4.5); ctx.lineTo(wx+1,DECK_Y-4.5); ctx.stroke();
  }
  // elevators outlined on the deck
  ctx.strokeStyle='rgba(30,30,30,.45)'; ctx.lineWidth=0.8;
  ctx.strokeRect(x+L*0.3,DECK_Y-3,36,3); ctx.strokeRect(x+L*0.86,DECK_Y-3,30,3);
  // hull number painted on the bow
  ctx.fillStyle='#e8e2c8'; ctx.font='bold 13px Rubik, sans-serif'; ctx.textAlign='center'; ctx.fillText('9', x+L+14, hullTop+16);
  // deck-edge lights at night
  if(night){ for(let px=x; px<=x+L; px+=40){ ctx.fillStyle='#7fb8ff'; ctx.fillRect(px-1,DECK_Y-4,2,2); } }
  // parked aircraft on the bow, folded wings (kept forward of the landing area)
  for(const px of [x+L+4, x+L+30]){
    ctx.save(); ctx.translate(px, DECK_Y-8); ctx.scale(-0.55,0.55); drawPlane(ctx,'fighter','#3d5c7c','us',1,false,false,1); ctx.restore();
  }

  // --- island superstructure ---
  const ix = x+L*0.62;
  ctx.fillStyle='#59616a'; ctx.fillRect(ix,DECK_Y-40,52,37);                       // base
  ctx.fillStyle='#4c535b'; ctx.fillRect(ix+4,DECK_Y-56,44,16);                      // flag bridge
  ctx.fillStyle='#636b74'; ctx.fillRect(ix+8,DECK_Y-68,36,12);                      // navigation bridge
  ctx.fillStyle='#4a5159'; ctx.fillRect(ix-4,DECK_Y-58,8,3); ctx.fillRect(ix+48,DECK_Y-58,8,3);   // bridge wings
  ctx.fillStyle = night ? '#ffd27a' : '#9fc4db';
  for(let i=0;i<6;i++) ctx.fillRect(ix+10+i*5.4,DECK_Y-65,3.6,3);
  for(let i=0;i<7;i++) ctx.fillRect(ix+7+i*5.6,DECK_Y-51,3.6,2.6);
  ctx.fillStyle='rgba(20,24,30,.5)'; for(let i=0;i<4;i++) ctx.fillRect(ix+6+i*11,DECK_Y-30,6,8); // hatches
  // funnel, angled outboard, with a black cap and exhaust haze
  ctx.fillStyle='#545b63'; ctx.beginPath(); ctx.moveTo(ix+26,DECK_Y-68); ctx.lineTo(ix+50,DECK_Y-68); ctx.lineTo(ix+54,DECK_Y-84); ctx.lineTo(ix+32,DECK_Y-86); ctx.fill();
  ctx.fillStyle='#1c1f23'; ctx.beginPath(); ctx.moveTo(ix+32,DECK_Y-86); ctx.lineTo(ix+54,DECK_Y-84); ctx.lineTo(ix+55,DECK_Y-88); ctx.lineTo(ix+33,DECK_Y-90); ctx.fill();
  if(Math.random()<0.08) puff(ix+44, DECK_Y-92, 'rgba(70,70,70,.6)', 7, 2);
  // tripod mast, yardarm, rotating search radar, ensign
  ctx.strokeStyle='#3a4047'; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.moveTo(ix+14,DECK_Y-68); ctx.lineTo(ix+20,DECK_Y-112); ctx.moveTo(ix+26,DECK_Y-68); ctx.lineTo(ix+20,DECK_Y-112);
  ctx.moveTo(ix+8,DECK_Y-100); ctx.lineTo(ix+32,DECK_Y-100); ctx.stroke();
  ctx.lineWidth=0.6; ctx.beginPath(); ctx.moveTo(ix+8,DECK_Y-100); ctx.lineTo(ix-6,DECK_Y-56); ctx.moveTo(ix+32,DECK_Y-100); ctx.lineTo(ix+60,DECK_Y-62); ctx.stroke();
  const rw = 11*Math.abs(Math.cos(t*1.6));
  ctx.fillStyle='#2e3339'; ctx.fillRect(ix+20-rw,DECK_Y-118,rw*2,5);
  ctx.strokeStyle='#5d656d'; ctx.lineWidth=0.5; for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.moveTo(ix+20+i*rw/2.5,DECK_Y-118); ctx.lineTo(ix+20+i*rw/2.5,DECK_Y-113); ctx.stroke(); }
  const wave = Math.sin(t*4)*1.2;
  ctx.fillStyle='#b22234'; ctx.fillRect(ix+32,DECK_Y-104+wave*0.3,10,6);
  ctx.fillStyle='#fff'; ctx.fillRect(ix+32,DECK_Y-102+wave*0.3,10,1); ctx.fillRect(ix+32,DECK_Y-100+wave*0.3,10,1);
  ctx.fillStyle='#3c3b6e'; ctx.fillRect(ix+32,DECK_Y-104+wave*0.3,4.5,3.2);
  // signal flags strung from the yardarm
  const sig=['#e8b33a','#c8402f','#1d3a6e','#f4f4f0','#c8402f'];
  sig.forEach((c,i)=>{ ctx.fillStyle=c; ctx.fillRect(ix+6-i*3.5, DECK_Y-98+i*6+wave*0.2, 3, 3); });
  ctx.fillStyle = t%1<0.5 ? '#ff5a3a' : '#7a2a1a'; ctx.fillRect(ix+18.5,DECK_Y-124,3,3);

  // --- anti-aircraft guns ---
  for(const g of C.guns){
    const gx=x+g.dx, gy=DECK_Y+g.dy, big=g.kind==='5in', ca=Math.cos(g.aim), sa=Math.sin(g.aim);
    ctx.strokeStyle='#2a2f35'; ctx.lineWidth = big?2.2:1.4; ctx.lineCap='butt';
    const len = big?17:13;
    for(const off of big?[-2,2]:[-1.6,1.6]){
      const ox = -sa*off, oy = ca*off;
      ctx.beginPath(); ctx.moveTo(gx+ox,gy+oy); ctx.lineTo(gx+ox+ca*len, gy+oy+sa*len); ctx.stroke();
    }
    ctx.fillStyle = big ? '#5c646d' : '#4c545c';
    if(big){ ctx.beginPath(); ctx.moveTo(gx-9,gy+4); ctx.lineTo(gx-7,gy-4); ctx.lineTo(gx+7,gy-4); ctx.lineTo(gx+9,gy+4); ctx.fill(); }
    else { ctx.fillRect(gx-5,gy-3,10,6); ctx.fillStyle='#3a4047'; ctx.fillRect(gx-6,gy+2,12,2); }
    if(g.flash>0){ ctx.fillStyle='rgba(255,220,120,.95)'; ctx.beginPath(); ctx.arc(gx+ca*(len+2), gy+sa*(len+2), big?5:3, 0, 7); ctx.fill(); }
  }

  // --- damage ---
  if(C.hit>0){ C.hit-=1/60; ctx.fillStyle='rgba(255,120,60,.4)'; ctx.fillRect(x-20,DECK_Y-4,L+60,SEA-DECK_Y+16); }
  const dmg = 1 - C.hp/C.max;
  if(dmg>0.25 && Math.random()<dmg*0.4) puff(x+rnd(0,L), DECK_Y-4, '#333', 10, 1.6);
  if(dmg>0.5){ ctx.fillStyle=`rgba(255,${120+Math.random()*80|0},40,.85)`; ctx.beginPath(); ctx.arc(x+L*0.4+Math.sin(t*9)*2, DECK_Y-5, 4+Math.random()*2, 0, 7); ctx.fill(); }
}
