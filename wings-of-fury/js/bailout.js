// ---- Bailing out: the pilot of a plane that is lost high enough jumps and comes down under a parachute ----
// Over the sea, a rescue launch sets out from the carrier to pick him up; if it gets there, the plane count goes
// back up by one. Zeros that pass low over the pilot in the water strafe him, so it pays to stay and cover him.
// Over enemy land he is taken prisoner; onto the carrier's deck he is home at once.
// While the last pilot is still waiting to be picked up, a mission with no aircraft left waits for the outcome.
const CHUTE = {minAlt: 70, fall: 42, boat: 140, hp: 12};

function bailOut(P){
  if(G.tutorial || groundY(P.x) - P.y < CHUTE.minAlt) return false;
  const v = playerVel(P);
  (G.chutes = G.chutes || []).push({x: P.x, y: P.y - 6, vx: v.vx*0.3, state: 'air', hp: CHUTE.hp, t: 0, open: 0, hit: 0});
  return true;
}
const chutePending = () => !!(G.chutes && G.chutes.some(c => c.state === 'air' || c.state === 'water'));
const chuteCaller = () => { const w = G.wingmen.find(w => !w.dead); return w ? `כנף ${w.slot + 2}` : 'נושאת'; };

function chuteRescued(c, deck){
  c.state = 'gone'; G.lives++; G.rescued = (G.rescued || 0) + 1; SFX.pickup();
  say(`${deck ? 'הטייס נחת ישר על הסיפון' : 'הטייס חולץ מהמים'}! קיבלת בחזרה מטוס · נותרו ${G.lives} מטוסים`, 4);
}

function chutesUpdate(dt){
  if(!G.chutes || !G.chutes.length) return;
  const C = G.carrier;
  for(const c of G.chutes){
    if(c.state === 'gone') continue;
    c.t += dt; c.hit = Math.max(0, c.hit - dt);
    if(c.state === 'air'){
      c.open = Math.min(1, c.t/0.8);                                     // a short free fall while the canopy opens
      c.vx += (G.weather.wind*0.6 - c.vx)*Math.min(1, dt*0.8);           // the jump's speed bleeds off into the wind
      c.x += c.vx*dt; c.y += (c.open < 1 ? 110 : CHUTE.fall)*dt;
      if(c.x > C.x && c.x < C.x + C.len && c.y >= DECK_Y - 6 && c.y < DECK_Y + 12){ chuteRescued(c, true); continue; }
      if(c.y >= groundY(c.x) - 4){
        if(overSea(c.x)){
          c.state = 'water'; c.y = SEA; splash(c.x);
          c.boat = {x: c.x < C.x ? C.x : C.x + C.len - 20};
          radio('נושאת', 'סירת חילוץ יוצאת אל הטייס. שמור עליו עד שתגיע!', null);
        } else { c.state = 'gone'; G.captured = (G.captured || 0) + 1; say('הטייס נחת בשטח האויב ונפל בשבי', 4); }
      }
      continue;
    }
    // in the water: the launch closes in
    const b = c.boat, d = c.x - b.x;
    b.x += Math.sign(d)*Math.min(Math.abs(d), CHUTE.boat*dt);
    if(Math.abs(c.x - b.x) < 8){ chuteRescued(c, false); continue; }
    // Zeros flying low nearby strafe the pilot
    for(const e of G.enemies){
      if(e.dead || e.takeoff || e.type !== 'zero' || Math.abs(e.x - c.x) > 450 || SEA - e.y > 420 || Math.random() > dt*0.9) continue;
      const a = Math.atan2(SEA - 6 - e.y, c.x - e.x) + rnd(-0.07, 0.07);
      G.shots.push({x: e.x, y: e.y, vx: Math.cos(a)*700, vy: Math.sin(a)*700, team: 'e', dmg: 3, life: 0.9});
      if(!c.warned){ c.warned = true; radio(chuteCaller(), 'זירו יורה על הטייס שבמים! תגן עליו!', null); }
    }
    // enemy bullets passing through him: tested along their path from the last frame to the next, because they
    // are fast, and one that reaches the water this frame is already gone from G.shots (updateProjectiles runs first)
    for(const s of G.shots){
      if(s.team !== 'e' || s.life <= 0) continue;
      const x0 = s.x - s.vx*dt, y0 = s.y - s.vy*dt, x1 = s.x + s.vx*dt, y1 = s.y + s.vy*dt, px = c.x, py = SEA - 5;
      const L2 = (x1-x0)**2 + (y1-y0)**2 || 1, k = clamp(((px-x0)*(x1-x0) + (py-y0)*(y1-y0))/L2, 0, 1);
      if(Math.hypot(x0 + (x1-x0)*k - px, y0 + (y1-y0)*k - py) < 7){ s.life = 0; c.hp -= s.dmg; c.hit = 0.15; }
    }
    if(c.hp <= 0){ c.state = 'gone'; say('הטייס שבמים נהרג', 4); }
  }
  G.chutes = G.chutes.filter(c => c.state !== 'gone');
}

function drawChutes(ctx){
  if(!G.chutes) return;
  for(const c of G.chutes){
    ctx.save(); ctx.translate(c.x, c.y);
    if(c.state === 'air'){
      const sw = Math.sin(c.t*1.7)*0.12, o = c.open;
      ctx.rotate(sw);
      if(o > 0.05){
        // canopy: white and orange panels, with shroud lines down to the harness
        const r = 4 + 12*o, top = -30;
        for(let i = 0; i < 6; i++){
          ctx.fillStyle = i % 2 ? '#f2efe6' : '#e07a2e';
          ctx.beginPath(); ctx.moveTo(0, top + r*0.25); ctx.arc(0, top + r*0.25, r, Math.PI + i*Math.PI/6, Math.PI + (i+1)*Math.PI/6); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(40,40,40,.55)'; ctx.lineWidth = 0.6; ctx.beginPath();
        for(const k of [-1, -0.4, 0.4, 1]){ ctx.moveTo(k*r, top + r*0.25); ctx.lineTo(0, -6); } ctx.stroke();
      }
      ctx.fillStyle = '#5a5240'; ctx.fillRect(-1.5, -6, 3, 6);              // flight suit
      ctx.fillStyle = '#e8c33a'; ctx.fillRect(-2, -5, 4, 3);                 // life vest
      ctx.fillStyle = '#d9a982'; ctx.beginPath(); ctx.arc(0, -7.5, 1.8, 0, 7); ctx.fill();
    } else {
      // in the water: dye marker, life vest, a hand waving; red when hit
      ctx.fillStyle = 'rgba(80,200,150,.35)'; ctx.beginPath(); ctx.ellipse(0, 1, 16, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = c.hit > 0 ? '#ff5a44' : '#e8c33a'; ctx.fillRect(-3, -3, 6, 3);
      ctx.fillStyle = '#d9a982'; ctx.beginPath(); ctx.arc(0, -5, 2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#d9a982'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(2, -3); ctx.lineTo(4 + Math.sin(c.t*6), -9); ctx.stroke();
      // hp over him, once he has been hit
      if(c.hp < CHUTE.hp){ ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(-10, -16, 20, 3); ctx.fillStyle = '#7fd08a'; ctx.fillRect(-10, -16, 20*c.hp/CHUTE.hp, 3); }
      ctx.restore();
      // the rescue launch: a grey boat with a white wake
      const b = c.boat, dir = Math.sign(c.x - b.x) || 1;
      ctx.save(); ctx.translate(b.x, SEA); ctx.scale(dir, 1);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(-14, 1); ctx.lineTo(-40, 3); ctx.lineTo(-14, 4); ctx.fill();
      ctx.fillStyle = '#6f7a84'; ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(12, -4); ctx.lineTo(16, -7); ctx.lineTo(14, 2); ctx.lineTo(-13, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4c555e'; ctx.fillRect(-6, -9, 9, 5);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-12, -6, 2, 2);
    }
    ctx.restore();
  }
}
