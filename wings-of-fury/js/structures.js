// ---- Island defences drawn in detail: pillboxes, AA pits, barracks, fuel dump, searchlight, coastal gun, HQ ----
// Each structure stands on (s.x, s.y) with width s.w and height s.h; s.aim is the gun/lamp angle in world space.

const CONCRETE = ['#8a8676','#77735f','#5e5a4a'];
function sandbags(ctx, x0, x1, y, rows, c='#a08e64'){
  for(let r=0;r<rows;r++){
    const yy = y - r*3.2, off = r%2 ? 3 : 0;
    for(let x=x0+off; x<x1-2; x+=6){ ctx.fillStyle=c; ctx.beginPath(); ctx.ellipse(x+3, yy-1.6, 3.2, 1.8, 0, 0, 7); ctx.fill();
      ctx.strokeStyle='rgba(60,45,25,.45)'; ctx.lineWidth=0.4; ctx.stroke(); }
  }
}
function jpFlag(ctx, x, y, s=1){
  ctx.strokeStyle='#3a3530'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y-18*s); ctx.stroke();
  const wv = Math.sin(G.time*4+x)*0.6;
  ctx.fillStyle='#f1ede2'; ctx.beginPath(); ctx.moveTo(x,y-18*s); ctx.lineTo(x+11*s,y-18*s+wv); ctx.lineTo(x+11*s,y-11*s+wv); ctx.lineTo(x,y-11*s); ctx.fill();
  ctx.fillStyle='#c4231c'; ctx.beginPath(); ctx.arc(x+5.5*s, y-14.5*s+wv*0.5, 2*s, 0, 7); ctx.fill();
}
function concreteFill(ctx, y0, y1){ const g=ctx.createLinearGradient(0,y0,0,y1); g.addColorStop(0,CONCRETE[0]); g.addColorStop(0.6,CONCRETE[1]); g.addColorStop(1,CONCRETE[2]); return g; }
function frond(ctx, x, y, len, ang){ ctx.strokeStyle='rgba(60,95,45,.85)'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(x,y); ctx.quadraticCurveTo(x+Math.cos(ang)*len*0.5, y+Math.sin(ang)*len*0.5-3, x+Math.cos(ang)*len, y+Math.sin(ang)*len); ctx.stroke(); }

// On a hillside the ground drops away under one side of the building: fill the gap with a stone-faced
// earth platform (sloping embankment at the ends) so nothing hangs in the air.
function drawFooting(ctx, s){
  const x0 = s.x - s.w/2 - 3, x1 = s.x + s.w/2 + 3, y = s.y;
  let drop = 0;
  for(let px=x0; px<=x1; px+=4) drop = Math.max(drop, groundY(px) - y);
  if(drop < 0.8) return;
  ctx.fillStyle='#6e5b3c'; ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  for(let px=x1+drop*0.8; px>=x0-drop*0.8; px-=3) ctx.lineTo(px, Math.max(y, groundY(px)) + 0.5);   // embankment down to the real ground
  ctx.closePath(); ctx.fill();
  // stone retaining wall right under the building
  ctx.fillStyle='#8a8070';
  for(let px=x0; px<x1; px+=3){ const g = groundY(px+1.5) - y; if(g>0.8) ctx.fillRect(px, y, 3, g+0.5); }
  ctx.strokeStyle='rgba(40,34,24,.45)'; ctx.lineWidth=0.6; ctx.beginPath();
  for(let ry=y+3; ry<y+drop; ry+=3.5) for(let px=x0+((ry|0)%2?0:4); px<x1; px+=8){ if(groundY(px+3) > ry+1){ ctx.moveTo(px,ry); ctx.lineTo(px+6,ry); } }
  ctx.stroke();
}

function drawStruct(ctx, s){
  const x=s.x, y=s.y, w=s.w, h=s.h, night = G.weather.time==='night';
  drawFooting(ctx, s);
  if(s.dead){ drawRubble(ctx, s); return; }
  ctx.save();
  if(s.flash>0) ctx.filter = 'brightness(1.8)';      // hit flash on the building only, not a box around it
  switch(s.type){
    case 'bunker': {                                   // reinforced-concrete pillbox under camouflage netting
      sandbags(ctx, x-w/2-6, x+w/2+6, y, 2);
      ctx.fillStyle=concreteFill(ctx, y-h, y);
      ctx.beginPath(); ctx.moveTo(x-w/2,y); ctx.lineTo(x-w/2+9,y-h+3); ctx.quadraticCurveTo(x,y-h-4,x+w/2-9,y-h+3); ctx.lineTo(x+w/2,y); ctx.fill();
      ctx.strokeStyle='rgba(40,38,30,.35)'; ctx.lineWidth=0.5;
      for(const k of [-0.25,0.05,0.3]){ ctx.beginPath(); ctx.moveTo(x+w*k, y-h+3); ctx.lineTo(x+w*k+3, y); ctx.stroke(); }   // pour joints
      ctx.fillStyle='#16150f'; ctx.beginPath(); ctx.moveTo(x-15,y-h+8); ctx.lineTo(x+15,y-h+8); ctx.lineTo(x+12,y-h+13); ctx.lineTo(x-12,y-h+13); ctx.fill();   // firing slit
      ctx.fillStyle='rgba(255,190,90,.25)'; ctx.fillRect(x-10,y-h+9.5,20,1.5);
      ctx.strokeStyle='#2a2925'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(x+4,y-h+10.5); ctx.lineTo(x+12,y-h+11.5); ctx.stroke();  // MG barrel
      ctx.fillStyle='rgba(70,90,50,.55)'; ctx.beginPath(); ctx.ellipse(x, y-h+1, w*0.42, 4, 0, Math.PI, 0); ctx.fill();          // netting
      for(let i=-2;i<=2;i++) frond(ctx, x+i*7, y-h, 9, -Math.PI/2 + i*0.5);
      ctx.fillStyle='#3d3226'; ctx.fillRect(x+w/2-12, y-9, 7, 9);                                                              // rear door
      break; }
    case 'aa': {                                       // twin 25 mm Type 96 in a sandbagged pit with a gun crew
      const ca=Math.cos(s.aim), sa=Math.sin(s.aim), px=x, py=y-h*0.55;
      ctx.fillStyle='#4a4033'; ctx.fillRect(x-w/2+3, y-4, w-6, 4);
      ctx.strokeStyle='#22231f'; ctx.lineWidth=1.8;
      for(const off of [-1.4,1.4]){ ctx.beginPath(); ctx.moveTo(px-sa*off, py+ca*off); ctx.lineTo(px-sa*off+ca*24, py+ca*off+sa*24); ctx.stroke(); }
      ctx.strokeStyle='#3b3b33'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(px+ca*3, py+sa*3); ctx.lineTo(px+ca*9, py+sa*9); ctx.stroke(); // magazine/flash guard
      if(s.muzzle>0){ ctx.fillStyle='rgba(255,215,110,.95)'; ctx.beginPath(); ctx.arc(px+ca*27, py+sa*27, 4, 0, 7); ctx.fill(); }
      ctx.fillStyle='#4f5047'; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 7); ctx.fill(); ctx.fillRect(px-2, py, 4, y-py);          // mount & pedestal
      ctx.fillStyle='#d9b48a'; ctx.beginPath(); ctx.arc(px-7, py-3, 1.8, 0, 7); ctx.fill();                                   // gunner
      ctx.fillStyle='#55502f'; ctx.fillRect(px-8.5, py-1.5, 3.4, 6); ctx.fillStyle='#4b4a2c'; ctx.beginPath(); ctx.arc(px-7, py-3.8, 2, Math.PI, 0); ctx.fill();
      ctx.fillStyle='#5a4a2c'; ctx.fillRect(x+w/2-2, y-5, 7, 5); ctx.fillRect(x+w/2+1, y-9, 5, 4);                               // ammo crates
      sandbags(ctx, x-w/2-4, x+w/2+2, y, 3);
      break; }
    case 'barracks': {                                 // raised timber barracks with a thatched roof
      ctx.fillStyle='#4e3a24'; for(const k of [-0.42,-0.1,0.2,0.42]) ctx.fillRect(x+w*k-1.5, y-7, 3, 7);                     // stilts
      const wy=y-7, top=y-h+11;
      ctx.fillStyle='#8a6a42'; ctx.fillRect(x-w/2, top, w, wy-top);
      ctx.strokeStyle='rgba(50,34,18,.4)'; ctx.lineWidth=0.5; for(let yy=top+3; yy<wy; yy+=3){ ctx.beginPath(); ctx.moveTo(x-w/2,yy); ctx.lineTo(x+w/2,yy); ctx.stroke(); }
      ctx.fillStyle = night ? 'rgba(255,200,110,.85)' : '#2a2016';
      for(const k of [-0.36,-0.16,0.18,0.36]) ctx.fillRect(x+w*k-3, top+4, 6, 5);
      ctx.fillStyle='#3a2a18'; ctx.fillRect(x-4, top+3, 8, wy-top-3);                                                          // door
      ctx.fillStyle='#5a4128'; ctx.fillRect(x-6, wy, 12, 2); ctx.fillRect(x-4, wy+2.5, 8, 2);                                 // steps
      ctx.fillStyle='#9b8450';                                                                                                  // thatch
      ctx.beginPath(); ctx.moveTo(x-w/2-7,top+1); ctx.lineTo(x-w*0.18,y-h-5); ctx.lineTo(x+w*0.18,y-h-5); ctx.lineTo(x+w/2+7,top+1); ctx.fill();
      ctx.strokeStyle='rgba(90,70,35,.6)'; ctx.lineWidth=0.5;
      for(let i=0;i<14;i++){ const fx = x-w/2-5 + i*(w+10)/13; ctx.beginPath(); ctx.moveTo(fx, top+1); ctx.lineTo(fx + (x-fx)*0.18, y-h-3); ctx.stroke(); }
      ctx.fillStyle='#6d5a33'; ctx.fillRect(x-w*0.18, y-h-6, w*0.36, 1.6);
      break; }
    case 'fuel': {                                     // fuel dump: a tank with ladder and stacked 200-litre drums
      const tx=x-4, tw=24, top=y-h;
      const g=ctx.createLinearGradient(tx-tw/2,0,tx+tw/2,0); g.addColorStop(0,'#5e6a4c'); g.addColorStop(0.45,'#8a9870'); g.addColorStop(1,'#4b5640');
      ctx.fillStyle=g; ctx.fillRect(tx-tw/2, top+3, tw, h-3); ctx.beginPath(); ctx.ellipse(tx, top+3, tw/2, 2.6, 0, 0, 7); ctx.fill();
      ctx.fillStyle='rgba(120,70,30,.35)'; ctx.fillRect(tx-4, top+10, 3, h-12); ctx.fillRect(tx+6, top+16, 2, h-18);              // rust streaks
      ctx.strokeStyle='#3a3f30'; ctx.lineWidth=0.6; ctx.beginPath(); ctx.moveTo(tx+tw/2-3, top+3); ctx.lineTo(tx+tw/2-3, y); ctx.moveTo(tx+tw/2-1, top+3); ctx.lineTo(tx+tw/2-1, y);
      for(let yy=top+6; yy<y; yy+=3){ ctx.moveTo(tx+tw/2-3, yy); ctx.lineTo(tx+tw/2-1, yy); } ctx.stroke();
      ctx.fillStyle='#e8b33a'; ctx.fillRect(tx-tw/2, y-h*0.45, tw, 2); ctx.fillStyle='#1d1d1d'; for(let k=0;k<5;k++) ctx.fillRect(tx-tw/2+k*5+1, y-h*0.45, 2.4, 2);
      const drum=(dx,dy,c)=>{ ctx.fillStyle=c; ctx.fillRect(dx-3,dy-7,6,7); ctx.fillStyle='rgba(0,0,0,.3)'; ctx.fillRect(dx-3,dy-5,6,0.7); ctx.fillRect(dx-3,dy-2.5,6,0.7); };
      drum(x+12,y,'#6b4e2c'); drum(x+18.5,y,'#5d6b3e'); drum(x+15,y-7,'#6b4e2c');
      break; }
    case 'light': {                                    // searchlight on a lattice tower, with its generator
      ctx.strokeStyle='#3f3e38'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x-7,y); ctx.lineTo(x-2,y-h+6); ctx.moveTo(x+7,y); ctx.lineTo(x+2,y-h+6);
      for(let i=0;i<3;i++){ const a=y-i*6, b=y-(i+1)*6; ctx.moveTo(x-7+i*1.6,a); ctx.lineTo(x+7-(i+1)*1.6,b); ctx.moveTo(x+7-i*1.6,a); ctx.lineTo(x-7+(i+1)*1.6,b); }
      ctx.stroke();
      ctx.fillStyle='#5b5a50'; ctx.fillRect(x+9, y-6, 9, 6); ctx.fillStyle='#2c2b26'; ctx.fillRect(x+11, y-8, 2, 2);        // generator
      ctx.save(); ctx.translate(x, y-h+3); ctx.rotate(s.aim);
      ctx.fillStyle='#55554c'; ctx.fillRect(-6,-6,12,12); ctx.fillStyle='#3d3d36'; ctx.fillRect(-8,-6,3,12);
      ctx.fillStyle = night ? '#fffbe0' : '#d9dccd'; ctx.beginPath(); ctx.ellipse(6.5,0,1.8,6,0,0,7); ctx.fill();
      ctx.restore();
      break; }
    case 'arty': {                                     // field gun behind a shield, barrel raised to lob shells
      const ca=Math.cos(s.aim), sa=Math.sin(s.aim), py=y-12;
      ctx.strokeStyle='#2f2e28'; ctx.lineWidth=4; ctx.lineCap='butt'; ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x+ca*30, py+sa*30); ctx.stroke();
      ctx.fillStyle='#5d5a44'; ctx.beginPath(); ctx.moveTo(x-6,py-8); ctx.lineTo(x+6,py-10); ctx.lineTo(x+7,py+6); ctx.lineTo(x-6,py+6); ctx.fill();   // gun shield
      ctx.fillStyle='#3a3628'; ctx.beginPath(); ctx.arc(x-4, y-4, 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x+5, y-4, 4, 0, 7); ctx.fill();   // wheels
      ctx.strokeStyle='#4a4535'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x, y-6); ctx.lineTo(x-20, y-1); ctx.stroke();                         // trail
      ctx.fillStyle='#5a4a2c'; ctx.fillRect(x+12, y-6, 6, 6); ctx.fillRect(x+13, y-10, 5, 4);                                                    // shell boxes
      sandbags(ctx, x-w/2, x+w/2, y, 2);
      break; }
    case 'biggun': {                                   // coastal-defence gun in a concrete casemate
      const ca=Math.cos(s.aim), sa=Math.sin(s.aim), py=y-h+15;
      ctx.strokeStyle='#2f2e29'; ctx.lineWidth=7; ctx.lineCap='butt'; ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x+ca*62, py+sa*62); ctx.stroke();
      ctx.lineWidth=9; ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x+ca*16, py+sa*16); ctx.stroke();
      ctx.fillStyle='#1f1e1a'; ctx.beginPath(); ctx.arc(x+ca*62, py+sa*62, 3, 0, 7); ctx.fill();
      ctx.fillStyle=concreteFill(ctx, y-h, y);
      ctx.beginPath(); ctx.moveTo(x-w/2,y); ctx.lineTo(x-w/2+6,y-h); ctx.lineTo(x+w/2-14,y-h); ctx.lineTo(x+w/2,y-h+18); ctx.lineTo(x+w/2,y); ctx.fill();
      ctx.fillStyle='#14130f'; ctx.beginPath(); ctx.arc(x, py, 9, 0, 7); ctx.fill();                                          // embrasure
      ctx.fillStyle='rgba(70,90,50,.6)'; ctx.fillRect(x-w/2+6, y-h-2, w-20, 3);
      for(let i=0;i<6;i++) frond(ctx, x-w/2+12+i*11, y-h-1, 10, -Math.PI/2 + (i%2?0.6:-0.6));
      sandbags(ctx, x-w/2-4, x+w/2+4, y, 2);
      break; }
    case 'core': {                                     // fortress headquarters: stepped concrete block, radio mast, flag
      ctx.fillStyle=concreteFill(ctx, y-h, y);
      ctx.fillRect(x-w/2, y-h*0.62, w, h*0.62); ctx.fillRect(x-w*0.32, y-h, w*0.64, h*0.4);
      ctx.fillStyle='#4e4b40'; for(let i=0;i<7;i++) ctx.fillRect(x-w/2+i*w/6.2, y-h*0.62-6, 9, 6);                          // crenellations
      ctx.fillStyle='#14130f'; for(let i=0;i<5;i++) ctx.fillRect(x-w/2+12+i*24, y-h*0.42, 13, 4);                             // gun slits
      for(let i=0;i<3;i++) ctx.fillRect(x-w*0.24+i*26, y-h+10, 12, 3);
      ctx.fillStyle='#2d2820'; ctx.beginPath(); ctx.moveTo(x-10,y); ctx.lineTo(x-10,y-14); ctx.quadraticCurveTo(x,y-20,x+10,y-14); ctx.lineTo(x+10,y); ctx.fill();   // armoured door
      ctx.strokeStyle='rgba(40,38,30,.3)'; ctx.lineWidth=0.6; for(let yy=y-h*0.55; yy<y; yy+=8){ ctx.beginPath(); ctx.moveTo(x-w/2,yy); ctx.lineTo(x+w/2,yy); ctx.stroke(); }
      ctx.strokeStyle='#33302a'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(x+w*0.22, y-h); ctx.lineTo(x+w*0.22, y-h-44);
      ctx.moveTo(x+w*0.22-10, y-h-34); ctx.lineTo(x+w*0.22+10, y-h-34); ctx.moveTo(x+w*0.22-7, y-h-26); ctx.lineTo(x+w*0.22+7, y-h-26); ctx.stroke();
      ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(x+w*0.22, y-h-44); ctx.lineTo(x+w*0.4, y-h); ctx.moveTo(x+w*0.22, y-h-44); ctx.lineTo(x+w*0.04, y-h); ctx.stroke();
      jpFlag(ctx, x-w*0.2, y-h, 1.3);
      sandbags(ctx, x-w/2-8, x-w/2+30, y, 2); sandbags(ctx, x+w/2-30, x+w/2+8, y, 2);
      break; }
  }
  ctx.restore();
  if(s.max>100 && s.hp<s.max){ ctx.fillStyle='#000a'; ctx.fillRect(x-w/2,y-h-12,w,3); ctx.fillStyle='#e8b33a'; ctx.fillRect(x-w/2,y-h-12,w*s.hp/s.max,3); }
}

// what is left of a structure: broken slabs or charred beams, scorch mark, smoke and smouldering embers
function drawRubble(ctx, s){
  const x=s.x, y=s.y, w=s.w, wood = s.type==='barracks';
  ctx.fillStyle='rgba(25,22,18,.55)'; ctx.beginPath(); ctx.ellipse(x, y, w*0.62, 3.5, 0, 0, 7); ctx.fill();
  const seed = (s.x*13.7)%7;
  if(wood){
    ctx.strokeStyle='#2a1f14'; ctx.lineWidth=2.2;
    for(let i=0;i<6;i++){ const bx = x-w/2+6+i*w/6, a = Math.sin(i*2.3+seed)*0.9; ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx+Math.cos(a-1.2)*12, y-Math.abs(Math.sin(a-1.2))*12); ctx.stroke(); }
  } else {
    for(let i=0;i<7;i++){
      const bx = x-w/2+4+i*(w-8)/6, bh = 3+((i*5.3+seed)%6);
      ctx.fillStyle = CONCRETE[i%3]; ctx.beginPath(); ctx.moveTo(bx-5,y); ctx.lineTo(bx-3,y-bh); ctx.lineTo(bx+4,y-bh+2); ctx.lineTo(bx+6,y); ctx.fill();
    }
    ctx.strokeStyle='#3b2f25'; ctx.lineWidth=0.7;                                                                             // twisted rebar
    for(let i=0;i<3;i++){ const bx=x-w/4+i*w/4; ctx.beginPath(); ctx.moveTo(bx,y-3); ctx.quadraticCurveTo(bx+4,y-12,bx+8,y-9); ctx.stroke(); }
  }
  if(Math.sin(G.time*7+seed)>0.2){ ctx.fillStyle='rgba(255,120,30,.75)'; ctx.beginPath(); ctx.arc(x+Math.sin(seed)*w*0.2, y-2, 1.6, 0, 7); ctx.fill(); }
  if(Math.random()<0.05) puff(x+rnd(-w/3,w/3), y-8, '#3a3a3a', 9, 1.8);
}
