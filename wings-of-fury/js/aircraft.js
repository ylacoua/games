// ---- Side-view aircraft drawn from each type's real profile ----
// Coordinates: nose toward +x, y down, roughly 1 unit = 0.25 m. Each spec lists the fuselage silhouette
// (top line nose->tail, bottom line nose->tail), canopy glazing, fin, wing, and type-specific details.

// 1944 paint schemes
const SCHEMES = {
  gsb:  {top:'#1f2e48', side:'#22334f', under:'#1c2a42', hi:'rgba(140,170,210,.35)'},   // US glossy sea blue
  tri:  {top:'#2f4262', side:'#58718f', under:'#dedcd2', hi:'rgba(200,215,235,.25)'},   // US tri-colour
  ijn:  {top:'#3a492d', side:'#3a492d', under:'#b6b39f', hi:'rgba(190,200,160,.25)'},   // IJN dark green over grey
  ijnb: {top:'#3d4b31', side:'#45533a', under:'#a7a593', hi:'rgba(190,200,160,.2)'}
};
const GLASS = '#9dbdd0', FRAME = 'rgba(25,32,40,.75)', DARK = '#15191e';

const AIRCRAFT = {
  hellcat: { scheme:'gsb', nation:'us', blades:3, propX:22.5, propR:11,
    top:[[22,-3],[21,-6],[16,-7.4],[7,-7.6],[4.5,-11],[-3,-11.5],[-6,-10.4],[-13,-5],[-22,-2.6],[-25.5,-2]],
    bot:[[22,4],[19,7],[12,8.6],[2,8],[-8,5],[-18,2.5],[-25.5,1]],
    glass:[[7,-7.7],[4.5,-11],[-3,-11.5],[-6,-10.4],[-7,-7.9]], frames:[4.5,0.5,-3],
    fin:[[-16,-3.5],[-19.5,-13],[-22.5,-15],[-25,-14.5],[-26,-11],[-25.5,-2]], rudder:-23,
    wing:{x:2,y:4.6,rx:11.5,ry:2.3}, stab:{x:-21,y:-0.6,rx:6,ry:1.3}, cowl:14, guns:[[12,5.2],[11,4.2]],
    exhaust:[13,0], ins:{x:-9.5,y:0,r:3.2}, gearX:5 },
  corsair: { scheme:'gsb', nation:'us', blades:3, propX:22.5, propR:12.5,
    top:[[22,-3],[21,-5.5],[14,-6.5],[0,-6.6],[-3,-7.1],[-5.5,-10.4],[-10,-11],[-12.8,-9.6],[-15,-6],[-23,-3],[-26.5,-2.5]],
    bot:[[22,3.5],[19,6],[10,6.6],[0,6.4],[-10,4.5],[-20,2],[-26.5,1]],
    glass:[[-3.6,-7.2],[-5.5,-10.4],[-10,-11],[-12.8,-9.6],[-13.6,-7.1]], frames:[-5.5],
    fin:[[-17.5,-4],[-21,-13.5],[-23.5,-15.6],[-26,-15],[-27.2,-11],[-26.5,-2.5]], rudder:-24.5,
    wing:{x:1,y:9,rx:10.5,ry:2.1}, gull:true, stab:{x:-22,y:-1,rx:6,ry:1.3}, cowl:15, guns:[[11,9.6]],
    exhaust:[11,1], ins:{x:-17,y:-0.5,r:2.9}, gearX:3 },
  bearcat: { scheme:'gsb', nation:'us', blades:4, propX:20.5, propR:12,
    top:[[20,-3],[19,-6.5],[13,-7.6],[6,-7.6],[4,-8.1],[2,-11.6],[-4,-12.1],[-7,-10.5],[-9,-7],[-16,-4],[-21,-2.5]],
    bot:[[20,4],[17,7],[10,8],[0,7.5],[-10,4],[-21,1]],
    glass:[[4,-8.1],[2,-11.6],[-4,-12.1],[-7,-10.5],[-8.4,-7.6]], frames:[2], bubble:true,
    fin:[[-9,-6.6],[-15,-8.5],[-18,-16],[-20.8,-17.2],[-22.6,-15],[-21.8,-2.5]], rudder:-20.4,
    wing:{x:2,y:4.6,rx:10,ry:2.1}, stab:{x:-18,y:-0.6,rx:5,ry:1.2}, cowl:12, guns:[[10,5]],
    exhaust:[11,0.5], ins:{x:-11,y:-0.6,r:2.7}, gearX:4 },
  dauntless: { scheme:'tri', nation:'us', blades:3, propX:23.5, propR:11,
    top:[[23,-2.5],[22,-5],[16,-6],[8,-6.2],[6,-6.6],[4,-10],[-14,-10.1],[-16,-7],[-24,-3],[-27,-2.5]],
    bot:[[23,4],[20,6.5],[10,7.5],[0,7.4],[-12,5],[-22,2.2],[-27,1]],
    glass:[[6,-6.7],[4,-10],[-14,-10.2],[-15.6,-7]], frames:[4,1,-2,-5,-8,-11],
    fin:[[-19,-3.5],[-21,-12],[-24,-13.6],[-26.8,-12.2],[-27.6,-8],[-27,-2.5]], rudder:-25,
    wing:{x:3,y:4.6,rx:12,ry:2.4}, flaps:{x0:-9,x1:0,y:5.2}, stab:{x:-22.5,y:-0.8,rx:6,ry:1.3}, cowl:16,
    rearGun:[[-13,-9.4],[-20,-12.6]], bomb:{x:2,y:10.2}, exhaust:[15,0], ins:{x:-11.5,y:-0.5,r:2.7}, gearX:5 },
  avenger: { scheme:'tri', nation:'us', blades:3, propX:24.5, propR:12.5,
    top:[[24,-3],[23,-6],[17,-7.6],[10,-8.1],[8,-8.3],[6,-12],[-9,-12.4],[-12,-15],[-15.5,-14.5],[-17,-10],[-25,-4.2],[-29.5,-3]],
    bot:[[24,4],[21,8],[12,10.2],[0,10.6],[-6,10.2],[-8,8],[-16,6],[-24,3],[-29.5,1.5]],
    glass:[[8,-8.4],[6,-12],[-9,-12.4],[-10.2,-8.6]], frames:[6,2,-2,-6],
    turret:{x:-13,y:-12.2,r:3.5},
    fin:[[-20,-4],[-24,-15.5],[-28,-16.4],[-30.4,-14],[-30.2,-3]], rudder:-27.6,
    wing:{x:2,y:5.2,rx:14,ry:2.8}, stab:{x:-25,y:-1.2,rx:7,ry:1.5}, cowl:17, bay:{x0:-4,x1:12},
    ventral:{x:-7,y:9}, exhaust:[16,0], ins:{x:-16.5,y:-0.5,r:2.9}, gearX:6 },
  wildcat: { scheme:'tri', nation:'us', blades:3, propX:19.5, propR:10,
    top:[[19,-4],[18,-7],[12,-8],[6,-8],[4,-8.5],[2,-11],[-5,-11],[-7,-8.2],[-14,-4.5],[-19.5,-2.5]],
    bot:[[19,5],[16,8.5],[8,10],[0,9.5],[-8,5],[-19.5,1.5]],
    glass:[[4,-8.6],[2,-11],[-5,-11],[-7,-8.3]], frames:[2,-1.5],
    fin:[[-12.5,-4],[-15,-13],[-17.5,-14.6],[-20,-13.2],[-20.4,-2.5]], rudder:-18.4,
    wing:{x:1,y:2,rx:9,ry:1.9}, stab:{x:-16.5,y:-0.8,rx:5,ry:1.2}, cowl:12, guns:[[9,2.4]],
    exhaust:[11,2], ins:{x:-9,y:0,r:2.7}, gearX:4 },
  helldiver: { scheme:'tri', nation:'us', blades:3, propX:24.5, propR:12,
    top:[[24,-3],[23,-6],[17,-7],[9,-7],[7,-7.5],[5,-11],[-12,-11],[-14,-7.6],[-23,-3.5],[-28,-2.5]],
    bot:[[24,4],[21,7],[12,8.6],[0,8.6],[-12,5.5],[-22,2.5],[-28,1]],
    glass:[[7,-7.6],[5,-11],[-12,-11.2],[-14,-7.6]], frames:[5,1,-3,-7,-10],
    fin:[[-19,-4],[-21,-15],[-27.5,-15.6],[-28.6,-13],[-28,-2.5]], rudder:-25.5,
    wing:{x:3,y:4.6,rx:13,ry:2.5}, stab:{x:-23,y:-1,rx:6.5,ry:1.4}, cowl:16,
    rearGun:[[-11,-10.4],[-18,-13]], exhaust:[16,0], ins:{x:-13,y:-0.5,r:2.8}, gearX:5 },
  zero: { scheme:'ijn', nation:'jp', blades:3, propX:21.5, propR:10.5,
    top:[[21,-2.5],[20,-5],[15,-5.8],[7,-6],[5,-6.4],[3,-9.5],[-8,-9.8],[-11,-7.5],[-20,-2.6],[-23,-2]],
    bot:[[21,3.5],[18,5.5],[10,6.2],[0,6],[-10,4],[-23,1]],
    glass:[[5,-6.5],[3,-9.5],[-8,-9.8],[-11,-6.9]], frames:[3,0,-4,-7.5],
    fin:[[-15.5,-3],[-18.5,-11],[-21,-12.6],[-23.6,-11.4],[-24,-2]], rudder:-21.8,
    wing:{x:2,y:4,rx:11,ry:1.9}, stab:{x:-19.5,y:-0.5,rx:5.5,ry:1.2}, cowl:14, cowlColor:'#151515', guns:[[10,4.6]],
    exhaust:[13,1], ins:{x:-10,y:-0.5,r:3}, gearX:4 },
  betty: { scheme:'ijnb', nation:'jp', blades:3, propX:22, propR:10,
    top:[[33,-1],[31,-5],[26,-7.6],[18,-8.6],[16,-9],[14,-11],[6,-11],[4,-9.6],[-10,-9],[-24,-6],[-32,-4],[-35.5,-2]],
    bot:[[33,2],[30,5.5],[20,8],[0,8.6],[-14,7],[-26,4],[-35.5,1]],
    glass:[[16,-9.1],[14,-11],[6,-11],[4,-9.6]], frames:[14,10],
    noseGlass:true, tailGlass:true, blister:{x:-8,y:-9.4,r:2.6},
    fin:[[-22,-6],[-26,-17],[-30,-18],[-33,-16],[-33.5,-4]], rudder:-31,
    wing:{x:2,y:-1.5,rx:17,ry:2.7}, stab:{x:-29,y:-2,rx:8,ry:1.6},
    nacelle:{x:11,y:1.5,rx:10,ry:4.2}, ins:{x:-18,y:0,r:3.4}, gearX:9 }
};

// The profiles above were sketched with deep bellies; real single-engine types are about 4.5-5x longer
// than they are deep, so flatten everything below the thrust line once at load time.
(function slimBellies(){
  for(const [id,A] of Object.entries(AIRCRAFT)){
    if(id==='betty') continue;
    const k = 0.7, kw = 0.8;
    A.bot = A.bot.map(([x,y])=>[x, y>0 ? y*k : y]);
    A.wing = {...A.wing, y:A.wing.y*kw};
    if(A.guns) A.guns = A.guns.map(([x,y])=>[x, y*kw]);
    if(A.flaps) A.flaps = {...A.flaps, y:A.flaps.y*kw};
    if(A.bomb) A.bomb = {...A.bomb, y:A.bomb.y*k+0.6};
    if(A.ventral) A.ventral = {...A.ventral, y:A.ventral.y*k};
  }
})();

function insignia(ctx, nation, x, y, r){
  if(nation==='us'){
    ctx.fillStyle='#1d3566'; ctx.fillRect(x-r*2.1, y-r*0.42, r*4.2, r*0.84);
    ctx.fillStyle='#f2f2ec'; ctx.fillRect(x-r*1.9, y-r*0.3, r*3.8, r*0.6);
    ctx.fillStyle='#1d3566'; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
    ctx.fillStyle='#f2f2ec'; ctx.beginPath();
    for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr=i%2?r*0.38:r*0.92; ctx.lineTo(x+Math.cos(a)*rr, y+Math.sin(a)*rr); }
    ctx.fill();
  } else {
    ctx.fillStyle='#eeeae0'; ctx.beginPath(); ctx.arc(x,y,r*1.18,0,7); ctx.fill();
    ctx.fillStyle='#b8241c'; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
  }
}

function smoothShape(ctx, pts){
  const n = pts.length;
  ctx.beginPath(); ctx.moveTo((pts[n-1][0]+pts[0][0])/2, (pts[n-1][1]+pts[0][1])/2);
  for(let i=0;i<n;i++){ const p=pts[i], q=pts[(i+1)%n]; ctx.quadraticCurveTo(p[0],p[1],(p[0]+q[0])/2,(p[1]+q[1])/2); }
  ctx.closePath();
}
function poly(ctx, pts){ ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.closePath(); }
function lineAt(pts, x){   // y of a profile line at x (pts run nose -> tail, x decreasing)
  for(let i=0;i<pts.length-1;i++){ const a=pts[i], b=pts[i+1]; if(x<=a[0] && x>=b[0]){ const k=(a[0]-x)/((a[0]-b[0])||1); return a[1]+(b[1]-a[1])*k; } }
  return pts[pts.length-1][1];
}

// Signature kept from the earlier sprite: drawPlane(ctx, type, color, nation, scale, flash, propSpinning, gear 0..1)
function drawPlane(ctx, type, color, nation, s, flash, prop, gear=0){
  const A = AIRCRAFT[type] || AIRCRAFT.hellcat, S = SCHEMES[A.scheme];
  const W = flash ? '#ffffff' : null;
  ctx.save(); ctx.scale(s,s); ctx.lineJoin='round'; ctx.lineCap='round';
  const body = A.top.concat(A.bot.slice().reverse());
  let minY=0, maxY=0; for(const p of body){ minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); }

  // landing gear (behind everything)
  if(gear>0.02){
    const gx = A.gearX, gy = lineAt(A.bot, gx) - 1, ex = gx + 3*gear, ey = gy + 9*gear;
    const tx = A.bot[A.bot.length-1][0] + 3, ty = lineAt(A.bot, tx);
    ctx.strokeStyle='#2a2f36'; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(ex,ey); ctx.moveTo(tx,ty); ctx.lineTo(tx-1,ty+4*gear); ctx.stroke();
    ctx.fillStyle='#14171b'; ctx.beginPath(); ctx.arc(ex,ey,3.4*gear+0.4,0,7); ctx.fill();
    ctx.fillStyle='#8a929c'; ctx.beginPath(); ctx.arc(ex,ey,1.2*gear,0,7); ctx.fill();
    ctx.fillStyle='#14171b'; ctx.beginPath(); ctx.arc(tx-1,ty+4*gear,1.7*gear,0,7); ctx.fill();
  }
  // far horizontal stabiliser peeks out above the near one
  ctx.fillStyle = W || S.under; ctx.beginPath(); ctx.ellipse(A.stab.x+1, A.stab.y-0.8, A.stab.rx*0.8, A.stab.ry*0.8, 0, 0, 7); ctx.fill();
  // vertical fin and rudder
  ctx.fillStyle = W || S.top; smoothShape(ctx, A.fin); ctx.fill();
  if(!W){ ctx.strokeStyle=FRAME; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(A.rudder, lineAt(A.top, A.rudder)-0.5);
    ctx.lineTo(A.rudder+1.2, Math.min(...A.fin.map(p=>p[1]))+1.5); ctx.stroke(); }
  // engine nacelle on the far side (twin-engine types)
  if(A.nacelle){ const n=A.nacelle; ctx.fillStyle = W || S.top; ctx.beginPath(); ctx.ellipse(n.x-2, n.y-1.5, n.rx*0.9, n.ry*0.9, 0, 0, 7); ctx.fill(); }

  // fuselage with paint-scheme gradient (upper surface -> side -> light underside)
  const g = ctx.createLinearGradient(0, minY, 0, maxY);
  if(W){ g.addColorStop(0,W); g.addColorStop(1,W); }
  else { g.addColorStop(0,S.top); g.addColorStop(0.42,S.side); g.addColorStop(0.62,S.side); g.addColorStop(0.68,S.under); g.addColorStop(1,S.under); }
  ctx.fillStyle = g; smoothShape(ctx, body); ctx.fill();
  if(!W){
    // gloss highlight along the spine, panel lines
    ctx.save(); smoothShape(ctx, body); ctx.clip();
    ctx.strokeStyle = S.hi; ctx.lineWidth = 1.2; ctx.beginPath();
    A.top.forEach((p,i)=> i ? ctx.lineTo(p[0], p[1]+1.3) : ctx.moveTo(p[0], p[1]+1.3)); ctx.stroke();
    ctx.strokeStyle='rgba(0,0,0,.18)'; ctx.lineWidth=0.4;
    for(const px of [A.cowl||14, (A.cowl||14)-9, -A.cowl*0.6||-8]){ ctx.beginPath(); ctx.moveTo(px,minY); ctx.lineTo(px,maxY); ctx.stroke(); }
    // engine cowling (Zero: black)
    if(A.cowl){ ctx.fillStyle = A.cowlColor || 'rgba(0,0,0,.12)'; ctx.fillRect(A.cowl, minY, 40, maxY-minY); }
    // exhaust staining streaking back from the cowl
    if(A.exhaust){ const [ex,ey]=A.exhaust; const eg=ctx.createLinearGradient(ex,0,ex-18,0); eg.addColorStop(0,'rgba(15,15,15,.4)'); eg.addColorStop(1,'rgba(15,15,15,0)');
      ctx.fillStyle=eg; ctx.beginPath(); ctx.moveTo(ex,ey-0.7); ctx.quadraticCurveTo(ex-9,ey-1.1,ex-18,ey+0.2); ctx.quadraticCurveTo(ex-9,ey+0.6,ex,ey+0.7); ctx.fill();
      ctx.fillStyle='#1a1a1a'; for(let i=0;i<3;i++) ctx.fillRect(ex+0.3-i*1.3, ey-0.5, 0.8, 1); }
    ctx.restore();
  }
  // glazed nose and tail turret (bombers)
  if(A.noseGlass){
    ctx.fillStyle = W || GLASS; poly(ctx, [[A.top[0][0],A.top[0][1]],[A.top[1][0],A.top[1][1]],[A.top[2][0],A.top[2][1]],[26,4],[A.bot[1][0],A.bot[1][1]],[A.bot[0][0],A.bot[0][1]]]); ctx.fill();
    if(!W){ ctx.strokeStyle=FRAME; ctx.lineWidth=0.5; for(const fx of [29,27.5]){ ctx.beginPath(); ctx.moveTo(fx,-6.5); ctx.lineTo(fx,5); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(26,-2); ctx.lineTo(33,0); ctx.stroke(); }
  }
  if(A.tailGlass){
    const t=A.top[A.top.length-1], b=A.bot[A.bot.length-1];
    ctx.fillStyle = W || GLASS; poly(ctx, [[t[0]+4,t[1]-2],[t[0],t[1]],[b[0],b[1]],[b[0]+4,b[1]+1]]); ctx.fill();
    ctx.strokeStyle=DARK; ctx.lineWidth=0.8; ctx.beginPath(); ctx.moveTo(t[0]+1,0); ctx.lineTo(t[0]-5,0.5); ctx.stroke();
  }
  // cockpit canopy with frames: reflective glass, bright at the top, dark interior below
  { const ty = Math.min(...A.glass.map(p=>p[1])), by = Math.max(...A.glass.map(p=>p[1]));
    const cg = ctx.createLinearGradient(0, ty, 0, by); cg.addColorStop(0,'#e4f2f8'); cg.addColorStop(0.45,'#8fb3c9'); cg.addColorStop(1,'#33495c');
    ctx.fillStyle = W || cg; poly(ctx, A.glass); ctx.fill(); }
  if(!W){
    ctx.fillStyle='rgba(255,255,255,.35)'; ctx.beginPath(); const gl=A.glass;
    ctx.moveTo(gl[1][0]-0.6, gl[1][1]+0.8); ctx.lineTo(gl[2][0]+1, gl[2][1]+0.8); ctx.lineTo(gl[2][0]+1, gl[2][1]+1.6); ctx.lineTo(gl[1][0]-1, gl[1][1]+1.6); ctx.fill();
    ctx.strokeStyle=FRAME; ctx.lineWidth = A.bubble ? 0.4 : 0.55;
    const ty = Math.min(...A.glass.map(p=>p[1])), by = Math.max(...A.glass.map(p=>p[1]));
    for(const fx of A.frames){ ctx.beginPath(); ctx.moveTo(fx, ty+0.2); ctx.lineTo(fx-0.4, by); ctx.stroke(); }
    // pilot's head
    ctx.fillStyle='rgba(40,35,30,.7)'; const hx = (A.glass[1][0]+A.glass[2][0])/2 + (A.frames.length>3?2:0);
    ctx.beginPath(); ctx.arc(hx, ty+2.6, 1.5, 0, 7); ctx.fill();
  }
  if(A.blister){ const b=A.blister; ctx.fillStyle=W||GLASS; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,Math.PI,0); ctx.fill(); }
  // Avenger's ball turret with its .50 gun, and the ventral gun step
  if(A.turret){ const t=A.turret;
    ctx.fillStyle = W || '#3a4a63'; ctx.beginPath(); ctx.arc(t.x,t.y+1.5,t.r+0.6,Math.PI,0); ctx.fill();
    ctx.fillStyle = W || GLASS; ctx.beginPath(); ctx.arc(t.x,t.y,t.r,0,7); ctx.fill();
    if(!W){ ctx.strokeStyle=FRAME; ctx.lineWidth=0.4; ctx.beginPath(); ctx.arc(t.x,t.y,t.r*0.6,0,7); ctx.stroke(); }
    ctx.strokeStyle=DARK; ctx.lineWidth=0.9; ctx.beginPath(); ctx.moveTo(t.x-1,t.y); ctx.lineTo(t.x-8,t.y-0.8); ctx.stroke();
  }
  if(A.ventral){ ctx.fillStyle = W || GLASS; ctx.fillRect(A.ventral.x-4, A.ventral.y-1.4, 3, 1.6);
    ctx.strokeStyle=DARK; ctx.lineWidth=0.7; ctx.beginPath(); ctx.moveTo(A.ventral.x-4,A.ventral.y-0.6); ctx.lineTo(A.ventral.x-9,A.ventral.y); ctx.stroke(); }
  if(A.bay && !W){ ctx.strokeStyle='rgba(0,0,0,.3)'; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(A.bay.x0, lineAt(A.bot,A.bay.x0)-1.5); ctx.lineTo(A.bay.x1, lineAt(A.bot,A.bay.x1)-1.5); ctx.stroke(); }
  // flexible rear guns (Dauntless, Helldiver)
  if(A.rearGun){ ctx.strokeStyle=DARK; ctx.lineWidth=0.8; ctx.beginPath(); ctx.moveTo(...A.rearGun[0]); ctx.lineTo(...A.rearGun[1]);
    ctx.moveTo(A.rearGun[0][0],A.rearGun[0][1]+1); ctx.lineTo(A.rearGun[1][0],A.rearGun[1][1]+1); ctx.stroke(); }
  // national insignia
  if(!W) insignia(ctx, A.nation, A.ins.x, A.ins.y, A.ins.r);
  // centreline bomb on the Dauntless's displacement yoke
  if(A.bomb){ const b=A.bomb; ctx.fillStyle = W || '#3b4030'; ctx.beginPath(); ctx.ellipse(b.x,b.y,5.2,1.8,0,0,7); ctx.fill();
    ctx.fillRect(b.x-7.5,b.y-1.6,2,3.2); ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(b.x+2,b.y-1.6); ctx.lineTo(b.x+3,b.y-3.2); ctx.stroke(); }
  // near engine nacelle with its cowl (twin-engine types)
  if(A.nacelle){ const n=A.nacelle; ctx.fillStyle = W || S.side; ctx.beginPath(); ctx.ellipse(n.x, n.y, n.rx, n.ry, 0, 0, 7); ctx.fill();
    ctx.fillStyle = W || '#1a1c1a'; ctx.beginPath(); ctx.ellipse(n.x+n.rx-2, n.y, 2.4, n.ry, 0, 0, 7); ctx.fill(); }
  // near wing: an airfoil seen edge-on; the Corsair's inverted gull drops below the fuselage first
  const w = A.wing;
  if(A.gull){ ctx.fillStyle = W || S.side; poly(ctx, [[8,4],[-4,4],[w.x-6,w.y],[w.x+7,w.y-0.5]]); ctx.fill(); }
  ctx.fillStyle = W || (A.scheme==='tri' ? S.side : A.scheme==='gsb' ? '#2b3f61' : '#4a5b3a');
  ctx.beginPath(); ctx.moveTo(w.x+w.rx, w.y);
  ctx.bezierCurveTo(w.x+w.rx, w.y-w.ry*1.4, w.x-w.rx*0.4, w.y-w.ry, w.x-w.rx, w.y);
  ctx.bezierCurveTo(w.x-w.rx*0.4, w.y+w.ry*0.6, w.x+w.rx, w.y+w.ry, w.x+w.rx, w.y); ctx.fill();
  if(!W){ ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.lineWidth=0.45; ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(w.x+w.rx*0.9, w.y-w.ry*0.55); ctx.quadraticCurveTo(w.x, w.y-w.ry*1.05, w.x-w.rx*0.8, w.y-w.ry*0.2); ctx.stroke(); }
  if(!W && A.scheme!=='gsb'){ ctx.fillStyle=S.under; ctx.beginPath(); ctx.ellipse(w.x, w.y+w.ry*0.45, w.rx*0.9, w.ry*0.45, 0, 0, Math.PI); ctx.fill(); }
  // perforated dive flaps on the Dauntless trailing edge
  if(A.flaps && !W){ const f=A.flaps; ctx.fillStyle=S.side; ctx.fillRect(f.x0, f.y-0.6, f.x1-f.x0, 2);
    ctx.fillStyle='rgba(10,10,10,.6)'; for(let x=f.x0+0.8; x<f.x1; x+=1.6) ctx.fillRect(x, f.y, 0.7, 0.7); }
  // wing guns protruding from the leading edge
  if(A.guns){ ctx.strokeStyle=DARK; ctx.lineWidth=0.8; for(const [gx,gy] of A.guns){ ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+3.5,gy); ctx.stroke(); } }
  // near horizontal stabiliser
  ctx.fillStyle = W || S.top; ctx.beginPath(); ctx.ellipse(A.stab.x, A.stab.y, A.stab.rx, A.stab.ry, 0, 0, 7); ctx.fill();

  // propeller: spinner plus either a spinning disc or still blades
  const px = A.nacelle ? A.nacelle.x + A.nacelle.rx + 0.5 : A.propX, py = A.nacelle ? A.nacelle.y : 0.5;
  if(prop){
    const pg = ctx.createLinearGradient(0, py-A.propR, 0, py+A.propR);
    pg.addColorStop(0,'rgba(30,30,30,0)'); pg.addColorStop(0.15,'rgba(30,30,30,.32)'); pg.addColorStop(0.85,'rgba(30,30,30,.32)'); pg.addColorStop(1,'rgba(30,30,30,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(px+0.8, py, 1.4, A.propR, 0, 0, 7); ctx.fill();
    ctx.strokeStyle='rgba(230,200,60,.35)'; ctx.lineWidth=0.5; ctx.beginPath(); ctx.ellipse(px+0.8, py, 1.4, A.propR-0.6, 0, 0, 7); ctx.stroke();
  } else {
    ctx.fillStyle='#202020';
    for(let i=0;i<A.blades;i++){ const a = i/A.blades*Math.PI*2 + 0.3, h = Math.sin(a)*A.propR; ctx.fillRect(px, Math.min(py,py+h), 1.6, Math.abs(h)); }
  }
  ctx.fillStyle = W || (A.nation==='jp' ? '#4a4a40' : '#1c2433'); ctx.beginPath(); ctx.ellipse(px, py, 2.2, 2.6, 0, -Math.PI/2, Math.PI/2); ctx.fill();
  ctx.restore();
}

// Kawanishi H8K "Emily": deep two-step flying-boat hull, shoulder wing on a pylon, four engines, gun turrets
function drawEmily(ctx, e){
  const right = Math.cos(e.a)>=0, W = e.flash>0 ? '#fff' : null, S = SCHEMES.ijnb;
  ctx.save(); ctx.translate(e.x,e.y); ctx.scale(right?1:-1,1); ctx.rotate(right?e.a:Math.PI-e.a);
  ctx.lineJoin='round';
  // fin and far stabiliser
  ctx.fillStyle = W || S.top; smoothShape(ctx, [[-46,-12],[-56,-40],[-64,-43],[-70,-39],[-69,-10]]); ctx.fill();
  ctx.fillStyle = W || S.under; ctx.beginPath(); ctx.ellipse(-56,-14,13,2,0,0,7); ctx.fill();
  // hull
  const top=[[62,-2],[60,-11],[52,-17],[38,-20],[10,-21],[-20,-18],[-45,-13],[-66,-9],[-72,-7]];
  const bot=[[62,-2],[58,7],[48,14],[30,18],[6,19],[2,15],[-20,10],[-45,2],[-66,-3],[-72,-5]];
  const body = top.concat(bot.slice().reverse());
  const g = ctx.createLinearGradient(0,-21,0,19);
  if(W){ g.addColorStop(0,W); g.addColorStop(1,W); } else { g.addColorStop(0,S.top); g.addColorStop(0.45,S.side); g.addColorStop(0.55,S.under); g.addColorStop(1,'#8f8d7d'); }
  ctx.fillStyle=g; smoothShape(ctx, body); ctx.fill();
  if(!W){
    ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.lineWidth=0.7; ctx.beginPath(); ctx.moveTo(6,19); ctx.lineTo(2,15); ctx.stroke();   // hull step
    ctx.fillStyle='rgba(0,0,0,.25)'; for(let i=0;i<5;i++) ctx.fillRect(-4-i*8, -6, 3, 3);                                   // waist windows
    ctx.fillStyle=GLASS; poly(ctx, [[62,-2],[60,-11],[54,-15],[54,-1]]); ctx.fill();                                         // glazed bow
    poly(ctx, [[46,-18],[42,-23],[30,-23.5],[28,-20.5]]); ctx.fill();                                                         // cockpit
    ctx.strokeStyle=FRAME; ctx.lineWidth=0.5; for(const fx of [42,38,34]){ ctx.beginPath(); ctx.moveTo(fx,-23); ctx.lineTo(fx,-19.5); ctx.stroke(); }
    ctx.fillStyle=GLASS; ctx.beginPath(); ctx.arc(-14,-18.5,4,Math.PI,0); ctx.fill();                                       // dorsal turret
    poly(ctx, [[-66,-9],[-73,-8],[-73,-4],[-66,-3]]); ctx.fill();                                                              // tail turret
    ctx.strokeStyle=DARK; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(-14,-20); ctx.lineTo(-20,-25); ctx.moveTo(-72,-6); ctx.lineTo(-79,-6); ctx.stroke();
    insignia(ctx, 'jp', -34, -4, 5.5);
  }
  // wing on its pylon, with two visible engine nacelles and a wingtip float strut
  ctx.fillStyle = W || '#34412a'; poly(ctx, [[18,-21],[24,-30],[-6,-30],[-2,-20]]); ctx.fill();
  ctx.fillStyle = W || S.top; ctx.beginPath(); ctx.moveTo(40,-32); ctx.bezierCurveTo(40,-37,-10,-36,-26,-32); ctx.bezierCurveTo(-10,-29,40,-28,40,-32); ctx.fill();
  for(const [nx,ny,k] of [[20,-30,0.85],[30,-31,1]]){
    ctx.fillStyle = W || S.side; ctx.beginPath(); ctx.ellipse(nx,ny,12*k,4.5*k,0,0,7); ctx.fill();
    ctx.fillStyle = W || '#1a1c1a'; ctx.beginPath(); ctx.ellipse(nx+11*k,ny,2.4,4.4*k,0,0,7); ctx.fill();
    ctx.fillStyle='rgba(30,30,30,.3)'; ctx.beginPath(); ctx.ellipse(nx+13.5*k,ny,1.5,12*k,0,0,7); ctx.fill();
  }
  ctx.fillStyle = W || S.top; ctx.beginPath(); ctx.ellipse(-58,-12,14,2.4,0,0,7); ctx.fill();
  ctx.restore();
}
