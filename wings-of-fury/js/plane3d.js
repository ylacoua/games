// ---- Low-poly 3D aircraft, used while the player turns around ----
// Body frame matches the side-view sprite: nose +x, y down, z toward the viewer.
// The model is rolled (bank), pitched, then yawed about the vertical axis and projected orthographically,
// with flat shading and painter's sorting.
const MODEL_CACHE = {};

function buildModel(shape){
  if(MODEL_CACHE[shape]) return MODEL_CACHE[shape];
  const heavy = shape==='heavy', bomber = shape==='bomber' || heavy;
  const len = heavy?26:bomber?24:22, fat = heavy?7.5:6, span = heavy?27:bomber?25:22;
  const faces = [];
  // fuselage: elliptical cross-sections lofted along x
  const st = [[len+1,1.2,1.2,0],[len-2,fat*0.8,fat*0.8,0],[len-8,fat,fat*0.95,0],[0,fat*0.95,fat*0.85,0],[-len*0.5,fat*0.6,fat*0.5,-0.5],[-len+2,2,1.6,-1],[-len,1.2,1,-1]];
  const N = 10, ring = s => Array.from({length:N}, (_,i)=>{ const a=i/N*Math.PI*2; return [s[0], s[3]+Math.sin(a)*s[1], Math.cos(a)*s[2]]; });
  const rings = st.map(ring);
  for(let k=0;k<rings.length-1;k++) for(let i=0;i<N;i++){
    const j=(i+1)%N; faces.push({p:[rings[k][i],rings[k][j],rings[k+1][j],rings[k+1][i]], part:'body'});
  }
  faces.push({p:rings[rings.length-1].slice().reverse(), part:'body'});
  // canopy
  const cx0 = bomber?8:7, cx1 = bomber?-10:-1, ch = fat+2.6;
  faces.push({p:[[cx0,-fat+0.6,-2.6],[cx0,-fat+0.6,2.6],[cx0-2,-ch,0]], part:'glass'});
  faces.push({p:[[cx0,-fat+0.6,2.6],[cx1,-fat+0.8,2.6],[cx1+2,-ch,0],[cx0-2,-ch,0]], part:'glass'});
  faces.push({p:[[cx0,-fat+0.6,-2.6],[cx0-2,-ch,0],[cx1+2,-ch,0],[cx1,-fat+0.8,-2.6]], part:'glass'});
  // main wing (gull wing for the Corsair), slightly below the centreline
  const wy = 3, root = [-6,9], tip = [-2,4];
  for(const side of [-1,1]){
    if(shape==='corsair'){
      const kz = side*8, ky = wy+4;
      faces.push({p:[[root[1],wy,side*fat*0.8],[root[1]-1,ky,kz],[root[0],ky,kz],[root[0],wy,side*fat*0.8]], part:'wing'});
      faces.push({p:[[root[1]-1,ky,kz],[tip[1],wy-1.5,side*span],[tip[0],wy-1.5,side*span],[root[0],ky,kz]], part:'wing', ins:side});
    } else {
      faces.push({p:[[root[1],wy,side*fat*0.8],[tip[1],wy-1.4,side*span],[tip[0],wy-1.4,side*span],[root[0],wy,side*fat*0.8]], part:'wing', ins:side});
    }
    // horizontal stabiliser
    faces.push({p:[[-len+6,0,side*1.2],[-len+3,-0.5,side*9],[-len,-0.5,side*9],[-len-1,0,side*1.2]], part:'wing'});
  }
  // vertical fin
  faces.push({p:[[-len+8,-2,0],[-len+1,-13,0],[-len-2,-13,0],[-len-1,-1,0]], part:'fin'});
  MODEL_CACHE[shape] = {faces, len, fat, span};
  return MODEL_CACHE[shape];
}

function xform(v, cr, sr, cp, sp, cy, sy){
  // roll about x
  let x=v[0], y=v[1]*cr - v[2]*sr, z=v[1]*sr + v[2]*cr;
  // pitch about z (nose up = negative y)
  const x1 = x*cp + y*sp, y1 = -x*sp + y*cp;
  // yaw about the screen vertical
  return [x1*cy + z*sy, y1, -x1*sy + z*cy];
}

function shadeHex(hex, k){
  const n = parseInt(hex.slice(1),16);
  const r = Math.min(255, ((n>>16)&255)*k), g = Math.min(255, ((n>>8)&255)*k), b = Math.min(255, (n&255)*k);
  return `rgb(${r|0},${g|0},${b|0})`;
}

function drawPlane3D(ctx, type, color, nation, yaw, roll, pitch, flash, prop){
  // per-type model family and the aircraft's real paint scheme
  const shape = {corsair:'corsair', dauntless:'bomber', helldiver:'bomber', avenger:'heavy'}[type] || 'fighter';
  const scheme = SCHEMES[(AIRCRAFT[type]||AIRCRAFT.hellcat).scheme];
  color = scheme.top;
  const M = buildModel(shape);
  const cr=Math.cos(roll), sr=Math.sin(roll), cp=Math.cos(pitch), sp=Math.sin(pitch), cy=Math.cos(yaw), sy=Math.sin(yaw);
  const L = [-0.35,-0.8,0.5]; const ll = Math.hypot(...L); L[0]/=ll; L[1]/=ll; L[2]/=ll;
  const under = scheme.under;
  const list = [];
  for(const f of M.faces){
    const q = f.p.map(v=>xform(v,cr,sr,cp,sp,cy,sy));
    // face normal from the first three points
    const ax=q[1][0]-q[0][0], ay=q[1][1]-q[0][1], az=q[1][2]-q[0][2];
    const bx=q[2][0]-q[0][0], by=q[2][1]-q[0][1], bz=q[2][2]-q[0][2];
    let nx=ay*bz-az*by, ny=az*bx-ax*bz, nz=ax*by-ay*bx; const nl=Math.hypot(nx,ny,nz)||1; nx/=nl; ny/=nl; nz/=nl;
    let fill;
    if(f.part==='body'){
      if(nz < -0.05) continue;                         // back-face cull the closed fuselage
      const lit = 0.5 + 0.6*Math.max(0, nx*L[0]+ny*L[1]+nz*L[2]);
      fill = shadeHex(ny>0.45 ? under : color, lit);
    } else {
      // flat surfaces are double-sided: decide which side faces the viewer
      if(nz<0){ nx=-nx; ny=-ny; nz=-nz; }
      const lit = 0.55 + 0.55*Math.abs(nx*L[0]+ny*L[1]+nz*L[2]);
      if(f.part==='glass') fill = `rgba(${150*lit|0},${200*lit|0},${230*lit|0},0.95)`;
      else {
        // the wing's upper surface is the one whose normal points along body -y
        const top = xform([0,-1,0],cr,sr,cp,sp,cy,sy);
        const seeingTop = top[2] > 0 ? true : top[2] < 0 ? false : top[1] < 0;
        fill = shadeHex(f.part==='fin' || seeingTop ? color : under, lit);
      }
    }
    const z = q.reduce((s,v)=>s+v[2],0)/q.length;
    list.push({q, z, fill, f, nz});
  }
  list.sort((a,b)=>a.z-b.z);
  ctx.lineJoin='round';
  for(const it of list){
    ctx.fillStyle = flash ? '#fff' : it.fill;
    ctx.strokeStyle = 'rgba(10,20,30,.35)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); it.q.forEach((v,i)=> i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1])); ctx.closePath(); ctx.fill();
    if(it.f.part!=='body') ctx.stroke();
    // national markings on the wings, foreshortened with the wing
    if(it.f.ins && !flash){
      const c = it.q.reduce((s,v)=>[s[0]+v[0]/4,s[1]+v[1]/4],[0,0]);
      const rx = Math.hypot(it.q[1][0]-it.q[0][0], it.q[1][1]-it.q[0][1])*0.18 + 1;
      const ry = 3.2*Math.max(0.15, it.nz);
      const ang = Math.atan2(it.q[1][1]-it.q[0][1], it.q[1][0]-it.q[0][0]);
      ctx.save(); ctx.translate(c[0],c[1]); ctx.rotate(ang);
      if(nation==='us'){ ctx.fillStyle='#f4f4f0'; ctx.beginPath(); ctx.ellipse(0,0,Math.min(rx,3.4),ry,0,0,7); ctx.fill(); ctx.fillStyle='#1d3a6e'; ctx.beginPath(); ctx.ellipse(0,0,Math.min(rx,3.4)*0.5,ry*0.5,0,0,7); ctx.fill(); }
      else { ctx.fillStyle='#c4231c'; ctx.beginPath(); ctx.ellipse(0,0,Math.min(rx,3.6),ry,0,0,7); ctx.fill(); }
      ctx.restore();
    }
  }
  // spinning propeller: a disc in the body's y-z plane at the nose
  if(prop){
    const c = xform([M.len+1.5,0,0],cr,sr,cp,sp,cy,sy);
    const ax = xform([0,0,1],cr,sr,cp,sp,cy,sy), ay = xform([0,1,0],cr,sr,cp,sp,cy,sy);
    ctx.fillStyle='rgba(40,40,40,.28)'; ctx.beginPath();
    for(let i=0;i<=24;i++){ const a=i/24*Math.PI*2, r=10; const x=c[0]+(ax[0]*Math.cos(a)+ay[0]*Math.sin(a))*r, y=c[1]+(ax[1]*Math.cos(a)+ay[1]*Math.sin(a))*r; i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.fill();
    ctx.fillStyle='#2a2a2a'; ctx.beginPath(); ctx.arc(c[0],c[1],1.6,0,7); ctx.fill();
  }
}
