// ---- Japanese warships, drawn in detail: Kagero-class destroyer, Yamato-class battleship, carrier ----
// Each ship is drawn in a local frame with the bow toward +x (mirrored when steaming left), origin at the
// waterline under the ship's centre. Functional AA/main turrets come from sh.turrets (world offsets dx).

const IJN = {hull:'#6f757b', hullDark:'#50565c', deck:'#7c6c50', boot:'#5c2b26', super:'#646a70', black:'#1d2024'};

function shipHull(ctx, pts, h){
  const g = ctx.createLinearGradient(0, -h, 0, 10);
  g.addColorStop(0, IJN.hull); g.addColorStop(0.75, IJN.hullDark); g.addColorStop(1, '#3a3f44');
  ctx.fillStyle = g; poly(ctx, pts); ctx.fill();
}
function portholes(ctx, x0, x1, y, step){ ctx.fillStyle='rgba(20,22,25,.7)'; for(let x=x0; x<x1; x+=step){ ctx.beginPath(); ctx.arc(x,y,0.9,0,7); ctx.fill(); } }
function bootTop(ctx, x0, x1){ ctx.fillStyle=IJN.boot; ctx.fillRect(x0,-2,x1-x0,3.5); }
function rakedFunnel(ctx, x, base, top, w, rake){
  ctx.fillStyle=IJN.super; ctx.beginPath(); ctx.moveTo(x-w/2,base); ctx.lineTo(x+w/2,base); ctx.lineTo(x+w/2-rake,top); ctx.lineTo(x-w/2-rake,top); ctx.fill();
  ctx.fillStyle=IJN.black; ctx.beginPath(); ctx.moveTo(x-w/2-rake,top); ctx.lineTo(x+w/2-rake,top); ctx.lineTo(x+w/2-rake*1.08,top-3); ctx.lineTo(x-w/2-rake*1.08,top-3); ctx.fill();
  if(Math.random()<0.05) return true; return false;
}
function ensign(ctx, x, y, s=1){
  const fy = y + Math.sin(G.time*4)*0.4;
  ctx.fillStyle='#f2efe6'; ctx.fillRect(x, fy, 12*s, 8*s);
  ctx.save(); ctx.beginPath(); ctx.rect(x, fy, 12*s, 8*s); ctx.clip();
  ctx.strokeStyle='#c4231c'; ctx.lineWidth=1*s;
  for(let k=0;k<8;k++){ const a=k*Math.PI/4; ctx.beginPath(); ctx.moveTo(x+4.5*s,fy+4*s); ctx.lineTo(x+4.5*s+Math.cos(a)*14*s, fy+4*s+Math.sin(a)*14*s); ctx.stroke(); }
  ctx.restore(); ctx.fillStyle='#c4231c'; ctx.beginPath(); ctx.arc(x+4.5*s, fy+4*s, 2.3*s, 0, 7); ctx.fill();
}
// a gun house with barrels; `aim` is in the local (bow = +x) frame
function gunHouse(ctx, x, y, w, h, barrels, len, aim, dead){
  if(dead){ ctx.fillStyle='#2a2a28'; ctx.beginPath(); ctx.moveTo(x-w/2,y); ctx.lineTo(x-w/4,y-h*0.6); ctx.lineTo(x+w/5,y-h*0.3); ctx.lineTo(x+w/2,y); ctx.fill(); return; }
  const ca=Math.cos(aim), sa=Math.sin(aim), py=y-h*0.55;
  ctx.strokeStyle=IJN.black; ctx.lineWidth = barrels>2 ? 1.6 : 1.3;
  for(let i=0;i<barrels;i++){ const off=(i-(barrels-1)/2)*1.7, ox=-sa*off, oy=ca*off;
    ctx.beginPath(); ctx.moveTo(x+ox, py+oy); ctx.lineTo(x+ox+ca*len, py+oy+sa*len); ctx.stroke(); }
  ctx.fillStyle=IJN.super; ctx.beginPath(); ctx.moveTo(x-w/2,y); ctx.lineTo(x-w/2+2,y-h); ctx.lineTo(x+w/2-h*0.6,y-h); ctx.lineTo(x+w/2,y-h*0.35); ctx.lineTo(x+w/2,y); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.12)'; ctx.fillRect(x-w/2+2,y-h,w-h*0.6-2,1);
}

function drawShip(ctx, sh){
  const x=sh.x, w=sh.w, h=sh.h, d=sh.dir;
  if(sh.dead && sh.sink>1.4) return;
  const toLocal = a => d>0 ? a : Math.PI - a;                                     // world aim angle -> local frame
  const body = ()=>{
    if(sh.type==='battleship') drawYamato(ctx, sh, toLocal);
    else if(sh.type==='jcarrier') drawJCarrier(ctx, sh, toLocal);
    else drawKagero(ctx, sh, toLocal);
  };
  ctx.save();
  // the sea hides whatever is below the waterline; this clip is in world space so a sinking hull disappears into it
  ctx.beginPath(); ctx.rect(x-w*1.5, -3000, w*3, SEA+3+3000); ctx.clip();
  if(!sh.dead){
    ctx.translate(x, SEA); ctx.scale(d, 1);
    body();
    if(sh.flash>0){ ctx.globalCompositeOperation='lighter'; ctx.fillStyle='rgba(255,255,255,.35)'; ctx.fillRect(-w/2-10,-h-60,w+30,h+70); ctx.globalCompositeOperation='source-over'; }
  } else {
    // broken in two at midships: each half tilts its far end up, the halves drift apart and slide under, faster and faster
    const s = sh.sink, depth = s*s*170, tilt = Math.min(s,0.7)*0.55, gap = s*12;
    for(const half of [1,-1]){                                                   // +1 = bow half, -1 = stern half
      ctx.save();
      ctx.translate(x + half*d*gap, SEA + depth);
      ctx.rotate(-half*d*tilt);                                                  // pivot at the break, not the world origin
      ctx.scale(d, 1);
      ctx.beginPath(); ctx.rect(half>0 ? 0 : -w, -500, w, 600); ctx.clip();
      body();
      ctx.fillStyle='rgba(15,15,15,.55)'; ctx.fillRect(half>0 ? 0 : -3, -h-120, 3, h+130);   // torn, burnt edge at the break
      ctx.restore();
    }
  }
  ctx.restore();
  // bow wave and wake
  if(!sh.dead){
    ctx.fillStyle='rgba(235,245,250,.7)';
    for(let i=0;i<4;i++){ ctx.beginPath(); ctx.ellipse(x + d*(w/2+6-i*6), SEA+1, 7-i, 1.8+Math.sin(G.time*3+i)*0.4, 0, 0, 7); ctx.fill(); }
  }
  if(!sh.dead && sh.hp<sh.max){
    const by = SEA-h-(sh.type==='battleship'?100:sh.type==='jcarrier'?52:48);
    ctx.fillStyle='#000a'; ctx.fillRect(x-w/2,by,w,4); ctx.fillStyle='#e8b33a'; ctx.fillRect(x-w/2,by,w*sh.hp/sh.max,4);
  }
  // damage: smoke and fire as the hull takes hits
  const dmg = 1 - Math.max(0,sh.hp)/sh.max;
  if(!sh.dead && dmg>0.3 && Math.random()<dmg*0.3) puff(x + rnd(-w/3,w/3), SEA-h*0.6, '#2c2c2c', 10, 1.6);
}

// Kagero-class destroyer: raised forecastle, bridge, two raked funnels, quad torpedo tubes, three twin 5-in mounts
function drawKagero(ctx, sh, toLocal){
  const L = sh.w/2;   // 85
  shipHull(ctx, [[-L,-8],[-L+4,-9],[18,-9],[20,-13],[L+8,-15],[L-4,5],[-L+6,5],[-L-2,-2]], 15);
  bootTop(ctx, -L+2, L-4);
  ctx.fillStyle=IJN.deck; ctx.fillRect(-L+4,-10,L+14,1.2); ctx.fillRect(20,-14,L-14,1.2);
  portholes(ctx, 25, L-8, -9, 7); portholes(ctx, -L+10, 15, -5, 9);
  // bridge and tripod foremast
  ctx.fillStyle=IJN.super; ctx.fillRect(34,-24,16,11); ctx.fillRect(37,-29,12,5);
  ctx.fillStyle='#9fc4db'; ctx.fillRect(38,-27.5,10,1.6);
  ctx.strokeStyle='#3a3f44'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(41,-29); ctx.lineTo(41,-48); ctx.moveTo(36,-24); ctx.lineTo(40,-42); ctx.moveTo(36,-41); ctx.lineTo(47,-41); ctx.stroke();
  // funnels (raked aft) and torpedo tube mounts
  rakedFunnel(ctx, 12, -9, -27, 8, 3); rakedFunnel(ctx, -10, -9, -25, 8, 3);
  if(Math.random()<0.06) puff(sh.x + sh.dir*9, SEA-30, 'rgba(70,70,70,.6)', 6, 1.6);
  for(const tx of [0,-28]){ ctx.fillStyle='#4a5056'; ctx.fillRect(tx-6,-13,12,4); ctx.fillStyle=IJN.black; for(let i=0;i<3;i++) ctx.fillRect(tx-9,-12.6+i*1.2,18,0.8); }
  // main mounts: one forward on the forecastle, two aft (fixed, trained fore and aft)
  gunHouse(ctx, 64,-15, 11,6, 2, 10, 0, false);
  gunHouse(ctx, -50,-9, 11,6, 2, 10, Math.PI, false);
  gunHouse(ctx, -66,-9, 11,6, 2, 10, Math.PI, false);
  // the AA mount the game aims and damages
  for(const t of sh.turrets){ const lx = t.dx*sh.dir; gunHouse(ctx, lx, -10, 8, 4, 2, 9, toLocal(t.aim ?? -1.2), t.dead); }
  // mainmast and ensign
  ctx.strokeStyle='#3a3f44'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(-36,-9); ctx.lineTo(-36,-34); ctx.stroke();
  ensign(ctx, -L-1, -22, 0.8);
  ctx.strokeStyle='#3a3f44'; ctx.lineWidth=0.8; ctx.beginPath(); ctx.moveTo(-L+1,-9); ctx.lineTo(-L+1,-22); ctx.stroke();
}

// Yamato-class battleship: long flush deck with sheer, pagoda tower, one big raked funnel, triple main turrets
function drawYamato(ctx, sh, toLocal){
  const L = sh.w/2;   // 220
  shipHull(ctx, [[-L,-13],[-L+10,-15],[-40,-16],[60,-17],[L+12,-24],[L-14,9],[-L+16,9],[-L-4,0]], 24);
  bootTop(ctx, -L+4, L-14);
  ctx.fillStyle=IJN.deck; ctx.beginPath(); ctx.moveTo(-L+10,-15); ctx.lineTo(60,-17); ctx.lineTo(L+12,-24); ctx.lineTo(L+10,-22.6); ctx.lineTo(60,-15.6); ctx.lineTo(-L+10,-13.6); ctx.fill();
  portholes(ctx, -L+20, L-30, -9, 9);
  ctx.strokeStyle='rgba(20,22,25,.3)'; ctx.lineWidth=0.6; ctx.beginPath(); ctx.moveTo(-L+14,-4); ctx.lineTo(L-20,-4); ctx.stroke();   // armour belt
  // superstructure: citadel, pagoda tower with stacked bridges and the main rangefinder
  ctx.fillStyle=IJN.super;
  ctx.fillRect(-40,-30,110,14);
  ctx.fillRect(20,-48,34,18); ctx.fillRect(24,-62,26,14); ctx.fillRect(28,-76,18,14); ctx.fillRect(31,-88,12,12);
  ctx.fillStyle='#4f555b'; ctx.fillRect(18,-90,38,3);                                       // rangefinder arms
  ctx.fillStyle='#9fc4db'; for(const [yy,x0,x1] of [[-58,26,48],[-72,30,44],[-84,32,42]]) ctx.fillRect(x0,yy,x1-x0,1.8);
  ctx.strokeStyle='#3a3f44'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(37,-90); ctx.lineTo(37,-112); ctx.moveTo(30,-104); ctx.lineTo(44,-104); ctx.stroke();
  // secondary 6.1-in turrets and AA gun tubs along the citadel
  gunHouse(ctx, 6,-30, 12,6, 3, 11, 0, false); gunHouse(ctx, 74,-30, 10,5, 2, 9, 0, false);
  ctx.fillStyle='#4a5056'; for(const ax of [-30,-12,58]){ ctx.fillRect(ax-5,-34,10,4); ctx.strokeStyle=IJN.black; ctx.lineWidth=0.7; ctx.beginPath(); ctx.moveTo(ax,-34); ctx.lineTo(ax+4,-39); ctx.stroke(); }
  // the single big funnel, raked aft, and the mainmast
  rakedFunnel(ctx, -10, -30, -66, 20, 7);
  if(Math.random()<0.1) puff(sh.x - sh.dir*17, SEA-92, 'rgba(60,60,60,.65)', 9, 2);
  ctx.strokeStyle='#3a3f44'; ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(-45,-30); ctx.lineTo(-45,-78); ctx.moveTo(-52,-66); ctx.lineTo(-38,-66); ctx.stroke();
  // stern: aircraft catapult, crane and a floatplane
  ctx.strokeStyle='#3a3f44'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(-L+30,-15); ctx.lineTo(-L+12,-32); ctx.lineTo(-L+6,-24); ctx.stroke();
  ctx.save(); ctx.translate(-L+46,-19); ctx.scale(0.45,0.45); drawPlane(ctx,'zero',null,null,1,false,false,0); ctx.restore();
  ensign(ctx, -L-2, -34, 1);
  // main triple 18.1-in turrets: these are the turrets the player must silence; they train on the target
  for(const t of sh.turrets){
    const lx = t.dx*sh.dir, fwd = lx > 0, y = fwd && lx > 120 ? -20 : fwd ? -26 : -16;
    gunHouse(ctx, lx, y, 30, 11, 3, 30, toLocal(t.aim ?? (fwd ? -0.2 : -Math.PI+0.2)), t.dead);
    if(!t.dead && t.max && t.hp < t.max){ ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(lx-12, y-16, 24, 2.5); ctx.fillStyle='#e8b33a'; ctx.fillRect(lx-12, y-16, 24*t.hp/t.max, 2.5); }
  }
}

// Japanese fleet carrier: hangar sides under an overhanging wooden flight deck, small island, downturned funnel
function drawJCarrier(ctx, sh, toLocal){
  const L = sh.w/2, dy = -JDECK;
  shipHull(ctx, [[-L+6,-14],[L-10,-15],[L+14,-18],[L-8,6],[-L+14,6],[-L,-4]], 18);
  bootTop(ctx, -L+4, L-8);
  ctx.fillStyle = '#4d5358'; ctx.fillRect(-L+10, dy+4, sh.w-20, 9);
  ctx.fillStyle='#24282c'; for(let i=0;i<7;i++) ctx.fillRect(-L+26+i*42, dy+7, 22, 4);
  portholes(ctx, -L+16, L-10, -8, 8);
  ctx.fillStyle='#7a6a4c'; ctx.fillRect(-L-8, dy, sh.w+16, 4);
  ctx.fillStyle='rgba(235,230,210,.8)'; ctx.fillRect(-L-8, dy, sh.w+16, 0.8);
  ctx.fillStyle='#fff'; ctx.fillRect(L-30, dy-0.2, 14, 1.2);                     // bow deck marking
  ctx.fillStyle='#222'; ctx.beginPath(); ctx.ellipse(-40, dy+13, 7, 4, 0, 0, Math.PI); ctx.fill();
  if(Math.random()<0.06) puff(sh.x - sh.dir*40, SEA-JDECK+16, 'rgba(70,70,70,.5)', 6, 1.4);
  const ix = sh.w*0.2;
  ctx.fillStyle='#4b5157'; ctx.fillRect(ix-9, dy-16, 18, 16); ctx.fillRect(ix-5, dy-22, 10, 6);
  ctx.fillStyle='#9fc4db'; ctx.fillRect(ix-7, dy-13, 14, 2.5);
  ctx.strokeStyle='#333'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(ix, dy-22); ctx.lineTo(ix, dy-40); ctx.stroke();
  ensign(ctx, ix, dy-40, 1.1);
  if(!sh.dead) for(const px of [-L*0.8, -L*0.6, -L*0.4]){
    ctx.save(); ctx.translate(px, dy-4); ctx.scale(0.55, 0.55); drawPlane(ctx,'zero',null,null,1,false,false,1); ctx.restore();
  }
  for(const t of sh.turrets){ const lx = t.dx*sh.dir; gunHouse(ctx, lx, -15, 9, 4, 2, 9, toLocal(t.aim ?? -1.2), t.dead); }
}

// tall white column of water thrown up by a torpedo hit
function drawColumn(ctx, f){
  const k = f.t/f.max, hgt = 120*Math.sin(Math.min(1,k*1.6)*Math.PI/2)*(1-k*0.4);
  ctx.fillStyle = `rgba(235,245,250,${0.85*(1-k)})`;
  for(let i=-3;i<=3;i++){ const wv = 6 - Math.abs(i)*1.2; ctx.beginPath(); ctx.ellipse(f.x+i*6, f.y-hgt*(1-Math.abs(i)*0.18)/2, wv, hgt*(1-Math.abs(i)*0.18)/2+2, 0, 0, 7); ctx.fill(); }
  ctx.fillStyle = `rgba(220,235,245,${0.6*(1-k)})`; ctx.beginPath(); ctx.ellipse(f.x, f.y-hgt, 26*(0.5+k), 12*(0.5+k), 0, 0, 7); ctx.fill();
}
