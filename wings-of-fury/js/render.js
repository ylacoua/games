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
    const span = vw+700, sx = ((c.x - camX*c.par)%span+span)%span - 350;
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
  for(const s of G.shots){ ctx.strokeStyle = s.team==='p'?'#ffe58a':'#ff8f6b'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x-s.vx*0.012, s.y-s.vy*0.012); ctx.stroke(); }
  for(const f of G.flak){ ctx.fillStyle='#2a2a2a'; ctx.fillRect(f.x-2,f.y-2,4,4); }
  for(const d of G.drops) drawDrop(ctx, d);
  // aircraft
  for(const w of G.wingmen) if(!w.dead && w.state==='fly') drawAI(ctx, w, w.role==='fighter'?'fighter':'bomber', w.color, 'us', 1, w.flash);
  for(const e of G.enemies){
    if(e.type==='zero') drawAI(ctx, e, 'zero', '#cdc6a6', 'jp', 1, e.flash);
    else if(e.type==='betty') drawAI(ctx, e, 'heavy', '#5a6b4c', 'jp', 1.5, e.flash);
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
      drawPlane3D(ctx, G.stats.shape, G.stats.color, 'us', yaw, roll, a, P.hitT>0, true);
    } else {
      ctx.scale(P.f,1); ctx.rotate(-a);
      drawPlane(ctx, G.stats.shape, G.stats.color, 'us', 1, P.hitT>0, P.throttle>0.05||P.speed>40, P.gear);
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
  for(const p of is.palms){
    const gy = groundY(p.x), s = p.s, sway = Math.sin(G.time*1.5+p.x)*2 + G.weather.wind*0.05;
    ctx.strokeStyle='#6b4f2c'; ctx.lineWidth=3*s; ctx.beginPath(); ctx.moveTo(p.x,gy); ctx.quadraticCurveTo(p.x+4*s,gy-18*s,p.x+2*s+sway,gy-34*s); ctx.stroke();
    ctx.strokeStyle='#2f6b2a'; ctx.lineWidth=2.5*s;
    for(let k=-2;k<=2;k++){ ctx.beginPath(); ctx.moveTo(p.x+2*s+sway,gy-34*s); ctx.quadraticCurveTo(p.x+k*8*s+sway,gy-42*s,p.x+k*13*s+sway,gy-30*s+Math.abs(k)*3); ctx.stroke(); }
  }
}

function drawStruct(ctx, s){
  const x=s.x, y=s.y, w=s.w, h=s.h;
  if(s.dead){
    ctx.fillStyle='#3d3a33'; ctx.beginPath(); ctx.moveTo(x-w/2,y); ctx.lineTo(x-w/3,y-6); ctx.lineTo(x,y-10); ctx.lineTo(x+w/4,y-5); ctx.lineTo(x+w/2,y); ctx.fill();
    if(Math.random()<0.04) puff(x+rnd(-w/3,w/3), y-8, '#3a3a3a', 9, 1.6);
    return;
  }
  const flash = s.flash>0;
  switch(s.type){
    case 'bunker':
      ctx.fillStyle=flash?'#fff':'#77735f'; ctx.beginPath(); ctx.moveTo(x-w/2,y); ctx.lineTo(x-w/2+10,y-h); ctx.lineTo(x+w/2-10,y-h); ctx.lineTo(x+w/2,y); ctx.fill();
      ctx.fillStyle='#1c1b17'; ctx.fillRect(x-14,y-h+9,28,5); break;
    case 'aa':
      ctx.fillStyle='#8a7a55'; ctx.beginPath(); ctx.ellipse(x,y,w/2,h/2,0,Math.PI,0); ctx.fill();
      ctx.strokeStyle=flash?'#fff':'#2d2d2a'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(x,y-h/2); ctx.lineTo(x+Math.cos(s.aim)*26,y-h/2+Math.sin(s.aim)*26); ctx.stroke();
      ctx.fillStyle='#4a4a40'; ctx.beginPath(); ctx.arc(x,y-h/2,6,0,7); ctx.fill(); break;
    case 'barracks':
      ctx.fillStyle=flash?'#fff':'#8c6a43'; ctx.fillRect(x-w/2,y-h+10,w,h-10);
      ctx.fillStyle='#5a3f26'; ctx.beginPath(); ctx.moveTo(x-w/2-5,y-h+10); ctx.lineTo(x,y-h-4); ctx.lineTo(x+w/2+5,y-h+10); ctx.fill();
      ctx.fillStyle='#2b2116'; ctx.fillRect(x-6,y-14,12,14); break;
    case 'fuel':
      ctx.fillStyle=flash?'#fff':'#6f7b5a'; ctx.fillRect(x-w/2,y-h,w,h); ctx.fillStyle='#4e573f'; ctx.fillRect(x-w/2,y-h,w,5); ctx.fillRect(x-w/2,y-h/2,w,3); break;
    case 'light':
      ctx.fillStyle='#4b4b45'; ctx.fillRect(x-4,y-h+6,8,h-6);
      ctx.save(); ctx.translate(x,y-h); ctx.rotate(s.aim); ctx.fillStyle=flash?'#fff':'#666'; ctx.fillRect(-6,-7,14,14); ctx.fillStyle='#fffbe0'; ctx.fillRect(7,-6,3,12); ctx.restore(); break;
    case 'biggun':
      ctx.fillStyle=flash?'#fff':'#6c6a60'; ctx.fillRect(x-w/2,y-h,w,h);
      ctx.strokeStyle='#34332e'; ctx.lineWidth=7; ctx.beginPath(); ctx.moveTo(x,y-h+12); ctx.lineTo(x+Math.cos(s.aim)*58,y-h+12+Math.sin(s.aim)*58); ctx.stroke(); break;
    case 'core':
      ctx.fillStyle=flash?'#fff':'#5f5d55'; ctx.fillRect(x-w/2,y-h,w,h);
      ctx.fillStyle='#4b4a43'; for(let i=0;i<6;i++) ctx.fillRect(x-w/2+i*w/5-4,y-h-10,14,10);
      ctx.fillStyle='#1d1c18'; for(let i=0;i<4;i++) ctx.fillRect(x-w/2+14+i*28,y-h+20,14,6);
      ctx.strokeStyle='#333'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,y-h-10); ctx.lineTo(x,y-h-50); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.fillRect(x,y-h-50,26,17); ctx.fillStyle='#c22'; ctx.beginPath(); ctx.arc(x+13,y-h-41.5,5,0,7); ctx.fill(); break;
  }
  if(s.max>100 && s.hp<s.max){ ctx.fillStyle='#000a'; ctx.fillRect(x-w/2,y-h-8,w,3); ctx.fillStyle='#e8b33a'; ctx.fillRect(x-w/2,y-h-8,w*s.hp/s.max,3); }
}

function drawShip(ctx, sh){
  const x=sh.x, w=sh.w, h=sh.h, d=sh.dir;
  ctx.save();
  if(sh.dead){ ctx.translate(0, sh.sink*h*1.6); ctx.rotate(sh.sink*0.08*d); if(sh.sink>1.2) { ctx.restore(); return; } }
  ctx.beginPath(); ctx.rect(x-w, 0, w*2, SEA+3); ctx.clip();
  ctx.fillStyle = sh.flash>0?'#ddd':'#5d646b';
  ctx.beginPath(); ctx.moveTo(x-d*w/2,SEA-h*0.5); ctx.lineTo(x+d*(w/2+14), SEA-h*0.62); ctx.lineTo(x+d*w/2, SEA+8); ctx.lineTo(x-d*(w/2-8), SEA+8); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#4b5157';
  if(sh.type==='battleship'){
    ctx.fillRect(x-60,SEA-h,120,h*0.5); ctx.fillRect(x-20,SEA-h-45,40,45); ctx.fillRect(x-10,SEA-h-70,20,25);
    ctx.fillStyle='#3d4247'; ctx.fillRect(x+30*-d,SEA-h-30,16,30);
  } else {
    ctx.fillRect(x-30,SEA-h,60,h*0.5); ctx.fillRect(x-12*d,SEA-h-14,18,14);
    ctx.fillStyle='#3d4247'; ctx.fillRect(x-35*d,SEA-h-6,10,10);
  }
  for(const t of sh.turrets){
    if(t.dead) continue;
    const tx=x+t.dx, ty=SEA-sh.h*0.5-6;
    ctx.fillStyle='#3f454b'; ctx.beginPath(); ctx.arc(tx,ty,sh.type==='battleship'?10:6,Math.PI,0); ctx.fill();
    ctx.strokeStyle='#2c3035'; ctx.lineWidth=sh.type==='battleship'?4:3; ctx.beginPath(); ctx.moveTo(tx,ty-3);
    const a = t.aim ?? -Math.PI/2; ctx.lineTo(tx+Math.cos(a)*22, ty-3+Math.sin(a)*22); ctx.stroke();
  }
  ctx.restore();
  if(!sh.dead && sh.hp<sh.max){ ctx.fillStyle='#000a'; ctx.fillRect(x-w/2,SEA-h-(sh.type==='battleship'?80:24),w,4); ctx.fillStyle='#e8b33a'; ctx.fillRect(x-w/2,SEA-h-(sh.type==='battleship'?80:24),w*sh.hp/sh.max,4); }
}

function drawSoldier(ctx, so){
  const x=so.x, y=so.y, leg=Math.sin(so.t*14)*3;
  ctx.strokeStyle='#4e4a2c'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(x,y-6); ctx.lineTo(x+leg,y); ctx.moveTo(x,y-6); ctx.lineTo(x-leg,y); ctx.moveTo(x,y-6); ctx.lineTo(x,y-13); ctx.stroke();
  ctx.fillStyle='#d9b48a'; ctx.beginPath(); ctx.arc(x,y-15,2.4,0,7); ctx.fill();
}

function drawDrop(ctx, d){
  ctx.save(); ctx.translate(d.x,d.y); ctx.rotate(Math.atan2(d.vy,d.vx));
  if(d.kind==='bomb'){ ctx.fillStyle=d.team==='p'?'#2f3a2a':'#3c2a2a'; ctx.beginPath(); ctx.ellipse(0,0,7,3,0,0,7); ctx.fill(); ctx.fillRect(-10,-3,4,6); }
  else if(d.kind==='rocket'){ ctx.fillStyle='#ddd'; ctx.fillRect(-7,-1.5,14,3); ctx.fillStyle='#ffb347'; ctx.fillRect(-12,-1.5,5,3); }
  else { ctx.fillStyle='#3a3f44'; ctx.fillRect(-10,-2,20,4); }
  ctx.restore();
}

// Side-view aircraft, nose toward +x, centred on 0,0
function drawPlane(ctx, shape, color, nation, s, flash, prop, gear=0){
  ctx.save(); ctx.scale(s,s);
  const body = flash ? '#fff' : color;
  const dark = nation==='jp' ? '#8c8670' : '#1c2c40';
  const heavy = shape==='heavy', bomber = shape==='bomber' || heavy;
  const len = heavy?26:bomber?24:22, fat = heavy?7.5:6;
  if(gear>0.02){
    // main gear swings down and forward out of the belly; small tail wheel at the back
    const g = gear, sx = 6, sy = fat-1;
    const ex = sx + 3*g, ey = sy + 9*g;
    ctx.strokeStyle='#2a2f36'; ctx.lineWidth=1.8; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.moveTo(-len+5,1); ctx.lineTo(-len+4,1+4*g); ctx.stroke();
    ctx.fillStyle='#161a1f'; ctx.beginPath(); ctx.arc(ex,ey,3.4*g+0.4,0,7); ctx.fill();
    ctx.fillStyle='#8a929c'; ctx.beginPath(); ctx.arc(ex,ey,1.2*g,0,7); ctx.fill();
    ctx.fillStyle='#161a1f'; ctx.beginPath(); ctx.arc(-len+4,1+4*g,1.7*g,0,7); ctx.fill();
  }
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(len,0); ctx.quadraticCurveTo(len-2,-fat,8,-fat); ctx.lineTo(-len+4,-2.5); ctx.lineTo(-len,-1); ctx.lineTo(-len+2,2); ctx.quadraticCurveTo(4,fat+1,len-3,fat*0.6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-len+8,-2); ctx.lineTo(-len-1,-13); ctx.lineTo(-len-3,-2); ctx.fill();
  ctx.fillStyle=dark; ctx.fillRect(-len-4,-1,11,2.6);
  ctx.fillStyle = flash?'#fff':(nation==='jp'?'#b3ad91':dark);
  if(shape==='corsair'){ ctx.beginPath(); ctx.moveTo(-8,3); ctx.lineTo(2,7); ctx.lineTo(14,2); ctx.lineTo(13,4.5); ctx.lineTo(2,9); ctx.lineTo(-8,5); ctx.fill(); }
  else { ctx.beginPath(); ctx.ellipse(1,3.5,heavy?15:13,2.6,0,0,7); ctx.fill(); }
  ctx.fillStyle='rgba(170,215,240,.9)';
  ctx.beginPath(); ctx.ellipse(bomber?0:3,-fat+0.5,bomber?10:5.5,3,0,Math.PI,0); ctx.fill();
  if(bomber){ ctx.fillStyle='#222'; ctx.fillRect(-9,-fat-1,1.5,2); }
  if(nation==='us'){ ctx.fillStyle='#f4f4f0'; ctx.beginPath(); ctx.arc(-9,0,3.4,0,7); ctx.fill(); ctx.fillStyle='#1d3a6e'; ctx.beginPath(); ctx.arc(-9,0,1.6,0,7); ctx.fill(); }
  else { ctx.fillStyle='#c4231c'; ctx.beginPath(); ctx.arc(-8,0,3.5,0,7); ctx.fill(); }
  if(prop){ ctx.fillStyle='rgba(30,30,30,.35)'; ctx.fillRect(len,-10,2.2,20); }
  else { ctx.fillStyle='#222'; ctx.fillRect(len,-8,2,16); }
  ctx.restore();
}

function drawAI(ctx, e, shape, color, nation, s, flash){
  ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(e.a);
  if(Math.cos(e.a)<0) ctx.scale(1,-1);
  drawPlane(ctx, shape==='zero'?'fighter':shape, color, nation, s, flash>0, true);
  ctx.restore();
}

function drawEmily(ctx, e){
  const right = Math.cos(e.a)>=0;
  ctx.save(); ctx.translate(e.x,e.y); ctx.scale(right?1:-1,1); ctx.rotate(right?e.a:Math.PI-e.a);
  ctx.fillStyle = e.flash>0?'#fff':'#59684f';
  ctx.beginPath(); ctx.moveTo(62,2); ctx.quadraticCurveTo(58,-14,30,-15); ctx.lineTo(-50,-8); ctx.lineTo(-64,-6); ctx.lineTo(-62,2); ctx.quadraticCurveTo(-10,14,40,20); ctx.quadraticCurveTo(58,16,62,2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-50,-7); ctx.lineTo(-66,-34); ctx.lineTo(-70,-6); ctx.fill();
  ctx.fillStyle='#46523d'; ctx.fillRect(-40,-22,90,6);
  for(const ex of [-14,22]){ ctx.fillStyle='#3e4836'; ctx.beginPath(); ctx.ellipse(ex,-17,10,4,0,0,7); ctx.fill(); ctx.fillStyle='rgba(30,30,30,.35)'; ctx.fillRect(ex+10,-27,2,20); }
  ctx.fillStyle='#c4231c'; ctx.beginPath(); ctx.arc(-24,-1,6,0,7); ctx.fill();
  ctx.fillStyle='rgba(170,215,240,.9)'; ctx.fillRect(36,-14,14,5);
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
