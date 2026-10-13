// ---- Drawing for the Ground Support mission: landing ship, US troops and Pattons, Chi-Ha tanks, shells, flags ----

function drawGround(ctx){
  const S = G.ground; if(!S) return;
  for(const is of G.islands) if(is.flag) drawFlagpole(ctx, is);
  drawLST(ctx, S.lst, S);
  for(const t of G.jtanks) if(!t.dead) drawChiHa(ctx, t);
  for(const u of S.units) if(!u.dead) (u.type==='tank' ? drawPatton : drawGI)(ctx, u);
  ctx.fillStyle='#222'; for(const sh of S.shells){ ctx.beginPath(); ctx.arc(sh.x, sh.y, 2.2, 0, 7); ctx.fill(); }
}

// LST: long low hull, bow doors and ramp at the front (right), bridge and stern superstructure aft,
// tanks and troops visible in the well deck while loaded
function drawLST(ctx, L, S){
  const x = L.x, y = SEA;
  ctx.save();
  if(L.flash>0) ctx.filter = 'brightness(1.7)';
  ctx.fillStyle = '#5f6c78';
  ctx.beginPath(); ctx.moveTo(x-80, y-16); ctx.lineTo(x+62, y-16); ctx.quadraticCurveTo(x+80, y-14, x+78, y+4); ctx.lineTo(x-74, y+6); ctx.quadraticCurveTo(x-84, y-2, x-80, y-16); ctx.fill();
  ctx.fillStyle = '#3c454e'; ctx.fillRect(x-78, y-3, 154, 4);                                                  // boot topping
  ctx.fillStyle = '#4a5560'; ctx.fillRect(x-80, y-18, 142, 3);                                                 // deck edge
  // cargo in the well deck
  if(S.phase==='sail'){
    for(let i=0;i<Math.min(5,S.tanks);i++){ ctx.fillStyle='#55613a'; ctx.fillRect(x-40+i*16, y-23, 13, 5); ctx.fillRect(x-36+i*16, y-26, 6, 3); }
    ctx.fillStyle='#4f5a32'; for(let i=0;i<Math.min(16, Math.ceil(S.inf/3)); i++) ctx.fillRect(x-60+i*7.5, y-22, 2, 4);
  }
  // stern superstructure, mast and ensign
  ctx.fillStyle='#56616c'; ctx.fillRect(x-76, y-34, 26, 16); ctx.fillRect(x-70, y-42, 14, 8);
  ctx.fillStyle='#9fc4db'; ctx.fillRect(x-68, y-40, 10, 2);
  ctx.strokeStyle='#333'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x-63, y-42); ctx.lineTo(x-63, y-62); ctx.stroke();
  drawUSFlag(ctx, x-63, y-62, 0.7);
  ctx.fillStyle='#e8e2c8'; ctx.font='bold 7px Rubik, sans-serif'; ctx.textAlign='center'; ctx.fillText('325', x+40, y-6);
  // bow ramp: raised at sea, lowered onto the beach when unloading
  ctx.save(); ctx.translate(x+70, y-14); ctx.rotate(L.ramp*1.1);
  ctx.fillStyle='#4f5a64'; ctx.fillRect(0, -2, 22, 4); ctx.restore();
  ctx.restore();
  // hull strength
  if(L.hp < L.max){ const k = clamp(L.hp/L.max,0,1); ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(x-50, y-74, 100, 5);
    ctx.fillStyle = k<0.3?'#c8402f':k<0.6?'#e8b33a':'#5fae6b'; ctx.fillRect(x-50, y-74, 100*k, 5); }
}

function drawUSFlag(ctx, x, y, s){
  const wv = Math.sin(G.time*4 + x)*0.6*s;
  ctx.fillStyle='#f2f0e8'; ctx.fillRect(x, y+wv, 18*s, 11*s);
  ctx.fillStyle='#b22234'; for(let k=0;k<4;k++) ctx.fillRect(x, y+wv+k*2.75*s, 18*s, 1.4*s);
  ctx.fillStyle='#3c3b6e'; ctx.fillRect(x, y+wv, 8*s, 6*s);
}

// flagpole raised on a captured island (rises over a few seconds, then the flag flies)
function drawFlagpole(ctx, is){
  const x = is.x0 + (is.x1-is.x0)*0.5, gy = groundY(x), h = 70*is.flag.t;
  ctx.strokeStyle='#d8d4c4'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy-h); ctx.stroke();
  if(is.flag.t > 0.15) drawUSFlag(ctx, x+1, gy-h, 1.2);
}

// US Marine/GI: dark green fatigues, round M1 helmet with netting, backpack, M1 rifle; faces the enemy (right)
function drawGI(ctx, u){
  const x=u.x, y=u.y, body = u.flash>0 ? '#fff' : '#3c5226';
  ctx.lineCap='round'; ctx.strokeStyle = body; ctx.lineWidth=2;
  const leg = Math.sin(u.t*12)*3;
  ctx.beginPath(); ctx.moveTo(x,y-6); ctx.lineTo(x+leg,y); ctx.moveTo(x,y-6); ctx.lineTo(x-leg,y); ctx.stroke();
  ctx.strokeStyle='#2a2418'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(x+leg*0.7,y-1); ctx.lineTo(x+leg,y); ctx.moveTo(x-leg*0.7,y-1); ctx.lineTo(x-leg,y); ctx.stroke();  // boots
  ctx.strokeStyle = body; ctx.lineWidth=2.6; ctx.beginPath(); ctx.moveTo(x,y-6); ctx.lineTo(x,y-12); ctx.stroke();
  ctx.fillStyle='#4a5a30'; ctx.fillRect(x-3.2, y-11.5, 2, 4.5);                                                   // backpack
  const a = u.aim || 0;
  ctx.strokeStyle='#3a2a1a'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(x-Math.cos(a)*2, y-10-Math.sin(a)*2); ctx.lineTo(x+Math.cos(a)*8, y-10+Math.sin(a)*8); ctx.stroke();
  if(u.fireT>0){ ctx.fillStyle='rgba(255,230,140,.95)'; ctx.beginPath(); ctx.arc(x+Math.cos(a)*9.5, y-10+Math.sin(a)*9.5, 1.6, 0, 7); ctx.fill(); }
  ctx.fillStyle='#e0bb92'; ctx.beginPath(); ctx.arc(x,y-14,2,0,7); ctx.fill();
  ctx.fillStyle='#2e4220'; ctx.beginPath(); ctx.ellipse(x,y-15.2,3.4,2.4,0,Math.PI,0); ctx.fill();                 // round M1 helmet
  ctx.strokeStyle='rgba(20,30,10,.6)'; ctx.lineWidth=0.4; ctx.beginPath(); ctx.moveTo(x-3,y-15.5); ctx.lineTo(x+3,y-15.5); ctx.stroke();   // helmet netting
}

// tracked hull with road wheels
function tankHull(ctx, x, y, w, h, body, dark){
  ctx.fillStyle=dark; ctx.beginPath(); ctx.moveTo(x-w/2, y-2); ctx.lineTo(x+w/2, y-2); ctx.quadraticCurveTo(x+w/2+3, y-4, x+w/2, y-h*0.6); ctx.lineTo(x-w/2, y-h*0.6); ctx.quadraticCurveTo(x-w/2-3, y-4, x-w/2, y-2); ctx.fill();
  ctx.fillStyle='#2a2a26'; for(let i=0;i<5;i++){ ctx.beginPath(); ctx.arc(x-w/2+3+i*(w-6)/4, y-3, 2, 0, 7); ctx.fill(); }
  ctx.fillStyle=body; ctx.fillRect(x-w/2+1, y-h, w-2, h*0.45);
}
// M46/M47 Patton: big olive hull, wide turret, long gun, white star
function drawPatton(ctx, u){
  const x=u.x, y=u.y, body = u.flash>0 ? '#ddd' : '#55613a';
  tankHull(ctx, x, y, 30, 12, body, '#3d4529');
  ctx.fillStyle=body; ctx.beginPath(); ctx.ellipse(x-1, y-12.5, 8, 4, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(x-9, y-13, 17, 2.5);
  const a = clamp(u.aim||0, -0.5, 0.3);
  ctx.strokeStyle='#3d4529'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(x+5, y-13); ctx.lineTo(x+5+Math.cos(a)*18, y-13+Math.sin(a)*18); ctx.stroke();
  if(u.fireT>0){ ctx.fillStyle='rgba(255,220,120,.95)'; ctx.beginPath(); ctx.arc(x+5+Math.cos(a)*20, y-13+Math.sin(a)*20, 3.5, 0, 7); ctx.fill(); }
  ctx.fillStyle='#f2f2ea'; ctx.beginPath();                                                                         // white star
  for(let i=0;i<10;i++){ const aa=-Math.PI/2+i*Math.PI/5, rr=i%2?1.1:2.6; ctx.lineTo(x-6+Math.cos(aa)*rr, y-7.5+Math.sin(aa)*rr); } ctx.fill();
}
// Type 97 Chi-Ha: smaller, khaki-and-brown camouflage, small offset turret with a short 57 mm gun, faces left
function drawChiHa(ctx, t){
  const x=t.x, y=t.y, body = t.flash>0 ? '#eee' : '#8a7d50';
  ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0);
  tankHull(ctx, x, y, 24, 10, body, '#5d5434');
  ctx.fillStyle='rgba(90,70,40,.6)'; ctx.fillRect(x-8, y-9.5, 6, 3); ctx.fillRect(x+3, y-9, 5, 2.5);             // camouflage
  ctx.fillStyle=body; ctx.beginPath(); ctx.ellipse(x+2, y-11, 5, 3.4, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle='#e8c34a'; ctx.fillRect(x-10, y-6, 20, 0.8);                                                       // yellow recognition band
  ctx.strokeStyle='#4a432b'; ctx.lineWidth=1.8; ctx.beginPath(); ctx.moveTo(x+6, y-11); ctx.lineTo(x+14, y-11.5); ctx.stroke();
  if(t.fireT>0){ t.fireT -= 1/60; ctx.fillStyle='rgba(255,210,110,.95)'; ctx.beginPath(); ctx.arc(x+15, y-11.5, 3, 0, 7); ctx.fill(); }
  ctx.restore();
  if(t.hp < t.max){ ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(x-11, y-20, 22, 2.5); ctx.fillStyle='#e8b33a'; ctx.fillRect(x-11, y-20, 22*t.hp/t.max, 2.5); }
}

// mission banner under the radar: which island, and how the two ground forces stand
function drawGroundHUD(ctx, vw){
  const S = G.ground; if(!S) return;
  const us = usUnits(), inf = S.inf + us.filter(u=>u.type==='inf').length, tanks = S.tanks + us.filter(u=>u.type==='tank').length;
  const i = Math.min(S.island, G.islands.length-1), f = jpForces(i);
  const phase = {sail:'הנחתת בדרך', unload:'נחיתה בחוף', assault:'קרב על האי', flag:'האי נכבש!', load:'עולים לנחתת', won:'ניצחון!'}[S.phase];
  // two short lines, so the banner stays clear of the side panels on narrow screens
  const line1 = `אי ${i+1} מתוך 3 · ${phase}`;
  const line2 = `ארה"ב: ${inf} חיילים, ${tanks} טנקים  |  יפן: ${f.inf} חיילים, ${f.tanks} טנקים, ${f.posts} עמדות`;
  ctx.save(); ctx.direction='rtl'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='13px Rubik, sans-serif';
  const w = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 24, y = 64;
  ctx.fillStyle='rgba(20,34,52,.18)'; ctx.fillRect(vw/2-w/2, y-11, w, 40);
  ctx.shadowColor='rgba(0,0,0,.7)'; ctx.shadowBlur=3; ctx.fillStyle='#f2d58a';
  ctx.fillText(line1, vw/2, y); ctx.fillText(line2, vw/2, y+18);
  ctx.restore();
}
