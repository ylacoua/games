// ---- Drawing: sky, sea, islands, carrier, aircraft, effects, night lighting, HUD ----
const SKY = {
  day:  {top:'#4f8fc9', bot:'#cfe5f0', sea1:'#2f6d93', sea2:'#163e5c', dark:0},
  dawn: {top:'#2b3c6b', bot:'#f2a66a', sea1:'#4b5f86', sea2:'#1e2a48', dark:0.1},
  dusk: {top:'#33244d', bot:'#ea7a46', sea1:'#4a3d5e', sea2:'#1c1830', dark:0.15},
  night:{top:'#03060f', bot:'#132344', sea1:'#0c1a2e', sea2:'#050b16', dark:0.76}
};
let darkCv = null;

// Camera framing: the sea stays at the bottom of the screen; as the player climbs the view's top edge
// rises with them, so the whole picture zooms out.
function viewMetrics(cw, ch){
  const top = G ? G.cam.top : 0, viewH = H - top, scale = ch/viewH;
  return {top, viewH, scale, vw: cw/scale};
}

function render(ctx, cw, ch){
  const {top, scale, vw} = viewMetrics(cw, ch);
  const hs = ch/H, hvw = cw/hs;                       // fixed screen-space scale for HUD and overlays
  const camX = G.cam.x, W = G.weather, sky = SKY[W.time];
  const stormy = W.rain>0.5 && W.time!=='night';
  // sky, in world coordinates so it darkens toward the stratosphere
  ctx.setTransform(scale,0,0,scale,-camX*scale,-top*scale);
  const skyTop = CEIL-250, g = ctx.createLinearGradient(0,skyTop,0,SEA);
  g.addColorStop(0, W.time==='night' ? '#000208' : stormy ? '#232a31' : '#173a68');
  g.addColorStop((0-skyTop)/(SEA-skyTop), stormy?'#3d4854':sky.top); g.addColorStop(1, stormy?'#7d8892':sky.bot);
  ctx.fillStyle=g; ctx.fillRect(camX-10,top-10,vw+20,SEA-top+10);
  // stars, sun and moon stay fixed on the screen
  ctx.setTransform(hs,0,0,hs,0,0);
  if(W.time==='night'){ ctx.fillStyle='#fff'; for(let i=0;i<90;i++){ const sx=((i*397.3 - camX*0.05)%hvw+hvw)%hvw, sy=(i*131.7)%(SEA-120); ctx.globalAlpha=0.3+0.5*((i*7)%5)/5; ctx.fillRect(sx,sy,1.5,1.5);} ctx.globalAlpha=1;
    ctx.fillStyle='#e9e6d4'; ctx.beginPath(); ctx.arc(hvw*0.8, 90, 22, 0, 7); ctx.fill(); }
  else if(!stormy){ ctx.fillStyle = W.time==='day'?'rgba(255,250,220,.9)':'rgba(255,200,140,.9)'; ctx.beginPath(); ctx.arc(W.time==='dawn'?hvw*0.15:hvw*0.85, W.time==='day'?80:SEA-90, 34, 0, 7); ctx.fill(); }
  // world
  ctx.setTransform(scale,0,0,scale,-camX*scale,-top*scale);
  // distant clouds with horizontal parallax, spread through every altitude band
  for(const c of G.clouds){
    if(c.y < top-60) continue;
    const drift = G.time*(4 + G.weather.wind*0.15)*c.s;   // slow wind drift, bigger clouds look closer
    const span = vw+700, sx = ((c.x + drift - camX*c.par)%span+span)%span - 350;
    drawCloud(ctx, camX+sx, c.y, c.s, W);
  }
  ctx.save();
  const x0 = camX-100, x1 = camX+vw+100;
  drawSea(ctx, x0, x1, sky, W);
  for(const is of G.islands) if(is.x1>x0 && is.x0<x1) drawIsland(ctx, is);
  drawCarrier(ctx, G.carrier);
  for(const s of G.structures) if(s.x>x0-100 && s.x<x1+100) drawStruct(ctx, s);
  for(const sh of G.ships) if(sh.x+sh.w>x0 && sh.x-sh.w<x1) drawShip(ctx, sh);
  for(const so of G.soldiers) drawSoldier(ctx, so);
  // projectiles
  ctx.lineCap='round';
  for(const s of G.shots){ ctx.strokeStyle = s.team==='p'?'#ffe58a':'#ff8f6b'; ctx.lineWidth = s.small ? 1 : 2; ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x-s.vx*0.012, s.y-s.vy*0.012); ctx.stroke(); }
  for(const f of G.flak){ ctx.fillStyle='#2a2a2a'; ctx.fillRect(f.x-2,f.y-2,4,4); }
  for(const d of G.drops) drawDrop(ctx, d);
  // aircraft
  for(const w of G.wingmen) if(!w.dead) drawAI(ctx, w, w.kind, 1, w.flash, w.gear||0);
  for(const e of G.enemies){
    if(e.type==='zero') drawAI(ctx, e, 'zero', 1, e.flash);
    else if(e.type==='betty') drawAI(ctx, e, 'betty', 1, e.flash);
    else if(e.type==='emily') drawEmily(ctx, e);
  }
  const P = G.player;
  if(!P.dead){
    const a = heading(P);
    // lift the sprite so the wheels sit on the deck rather than sinking into it
    const C = G.carrier, overDeck = P.x > C.x-20 && P.x < C.x+C.len+20;
    const lift = overDeck ? 9*P.gear*clamp(1-(DECK_Y-9-P.y)/30, 0, 1) : 0;
    ctx.save(); ctx.translate(P.x, P.y-lift);
    if(P.inv>0 && Math.floor(G.time*12)%2) ctx.globalAlpha=0.5;
    if(P.loop){
      // turn-around: a 3D model yaws through nose-toward-the-viewer and banks into the turn
      const t = P.loop.t, ease = t*t*(3-2*t);
      const yaw = (P.f>0 ? 0 : Math.PI) + (P.f>0 ? -1 : 1)*Math.PI*ease;
      const roll = -Math.sin(Math.PI*t)*0.75;
      drawPlane3D(ctx, G.stats.type, null, 'us', yaw, roll, a, P.hitT>0, true);
    } else {
      ctx.scale(P.f,1); ctx.rotate(-a);
      drawPlane(ctx, G.stats.type, null, null, 1, P.hitT>0, P.throttle>0.05||P.speed>40, P.gear);
    }
    ctx.restore();
  }
  // effects
  for(const d of G.debris){
    ctx.fillStyle=d.c;
    if(d.spark){ ctx.globalAlpha=Math.min(1,d.life*3); ctx.fillRect(d.x-1.5,d.y-1.5,3,3); }
    else { ctx.save(); ctx.translate(d.x,d.y); ctx.rotate(d.r); ctx.fillRect(-4,-2,8,4); ctx.restore(); if(d.smoke && Math.random()<0.3) puff(d.x,d.y,'#444',6,0.8); }
    ctx.globalAlpha=1;
  }
  for(const f of G.fx) drawFx(ctx, f);
  ctx.restore();

  // night / dusk lighting
  if(sky.dark>0.3) drawDarkness(ctx, cw, ch, scale, camX, sky.dark, top);
  const vw0 = vw; { const vw = hvw; ctx.setTransform(hs,0,0,hs,0,0);
  if(sky.dark>0 && sky.dark<=0.3){ ctx.fillStyle=`rgba(40,20,60,${sky.dark})`; ctx.fillRect(0,0,vw,H); }
  if(stormy){ ctx.fillStyle='rgba(30,40,50,.18)'; ctx.fillRect(0,0,vw,H); }
  // rain
  if(W.rain>0){
    ctx.strokeStyle='rgba(190,210,230,.45)'; ctx.lineWidth=1; ctx.beginPath();
    const n = Math.floor(G.rain.length*W.rain), slant = W.wind*0.25 - 4;
    for(let i=0;i<n;i++){ const r=G.rain[i]; r.y=(r.y+0.018*r.v)%1; const rx=((r.x*vw + slant*r.y*10 - camX*0.3)%vw+vw)%vw, ry=r.y*H; ctx.moveTo(rx,ry); ctx.lineTo(rx+slant,ry+16); }
    ctx.stroke();
  }
  if(W.flash>0){ ctx.fillStyle=`rgba(230,235,255,${W.flash*0.6})`; ctx.fillRect(0,0,vw,H); }
  if(P.hitT>0){ ctx.fillStyle='rgba(200,40,30,.18)'; ctx.fillRect(0,0,vw,H); }
  drawHUD(ctx, vw, vw0);
  drawTutorial(ctx, vw);
  }
}

function drawCloud(ctx, x, y, s, W){
  ctx.fillStyle = W.time==='night' ? 'rgba(60,70,95,.35)' : W.rain>0.5 ? 'rgba(90,100,110,.7)' : W.time==='day' ? 'rgba(255,255,255,.75)' : 'rgba(255,190,160,.45)';
  ctx.beginPath();
  ctx.ellipse(x, y, 60*s, 16*s, 0, 0, 7); ctx.ellipse(x-30*s, y+4*s, 34*s, 12*s, 0, 0, 7); ctx.ellipse(x+28*s, y-6*s, 38*s, 15*s, 0, 0, 7);
  ctx.fill();
}

function drawSea(ctx, x0, x1, sky, W){
  const g = ctx.createLinearGradient(0,SEA,0,H); g.addColorStop(0,sky.sea1); g.addColorStop(1,sky.sea2);
  ctx.fillStyle=g; ctx.fillRect(x0,SEA,x1-x0,H-SEA);
  ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=1.5; ctx.beginPath();
  const amp = W.rain>0.5?3:1.5;
  for(let row=0;row<4;row++){
    const yy = SEA+6+row*18, off = G.time*(20+row*8)*(row%2?1:-1);
    for(let x=Math.floor(x0/60)*60; x<x1; x+=60){ const xx=x+((off+row*23)%60); ctx.moveTo(xx,yy+Math.sin(xx*0.05+G.time*2)*amp); ctx.lineTo(xx+18,yy+Math.sin(xx*0.05+G.time*2)*amp); }
  }
  ctx.stroke();
}

function drawIsland(ctx, is){
  ctx.beginPath(); ctx.moveTo(is.x0, SEA+2);
  for(let x=is.x0; x<=is.x1; x+=8) ctx.lineTo(x, groundY(x));
  ctx.lineTo(is.x1, SEA+2); ctx.closePath();
  ctx.fillStyle = G.weather.time==='night' ? '#3c3829' : '#c8b07a'; ctx.fill();
  ctx.beginPath();
  for(let x=is.x0+is.slope*0.6; x<=is.x1-is.slope*0.6; x+=8) ctx.lineTo(x, groundY(x)+1);
  for(let x=is.x1-is.slope*0.6; x>=is.x0+is.slope*0.6; x-=8) ctx.lineTo(x, groundY(x)+9);
  ctx.fillStyle = G.weather.time==='night' ? '#24331f' : '#5f8a3c'; ctx.fill();
  // airstrip: enemy fighters take off from it while the island still has a working building; cratered once it is dead
  if(is.strip){
    const idx = G.islands.indexOf(is), active = G.structures.some(s=>s.island===idx && !s.dead);
    const runway = ()=>{ ctx.beginPath(); for(let x=is.strip.x0; x<=is.strip.x1; x+=10) ctx.lineTo(x, groundY(x)-0.5); };
    ctx.strokeStyle = G.weather.time==='night' ? '#2b2b27' : '#64625a'; ctx.lineWidth=4; ctx.lineCap='butt'; runway(); ctx.stroke();
    ctx.strokeStyle='rgba(235,230,210,.55)'; ctx.lineWidth=0.8; ctx.setLineDash([8,8]); runway(); ctx.stroke(); ctx.setLineDash([]);
    if(!active){
      const len = is.strip.x1-is.strip.x0;
      ctx.fillStyle='#2e2a22';
      for(let k=0;k<6;k++){ const cx = is.strip.x0 + len*(k+0.5)/6 + Math.sin(k*7.3+is.seed)*20; ctx.beginPath(); ctx.ellipse(cx, groundY(cx)-1, 9, 2.6, 0, 0, 7); ctx.fill(); }
    }
  }
  for(const p of is.palms){
    const gy = groundY(p.x), s = p.s, sway = Math.sin(G.time*1.5+p.x)*2 + G.weather.wind*0.05;
    ctx.strokeStyle='#6b4f2c'; ctx.lineWidth=3*s; ctx.beginPath(); ctx.moveTo(p.x,gy); ctx.quadraticCurveTo(p.x+4*s,gy-18*s,p.x+2*s+sway,gy-34*s); ctx.stroke();
    ctx.strokeStyle='#2f6b2a'; ctx.lineWidth=2.5*s;
    for(let k=-2;k<=2;k++){ ctx.beginPath(); ctx.moveTo(p.x+2*s+sway,gy-34*s); ctx.quadraticCurveTo(p.x+k*8*s+sway,gy-42*s,p.x+k*13*s+sway,gy-30*s+Math.abs(k)*3); ctx.stroke(); }
  }
}

// infantryman in khaki with a helmet and rifle: runs while nothing is in reach, kneels and fires at low aircraft
function drawSoldier(ctx, so){
  const x=so.x, y=so.y, aiming = so.aim != null;
  ctx.lineCap='round';
  ctx.strokeStyle='#5a5330'; ctx.lineWidth=2;
  if(aiming){
    ctx.beginPath(); ctx.moveTo(x,y-6); ctx.lineTo(x+3,y-2); ctx.lineTo(x+3,y); ctx.moveTo(x,y-6); ctx.lineTo(x-4,y); ctx.stroke();        // kneeling
    ctx.lineWidth=2.4; ctx.beginPath(); ctx.moveTo(x,y-6); ctx.lineTo(x,y-11); ctx.stroke();
    const ca=Math.cos(so.aim), sa=Math.sin(so.aim);
    ctx.strokeStyle='#3b2a1a'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(x-ca*3, y-10-sa*3); ctx.lineTo(x+ca*8, y-10+sa*8); ctx.stroke();   // rifle
    ctx.strokeStyle='#5a5330'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(x,y-10); ctx.lineTo(x+ca*4, y-10+sa*4); ctx.stroke();               // arms
    if(so.fireT>0){ ctx.fillStyle='rgba(255,220,120,.95)'; ctx.beginPath(); ctx.arc(x+ca*9.5, y-10+sa*9.5, 1.8, 0, 7); ctx.fill(); }
    ctx.fillStyle='#d9b48a'; ctx.beginPath(); ctx.arc(x,y-13,2.1,0,7); ctx.fill();
    ctx.fillStyle='#4b4a2c'; ctx.beginPath(); ctx.arc(x,y-13.6,2.4,Math.PI,0); ctx.fill();
  } else {
    const leg=Math.sin(so.t*14)*3, arm=Math.sin(so.t*14)*2;
    ctx.beginPath(); ctx.moveTo(x,y-6); ctx.lineTo(x+leg,y); ctx.moveTo(x,y-6); ctx.lineTo(x-leg,y); ctx.stroke();
    ctx.lineWidth=2.4; ctx.beginPath(); ctx.moveTo(x,y-6); ctx.lineTo(x,y-12); ctx.stroke();
    ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(x,y-11); ctx.lineTo(x-arm,y-7.5); ctx.stroke();
    ctx.strokeStyle='#3b2a1a'; ctx.lineWidth=1.1; ctx.beginPath(); ctx.moveTo(x-3*so.dir,y-6); ctx.lineTo(x+4*so.dir,y-15); ctx.stroke();      // rifle at port arms
    ctx.fillStyle='#d9b48a'; ctx.beginPath(); ctx.arc(x,y-14,2.1,0,7); ctx.fill();
    ctx.fillStyle='#4b4a2c'; ctx.beginPath(); ctx.arc(x,y-14.6,2.4,Math.PI,0); ctx.fill();
  }
}

function drawDrop(ctx, d){
  ctx.save(); ctx.translate(d.x,d.y); ctx.rotate(Math.atan2(d.vy,d.vx));
  if(d.kind==='bomb'){ ctx.fillStyle=d.team==='p'?'#2f3a2a':'#3c2a2a'; ctx.beginPath(); ctx.ellipse(0,0,7,3,0,0,7); ctx.fill(); ctx.fillRect(-10,-3,4,6); }
  else if(d.kind==='rocket'){ ctx.fillStyle='#ddd'; ctx.fillRect(-7,-1.5,14,3); ctx.fillStyle='#ffb347'; ctx.fillRect(-12,-1.5,5,3); }
  else if(d.run){ ctx.fillStyle='rgba(18,28,38,.6)'; ctx.beginPath(); ctx.ellipse(0,0,11,2.2,0,0,7); ctx.fill(); ctx.fillStyle='rgba(200,225,240,.5)'; ctx.fillRect(-15,-0.6,4,1.2); }   // submerged: a dark shape under the surface
  else { ctx.fillStyle='#3a3f44'; ctx.fillRect(-10,-2,20,4); }
  ctx.restore();
}

function drawAI(ctx, e, type, s, flash, gear=0){
  ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(e.a);
  // keep the aircraft upright, but only roll it over once it is clearly heading the other way, so it does
  // not flip back and forth while climbing or diving near the vertical
  if(e.face == null) e.face = Math.cos(e.a) < 0 ? -1 : 1;
  if(Math.cos(e.a) > 0.3) e.face = 1; else if(Math.cos(e.a) < -0.3) e.face = -1;
  if(e.face < 0) ctx.scale(1,-1);
  drawPlane(ctx, type, null, null, s, flash>0, !(e.takeoff && e.takeoff.t<0) && !(e.state==='rearm'), gear);
  ctx.restore();
}

function drawFx(ctx, f){
  const k = f.t/f.max;
  switch(f.type){
    case 'boom':{
      const r = f.r*(0.4+k);
      const g = ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,r);
      g.addColorStop(0,`rgba(255,240,180,${1-k})`); g.addColorStop(0.5,`rgba(255,140,40,${0.85*(1-k)})`); g.addColorStop(1,'rgba(120,40,10,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(f.x,f.y,r,0,7); ctx.fill(); break; }
    case 'flak':
      ctx.fillStyle=`rgba(40,40,40,${0.8*(1-k)})`; ctx.beginPath(); ctx.arc(f.x,f.y,f.r*(0.5+k*0.6),0,7); ctx.fill();
      if(k<0.2){ ctx.fillStyle='rgba(255,200,90,.9)'; ctx.beginPath(); ctx.arc(f.x,f.y,f.r*0.4,0,7); ctx.fill(); } break;
    case 'smoke':
      ctx.fillStyle=f.c; ctx.globalAlpha=0.5*(1-k); ctx.beginPath(); ctx.arc(f.x,f.y,f.s*(0.6+k),0,7); ctx.fill(); ctx.globalAlpha=1; break;
    case 'splash':
      ctx.fillStyle=`rgba(225,240,250,${1-k})`;
      for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.ellipse(f.x+i*7, SEA-30*Math.sin(k*Math.PI)*(1-Math.abs(i)*0.25), 3, 10*(1-k)+2, 0, 0, 7); ctx.fill(); } break;
    case 'wake':
      ctx.fillStyle=`rgba(230,245,255,${0.5*(1-k)})`; ctx.fillRect(f.x-6-k*10, f.y, 12+k*20, 2); break;
    case 'column': drawColumn(ctx, f); break;
    case 'text':
      ctx.font='bold 14px Rubik, sans-serif'; ctx.textAlign='center'; ctx.fillStyle=`rgba(255,215,90,${1-k})`; ctx.fillText(f.text,f.x,f.y); break;
  }
}

// Night: a dark layer with holes cut out wherever there is light
function drawDarkness(ctx, cw, ch, scale, camX, alpha, top){
  if(!darkCv) darkCv = document.createElement('canvas');
  if(darkCv.width!==cw || darkCv.height!==ch){ darkCv.width=cw; darkCv.height=ch; }
  const d = darkCv.getContext('2d');
  d.setTransform(1,0,0,1,0,0); d.globalCompositeOperation='source-over'; d.clearRect(0,0,cw,ch);
  d.fillStyle=`rgba(4,8,22,${alpha})`; d.fillRect(0,0,cw,ch);
  d.setTransform(scale,0,0,scale,-camX*scale,-top*scale);
  d.globalCompositeOperation='destination-out';
  const hole=(x,y,r,a=1)=>{ const g=d.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,`rgba(0,0,0,${a})`); g.addColorStop(1,'rgba(0,0,0,0)'); d.fillStyle=g; d.beginPath(); d.arc(x,y,r,0,7); d.fill(); };
  const P=G.player;
  if(!P.dead) hole(P.x,P.y,150,0.85);
  hole(G.carrier.x+G.carrier.len*0.66+21, DECK_Y-90, 60, 0.7);
  for(let i=0;i<6;i++) hole(G.carrier.x+40+i*90, DECK_Y, 40, 0.5);
  for(const f of G.fx){
    if(f.type==='boom') hole(f.x,f.y,f.r*4*(1-f.t/f.max)+20,1);
    else if(f.type==='flak' && f.t<0.2) hole(f.x,f.y,60,0.8);
  }
  for(const s of G.shots) hole(s.x,s.y,12,0.6);
  for(const dr of G.drops) if(dr.kind==='rocket') hole(dr.x,dr.y,30,0.8);
  for(const w of G.wingmen) if(!w.dead && w.state==='fly') hole(w.x,w.y,45,0.5);
  for(const s of G.structures){
    if(s.type==='light' && !s.dead){
      const ox=s.x, oy=s.y-s.h, L=1900, sp=0.06;
      d.fillStyle='rgba(0,0,0,.85)'; d.beginPath(); d.moveTo(ox,oy);
      d.lineTo(ox+Math.cos(s.aim-sp)*L, oy+Math.sin(s.aim-sp)*L); d.lineTo(ox+Math.cos(s.aim+sp)*L, oy+Math.sin(s.aim+sp)*L); d.fill();
      hole(ox,oy,30,1);
    } else if(s.dead) hole(s.x,s.y-6,40+Math.sin(G.time*9+s.x)*6,0.6);
  }
  d.globalCompositeOperation='source-over';
  ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(darkCv,0,0);
  // beam glow on top
  ctx.setTransform(scale,0,0,scale,-camX*scale,-top*scale);
  ctx.globalCompositeOperation='lighter';
  for(const s of G.structures) if(s.type==='light' && !s.dead){
    const ox=s.x, oy=s.y-s.h, L=1900, sp=0.06;
    ctx.fillStyle = P.lit ? 'rgba(255,240,170,.16)' : 'rgba(220,230,255,.09)';
    ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(ox+Math.cos(s.aim-sp)*L, oy+Math.sin(s.aim-sp)*L); ctx.lineTo(ox+Math.cos(s.aim+sp)*L, oy+Math.sin(s.aim+sp)*L); ctx.fill();
  }
  ctx.globalCompositeOperation='source-over';
  ctx.setTransform(scale,0,0,scale,0,0);
}
