// ---- Boot, input and the main loop ----
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let CW=0, CH=0;

function resize(){
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  CW = Math.floor(window.innerWidth*dpr); CH = Math.floor(window.innerHeight*dpr);
  cv.width = CW; cv.height = CH;
}
window.addEventListener('resize', resize); resize();

const GAME_KEYS = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyS','KeyX','KeyB'];
window.addEventListener('keydown', e=>{
  SFX.init();
  if(GAME_KEYS.includes(e.code) && G && !UI.open()) e.preventDefault();
  if(e.repeat) { keys[e.code]=true; return; }
  keys[e.code] = true;
  if(!G) return;
  if(e.code==='Escape' || e.code==='KeyP'){ if(G.paused){ G.paused=false; UI.hide(); } else UI.pause(); }
  if(e.code==='KeyM') say(SFX.toggleMute() ? 'צליל כבוי' : 'צליל פועל', 1.5);
  if(e.code==='KeyC') toggleWingMode();
  if(e.code==='Enter' && G.state==='rearm') UI.act('takeoff');
});
window.addEventListener('keyup', e=>{ keys[e.code]=false; });
window.addEventListener('blur', ()=>{ for(const k in keys) keys[k]=false; });

function toggleWingMode(){
  if(!G || !G.wingmen.length) return;
  G.wingMode = G.wingMode==='escort' ? 'attack' : 'escort';
  say(G.wingMode==='escort' ? 'כנפיים: ליווי וחיפוי צמוד' : 'כנפיים: תקיפה עצמאית של מטרות', 2.5);
}

// touch pad
document.querySelectorAll('#touch button').forEach(b=>{
  const k = b.dataset.k;
  const down = e=>{ e.preventDefault(); SFX.init(); if(!G) return;
    if(k==='Escape'){ UI.pause(); return; } if(k==='KeyC'){ toggleWingMode(); return; } keys[k]=true; };
  const up = e=>{ e.preventDefault(); keys[k]=false; };
  b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
});

function update(dt, vw){
  const P = G.player;
  G.time += dt;
  updateWeather(dt);
  updatePlayer(dt);
  updateWingmen(dt);
  updateEnemies(dt);
  updateGround(dt);
  updateCarrierAA(dt);
  updateProjectiles(dt);
  updateFx(dt);
  updateSpawns(dt, vw);
  SFX.setEngine(!P.dead && (P.speed>5 || P.throttle>0), P.speed);

  if(!G.complete && primariesLeft()===0){
    G.complete = true; SFX.pickup();
    say('כל המטרות הושמדו! חזור לנושאת ונחת כדי לסיים', 6);
  }
  if(G.carrier.hp<=0){ boom(G.carrier.x+G.carrier.len/2, DECK_Y, 120, true); UI.result(false, 'נושאת המטוסים הוטבעה.'); return; }
  if(P.dead){
    G.endT -= dt;
    if(G.endT<=0){
      if(G.lives>0){ G.state='rearm'; UI.openDeck(true); }
      else UI.result(false, 'כל המטוסים אבדו.');
    }
  }
  // vertical framing: zoom out as the player climbs above the normal view
  const wantTop = clamp(P.dead ? 0 : Math.min(0, P.y - 280), CEIL-280, 0);
  G.cam.top += (wantTop - G.cam.top)*Math.min(1, dt*2);
  // camera leads in the direction of flight
  const target = P.x - vw*(P.f>0 ? 0.35 : 0.65);
  G.cam.x += (target - G.cam.x)*Math.min(1, dt*2.2);
  G.cam.x = clamp(G.cam.x, -500, G.L+500-vw);
}

let last = performance.now();
function frame(now){
  const dt = Math.min(0.033, (now-last)/1000); last = now;
  if(G){
    const vw = viewMetrics(CW, CH).vw;
    const running = !G.paused && G.state!=='rearm' && G.state!=='over';
    if(running) update(dt, vw);
    render(ctx, CW, CH);
  } else drawTitleBackdrop(now/1000);
  requestAnimationFrame(frame);
}

// animated ocean behind the menus
function drawTitleBackdrop(t){
  const scale = CH/H, vw = CW/scale;
  ctx.setTransform(scale,0,0,scale,0,0);
  const g = ctx.createLinearGradient(0,0,0,SEA); g.addColorStop(0,'#2b3c6b'); g.addColorStop(1,'#f2a66a');
  ctx.fillStyle=g; ctx.fillRect(0,0,vw,SEA);
  ctx.fillStyle='rgba(255,210,150,.9)'; ctx.beginPath(); ctx.arc(vw*0.25, SEA-60, 46, 0, 7); ctx.fill();
  const s = ctx.createLinearGradient(0,SEA,0,H); s.addColorStop(0,'#4b5f86'); s.addColorStop(1,'#1e2a48');
  ctx.fillStyle=s; ctx.fillRect(0,SEA,vw,H-SEA);
  for(let i=0;i<3;i++){
    const x = ((t*90 + i*vw/3) % (vw+200)) - 100, y = 200 + i*60 + Math.sin(t+i)*10;
    ctx.save(); ctx.translate(x,y); ctx.rotate(Math.sin(t+i)*0.05); drawPlane(ctx, i===1?'corsair':'fighter', '#3d5c7c', 'us', 1.4, false, true); ctx.restore();
  }
}

UI.init();
// Title screen: any key, click or tap continues to the main menu
(function(){
  const t = document.getElementById('title');
  t.focus();
  const go = e => {
    if(!t.isConnected) return;
    e.preventDefault(); e.stopImmediatePropagation();
    SFX.init(); SFX.tone(220, 440, 0.25, 0.08, 'triangle');
    t.remove(); UI.mainMenu();
    window.removeEventListener('keydown', go, true);
  };
  window.addEventListener('keydown', go, true);
  t.addEventListener('pointerdown', go);
  // the music button starts the theme without leaving the title screen
  const mb = document.getElementById('musicBtn');
  mb.addEventListener('pointerdown', e=>{ e.stopPropagation(); SFX.init(); Music.start(); mb.hidden = true; });
  // browsers only allow sound after an interaction; start now in case this one already allows it
  Music.start();
  if(SFX.ctx && SFX.ctx.state==='running') mb.hidden = true;
})();
requestAnimationFrame(frame);
