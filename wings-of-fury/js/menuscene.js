// ---- Home-screen backdrop: a short air battle at sunset, on a loop ----
// Drawn behind the menus whenever no mission is running. Every element is a pure function of the clock (no
// particles, no saved state), so it is cheap, runs the same at any frame rate and loops forever:
//  - a dusk sky with a low sun and its glint on the sea, drifting two-tone clouds, distant islands
//  - our carrier on the horizon, and a burning enemy island with a smoke column and flak bursting above it
//  - a formation of three American aircraft passing high and small, trailing contrails (every 24 s)
//  - every 13 s a dogfight: a Hellcat and its wingman chase a Zero out from behind the menu, the Hellcat opens
//    fire, the Zero trails smoke, explodes and falls burning into the sea, and the pair pull up and climb away
// The fight is staged on the side of the screen that the menu leaves open (left in Hebrew, right in English).
const MS = {cycle:13, hit:7, lag:1.0};
const msHash = n => { const h = Math.sin(n*12.9898)*43758.5453; return h - Math.floor(h); };
const MS_WEATHER = {time:'dusk', rain:0, flash:0, wind:0};

function drawMenuScene(ctx, cw, ch, t){
  if(!cw || !ch) return;
  const scale = ch/H, vw = cw/scale, rtl = document.documentElement.dir !== 'ltr';
  const open = rtl ? vw*0.3 : vw*0.7;                  // middle of the part of the screen the menu leaves open
  const sunX = rtl ? vw*0.16 : vw*0.84;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  msSky(ctx, vw, t, sunX);
  msFarIslands(ctx, vw);
  for(let i=0;i<6;i++){                                 // clouds drifting slowly across
    const span = vw + 500, x = ((msHash(i)*span + t*(5 + i*1.6)) % span) - 250, y = 70 + msHash(i+9)*230;
    drawCloud(ctx, x, y, 0.7 + msHash(i+20)*0.8, MS_WEATHER);
  }
  msBurningIsland(ctx, rtl ? vw*0.6 : vw*0.4, t);
  msSea(ctx, vw, t, sunX);
  msCarrier(ctx, rtl ? vw*0.42 : vw*0.58, t);
  msFormation(ctx, vw, t, rtl);
  msDogfight(ctx, vw, t, rtl, open);
  drawVignette(ctx, vw, false);
}

function msSky(ctx, vw, t, sunX){
  const g = ctx.createLinearGradient(0, 0, 0, SEA);
  g.addColorStop(0, '#141a3c'); g.addColorStop(0.45, '#4a2f5c'); g.addColorStop(0.8, '#c4614f'); g.addColorStop(1, '#f39a55');
  ctx.fillStyle = g; ctx.fillRect(0, 0, vw, SEA);
  ctx.fillStyle = '#fff';                               // a few stars still out in the dark top of the sky
  for(let i=0;i<50;i++){ ctx.globalAlpha = (0.12 + 0.3*msHash(i+3))*(0.6 + 0.4*Math.sin(t*1.5 + i)); ctx.fillRect(msHash(i)*vw, msHash(i+50)*SEA*0.33, 1.4, 1.4); }
  ctx.globalAlpha = 1;
  const sy = SEA - 58, r = 44;                          // the low sun with its halo, thin cloud bands across it
  const halo = ctx.createRadialGradient(sunX, sy, r*0.7, sunX, sy, r*5);
  halo.addColorStop(0, 'rgba(255,190,120,.55)'); halo.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = halo; ctx.fillRect(sunX - r*5, sy - r*5, r*10, r*10);
  const sg = ctx.createLinearGradient(0, sy - r, 0, sy + r); sg.addColorStop(0, '#ffe0a8'); sg.addColorStop(1, '#ff9248');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sunX, sy, r, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(120,60,80,.45)';
  for(let i=0;i<3;i++) ctx.fillRect(sunX - r*1.6 + i*12, sy - 6 + i*13, r*2.6 - i*18, 2.2);
  const hz = ctx.createLinearGradient(0, SEA - 90, 0, SEA);   // haze at the horizon
  hz.addColorStop(0, 'rgba(250,160,110,0)'); hz.addColorStop(1, 'rgba(250,160,110,.45)');
  ctx.fillStyle = hz; ctx.fillRect(0, SEA - 90, vw, 90);
}

function msFarIslands(ctx, vw){
  ctx.fillStyle = 'rgba(70,45,80,.75)';
  for(const [u, w, h] of [[0.04, 260, 22], [0.3, 180, 14], [0.7, 320, 26], [0.93, 200, 16]]){
    const x = vw*u;
    ctx.beginPath(); ctx.moveTo(x - w/2, SEA + 1);
    ctx.quadraticCurveTo(x - w*0.2, SEA - h*1.2, x, SEA - h); ctx.quadraticCurveTo(x + w*0.25, SEA - h*0.9, x + w/2, SEA + 1); ctx.fill();
  }
}

// An enemy island on the horizon, set on fire by an earlier strike: a red glow, a column of smoke leaning with the
// wind, and anti-aircraft fire bursting above it now and then
function msBurningIsland(ctx, x, t){
  ctx.fillStyle = '#2c1d33';
  ctx.beginPath(); ctx.moveTo(x - 150, SEA + 1); ctx.quadraticCurveTo(x - 60, SEA - 46, x + 10, SEA - 40); ctx.quadraticCurveTo(x + 80, SEA - 30, x + 140, SEA + 1); ctx.fill();
  const fl = 0.75 + 0.25*Math.sin(t*9) * Math.sin(t*5.3);
  const glow = ctx.createRadialGradient(x, SEA - 40, 0, x, SEA - 40, 46);
  glow.addColorStop(0, `rgba(255,150,60,${0.75*fl})`); glow.addColorStop(1, 'rgba(255,90,40,0)');
  ctx.fillStyle = glow; ctx.fillRect(x - 46, SEA - 86, 92, 92);
  for(let i=0;i<16;i++){                                // the smoke column (same idea as drawSmokePillars)
    const p = (t*0.12 + i/16) % 1, y = SEA - 44 - p*230, sx = x + p*p*90 + Math.sin(t*0.8 + i*2)*4*p;
    softSmoke(ctx, '#1f1820', sx, y, 8 + p*40, 0.5*(1 - p)*Math.min(1, p*6));
  }
  for(let k=0;k<4;k++){                                 // flak: each burst flashes, then hangs as a dark puff
    const per = 2.6 + k*0.7, ph = ((t + k*1.1) % per)/per, n = Math.floor((t + k*1.1)/per);
    const bx = x - 120 + msHash(n*7 + k)*260, by = SEA - 160 - msHash(n*3 + k + 1)*200;
    if(ph < 0.06){ const q = ph/0.06; ctx.fillStyle = `rgba(255,220,140,${1 - q})`; ctx.beginPath(); ctx.arc(bx, by, 4 + q*6, 0, 7); ctx.fill(); }
    softSmoke(ctx, '#1c1618', bx, by, 6 + ph*12, 0.8*(1 - ph));
  }
}

function msSea(ctx, vw, t, sunX){
  const g = ctx.createLinearGradient(0, SEA, 0, H); g.addColorStop(0, '#6c4660'); g.addColorStop(1, '#1a1830');
  ctx.fillStyle = g; ctx.fillRect(0, SEA, vw, H - SEA);
  ctx.fillStyle = 'rgba(255,200,150,.3)'; ctx.fillRect(0, SEA, vw, 1.5);
  ctx.fillStyle = 'rgba(10,8,25,.16)';                  // slow swell bands
  for(let row=0; row<3; row++){
    const yy = SEA + 14 + row*22, ph = t*0.6 + row*2;
    ctx.beginPath(); ctx.moveTo(0, yy + 12);
    for(let x = 0; x <= vw + 40; x += 40) ctx.lineTo(x, yy + Math.sin(x*0.012 + ph)*3);
    ctx.lineTo(vw + 40, yy + 12); ctx.closePath(); ctx.fill();
  }
  for(let i=0;i<16;i++){                                // the sun's path on the water
    const y = SEA + 3 + i*5, spread = 18 + i*10;
    for(let j=0;j<3;j++){
      const x = sunX + Math.sin(i*12.9898 + j*78.233)*spread + Math.sin(t*1.7 + i*1.9)*4, len = (12 + (i*j)%9)*(1 - i/20);
      ctx.fillStyle = `rgba(255,200,140,${(1 - i/16)*(0.5 + 0.45*Math.sin(t*3 + i + j*2))})`; ctx.fillRect(x - len/2, y, len, 1.6);
    }
  }
}

// Our carrier as a dark silhouette against the sunset, deck lights on, smoke from the funnel
function msCarrier(ctx, x, t){
  const L = 150, d = SEA - 14;
  ctx.fillStyle = 'rgba(15,10,25,.35)'; ctx.fillRect(x - L/2, SEA + 2, L, 6);        // reflection
  ctx.fillStyle = '#211827';
  ctx.beginPath(); ctx.moveTo(x - L/2 - 6, d); ctx.lineTo(x + L/2 + 12, d); ctx.lineTo(x + L/2, SEA + 2); ctx.lineTo(x - L/2 + 6, SEA + 2); ctx.closePath(); ctx.fill();
  ctx.fillRect(x + 18, d - 16, 18, 16); ctx.fillRect(x + 22, d - 24, 9, 8); ctx.fillRect(x + 26, d - 34, 1.4, 10);   // island, funnel, mast
  ctx.fillStyle = 'rgba(255,210,140,.85)';
  for(let i=0;i<7;i++) ctx.fillRect(x - L/2 + 8 + i*20, d + 4, 2, 1.4);
  for(let i=0;i<6;i++){ const p = (t*0.25 + i/6) % 1; softSmoke(ctx, '#3a2c38', x + 26 + p*30, d - 26 - p*40, 3 + p*12, 0.45*(1 - p)); }
}

// Draw an aircraft at (x, y) heading along (dx, dy), kept upright whichever way it flies
function msPlane(ctx, type, x, y, dx, dy, s, extra){
  const dir = dx < 0 ? -1 : 1, ang = Math.atan2(dy, Math.abs(dx));
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(ang);
  drawPlane(ctx, type, null, null, s, false, true);
  if(extra) extra(ctx);
  ctx.restore();
}

// Three American aircraft in formation, high and small, with contrails (every 24 s, across the whole screen)
function msFormation(ctx, vw, t, rtl){
  const per = 24, ph = (t % per)/per, d = rtl ? -1 : 1, span = vw + 700;
  const lead = d > 0 ? -300 + ph*span : vw + 300 - ph*span, y = 120 + Math.sin(t*0.5)*4;
  [['hellcat', 0, 0], ['corsair', -40, 14], ['avenger', -80, 28]].forEach(([type, back, down]) => {
    const x = lead + d*back, yy = y + down;
    for(let k=0;k<10;k++){                              // contrail: a fading line behind the plane
      ctx.strokeStyle = `rgba(255,235,225,${0.35*(1 - k/10)})`; ctx.lineWidth = 1.4 + k*0.2;
      ctx.beginPath(); ctx.moveTo(x - d*(14 + k*16), yy); ctx.lineTo(x - d*(14 + (k+1)*16), yy); ctx.stroke();
    }
    msPlane(ctx, type, x, yy, d, 0, 0.55);
  });
}

// The dogfight. τ runs 0..cycle; the Zero is hit at MS.hit, right in the middle of the open side of the screen.
function msDogfight(ctx, vw, t, rtl, open){
  const tau = t % MS.cycle, d = rtl ? -1 : 1, x0 = d > 0 ? -140 : vw + 140, v = Math.abs(open - x0)/MS.hit;
  const path = s => ({x: x0 + d*v*s, y: 290 + Math.sin(s*1.1)*48 + Math.sin(s*0.53 + 1)*24});
  const vel = s => { const a = path(s - 0.02), b = path(s + 0.02); return {x:(b.x - a.x)/0.04, y:(b.y - a.y)/0.04}; };
  const th = MS.hit, tf = th + 0.35, hurt = th - 0.9;
  // the Zero: on its path, then (after the explosion) falling in a burning spin until it reaches the sea
  const f0 = path(tf), fv = vel(tf), G0 = 230;
  const vy0 = fv.y*0.8, tImpact = tf + (-vy0 + Math.sqrt(vy0*vy0 + 2*G0*(SEA - f0.y)))/G0;   // y(s) reaches SEA
  const zeroAt = s => s <= tf ? path(s) : {x: f0.x + fv.x*0.8*(s - tf), y: f0.y + fv.y*0.8*(s - tf) + 0.5*G0*(s - tf)**2};
  // the Hellcat follows the Zero's path a little behind, then pulls up and climbs away; its wingman stays on it
  const tb = th + MS.lag + 0.3, b0 = path(tb - MS.lag), bv = vel(tb - MS.lag);
  const hellAt = s => s <= tb ? path(s - MS.lag) : {x: b0.x + bv.x*(s - tb), y: b0.y + bv.y*(s - tb) - 0.5*300*(s - tb)**2};
  const hellVel = s => { const a = hellAt(s - 0.02), b = hellAt(s + 0.02); return {x:(b.x - a.x)/0.04, y:(b.y - a.y)/0.04}; };
  const zVel = s => { const a = zeroAt(s - 0.02), b = zeroAt(s + 0.02); return {x:(b.x - a.x)/0.04, y:(b.y - a.y)/0.04}; };

  // smoke trail behind the Zero from the first hits on, then fire
  if(tau > hurt && tau < tImpact + 1.5){
    for(let k=22;k>=1;k--){
      const s = tau - k*0.07; if(s < hurt || s > tImpact) continue;
      const p = zeroAt(s), burn = s > th;
      softSmoke(ctx, burn ? '#1a1414' : '#3a3432', p.x, p.y, (burn ? 6 : 4) + k*0.9, (burn ? 0.7 : 0.45)*(1 - k/22));
    }
  }
  // the Zero itself
  if(tau < tImpact){
    const z = zeroAt(tau), zv = zVel(tau);
    if(tau <= tf) msPlane(ctx, 'zero', z.x, z.y, zv.x, zv.y, 1.5);
    else { ctx.save(); ctx.translate(z.x, z.y); ctx.rotate((tau - tf)*5*d + Math.atan2(zv.y, zv.x)); drawPlane(ctx, 'zero', null, null, 1.5, false, false); ctx.restore(); }
    if(tau > th){ const fl = 6 + Math.sin(tau*40)*2; ctx.fillStyle = 'rgba(255,150,50,.9)'; ctx.beginPath(); ctx.arc(z.x, z.y, fl, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,180,.9)'; ctx.beginPath(); ctx.arc(z.x, z.y, fl*0.4, 0, 7); ctx.fill(); }
    if(tau > hurt && tau < th && (tau*5) % 1 < 0.5){ ctx.fillStyle = '#ffe28a'; for(let i=0;i<3;i++) ctx.fillRect(z.x - 8 + msHash(i + Math.floor(tau*20))*16, z.y - 4 + msHash(i + 7 + Math.floor(tau*20))*8, 2, 2); }
  }
  // the explosion when the Zero is finished: a flash, a fireball, a ring and sparks
  if(tau > th && tau < th + 1.1){
    const k = (tau - th)/1.1, p = path(th);
    if(k < 0.07){ ctx.fillStyle = `rgba(255,252,235,${0.9*(1 - k/0.07)})`; ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, 7); ctx.fill(); }
    const r = 12 + k*38, g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, `rgba(255,240,190,${1 - k})`); g.addColorStop(0.5, `rgba(255,140,40,${0.85*(1 - k)})`); g.addColorStop(1, 'rgba(150,40,10,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
    if(k < 0.25){ ctx.strokeStyle = `rgba(255,235,210,${0.3*(1 - k/0.25)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 20 + k*110, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#ffcf5a';
    for(let i=0;i<14;i++){ const a = msHash(i)*Math.PI*2, sp = 60 + msHash(i + 30)*140, e = tau - th;
      ctx.globalAlpha = 1 - k; ctx.fillRect(p.x + Math.cos(a)*sp*e - 1.5, p.y + Math.sin(a)*sp*e + 120*e*e - 1.5, 3, 3); }
    ctx.globalAlpha = 1;
  }
  // the splash where the wreck hits the sea
  if(tau > tImpact && tau < tImpact + 1.3){
    const k = (tau - tImpact)/1.3, x = zeroAt(tImpact).x;
    ctx.fillStyle = `rgba(240,235,235,${0.9*(1 - k)})`;
    for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.ellipse(x + i*8, SEA - 46*Math.sin(Math.min(1, k*1.6)*Math.PI)*(1 - Math.abs(i)*0.22), 3.5, 13*(1 - k) + 2, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = `rgba(255,240,230,${0.6*(1 - k)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, SEA + 3, 10 + k*40, 2 + k*3, 0, 0, 7); ctx.stroke();
  }
  // the Hellcat (firing in bursts as it closes) and its wingman, a Corsair, slightly behind and above
  if(tau < tb + 3){
    const firing = tau > hurt - 0.7 && tau < th && (tau*4) % 1 < 0.6;
    const w = hellAt(tau - 0.3), wv = hellVel(tau - 0.3);
    msPlane(ctx, 'corsair', w.x - d*40, w.y - 54, wv.x, wv.y, 1.25);
    const hp = hellAt(tau), hv = hellVel(tau);
    msPlane(ctx, 'hellcat', hp.x, hp.y, hv.x, hv.y, 1.55, firing ? c => {
      const mg = c.createRadialGradient(41, 1, 0, 41, 1, 11); mg.addColorStop(0, 'rgba(255,250,210,.95)'); mg.addColorStop(1, 'rgba(255,150,40,0)');
      c.fillStyle = mg; c.beginPath(); c.arc(41, 1, 11, 0, 7); c.fill();
    } : null);
    if(firing){                                          // tracers streaming from the Hellcat to the Zero
      const z = zeroAt(tau); ctx.strokeStyle = '#ffe58a'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
      for(let i=0;i<6;i++){ const q = ((tau*5 + i/6) % 1), ex = (msHash(i + 3) - 0.5)*14;
        const bx = hp.x + (z.x - hp.x)*q, by = hp.y + (z.y - hp.y + ex)*q, ux = (z.x - hp.x), uy = (z.y - hp.y), ul = Math.hypot(ux, uy) || 1;
        ctx.moveTo(bx, by); ctx.lineTo(bx - ux/ul*12, by - uy/ul*12); }
      ctx.stroke();
    }
  }
}
