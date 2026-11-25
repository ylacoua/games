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
// VIEW_ZOOM brings the camera 10% closer: aircraft and targets read bigger, and what is cut off is the empty sky
// at the top of the low-altitude view (the sea line stays at the bottom; climbing still zooms out as before).
const VIEW_ZOOM = 1.1;
function viewMetrics(cw, ch){
  const top0 = G ? G.cam.top : 0, full = Math.min(H - top0, H*2.2);
  const viewH = full / VIEW_ZOOM, top = top0 + full - viewH, scale = ch/viewH;
  return {top, viewH, scale, vw: cw/scale};
}

// Several draw functions (ships' funnels, burning wrecks, tank dust...) add smoke puffs with a fixed chance per
// drawn frame. While drawing, puff() keeps each one only with chance RENDER_FX.keep = frame time / (1/60 s), so the
// amount of smoke is the same on a 60, 120 or 144 Hz screen.
const RENDER_FX = {drawing:false, keep:1, last:0};
function render(ctx, cw, ch){
  const now = performance.now();
  RENDER_FX.keep = RENDER_FX.last ? clamp((now - RENDER_FX.last)/(1000/60), 0.05, 1) : 1;
  RENDER_FX.last = now; RENDER_FX.drawing = true;
  try{ renderScene(ctx, cw, ch); } finally { RENDER_FX.drawing = false; }
}
function renderScene(ctx, cw, ch){
  const vm = viewMetrics(cw, ch), {scale, vw} = vm;
  const hs = ch/H, hvw = cw/hs;                       // fixed screen-space scale for HUD and overlays
  // impacts near the aircraft shake the view (trauma-based, see entities.js); camera only, the world never moves
  const so = shakeOffset(), top = vm.top + so.y;
  const camX = G.cam.x + so.x, W = G.weather, sky = SKY[W.time];
  const stormy = W.rain>0.5 && W.time!=='night';
  // sky, in world coordinates so it darkens toward the stratosphere
  ctx.setTransform(scale,0,0,scale,-camX*scale,-top*scale);
  const skyTop = CEIL-250, g = ctx.createLinearGradient(0,skyTop,0,SEA);
  g.addColorStop(0, W.time==='night' ? '#000208' : stormy ? '#232a31' : '#173a68');
  g.addColorStop((0-skyTop)/(SEA-skyTop), stormy?'#3d4854':sky.top); g.addColorStop(1, stormy?'#7d8892':sky.bot);
  ctx.fillStyle=g; ctx.fillRect(camX-10,top-10,vw+20,SEA-top+10);
  // stars, sun and moon stay fixed on the screen. They sit below the HUD panels (which end ~115 px down):
  // the day sun and the moon used to hide behind the top-right panel.
  ctx.setTransform(hs,0,0,hs,0,0);
  const sun = celestial(W, stormy, hvw);
  if(W.time==='night'){ ctx.fillStyle='#fff'; for(let i=0;i<90;i++){ const sx=((i*397.3 - camX*0.05)%hvw+hvw)%hvw, sy=(i*131.7)%(SEA-120); ctx.globalAlpha=0.3+0.5*((i*7)%5)/5; ctx.fillRect(sx,sy,1.5,1.5);} ctx.globalAlpha=1; }
  if(sun){
    const halo = ctx.createRadialGradient(sun.x, sun.y, sun.r*0.6, sun.x, sun.y, sun.r*4.5);   // soft glow around it
    halo.addColorStop(0, sun.glow); halo.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = halo; ctx.fillRect(sun.x - sun.r*4.5, sun.y - sun.r*4.5, sun.r*9, sun.r*9);
    ctx.fillStyle = sun.c; ctx.beginPath(); ctx.arc(sun.x, sun.y, sun.r, 0, 7); ctx.fill();
  }
  // world
  ctx.setTransform(scale,0,0,scale,-camX*scale,-top*scale);
  drawFarIslands(ctx, camX, vw, W);                    // low hills on the horizon, barely moving: depth
  drawHaze(ctx, camX, vw, top, W, sky, stormy);         // the air thickens toward the horizon
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
  if(sun) drawGlint(ctx, camX + sun.x*hs/scale, x0, x1, sun, W);   // the sun's (or moon's) path on the water
  drawReflections(ctx, x0, x1, W);                     // dark, rippling reflections under the hulls and islands
  if(W.rain > 0) drawRainSplashes(ctx, x0, x1, W);
  for(const is of G.islands) if(is.x1>x0 && is.x0<x1){ drawIsland(ctx, is, x0, x1); drawShoreFoam(ctx, is, W); }
  drawCarrier(ctx, G.carrier);
  if(G.carrier2) drawCarrier(ctx, G.carrier2);
  drawSmokePillars(ctx, x0, x1, W);                    // destroyed targets keep burning: tall smoke behind them
  for(const s of G.structures) if(s.x>x0-100 && s.x<x1+100) drawStruct(ctx, s);
  for(const sh of G.ships) if(sh.x+sh.w>x0 && sh.x-sh.w<x1) drawShip(ctx, sh);
  drawRemains(ctx);
  for(const so of G.soldiers) drawSoldier(ctx, so);
  if(G.ground) drawGround(ctx);
  if(G.special) specialDraw(ctx);                      // special-mission objects: boats, convoy, bridge, train...
  if(W.time==='dawn' && !stormy) drawFog(ctx, x0, x1, W);   // morning mist lying low over the water
  drawShadows(ctx, W);                                 // aircraft flying low cast a shadow on the water / ground
  // projectiles
  ctx.lineCap='round';
  for(const s of G.shots){ ctx.strokeStyle = s.team==='p'?'#ffe58a':'#ff8f6b'; ctx.lineWidth = s.small ? 1 : 2; ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x-s.vx*0.012, s.y-s.vy*0.012); ctx.stroke(); }
  for(const f of G.flak){ ctx.fillStyle='#2a2a2a'; ctx.fillRect(f.x-2,f.y-2,4,4); }
  for(const d of G.drops) drawDrop(ctx, d);
  // aircraft
  for(const w of G.wingmen) if(!w.dead) drawAI(ctx, w, w.kind, 1, w.flash, w.gear||0);
  drawChutes(ctx);                                     // pilots who bailed out, and the rescue launch (bailout.js)
  for(const e of G.enemies){
    if(e.type==='zero') drawAI(ctx, e, 'zero', 1, e.flash);
    else if(e.type==='betty') drawAI(ctx, e, 'betty', 1, e.flash);
    else if(e.type==='val') drawAI(ctx, e, 'val', 1, e.flash, 1);   // the D3A had fixed, spatted landing gear
    else if(e.type==='emily') drawEmily(ctx, e);
    if(e.burning && !e.dead){                          // badly hit: flames licking back from the engine
      const bx = e.x - Math.cos(e.a)*4, by = e.y - Math.sin(e.a)*4, fl = 3 + Math.random()*3;
      ctx.fillStyle = `rgba(255,${130 + (Math.random()*90|0)},40,.85)`; ctx.beginPath(); ctx.ellipse(bx, by, fl*1.4, fl*0.8, e.a, 0, 7); ctx.fill();
    }
  }
  const P = G.player;
  if(!P.dead){
    const a = heading(P);
    // lift the sprite so the wheels sit on the deck rather than sinking into it
    const lift = P.liftV ?? deckLift(G.stats.type, P.x, P.y, P.gear);   // smoothed in update() (main.js)
    ctx.save(); ctx.translate(P.x, P.y-lift);
    if(P.inv>0 && Math.floor(G.time*12)%2) ctx.globalAlpha=0.5;
    if(P.loop){
      // turn-around: a 3D model yaws through nose-toward-the-viewer and banks into the turn
      const t = P.loop.t, ease = t*t*(3-2*t);
      const yaw = (P.f>0 ? 0 : Math.PI) + (P.f>0 ? -1 : 1)*Math.PI*ease;
      const roll = -Math.sin(Math.PI*t)*0.75;
      drawPlane3D(ctx, G.stats.type, P.skin || null, 'us', yaw, roll, a, P.hitT>0, true);
    } else {
      drawPilotPlane(ctx, P, G.stats.type, 'us', a, P.hitT>0, P.throttle>0.05||P.speed>40, P.gear);
      drawPlayerDamage(ctx, P, a);                     // bullet holes, oil, a burning engine (render.js)
    }
    if(P.muzzle > 0 && !P.loop){                       // muzzle flash from the wing guns
      const cx = P.f*Math.cos(a), cy = -Math.sin(a), mx = cx*27, my = cy*27 + 1;   // just ahead of the propeller disc
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 9);
      mg.addColorStop(0, 'rgba(255,250,210,.95)'); mg.addColorStop(0.4, 'rgba(255,200,80,.8)'); mg.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 9, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  // effects
  for(const d of G.debris){
    ctx.fillStyle=d.c;
    if(d.spark){ ctx.globalAlpha=Math.min(1,d.life*3); ctx.fillRect(d.x-1.5,d.y-1.5,3,3); }
    else { ctx.save(); ctx.translate(d.x,d.y); ctx.rotate(d.r); ctx.fillRect(-4,-2,8,4);
      if(d.burn){ ctx.fillStyle = `rgba(255,${150+Math.floor(Math.random()*80)},40,.9)`; ctx.fillRect(-2,-3,4,3); }   // still on fire
      ctx.restore(); }
    ctx.globalAlpha=1;
  }
  for(const f of G.fx) drawFx(ctx, f);
  if(G.special) specialDrawOver(ctx);                  // drawn above the aircraft: flames, flares, sun glare
  ctx.restore();

  // night / dusk lighting
  if(sky.dark>0.3) drawDarkness(ctx, cw, ch, scale, camX, sky.dark, top);
  const vw0 = vw; { const vw = hvw; ctx.setTransform(hs,0,0,hs,0,0);
  // dawn and dusk: everything (aircraft, ships, buildings) takes on the warm low light, multiplied over the picture,
  // then the usual slight purple dimming
  if(W.time==='dawn' || W.time==='dusk'){
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = stormy ? 0.25 : 0.5;
    ctx.fillStyle = W.time==='dawn' ? 'rgb(255,214,188)' : 'rgb(255,186,160)'; ctx.fillRect(0,0,vw,H);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  if(sky.dark>0 && sky.dark<=0.3){ ctx.fillStyle=`rgba(40,20,60,${sky.dark})`; ctx.fillRect(0,0,vw,H); }
  if(stormy){ ctx.fillStyle='rgba(30,40,50,.18)'; ctx.fillRect(0,0,vw,H); }
  // a soft darkening toward the screen edges frames the action, like the title painting (not at night: the dark
  // layer already does it)
  if(W.time!=='night') drawVignette(ctx, vw, stormy);
  drawSpeedLines(ctx, vw, P);
  if(G.time < 3.4) drawMissionIntro(ctx, vw);
  // rain
  if(W.rain>0){
    ctx.strokeStyle='rgba(190,210,230,.45)'; ctx.lineWidth=1; ctx.beginPath();
    const n = Math.floor(G.rain.length*W.rain), slant = W.wind*0.25 - 4;
    for(let i=0;i<n;i++){ const r=G.rain[i]; const rx=((r.x*vw + slant*r.y*10 - camX*0.3)%vw+vw)%vw, ry=r.y*H; ctx.moveTo(rx,ry); ctx.lineTo(rx+slant,ry+16); }
    ctx.stroke();
  }
  // full-screen flashes; with "flashes: reduced" (or the system's reduce-motion) they become a faint tint,
  // and the hit warning becomes a red frame around the edge of the screen instead of a full red wash
  const flashes = SAVE.flashes !== false;
  if(W.flash>0){ ctx.fillStyle=`rgba(230,235,255,${W.flash*(flashes ? 0.6 : 0.12)})`; ctx.fillRect(0,0,vw,H); }
  if(P.hitT>0){
    if(flashes){ ctx.fillStyle='rgba(200,40,30,.18)'; ctx.fillRect(0,0,vw,H); }
    else { ctx.strokeStyle='rgba(200,40,30,.55)'; ctx.lineWidth=10; ctx.strokeRect(5,5,vw-10,H-10); }
  }
  drawHUD(ctx, vw, vw0);
  drawTutorial(ctx, vw);
  drawDefenseHUD(ctx, vw);
  drawGroundHUD(ctx, vw);
  if(G.special) drawSpecialHUD(ctx, vw);
  }
}

// sun / moon on the screen (HUD units), or null in a storm. Kept clear of the HUD panels in the top corners.
function celestial(W, stormy, hvw){
  if(W.time==='night') return {x:hvw*0.78, y:165, r:22, c:'#e9e6d4', glow:'rgba(220,225,255,.16)', glint:'rgba(220,230,255,.35)'};
  if(stormy) return null;
  if(W.time==='day')  return {x:hvw*0.84, y:175, r:32, c:'rgba(255,250,220,.95)', glow:'rgba(255,248,215,.35)', glint:'rgba(255,250,225,.55)'};
  return {x: W.time==='dawn' ? hvw*0.15 : hvw*0.85, y:SEA-90, r:34, c:'rgba(255,200,140,.95)', glow:'rgba(255,170,110,.4)', glint:'rgba(255,190,130,.6)'};
}

// Clouds: a shaded underside under a lit top, so they read as volumes rather than flat cut-outs
function drawCloud(ctx, x, y, s, W){
  const night = W.time==='night', rain = W.rain>0.5;
  const top = night ? 'rgba(60,70,95,.35)' : rain ? 'rgba(90,100,110,.7)' : W.time==='day' ? 'rgba(255,255,255,.8)' : 'rgba(255,195,165,.5)';
  const base = night ? 'rgba(30,36,52,.35)' : rain ? 'rgba(55,62,70,.7)' : W.time==='day' ? 'rgba(196,210,226,.8)' : 'rgba(150,100,120,.45)';
  ctx.fillStyle = base; ctx.beginPath();
  ctx.ellipse(x, y+3*s, 62*s, 15*s, 0, 0, 7); ctx.ellipse(x-30*s, y+7*s, 34*s, 11*s, 0, 0, 7); ctx.ellipse(x+28*s, y-2*s, 38*s, 14*s, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = top; ctx.beginPath();
  ctx.ellipse(x, y-1*s, 56*s, 14*s, 0, 0, 7); ctx.ellipse(x-30*s, y+2*s, 30*s, 10*s, 0, 0, 7); ctx.ellipse(x+28*s, y-8*s, 34*s, 13*s, 0, 0, 7);
  ctx.ellipse(x+6*s, y-12*s, 26*s, 11*s, 0, 0, 7);
  ctx.fill();
  // lightning: the clouds light up from inside for a moment (dimmer with "flashes: reduced")
  if(W.flash > 0){
    ctx.fillStyle = `rgba(235,240,255,${W.flash*(SAVE.flashes !== false ? 0.55 : 0.15)})`; ctx.beginPath();
    ctx.ellipse(x, y, 46*s, 11*s, 0, 0, 7); ctx.ellipse(x+6*s, y-10*s, 22*s, 9*s, 0, 0, 7); ctx.fill();
  }
}

// Rain on the sea: tiny rings that open and fade where the drops land, scattered across the visible water
function drawRainSplashes(ctx, x0, x1, W){
  const n = Math.floor(70*W.rain), span = x1 - x0;
  ctx.strokeStyle = 'rgba(220,232,242,.5)'; ctx.lineWidth = 0.8;
  for(let i=0;i<n;i++){
    const tt = G.time*5 + i*0.37, ph = tt % 1, cyc = Math.floor(tt);
    const h = Math.sin(i*12.9898 + cyc*78.233)*43758.5453, u = h - Math.floor(h);   // a new spot every cycle
    const x = x0 + u*span, y = SEA + 3 + (i%4)*9;
    ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(x, y, 1 + ph*4, 0.6 + ph*1.2, 0, 0, 7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Dawn fog: a low white band over the sea and the foot of the islands, with a few soft banks drifting through it
function drawFog(ctx, x0, x1, W){
  const g = ctx.createLinearGradient(0, SEA - 80, 0, SEA + 30);
  g.addColorStop(0, 'rgba(240,230,225,0)'); g.addColorStop(0.6, 'rgba(240,230,225,.38)'); g.addColorStop(1, 'rgba(240,230,225,.15)');
  ctx.fillStyle = g; ctx.fillRect(x0, SEA - 80, x1 - x0, 110);
  const span = x1 - x0 + 400;
  for(let i=0;i<7;i++){
    const x = x0 - 200 + (((i*331 + G.time*(8 + i*2)) % span) + span) % span, y = SEA - 18 - (i%3)*12;
    softSmoke(ctx, '#f2e8e2', x, y, 60 + (i%3)*25, 0.35);
  }
}

// The island's two waterlines (where the ground meets the sea), found once per island
function shoreOf(is){
  if(is.shore) return is.shore;
  let l = is.x0, r = is.x1;
  while(l < is.x1 && groundY(l) >= SEA - 1) l += 4;
  while(r > is.x0 && groundY(r) >= SEA - 1) r -= 4;
  return (is.shore = [l, r]);
}

// Reflections: under each hull and island, a darker band of broken horizontal strokes that ripple sideways, so the
// objects sit in the water instead of on top of it. Drawn right after the sea, before the objects themselves.
function drawReflections(ctx, x0, x1, W){
  const night = W.time==='night';
  const band = (a, b, depth, rgb, alpha) => {
    if(b < x0 || a > x1) return;
    a = Math.max(a, Math.floor(x0/26)*26); b = Math.min(b, x1);   // only the part on screen (long coastlines)
    for(let i=0;i<5;i++){
      const y = SEA + 2 + i*depth/5, k = 1 - i/5, sh = Math.sin(G.time*2.2 + i*1.7)*3*(i+1)/3;
      ctx.fillStyle = `rgba(${rgb},${alpha*k})`;
      for(let x = a; x < b; x += 26){ const w = Math.min(20, b - x); ctx.fillRect(x + sh + (i%2)*6, y, w*(0.6 + 0.4*k), 1.6); }
    }
  };
  for(const C of carriers()) band(C.x - 20, C.x + C.len + 40, 22, night ? '0,0,0' : '20,26,36', night ? 0.3 : 0.3);
  for(const sh of G.ships) if(!sh.dead) band(sh.x - sh.w/2, sh.x + sh.w/2, 16, '20,26,36', 0.28);
  for(const is of G.islands){ const [l, r] = shoreOf(is); band(l + 10, r - 10, 18, night ? '10,12,8' : '70,80,40', 0.22); }
}

// Foam where the island meets the sea: a few white ovals that swell and fade in a slow rhythm on each side
function drawShoreFoam(ctx, is, W){
  const [l, r] = shoreOf(is), night = W.time==='night';
  for(const [x, dir] of [[l, -1], [r, 1]]){
    for(let i=0;i<4;i++){
      const ph = (G.time*0.5 + i*0.25 + (is.seed || 0)) % 1, fx = x + dir*(4 + i*9 + ph*6);
      ctx.fillStyle = night ? `rgba(160,180,200,${0.3*(1-ph)})` : `rgba(245,250,252,${0.75*(1-ph)})`;
      ctx.beginPath(); ctx.ellipse(fx, SEA + 1, 7 + ph*5, 1.6, 0, 0, 7); ctx.fill();
    }
  }
}

// Shadows: an aircraft below ~260 world units casts a soft dark oval straight down - on the sea, the island or
// the carrier's deck. It grows sharper and darker as the aircraft gets lower, which makes height easy to judge.
function drawShadows(ctx, W){
  if(W.time==='night') return;
  const base = W.time==='day' ? 0.32 : 0.2, decks = carriers();
  const one = (x, y, w) => {
    let gy = groundY(x);
    for(const C of decks) if(x > C.x - 20 && x < C.x + C.len + 40 && y < DECK_Y) gy = DECK_Y - 3;
    const h = gy - y; if(h < 6 || h > 260) return;
    const q = 1 - h/260;
    ctx.globalAlpha = base*q; ctx.beginPath(); ctx.ellipse(x, gy + 1.5, w*(0.55 + 0.45*q), 1.6 + 1.6*q, 0, 0, 7); ctx.fill();
  };
  ctx.fillStyle = '#081018';
  const P = G.player;
  if(!P.dead && !P.onDeck) one(P.x, P.y, 20);
  for(const w of G.wingmen) if(!w.dead && w.state === 'fly') one(w.x, w.y, 18);
  for(const e of G.enemies) if(!e.dead) one(e.x, e.y, e.type === 'zero' ? 16 : e.type === 'emily' ? 50 : 24);
  ctx.globalAlpha = 1;
}

// Damage you can see on your own aircraft (drawn in the plane's frame, nose toward +x): bullet holes from 60%
// strength, an oil streak along the fuselage from 40%, and the engine on fire below 22%.
function drawPlayerDamage(ctx, P, a){
  const k = P.hp/P.max, r = Math.abs(visRoll(P)); if(k > 0.6 || (r > 0.02 && r < Math.PI-0.02)) return;   // not mid-roll (3D model)
  ctx.save(); ctx.scale(P.f, 1); ctx.rotate(-a);
  if(r > 1) ctx.scale(1, -1);
  ctx.fillStyle = 'rgba(20,18,16,.85)';
  const holes = k < 0.35 ? 6 : 3;
  for(let i=0;i<holes;i++){ ctx.beginPath(); ctx.arc(-10 + i*4.3 + (i%2)*1.5, -1.5 + (i%3)*1.4, 0.9 + (i%2)*0.4, 0, 7); ctx.fill(); }
  if(k < 0.4){ ctx.strokeStyle = 'rgba(25,20,15,.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(8, 1); ctx.quadraticCurveTo(-4, 2.5, -18, 1.5); ctx.stroke(); }
  if(k < 0.22){
    const fl = 4 + Math.random()*3;
    ctx.fillStyle = `rgba(255,${130 + (Math.random()*90|0)},40,.9)`; ctx.beginPath(); ctx.ellipse(10, -1, fl, 2.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,170,.9)'; ctx.beginPath(); ctx.ellipse(12, -1, fl*0.4, 1.3, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// Mission start: the picture fades in from black, and the mission's name and difficulty appear across the
// middle of the screen for a moment (HUD units). G.time starts at 0 with every mission.
function drawMissionIntro(ctx, vw){
  const t = G.time;
  if(t < 0.7){ ctx.fillStyle = `rgba(5,9,15,${1 - t/0.7})`; ctx.fillRect(0, 0, vw, H); }
  const a = t < 0.35 ? 0 : t < 0.9 ? (t-0.35)/0.55 : t < 2.6 ? 1 : Math.max(0, 1 - (t-2.6)/0.8);
  if(a <= 0 || !G.def || !G.def.name) return;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.direction = 'rtl';
  const y = H*0.36, rise = (1 - Math.min(1, (t-0.35)/0.55))*8;
  ctx.fillStyle = 'rgba(5,9,15,.45)'; ctx.fillRect(0, y - 40, vw, 66);
  ctx.font = '34px "Secular One", Rubik, sans-serif'; ctx.fillStyle = '#e8b33a'; ctx.fillText(G.def.name, vw/2, y + rise);
  ctx.font = '15px Rubik, sans-serif'; ctx.fillStyle = '#efe6cf'; ctx.fillText(`רמת קושי: ${diff().name}`, vw/2, y + 20 + rise);
  ctx.restore();
}

// Speed lines: thin streaks racing past the edges of the screen at full speed or in a steep dive (HUD units).
// They follow the screen-shake setting, so "shake off" also turns them off.
function drawSpeedLines(ctx, vw, P){
  if(P.dead || P.onDeck) return;
  const top = G.stats.speed, k = clamp((P.speed - top*0.88)/(top*0.25), 0, 1) + (P.p < -0.7 ? clamp((P.speed - 150)/150, 0, 0.6) : 0);
  const amt = Math.min(1, k) * clamp(SAVE.shake ?? 1, 0, 1); if(amt <= 0.02) return;
  ctx.strokeStyle = `rgba(255,255,255,${0.22*amt})`; ctx.lineWidth = 1.2; ctx.beginPath();
  for(let i=0;i<18;i++){
    const row = (i*0.618) % 1, y = row < 0.5 ? row*H*0.6 + 30 : H - (row-0.5)*H*0.6 - 30;   // top and bottom bands only
    const span = vw + 240, x = (((i*397) - G.time*1500*P.f) % span + span) % span - 120, len = 50 + (i%4)*25;
    ctx.moveTo(x, y); ctx.lineTo(x + len*P.f, y);
  }
  ctx.stroke();
}

// ---- Soft smoke ----
// Every puff of smoke is a soft, round "cloud" image instead of a hard-edged circle: the image is painted once per
// colour (64x64, opaque core fading to nothing at the rim) and then stretched and faded with drawImage, which is
// also cheaper than building a path for each puff. The visible size is about 0.7 of the image, so callers pass
// the radius they used to draw and softSmoke enlarges it.
const SMOKE_SPR = new Map();
function smokeSprite(c){
  let s = SMOKE_SPR.get(c); if(s) return s;
  if(SMOKE_SPR.size > 48) SMOKE_SPR.clear();
  s = document.createElement('canvas'); s.width = s.height = 64;
  const g = s.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 64, 64);
  g.globalCompositeOperation = 'destination-in';          // keep the colour, take the alpha from a soft disc
  const m = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.45, 'rgba(0,0,0,.8)'); m.addColorStop(0.75, 'rgba(0,0,0,.3)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, 64, 64);
  SMOKE_SPR.set(c, s); return s;
}
function softSmoke(ctx, c, x, y, r, a){
  if(a <= 0.003 || r <= 0) return;
  const R = r*1.45, ga = ctx.globalAlpha; ctx.globalAlpha = Math.min(1, a*ga);
  ctx.drawImage(smokeSprite(c), x - R, y - R, R*2, R*2);
  ctx.globalAlpha = ga;
}

// A destroyed target keeps burning for a while: a column of smoke rises from it, leans with the wind, widens and
// thins out. Drawn from time alone (no particles), so it costs a few circles and looks the same at any frame rate.
// It is tall for the first half minute and dies down over the next.
function drawSmokePillars(ctx, x0, x1, W){
  const N = 16, wind = W.wind*0.6 + 14, night = W.time==='night';   // enough overlapping puffs to read as one column
  for(const s of G.structures){
    if(!s.dead || s.deadT == null || s.x < x0-200 || s.x > x1+200) continue;
    const age = G.time - s.deadT; if(age > 60 || age < 0) continue;
    const life = age < 30 ? Math.min(1, age*1.5) : 1 - (age-30)/30, seed = (s.x*0.013) % 1;
    const base = s.y - 6, tall = 150 + (s.w||30)*1.5;
    for(let i=0;i<N;i++){
      const p = (G.time*0.16 + i/N + seed) % 1;              // 0 at the fire, 1 at the top, then it starts again
      const y = base - p*tall*life, x = s.x + p*p*wind*3 + Math.sin(G.time*0.9 + i*2.1)*4*p;
      const r = 9 + p*34, a = (night ? 0.5 : 0.42)*(1-p)*life*Math.min(1, p*6);
      softSmoke(ctx, night ? '#121216' : '#2a2826', x, y, r, a);
    }
  }
}

// Distant islands: low blue-grey hills sitting on the horizon. They move at 12% of the camera's speed, so they
// read as far away; generated once per mission from the level length.
function drawFarIslands(ctx, camX, vw, W){
  if(!G.far){
    G.far = []; let x = -800;
    while(x < G.L*0.12 + 4000){ G.far.push({x, w:rnd(160,460), h:rnd(8,26), bump:rnd(0,6)}); x += rnd(700,1600); }
  }
  const col = {day:'rgba(92,128,156,.55)', dawn:'rgba(110,100,140,.55)', dusk:'rgba(95,72,110,.6)', night:'rgba(16,22,38,.8)'}[W.time];
  ctx.fillStyle = W.rain>0.5 && W.time!=='night' ? 'rgba(90,100,110,.45)' : col;
  const shift = camX*0.88;                              // world x = own x + 88% of the camera: 12% parallax
  for(const f of G.far){
    const x = f.x + shift; if(x + f.w < camX - 50 || x > camX + vw + 50) continue;
    ctx.beginPath(); ctx.moveTo(x, SEA+1);
    ctx.quadraticCurveTo(x + f.w*0.25, SEA - f.h*1.1, x + f.w*0.45, SEA - f.h);
    ctx.quadraticCurveTo(x + f.w*0.6, SEA - f.h - f.bump, x + f.w*0.75, SEA - f.h*0.7);
    ctx.quadraticCurveTo(x + f.w*0.9, SEA - f.h*0.3, x + f.w, SEA+1); ctx.fill();
  }
}

// The vignette is painted once into a small offscreen image (per screen shape and weather) and then stretched over
// the screen: a full-screen radial gradient every frame cost ~1.7 ms at 1600x900.
let vigCv = null, vigKey = '';
function drawVignette(ctx, vw, stormy){
  const w = 256, h = Math.max(32, Math.round(256*H/vw)), key = h + (stormy ? 's' : '');
  if(key !== vigKey){
    vigCv = vigCv || document.createElement('canvas'); vigCv.width = w; vigCv.height = h; vigKey = key;
    const v = vigCv.getContext('2d'), vg = v.createRadialGradient(w/2, h*0.55, Math.min(w, h)*0.45, w/2, h*0.55, Math.max(w, h)*0.8);
    vg.addColorStop(0, 'rgba(10,14,24,0)'); vg.addColorStop(1, `rgba(10,14,24,${stormy ? .35 : .24})`);
    v.fillStyle = vg; v.fillRect(0, 0, w, h);
  }
  ctx.drawImage(vigCv, 0, 0, vw, H);
}

// Haze: a band of the horizon colour fading up from the sea, which softens the hard sea/sky line
function drawHaze(ctx, camX, vw, top, W, sky, stormy){
  if(W.time==='night') return;
  const hz = stormy ? '125,136,146' : W.time==='day' ? '225,236,242' : W.time==='dawn' ? '245,180,130' : '235,140,100';
  const g = ctx.createLinearGradient(0, SEA-90, 0, SEA);
  g.addColorStop(0, `rgba(${hz},0)`); g.addColorStop(1, `rgba(${hz},${stormy ? .5 : .45})`);
  ctx.fillStyle = g; ctx.fillRect(camX-10, SEA-90, vw+20, 90);
}

// The sun's path on the sea: short bright dashes under it, widening and thinning toward the viewer
function drawGlint(ctx, sx, x0, x1, sun, W){
  if(sx < x0-200 || sx > x1+200) return;
  ctx.fillStyle = sun.glint;
  for(let i=0;i<14;i++){
    const y = SEA + 3 + i*5.5, spread = 14 + i*9, wob = Math.sin(G.time*1.7 + i*1.9);
    for(let j=0;j<3;j++){
      const x = sx + Math.sin(i*12.9898 + j*78.233)*spread + wob*4;
      const len = (10 + (i*j)%9) * (1 - i/18);
      ctx.globalAlpha = (1 - i/14) * (0.55 + 0.45*Math.sin(G.time*3 + i + j*2));
      ctx.fillRect(x - len/2, y, len, 1.6);
    }
  }
  ctx.globalAlpha = 1;
}

function drawSea(ctx, x0, x1, sky, W){
  const g = ctx.createLinearGradient(0,SEA,0,H); g.addColorStop(0,sky.sea1); g.addColorStop(1,sky.sea2);
  ctx.fillStyle=g; ctx.fillRect(x0,SEA,x1-x0,H-SEA);
  // a light line where the far sea meets the sky, and darker swell bands that drift slowly
  ctx.fillStyle = W.time==='night' ? 'rgba(120,140,180,.12)' : 'rgba(235,245,250,.28)'; ctx.fillRect(x0, SEA, x1-x0, 1.5);
  // in a storm the swell runs higher and faster, and its crests break into whitecaps
  const storm = W.rain > 0.5, swell = storm ? 7 : 3, speed = storm ? 1.4 : 0.6;
  ctx.fillStyle = storm ? 'rgba(0,15,30,.16)' : 'rgba(0,20,40,.10)';
  for(let row=0; row<3; row++){
    const yy = SEA + 16 + row*24, ph = G.time*speed + row*2;
    ctx.beginPath(); ctx.moveTo(x0, yy+12);
    for(let x = Math.floor(x0/40)*40; x <= x1+40; x += 40) ctx.lineTo(x, yy + Math.sin(x*0.012 + ph)*swell);
    ctx.lineTo(x1+40, yy+12); ctx.closePath(); ctx.fill();
    if(storm){
      ctx.fillStyle = 'rgba(235,242,246,.55)';
      for(let x = Math.floor(x0/40)*40; x <= x1+40; x += 40){ const s = Math.sin(x*0.012 + ph); if(s < -0.8) ctx.fillRect(x - 6, yy + s*swell - 1, 12 + (x%7), 1.6); }
      ctx.fillStyle = 'rgba(0,15,30,.16)';
    }
  }
  ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=1.5; ctx.beginPath();
  const amp = W.rain>0.5?3:1.5;
  for(let row=0;row<4;row++){
    const yy = SEA+6+row*18, off = G.time*(20+row*8)*(row%2?1:-1);
    for(let x=Math.floor(x0/60)*60; x<x1; x+=60){ const xx=x+((off+row*23)%60); ctx.moveTo(xx,yy+Math.sin(xx*0.05+G.time*2)*amp); ctx.lineTo(xx+18,yy+Math.sin(xx*0.05+G.time*2)*amp); }
  }
  ctx.stroke();
}

// vx0..vx1: the visible stretch of the world, so a long coastline (the mainland in "Bridge on the River")
// only draws what is on screen
function drawIsland(ctx, is, vx0=-Infinity, vx1=Infinity){
  const a = Math.max(is.x0, Math.floor((vx0-16)/8)*8), b = Math.min(is.x1, vx1+16);
  ctx.beginPath(); ctx.moveTo(a, SEA+2);
  for(let x=a; x<=b; x+=8) ctx.lineTo(x, groundY(x));
  ctx.lineTo(b, SEA+2); ctx.closePath();
  const night = G.weather.time==='night';
  ctx.fillStyle = night ? '#3c3829' : '#c8b07a'; ctx.fill();
  // shading on the same outline: the sand darkens toward the base (and lightens at the crest), so the island has
  // volume; then a band of wet, darker sand at the waterline and a few scattered stones and tufts
  const sh = ctx.createLinearGradient(0, SEA - (is.h || 110), 0, SEA);
  sh.addColorStop(0, night ? 'rgba(255,255,255,0)' : 'rgba(255,250,230,.18)'); sh.addColorStop(0.55, 'rgba(0,0,0,0)');
  sh.addColorStop(1, night ? 'rgba(0,0,0,.3)' : 'rgba(90,60,25,.32)');
  ctx.fillStyle = sh; ctx.fill();
  ctx.fillStyle = night ? 'rgba(0,0,0,.25)' : 'rgba(110,85,45,.35)'; ctx.fillRect(a, SEA-5, b-a, 7);
  if(!is.specks){ is.specks = []; for(let x = is.x0 + 12; x < is.x1 - 12; x += rnd(9, 26)) is.specks.push({x, d:rnd(4, 40), r:rnd(0.8, 2.2), c:Math.random() < 0.6}); }
  for(const dark of [true, false]){                    // one path per colour: two fills instead of one per speck
    ctx.fillStyle = dark ? (night ? 'rgba(0,0,0,.25)' : 'rgba(120,95,55,.45)') : (night ? 'rgba(255,255,255,.05)' : 'rgba(255,245,215,.35)');
    ctx.beginPath();
    for(const sp of is.specks){
      if(sp.c !== dark || sp.x < a || sp.x > b) continue;
      const y = groundY(sp.x) + sp.d; if(y > SEA-4) continue;
      ctx.moveTo(sp.x + sp.r*1.6, y); ctx.ellipse(sp.x, y, sp.r*1.6, sp.r, 0, 0, 7);
    }
    ctx.fill();
  }
  const ga = Math.max(is.x0+is.slope*0.6, a), gb = Math.min(is.x1-is.slope*0.6, b);
  ctx.beginPath();
  for(let x=ga; x<=gb; x+=8) ctx.lineTo(x, groundY(x)+1);
  for(let x=gb; x>=ga; x-=8) ctx.lineTo(x, groundY(x)+9);
  ctx.fillStyle = G.weather.time==='night' ? '#24331f' : '#5f8a3c'; ctx.fill();
  // scorch marks where bombs and burning targets hit the ground
  if(G.scorch){
    ctx.fillStyle = G.weather.time==='night' ? 'rgba(10,10,8,.6)' : 'rgba(40,32,24,.55)';
    for(const sc of G.scorch) if(sc.x > a-sc.w && sc.x < b+sc.w && sc.x > is.x0 && sc.x < is.x1){
      ctx.beginPath(); ctx.ellipse(sc.x, groundY(sc.x)+2, sc.w, 3.2, 0, 0, 7); ctx.fill(); }
  }
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
  // jungle: broadleaf trees and extra palms across the island (generated once per island)
  if(!is.trees){
    is.trees = [];
    for(let x = is.x0 + is.slope*0.5; x < is.x1 - is.slope*0.5; x += rnd(28,60))
      is.trees.push({x, s:rnd(0.7,1.35), palm: Math.random() < 0.35, hue: Math.floor(rnd(0,3))});
  }
  const greens = night ? ['#1f2d1a','#243320','#1a2716'] : ['#2f6a2c','#3c7a32','#2a5b28'];
  for(const tr of is.trees){
    if(tr.x < vx0-40 || tr.x > vx1+40) continue;
    const gy = groundY(tr.x), s = tr.s;
    if(tr.palm){
      const sway = Math.sin(G.time*1.5+tr.x)*2 + G.weather.wind*0.05;
      ctx.strokeStyle='#6b4f2c'; ctx.lineWidth=2.4*s; ctx.beginPath(); ctx.moveTo(tr.x,gy); ctx.quadraticCurveTo(tr.x+3*s,gy-14*s,tr.x+2*s+sway,gy-28*s); ctx.stroke();
      ctx.strokeStyle=greens[tr.hue]; ctx.lineWidth=2.2*s;
      for(let k=-2;k<=2;k++){ ctx.beginPath(); ctx.moveTo(tr.x+2*s+sway,gy-28*s); ctx.quadraticCurveTo(tr.x+k*7*s+sway,gy-35*s,tr.x+k*11*s+sway,gy-25*s+Math.abs(k)*3); ctx.stroke(); }
    } else {
      ctx.fillStyle='#5a4128'; ctx.fillRect(tr.x-1.2*s, gy-12*s, 2.4*s, 12*s);                                   // trunk
      ctx.fillStyle=greens[tr.hue];
      ctx.beginPath(); ctx.arc(tr.x, gy-16*s, 8*s, 0, 7); ctx.arc(tr.x-6*s, gy-12*s, 6*s, 0, 7); ctx.arc(tr.x+6*s, gy-12*s, 6.5*s, 0, 7); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(tr.x-2*s, gy-19*s, 4*s, 0, 7); ctx.fill();   // sunlit top
    }
  }
  for(const p of is.palms){
    if(p.x < vx0-40 || p.x > vx1+40) continue;
    const gy = groundY(p.x), s = p.s, sway = Math.sin(G.time*1.5+p.x)*2 + G.weather.wind*0.05;
    ctx.strokeStyle='#6b4f2c'; ctx.lineWidth=3*s; ctx.beginPath(); ctx.moveTo(p.x,gy); ctx.quadraticCurveTo(p.x+4*s,gy-18*s,p.x+2*s+sway,gy-34*s); ctx.stroke();
    ctx.strokeStyle='#2f6b2a'; ctx.lineWidth=2.5*s;
    for(let k=-2;k<=2;k++){ ctx.beginPath(); ctx.moveTo(p.x+2*s+sway,gy-34*s); ctx.quadraticCurveTo(p.x+k*8*s+sway,gy-42*s,p.x+k*13*s+sway,gy-30*s+Math.abs(k)*3); ctx.stroke(); }
  }
}

// infantryman in khaki with a helmet and rifle: runs while nothing is in reach, kneels and fires at low aircraft
// Japanese infantryman: light khaki uniform, field cap with a neck flap and a yellow star, puttees.
// Kneels in his position facing the landing; runs (bayonet forward) in the banzai charge.
const JP_KHAKI = '#a8925a', JP_CAP = '#8f7c45';
function jpCap(ctx, x, hy, dir){
  ctx.fillStyle=JP_CAP; ctx.beginPath(); ctx.arc(x, hy-0.6, 2.4, Math.PI, 0); ctx.fill();
  ctx.fillRect(x - dir*2.6 - (dir<0?0:0), hy-0.8, dir*-0.01 + 1.2, 3.2);                 // neck flap at the back
  ctx.fillStyle='#e8c34a'; ctx.fillRect(x - 0.5 + dir*0.8, hy-2.6, 1, 1);                // star
}
function drawSoldier(ctx, so){
  const x=so.x, y=so.y, aiming = so.aim != null || (so.def && !so.running);
  ctx.lineCap='round';
  ctx.strokeStyle=JP_KHAKI; ctx.lineWidth=2;
  if(aiming){
    ctx.beginPath(); ctx.moveTo(x,y-6); ctx.lineTo(x+3,y-2); ctx.lineTo(x+3,y); ctx.moveTo(x,y-6); ctx.lineTo(x-4,y); ctx.stroke();        // kneeling
    ctx.lineWidth=2.4; ctx.beginPath(); ctx.moveTo(x,y-6); ctx.lineTo(x,y-11); ctx.stroke();
    const aim = so.aim ?? Math.PI*1.02, ca=Math.cos(aim), sa=Math.sin(aim);
    ctx.strokeStyle='#3b2a1a'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(x-ca*3, y-10-sa*3); ctx.lineTo(x+ca*8, y-10+sa*8); ctx.stroke();   // rifle
    ctx.strokeStyle=JP_KHAKI; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(x,y-10); ctx.lineTo(x+ca*4, y-10+sa*4); ctx.stroke();                // arms
    if(so.fireT>0){ ctx.fillStyle='rgba(255,220,120,.95)'; ctx.beginPath(); ctx.arc(x+ca*9.5, y-10+sa*9.5, 1.8, 0, 7); ctx.fill(); }
    ctx.fillStyle='#d9b48a'; ctx.beginPath(); ctx.arc(x,y-13,2.1,0,7); ctx.fill();
    jpCap(ctx, x, y-13, ca<0 ? -1 : 1);
  } else {
    // running stride with bent knees and a bounce, leaning into the charge, bayonet thrust forward
    const d = so.dir||1, ph = so.t*11;
    const b = legs(ctx, x, y, ph, 1.35, d, JP_KHAKI, '#cdbb88');
    ctx.strokeStyle=JP_KHAKI; ctx.lineWidth=2.6; ctx.beginPath(); ctx.moveTo(x,y-7+b); ctx.lineTo(x+d*2,y-12.5+b); ctx.stroke();
    const jab = Math.sin(ph)*1;
    ctx.strokeStyle='#3b2a1a'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(x-d*2+d*jab,y-9+b); ctx.lineTo(x+d*(9+jab),y-11+b); ctx.stroke();
    ctx.strokeStyle='#d8d8d0'; ctx.lineWidth=0.8; ctx.beginPath(); ctx.moveTo(x+d*(9+jab),y-11+b); ctx.lineTo(x+d*(12+jab),y-11.6+b); ctx.stroke();
    ctx.strokeStyle=JP_KHAKI; ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(x+d*1.6,y-11.5+b); ctx.lineTo(x+d*(4+jab),y-10+b); ctx.stroke();   // arms on the rifle
    ctx.fillStyle='#d9b48a'; ctx.beginPath(); ctx.arc(x+d*2.2,y-14.4+b,2.1,0,7); ctx.fill();
    jpCap(ctx, x+d*2.2, y-14.4+b, d);
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
  // American aircraft on (or just leaving / settling onto) our carrier: wheels on the deck, not through it
  const lift = e.team==='p' ? deckLift(type, e.x, e.y, gear) : 0;
  if(e.pilot && e.state==='fly' && e.f != null){
    // wingmen are drawn exactly like the player's aircraft: upright, the 3D model during a turn-around,
    // and naturally upside down only at the top of a loop
    const ang = e.mv ? e.mv.ang : e.vl != null ? e.vl : e.p;
    ctx.save(); ctx.translate(e.x, e.y - lift);
    if(e.ft != null){
      const t = e.ft, ease = t*t*(3-2*t);
      drawPlane3D(ctx, type, null, 'us', (e.f>0 ? 0 : Math.PI) + (e.f>0 ? -1 : 1)*Math.PI*ease, -Math.sin(Math.PI*t)*0.75, ang, flash>0, true);
    } else drawPilotPlane(ctx, e, type, 'us', ang, flash>0, true, gear);
    ctx.restore();
    return;
  }
  ctx.save(); ctx.translate(e.x, e.y - lift); ctx.rotate(e.a);
  // Keep the aircraft upright: once it is clearly heading the other way it rolls about its own nose axis to
  // right itself, like a pilot rolling out at the top of a half loop. The roll takes about 0.4 s and is drawn
  // with the 3D model, instead of the sprite snapping onto its back in a single frame.
  // (Hysteresis around the vertical so it doesn't roll back and forth while climbing or diving straight.)
  // A manoeuvre (maneuvers.js) can hold the attitude: faceLock keeps it on its back through a split-S or
  // upright until the top of an Immelmann; rollOverride shows it from above while it pivots in a hammerhead.
  const c = Math.cos(e.a);
  if(e.face == null){ e.face = c < 0 ? -1 : 1; e.roll = e.face < 0 ? Math.PI : 0; }
  if(e.man && e.faceLock != null) e.face = e.faceLock;
  else if(c > 0.2) e.face = 1; else if(c < -0.2) e.face = -1;
  const want = e.man && e.rollOverride != null ? e.rollOverride : e.face < 0 ? Math.PI : 0, step = Math.PI/0.4/60;
  e.roll += clamp(want - e.roll, -step, step);
  const r = visRoll(e);                                       // plus a full turn during a barrel roll
  const prop = !(e.takeoff && e.takeoff.t<0) && !(e.state==='rearm');
  if(Math.abs(r) > 0.02 && Math.abs(r) < Math.PI-0.02 && type !== 'betty'){
    drawPlane3D(ctx, type, e.skin || null, (AIRCRAFT[type]||{}).nation || 'us', 0, r, 0, flash>0, prop);
  } else {
    if(Math.abs(r) > Math.PI/2) ctx.scale(1,-1);
    drawPlane(ctx, type, e.skin || null, null, s, flash>0, prop, gear);       // e.skin: the enemy ace's colours
    // dive brakes on a Val in its dive onto the carrier; split flaps on a Zero braking hard
    drawBrakes(ctx, type, type==='val' && Math.sin(e.a) > 0.6, e.brk > 0);
  }
  ctx.restore();
}

function drawFx(ctx, f){
  const k = f.t/f.max;
  switch(f.type){
    case 'boom':{
      // 1) a dark cloud that grows out of the fireball and lingers after it
      if(k > 0.25){ const q = (k-0.25)/0.75; softSmoke(ctx, '#26221e', f.x, f.y - q*f.r*0.6, f.r*(0.55 + q*0.6), 0.75*(1-q)); }
      // 2) the fireball: white-hot centre, orange body, red edge
      const r = f.r*(0.4+k);
      const g = ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,r);
      g.addColorStop(0,`rgba(255,244,200,${1-k})`); g.addColorStop(0.45,`rgba(255,150,45,${0.9*(1-k)})`);
      g.addColorStop(0.8,`rgba(200,60,20,${0.5*(1-k)})`); g.addColorStop(1,'rgba(120,40,10,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(f.x,f.y,r,0,7); ctx.fill();
      // 3) the first instant: a white flash bigger than the fireball
      if(k < 0.12){ const q = k/0.12; ctx.fillStyle = `rgba(255,252,235,${0.9*(1-q)})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r*(0.7 + q*0.3), 0, 7); ctx.fill(); }
      // 4) big blasts: a shockwave ring racing outward
      if(f.r >= 40 && k < 0.3){ const q = k/0.3; ctx.strokeStyle = `rgba(255,240,215,${0.45*(1-q)*(1-q)})`; ctx.lineWidth = 3*(1-q) + 0.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r*(0.6 + q*1.8), 0, 7); ctx.stroke(); }
      break; }
    case 'flak': {
      // an air burst: a fireball that flashes and rolls out, then a dirty black cloud hangs where it was
      softSmoke(ctx, '#201e1c', f.x, f.y, f.r*(0.5+k*0.7), 0.95*(1-k));
      if(k < 0.45){
        const q = k/0.45, rr = f.r*(0.35 + q*0.85), g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rr);
        g.addColorStop(0, `rgba(255,248,210,${1-q})`); g.addColorStop(0.35, `rgba(255,190,70,${0.95*(1-q)})`);
        g.addColorStop(0.7, `rgba(230,90,30,${0.7*(1-q)})`); g.addColorStop(1, 'rgba(160,40,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, 7); ctx.fill();
      }
      break; }
    case 'smoke': softSmoke(ctx, f.c, f.x, f.y, f.s*(0.6+k), 0.62*(1-k)); break;
    case 'splash':
      ctx.fillStyle=`rgba(225,240,250,${1-k})`;
      for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.ellipse(f.x+i*7, SEA-30*Math.sin(k*Math.PI)*(1-Math.abs(i)*0.25), 3, 10*(1-k)+2, 0, 0, 7); ctx.fill(); } break;
    case 'wake':
      ctx.fillStyle=`rgba(230,245,255,${0.5*(1-k)})`; ctx.fillRect(f.x-6-k*10, f.y, 12+k*20, 2); break;
    case 'column': drawColumn(ctx, f); break;
    case 'fall': case 'trailfade': case 'part': case 'wsplash': case 'sink': case 'slick': case 'wreck': case 'echute':
      drawWreckFx(ctx, f, k); break;                   // shot-down aircraft and what they leave behind (wreck.js)
    case 'spl': {                                      // bullet hitting the sea: two thin spouts that rise and fall
      const h = f.h*Math.sin(k*Math.PI); ctx.strokeStyle = `rgba(230,242,250,${0.85*(1-k)})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(f.x-1.5, SEA); ctx.lineTo(f.x-2.5, SEA-h); ctx.moveTo(f.x+1.5, SEA); ctx.lineTo(f.x+2, SEA-h*0.7); ctx.stroke(); break; }
    case 'trail': ctx.strokeStyle = `rgba(245,250,255,${0.55*(1-k)})`; ctx.lineWidth = f.w + k*2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke(); break;
    case 'tracer': ctx.strokeStyle=f.c; ctx.lineWidth=0.8; ctx.globalAlpha=1-k; ctx.beginPath(); ctx.moveTo(f.x1,f.y1); ctx.lineTo(f.x2,f.y2); ctx.stroke(); ctx.globalAlpha=1; break;
    case 'text':
      ctx.font='bold 14px Rubik, sans-serif'; ctx.textAlign='center'; ctx.fillStyle=`rgba(255,215,90,${1-k})`; ctx.fillText(f.text,f.x,f.y); break;
  }
}

// Night: a dark layer with holes cut out wherever there is light
function drawDarkness(ctx, cw, ch, scale, camX, alpha, top){
  if(!cw || !ch) return;                               // window minimised / hidden: nothing to draw into
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
  if(!P.dead && P.muzzle > 0) hole(P.x + P.f*Math.cos(heading(P))*24, P.y - Math.sin(heading(P))*24, 70, 0.7);   // gunfire lights up the dark
  wreckLights(hole);                                   // planes going down in flames, burning parts, oil and wrecks (wreck.js)
  for(const e of G.enemies) if(!e.dead && e.burning) hole(e.x, e.y, 40, 0.5);
  hole(G.carrier.x+G.carrier.len*0.66+21, DECK_Y-90, 60, 0.7);
  for(let i=0;i<6;i++) hole(G.carrier.x+40+i*90, DECK_Y, 40, 0.5);
  for(const f of G.fx){
    if(f.type==='boom') hole(f.x,f.y,f.r*4*(1-f.t/f.max)+20,1);
    else if(f.type==='flak' && f.t<0.35) hole(f.x,f.y,90*(1-f.t/0.35)+30,0.9);    // air bursts light up the night sky
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
