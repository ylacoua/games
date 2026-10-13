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
  withFlash(ctx, L.flash>0, ()=>{
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
  });
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

// ---- articulated figures: hips, knees and feet from a walk/run cycle, body bob and swinging arms ----
// ph: cycle phase, amp: stride (0 = standing), dir: facing (+1 right / -1 left). Returns the body bob.
function legs(ctx, x, y, ph, amp, dir, cloth, boot){
  const bob = -Math.abs(Math.sin(ph))*0.8*amp;
  ctx.lineCap='round';
  for(let i=0;i<2;i++){
    const p = ph + i*Math.PI;
    const thigh = Math.sin(p)*0.6*amp, bend = Math.max(0, Math.cos(p))*1.0*amp;   // the knee folds on the forward swing
    const hx = x, hy = y - 7 + bob;
    const kx = hx + dir*Math.sin(thigh)*3.8, ky = hy + Math.cos(thigh)*3.8;
    const sa = thigh - bend;
    const fx = kx + dir*Math.sin(sa)*3.6, fy = Math.min(y, ky + Math.cos(sa)*3.6);
    ctx.strokeStyle = i ? shade(cloth) : cloth; ctx.lineWidth = 1.9;
    ctx.beginPath(); ctx.moveTo(hx,hy); ctx.lineTo(kx,ky); ctx.lineTo(fx,fy); ctx.stroke();
    ctx.strokeStyle = boot; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(fx+dir*1.6,fy); ctx.stroke();
  }
  return bob;
}
function shade(hex){ const n=parseInt(hex.slice(1),16); return `rgb(${((n>>16)&255)*0.78|0},${((n>>8)&255)*0.78|0},${(n&255)*0.78|0})`; }

// US Marine/GI: dark green fatigues, round M1 helmet with netting, backpack, M1 rifle.
// Walks with a proper stride while advancing (backwards to the boat when re-embarking), stands and fires.
function drawGI(ctx, u){
  const x=u.x, y=u.y, cloth = u.flash>0 ? '#ffffff' : '#3c5226', dir = u.back ? -1 : 1;
  const walking = u.moving, ph = (u.dist||0)*0.32;
  const bob = legs(ctx, x, y, walking ? ph : 0, walking ? 1 : 0, dir, cloth, '#2a2418');
  ctx.strokeStyle = cloth; ctx.lineWidth=2.8; ctx.beginPath(); ctx.moveTo(x, y-7+bob); ctx.lineTo(x+dir*0.6, y-12.5+bob); ctx.stroke();   // torso
  ctx.fillStyle='#4a5a30'; ctx.fillRect(x-dir*3.4-1, y-12+bob, 2.2, 4.6);                                             // backpack
  if(walking && !(u.fireT>0)){
    // rifle at port arms, arm swinging with the stride
    const sw = Math.sin(ph)*2;
    ctx.strokeStyle=cloth; ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(x, y-11.5+bob); ctx.lineTo(x+dir*(2+sw*0.4), y-8.5+bob); ctx.stroke();
    ctx.strokeStyle='#3a2a1a'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(x-dir*3, y-7.5+bob); ctx.lineTo(x+dir*5, y-15+bob); ctx.stroke();
  } else {
    const a = u.aim || 0, ca=Math.cos(a), sa=Math.sin(a), sy = y-11+bob - (u.fireT>0 ? 0.5 : 0);
    const kick = u.fireT>0 ? 1.2 : 0;                                                                                      // recoil
    ctx.strokeStyle='#3a2a1a'; ctx.lineWidth=1.25; ctx.beginPath(); ctx.moveTo(x-ca*(3+kick), sy-sa*(3+kick)); ctx.lineTo(x+ca*(8-kick), sy+sa*(8-kick)); ctx.stroke();
    ctx.strokeStyle=cloth; ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(x, sy-0.5); ctx.lineTo(x+ca*4, sy+sa*4); ctx.stroke();
    if(u.fireT>0){ ctx.fillStyle='rgba(255,230,140,.95)'; ctx.beginPath(); ctx.arc(x+ca*9.5, sy+sa*9.5, 1.7, 0, 7); ctx.fill(); }
  }
  ctx.fillStyle='#e0bb92'; ctx.beginPath(); ctx.arc(x+dir*0.6, y-14.2+bob, 2, 0, 7); ctx.fill();
  ctx.fillStyle='#2e4220'; ctx.beginPath(); ctx.ellipse(x+dir*0.6, y-15.4+bob, 3.4, 2.4, 0, Math.PI, 0); ctx.fill();     // round M1 helmet
  ctx.strokeStyle='rgba(20,30,10,.6)'; ctx.lineWidth=0.4; ctx.beginPath(); ctx.moveTo(x-2.4, y-15.7+bob); ctx.lineTo(x+3.6, y-15.7+bob); ctx.stroke();
}

// ---- the fallen: bodies and burnt-out tanks stay on the ground for a while ----
function addBody(x, side, dir){
  (G.bodies ||= []).push({x, side, dir: dir || 1, t:0});
  if(G.bodies.length > 90) G.bodies.shift();
}
function addWreck(x, kind, dir){
  (G.wrecks ||= []).push({x, kind, dir, t:0});
  if(G.wrecks.length > 30) G.wrecks.shift();
}
function drawRemains(ctx){
  for(const b of (G.bodies||[])){
    b.t += 1/60; const k = clamp(1 - (b.t-10)/3, 0, 1); if(k<=0) continue;                 // lie for 10 s, then fade
    const y = groundY(b.x), d = b.dir, fall = Math.min(1, b.t*3);                            // topples over in ~1/3 s
    ctx.save(); ctx.globalAlpha = k; ctx.translate(b.x, y); ctx.rotate(-d*fall*Math.PI/2*0.95);
    ctx.strokeStyle = b.side==='us' ? '#3c5226' : '#a8925a'; ctx.lineWidth=2.4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,-1); ctx.lineTo(0,-12); ctx.stroke();
    ctx.fillStyle='#d9b48a'; ctx.beginPath(); ctx.arc(0,-14,2,0,7); ctx.fill();
    ctx.fillStyle = b.side==='us' ? '#2e4220' : '#8f7c45'; ctx.beginPath(); ctx.arc(0,-15,2.4,Math.PI,0); ctx.fill();
    ctx.restore();
  }
  for(const w of (G.wrecks||[])){
    w.t += 1/60; const k = clamp(1 - (w.t-25)/4, 0, 1); if(k<=0) continue;
    const y = groundY(w.x);
    ctx.save(); ctx.globalAlpha = k; ctx.translate(w.x, y); ctx.rotate(slopeAt(w.x)); ctx.scale(w.dir, 1);
    ctx.fillStyle='#2b2620'; ctx.beginPath(); ctx.moveTo(-13,-1); ctx.lineTo(13,-1); ctx.lineTo(12,-7); ctx.lineTo(-12,-7); ctx.fill();
    ctx.fillStyle='#1d1a16'; ctx.beginPath(); ctx.ellipse(1,-8,6,3,0.25,Math.PI,0); ctx.fill();                          // turret knocked askew
    ctx.strokeStyle='#1d1a16'; ctx.lineWidth=1.8; ctx.beginPath(); ctx.moveTo(4,-9); ctx.lineTo(13,-4); ctx.stroke();      // drooping gun
    ctx.restore();
    if(w.t < 20 && Math.random() < 0.08) puff(w.x + rnd(-6,6), y - 10, '#2a2a2a', 6, 2);                                  // still smouldering
  }
}

// slope of the ground at x (radians), so vehicles sit on hills instead of floating
function slopeAt(x){ return Math.atan2(groundY(x+9) - groundY(x-9), 18); }

// Tracked hull drawn at the origin (the caller translates and tilts it to the slope): running gear with
// road wheels whose spokes turn with distance travelled, track links that move, and the upper hull.
function tankHull(ctx, w, h, body, dark, dist){
  ctx.fillStyle=dark; ctx.beginPath(); ctx.moveTo(-w/2, -2); ctx.lineTo(w/2, -2); ctx.quadraticCurveTo(w/2+3, -4, w/2, -h*0.6); ctx.lineTo(-w/2, -h*0.6); ctx.quadraticCurveTo(-w/2-3, -4, -w/2, -2); ctx.fill();
  // track links sliding along the top and bottom runs
  const off = ((dist||0)*0.9) % 3;
  ctx.fillStyle='rgba(0,0,0,.35)';
  for(let lx=-w/2+off; lx<w/2; lx+=3){ ctx.fillRect(lx, -h*0.6, 1.2, 1); ctx.fillRect(w/2 - (lx + w/2), -2.2, 1.2, 1); }
  // road wheels with turning spokes
  const rot = (dist||0)/2;
  for(let i=0;i<5;i++){
    const cx = -w/2+3+i*(w-6)/4, cy = -3.2;
    ctx.fillStyle='#2a2a26'; ctx.beginPath(); ctx.arc(cx, cy, 2.1, 0, 7); ctx.fill();
    ctx.strokeStyle='#5a5a52'; ctx.lineWidth=0.5; ctx.beginPath();
    for(let k=0;k<3;k++){ const a = rot + k*Math.PI/3; ctx.moveTo(cx-Math.cos(a)*1.7, cy-Math.sin(a)*1.7); ctx.lineTo(cx+Math.cos(a)*1.7, cy+Math.sin(a)*1.7); }
    ctx.stroke();
  }
  ctx.fillStyle=body; ctx.fillRect(-w/2+1, -h, w-2, h*0.45);
}
// M46/M47 Patton: big olive hull, wide turret, long gun, white star; sits on the slope, rocks back when it fires
function drawPatton(ctx, u){
  const body = u.flash>0 ? '#dddddd' : '#55613a', dir = u.back ? -1 : 1, recoil = u.fireT>0 ? 1 : 0;
  ctx.save(); ctx.translate(u.x, u.y); ctx.rotate(slopeAt(u.x) - dir*recoil*0.04); ctx.scale(dir, 1);
  tankHull(ctx, 30, 12, body, '#3d4529', u.dist);
  ctx.fillStyle=body; ctx.beginPath(); ctx.ellipse(-1, -12.5, 8, 4, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-9, -13, 17, 2.5);
  const a = clamp((u.aim||0) - slopeAt(u.x), -0.5, 0.3), gl = 18 - recoil*3;
  ctx.strokeStyle='#3d4529'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(5, -13); ctx.lineTo(5+Math.cos(a)*gl, -13+Math.sin(a)*gl); ctx.stroke();
  ctx.fillStyle='#2f3622'; ctx.beginPath(); ctx.arc(5+Math.cos(a)*gl, -13+Math.sin(a)*gl, 1.4, 0, 7); ctx.fill();      // muzzle brake
  if(u.fireT>0){ ctx.fillStyle='rgba(255,220,120,.95)'; ctx.beginPath(); ctx.arc(5+Math.cos(a)*(gl+3), -13+Math.sin(a)*(gl+3), 4, 0, 7); ctx.fill(); }
  ctx.fillStyle='#f2f2ea'; ctx.beginPath();                                                                         // white star
  for(let i=0;i<10;i++){ const aa=-Math.PI/2+i*Math.PI/5, rr=i%2?1.1:2.6; ctx.lineTo(-6+Math.cos(aa)*rr, -7.5+Math.sin(aa)*rr); } ctx.fill();
  ctx.restore();
  if(u.moving && Math.random() < 0.15) puff(u.x - dir*16, u.y - 3, 'rgba(180,160,120,.5)', 4, 0.7);                    // dust
  if(u.moving && Math.random() < 0.05) puff(u.x - dir*14, u.y - 10, 'rgba(60,60,60,.5)', 4, 1);                        // exhaust
}
// Type 97 Chi-Ha: smaller, khaki-and-brown camouflage, small offset turret with a short 57 mm gun, faces left
function drawChiHa(ctx, t){
  const body = t.flash>0 ? '#eeeeee' : '#8a7d50', recoil = t.fireT>0 ? 1 : 0;
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(slopeAt(t.x) + recoil*0.04); ctx.scale(-1, 1);
  tankHull(ctx, 24, 10, body, '#5d5434', t.dist);
  ctx.fillStyle='rgba(90,70,40,.6)'; ctx.fillRect(-8, -9.5, 6, 3); ctx.fillRect(3, -9, 5, 2.5);                    // camouflage
  ctx.fillStyle=body; ctx.beginPath(); ctx.ellipse(2, -11, 5, 3.4, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle='#e8c34a'; ctx.fillRect(-10, -6, 20, 0.8);                                                         // yellow recognition band
  const gl = 8 - recoil*2;
  ctx.strokeStyle='#4a432b'; ctx.lineWidth=1.8; ctx.beginPath(); ctx.moveTo(6, -11); ctx.lineTo(6+gl, -11.5); ctx.stroke();
  if(t.fireT>0){ t.fireT -= 1/60; ctx.fillStyle='rgba(255,210,110,.95)'; ctx.beginPath(); ctx.arc(7+gl, -11.5, 3, 0, 7); ctx.fill(); }
  ctx.restore();
  if(t.moving && Math.random() < 0.12) puff(t.x + 13, t.y - 3, 'rgba(180,160,120,.5)', 4, 0.7);                        // dust
  if(t.hp < t.max){ ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(t.x-11, t.y-22, 22, 2.5); ctx.fillStyle='#e8b33a'; ctx.fillRect(t.x-11, t.y-22, 22*t.hp/t.max, 2.5); }
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
