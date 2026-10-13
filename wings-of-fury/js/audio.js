// ---- Synthesized sound (WebAudio, no files): effects, per-aircraft engines, 8-bit menu music ----

// Engine voices by aircraft. Bigger airframes: lower pitch, heavier sub-octave rumble, slower cylinder throb.
const ENGINE_PROFILES = {
  hellcat:  {base:50, mul:0.16, cutoff:430, vol:0.075, sub:0.35, throb:0.35},
  corsair:  {base:56, mul:0.18, cutoff:560, vol:0.075, sub:0.30, throb:0.30},
  bearcat:  {base:66, mul:0.20, cutoff:700, vol:0.065, sub:0.20, throb:0.25},
  dauntless:{base:42, mul:0.14, cutoff:340, vol:0.085, sub:0.50, throb:0.40},
  avenger:  {base:33, mul:0.12, cutoff:270, vol:0.095, sub:0.70, throb:0.50}
};

const SFX = {
  ctx:null, master:null, muted:false, noiseBuf:null, eng:null, profile:ENGINE_PROFILES.hellcat,
  init(){
    if(this.ctx) { if(this.ctx.state==='suspended') this.ctx.resume(); return; }
    try{
      const C = window.AudioContext || window.webkitAudioContext; if(!C) return;
      this.ctx = new C();
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted?0:0.5; this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1,len,this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
      this.buildEngine();
      try{ window.speechSynthesis && window.speechSynthesis.getVoices(); }catch(e){}   // starts loading the voice list early
      this.loadBanzai();
    }catch(e){ this.ctx=null; }
  },
  // engine: sawtooth + sub-octave square -> lowpass -> tremolo (cylinder throb) -> output gain
  buildEngine(){
    const c = this.ctx;
    const o1 = c.createOscillator(); o1.type='sawtooth';
    const o2 = c.createOscillator(); o2.type='square';
    const subG = c.createGain();
    const f = c.createBiquadFilter(); f.type='lowpass'; f.Q.value=2;
    const trem = c.createGain(); trem.gain.value = 1;
    const lfo = c.createOscillator(); lfo.type='sine'; const lfoG = c.createGain();
    lfo.connect(lfoG); lfoG.connect(trem.gain);
    const out = c.createGain(); out.gain.value = 0;
    o1.connect(f); o2.connect(subG); subG.connect(f); f.connect(trem); trem.connect(out); out.connect(this.master);
    o1.start(); o2.start(); lfo.start();
    this.eng = {o1, o2, subG, f, lfo, lfoG, out};
    this.applyProfile();
  },
  setEngineProfile(id){ this.profile = ENGINE_PROFILES[id] || ENGINE_PROFILES.hellcat; this.applyProfile(); },
  applyProfile(){
    if(!this.eng) return;
    const p = this.profile, e = this.eng, t = this.ctx.currentTime;
    e.f.frequency.setTargetAtTime(p.cutoff, t, 0.05);
    e.subG.gain.setTargetAtTime(p.sub, t, 0.05);
    e.lfoG.gain.setTargetAtTime(p.throb, t, 0.05);
  },
  toggleMute(){ this.muted=!this.muted; if(this.master) this.master.gain.value=this.muted?0:0.5; return this.muted; },
  setEngine(on, speed){
    if(!this.eng) return;
    const p = this.profile, e = this.eng, t = this.ctx.currentTime, fr = p.base + speed*p.mul;
    e.out.gain.setTargetAtTime(on ? p.vol : 0, t, 0.12);
    e.o1.frequency.setTargetAtTime(fr, t, 0.15);
    e.o2.frequency.setTargetAtTime(fr/2 + 0.7, t, 0.15);
    e.lfo.frequency.setTargetAtTime(fr/4, t, 0.15);
  },
  // voice limiter: in a big battle dozens of shots and blasts can fire in the same instant; beyond a dozen
  // short sounds per tenth of a second the extra ones are inaudible anyway and only load the audio thread
  voice(){
    const now = performance.now();
    if(now - (this.vT||0) > 100){ this.vT = now; this.vN = 0; }
    return ++this.vN <= 12;
  },
  noise(dur, freq, vol, type='lowpass', q=1){
    if(!this.ctx||this.muted||(dur<1 && !this.voice())) return;
    const t=this.ctx.currentTime, s=this.ctx.createBufferSource(); s.buffer=this.noiseBuf;
    const f=this.ctx.createBiquadFilter(); f.type=type; f.frequency.setValueAtTime(freq,t); f.frequency.exponentialRampToValueAtTime(Math.max(40,freq*0.25),t+dur); f.Q.value=q;
    const g=this.ctx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()*0.5); s.stop(t+dur+0.05);
  },
  tone(f0,f1,dur,vol,type='square'){
    if(!this.ctx||this.muted||!this.voice()) return;
    const t=this.ctx.currentTime, o=this.ctx.createOscillator(), g=this.ctx.createGain(); o.type=type;
    o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+dur+0.02);
  },
  // one shot from a battery of .50-cal guns: a sharp crack, a hard mid "bang" and a short low thump
  shot(vol, pitch){
    if(!this.ctx||this.muted||!this.voice()) return;
    const c=this.ctx, t=c.currentTime, out=c.createGain(); out.gain.value=vol; out.connect(this.master);
    const s=c.createBufferSource(); s.buffer=this.noiseBuf;
    const hp=c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=4500*pitch;
    const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1400*pitch; bp.Q.value=0.9;
    const g1=c.createGain(); g1.gain.setValueAtTime(0.7,t); g1.gain.exponentialRampToValueAtTime(0.001,t+0.025);
    const g2=c.createGain(); g2.gain.setValueAtTime(1,t); g2.gain.exponentialRampToValueAtTime(0.001,t+0.07);
    s.connect(hp); hp.connect(g1); g1.connect(out); s.connect(bp); bp.connect(g2); g2.connect(out);
    s.start(t, Math.random()*0.8); s.stop(t+0.09);
    const o=c.createOscillator(), og=c.createGain(); o.type='triangle';
    o.frequency.setValueAtTime(140*pitch,t); o.frequency.exponentialRampToValueAtTime(45,t+0.06);
    og.gain.setValueAtTime(0.9,t); og.gain.exponentialRampToValueAtTime(0.001,t+0.07);
    o.connect(og); og.connect(out); o.start(t); o.stop(t+0.08);
  },
  gun(){ this.shot(0.22, rnd(0.92,1.08)); },
  enemyGun(){ this.shot(0.08, rnd(0.75,0.85)); },          // the Zero's lighter guns, heard from further off
  // aircraft blowing up: a sharp blast, a deep rumble, and a long tail that fades away
  planeBoom(){
    if(!this.ctx||this.muted) return;
    const c=this.ctx, t=c.currentTime;
    const s=c.createBufferSource(); s.buffer=this.noiseBuf; s.loop=true;
    const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.setValueAtTime(2600,t); lp.frequency.exponentialRampToValueAtTime(160,t+2.6);
    const g=c.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.85,t+0.02);
    g.gain.setTargetAtTime(0.35,t+0.05,0.18); g.gain.setTargetAtTime(0.0001,t+0.6,0.7);       // fade out over ~2.5 s
    s.connect(lp); lp.connect(g); g.connect(this.master); s.start(t); s.stop(t+3.4);
    const o=c.createOscillator(), og=c.createGain(); o.type='sine';
    o.frequency.setValueAtTime(85,t); o.frequency.exponentialRampToValueAtTime(32,t+1.6);
    og.gain.setValueAtTime(0.6,t); og.gain.setTargetAtTime(0.0001,t+0.15,0.45);
    o.connect(og); og.connect(this.master); o.start(t); o.stop(t+2.5);
    for(let i=0;i<5;i++) setTimeout(()=>this.noise(0.12, rnd(1500,3500), 0.05, 'bandpass', 3), 200+i*rnd(120,260));  // debris crackle
  },
  // "Banzaiiiiiii!" from a pilot diving onto the carrier.
  // 1) a real recorded battle cry, if the game ships one (sfx/banzai.mp3): the only way to get a truly furious shout;
  // 2) otherwise the browser's own voice says it clearly (Japanese voice if available, final "i" drawn out);
  // 3) only with no speech support at all, the synthesized shout.
  loadBanzai(){
    if(this.banzaiTried || !this.ctx) return; this.banzaiTried = true;
    try{
      fetch('sfx/banzai.mp3').then(r=>r.ok ? r.arrayBuffer() : null)
        .then(a=>a && this.ctx.decodeAudioData(a)).then(b=>{ if(b) this.banzaiBuf = b; }).catch(()=>{});
    }catch(e){}
  },
  banzai(){
    if(this.muted) return;
    const now = performance.now(); if(now - (this.lastBanzai||0) < 2600) return; this.lastBanzai = now;
    if(this.banzaiBuf && this.ctx){
      const s=this.ctx.createBufferSource(), g=this.ctx.createGain(); s.buffer=this.banzaiBuf; g.gain.value=1.6;
      s.connect(g); g.connect(this.master); s.start(); return;
    }
    try{
      const ss = window.speechSynthesis;
      if(ss && window.SpeechSynthesisUtterance){
        const voices = ss.getVoices(), jp = voices.find(v=>/^ja/i.test(v.lang));
        // in Japanese, ー stretches the vowel before it: "ban-za-iiiiii"
        const u = new SpeechSynthesisUtterance(jp ? 'バンザイーーーーー！' : 'Banzai!');
        if(jp){ u.voice = jp; u.lang = jp.lang; }
        u.rate = jp ? 0.85 : 0.75; u.pitch = 1.6; u.volume = 1;
        ss.cancel(); ss.speak(u);
        return;
      }
    }catch(e){}
    this.shout(1);
  },
  // falling-bomb whistle: a descending, slightly wavering tone with an airy edge that grows louder as the bomb
  // falls; the caller stops it at impact
  whistle(vol=0.06){
    if(!this.ctx||this.muted) return null;
    const c=this.ctx, t=c.currentTime, T=8;
    const o=c.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(1700,t); o.frequency.exponentialRampToValueAtTime(420,t+5);
    const lfo=c.createOscillator(), lg=c.createGain(); lfo.frequency.value=8; lg.gain.value=14; lfo.connect(lg); lg.connect(o.frequency);
    const n=c.createBufferSource(); n.buffer=this.noiseBuf; n.loop=true;
    const nf=c.createBiquadFilter(); nf.type='bandpass'; nf.Q.value=14;
    nf.frequency.setValueAtTime(1700,t); nf.frequency.exponentialRampToValueAtTime(420,t+5);
    const ng=c.createGain(); ng.gain.value=0.7;
    const g=c.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.3); g.gain.linearRampToValueAtTime(vol*1.8,t+3.5);
    o.connect(g); n.connect(nf); nf.connect(ng); ng.connect(g); g.connect(this.master);
    o.start(t); lfo.start(t); n.start(t); o.stop(t+T); lfo.stop(t+T); n.stop(t+T);
    return { stop(){ const tt=c.currentTime; try{ g.gain.cancelScheduledValues(tt); g.gain.setValueAtTime(g.gain.value, tt); g.gain.linearRampToValueAtTime(0, tt+0.03);
      o.stop(tt+0.05); lfo.stop(tt+0.05); n.stop(tt+0.05); }catch(e){} } };
  },
  // Synthesized shout: a strained, high, raspy voice (sawtooth with jitter and breath noise, hard-clipped),
  // shaped by three formant filters through B-a-n-z-a then a long rising, trembling "iiiiiii" that tails off.
  shout(level){
    if(!this.ctx) return;
    const c=this.ctx, t=c.currentTime, T=2.1;
    const out=c.createGain(); out.gain.value=0.5*level; out.connect(this.master);
    // hard clipping makes it sound like a voice pushed to its limit
    const clip=c.createWaveShaper(), curve=new Float32Array(1024);
    for(let i=0;i<1024;i++){ const x=i/511.5-1; curve[i]=Math.tanh(x*4); }
    clip.curve=curve; clip.connect(out);
    // voice source: pitch jumps up on "zai" and keeps climbing in anger, with a fast tremble
    const v=c.createOscillator(); v.type='sawtooth';
    const f=v.frequency;
    f.setValueAtTime(210,t); f.linearRampToValueAtTime(240,t+0.2); f.linearRampToValueAtTime(230,t+0.32);
    f.linearRampToValueAtTime(285,t+0.5); f.linearRampToValueAtTime(330,t+1.6); f.linearRampToValueAtTime(300,t+T);
    const vib=c.createOscillator(), vibG=c.createGain(); vib.frequency.value=7.5; vibG.gain.setValueAtTime(0,t); vibG.gain.linearRampToValueAtTime(14,t+0.9);
    vib.connect(vibG); vibG.connect(f);
    const voiced=c.createGain(); v.connect(voiced);
    // breath / rasp noise, strongest on the consonants
    const n=c.createBufferSource(); n.buffer=this.noiseBuf; n.loop=true;
    const nf=c.createBiquadFilter(); nf.type='highpass'; nf.frequency.value=1800;
    const breath=c.createGain(); n.connect(nf); nf.connect(breath);
    // loudness through the syllables: B(burst) a n z a iiiiiii (fade)
    const g=voiced.gain; g.setValueAtTime(0,t);
    g.linearRampToValueAtTime(1,t+0.03); g.setValueAtTime(1,t+0.2);
    g.linearRampToValueAtTime(0.35,t+0.24); g.setValueAtTime(0.35,t+0.3);          // "n"
    g.linearRampToValueAtTime(0.5,t+0.34); g.linearRampToValueAtTime(1,t+0.42);    // "z" -> "a"
    g.setValueAtTime(1,t+1.5); g.linearRampToValueAtTime(0,t+T);                    // long "iiii", tailing off
    const b=breath.gain; b.setValueAtTime(0.9,t); b.linearRampToValueAtTime(0.1,t+0.05);   // the "B" burst
    b.setValueAtTime(0.1,t+0.3); b.linearRampToValueAtTime(0.8,t+0.33); b.linearRampToValueAtTime(0.15,t+0.42);   // "z" hiss
    b.setValueAtTime(0.15,t+1.5); b.linearRampToValueAtTime(0,t+T);
    // formants: a (F1 800, F2 1250) -> nasal n -> a -> i (F1 300, F2 2300), plus a steady F3 for brightness
    const F=[[800,250,800,330],[1250,1500,1250,2350],[2700,2600,2700,3100]], Q=[5,7,9];
    F.forEach((fr,k)=>{
      const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=Q[k];
      const p=bp.frequency; p.setValueAtTime(fr[0],t); p.setValueAtTime(fr[0],t+0.2); p.linearRampToValueAtTime(fr[1],t+0.24);
      p.setValueAtTime(fr[1],t+0.3); p.linearRampToValueAtTime(fr[2],t+0.42); p.setValueAtTime(fr[2],t+0.5); p.linearRampToValueAtTime(fr[3],t+0.75);
      const gk=c.createGain(); gk.gain.value=[1,0.8,0.45][k]*3;
      voiced.connect(bp); breath.connect(bp); bp.connect(gk); gk.connect(clip);
    });
    v.start(t); vib.start(t); n.start(t); v.stop(t+T+0.05); vib.stop(t+T+0.05); n.stop(t+T+0.05);
  },
  boom(big){ this.noise(big?1.4:0.7, big?900:1400, big?0.9:0.55); },
  flak(){ this.noise(0.35, 1100, 0.22); },
  drop(){ this.tone(900,300,0.5,0.05,'sine'); },
  // rocket launch: an ignition pop, then a rushing whoosh that rises in pitch as the motor burns
  rocket(){
    if(!this.ctx||this.muted) return;
    const c=this.ctx, t=c.currentTime;
    const s=c.createBufferSource(); s.buffer=this.noiseBuf;
    const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.4;
    bp.frequency.setValueAtTime(600,t); bp.frequency.exponentialRampToValueAtTime(3200,t+0.55);
    const g=c.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.32,t+0.06); g.gain.setTargetAtTime(0.0001,t+0.25,0.18);
    s.connect(bp); bp.connect(g); g.connect(this.master); s.start(t, Math.random()*0.5); s.stop(t+0.9);
    this.tone(220, 70, 0.08, 0.18, 'square');                          // ignition pop
  },
  splash(){ this.noise(0.6, 600, 0.3); },
  thunder(){ this.noise(2.5, 300, 0.8); },
  hit(){ this.tone(220,90,0.12,0.15,'square'); },
  pickup(){ this.tone(500,1000,0.15,0.08,'triangle'); },
  alarm(){ this.tone(880,660,0.25,0.07,'square'); }
};

// ---- 8-bit theme: a dramatic D-minor march, 8 bars looping, 140 BPM in 16th-note steps ----
const Music = (() => {
  const NOTE = {C:0,'C#':1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,Bb:10,B:11};
  const midi = s => { const m = s.match(/^([A-G][#b]?)(\d)$/); return 12*(+m[2]+1) + NOTE[m[1]]; };
  const hz = m => 440*Math.pow(2,(m-69)/12);
  // melody: [note|null, length in 16ths]; every bar sums to 16
  const MEL = [
    [['D5',4],['A4',2],['D5',2],['F5',6],['E5',2]],
    [['D5',4],['C5',2],['Bb4',2],['F5',8]],
    [['E5',4],['G5',2],['F5',2],['E5',4],['C5',4]],
    [['C#5',6],['D5',2],['E5',8]],
    [['A5',4],['G5',2],['F5',2],['E5',4],['F5',4]],
    [['G5',6],['F5',2],['D5',8]],
    [['E5',2],['F5',2],['G5',2],['A5',2],['Bb5',4],['A5',4]],
    [['C#5',4],['E5',4],['A5',6],[null,2]]
  ];
  const CHORDS = [['D','F','A'],['Bb','D','F'],['C','E','G'],['A','C#','E'],['D','F','A'],['G','Bb','D'],['A','C#','E'],['A','C#','E']];
  const STEPS = 16*MEL.length, STEP = 60/140/4;
  const lead = new Array(STEPS).fill(null);
  MEL.forEach((bar,b)=>{ let s=b*16; for(const [n,l] of bar){ if(n) lead[s]={f:hz(midi(n)), len:l}; s+=l; } });

  let bus=null, timer=null, step=0, next=0, playing=false;

  function blip(type, f, t, dur, vol, slideTo){
    const c=SFX.ctx, o=c.createOscillator(), g=c.createGain(); o.type=type;
    o.frequency.setValueAtTime(f,t); if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.setValueAtTime(vol,t+dur*0.7); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t+dur+0.02);
  }
  function hiss(t, dur, vol, freq){
    const c=SFX.ctx, s=c.createBufferSource(); s.buffer=SFX.noiseBuf;
    const f=c.createBiquadFilter(); f.type='highpass'; f.frequency.value=freq;
    const g=c.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random()*0.5); s.stop(t+dur+0.02);
  }
  function play(i, t){
    const bar = Math.floor(i/16), s = i%16, ch = CHORDS[bar];
    const root = hz(midi(ch[0]+'2'));
    // lead: square, with a short vibrato-free 8-bit attack
    const n = lead[i]; if(n) blip('square', n.f, t, n.len*STEP*0.95, 0.11);
    // bass: driving eighth notes, octave jumps on the off-beats
    if(s%2===0) blip('triangle', s%4===2 ? root*2 : root, t, STEP*1.8, 0.32);
    // arpeggio: quiet 16th-note pulse over the chord
    const arp = ch[[0,1,2,1][s%4]];
    blip('square', hz(midi(arp+'4')), t, STEP*0.6, 0.035);
    // drums: kick on 1 and 3, snare on 2 and 4, hats on eighths, a fill on the last bar
    if(s===0 || s===8 || (bar===7 && s===14)) blip('sine', 150, t, 0.16, 0.5, 40);
    if(s===4 || s===12 || (bar===7 && s>=12)) hiss(t, 0.12, 0.22, 1500);
    if(s%2===0) hiss(t, 0.03, 0.06, 7000);
  }
  function tick(){
    const c = SFX.ctx; if(!c || !playing) return;
    if(next < c.currentTime) next = c.currentTime + 0.05;   // after a suspend, resync instead of bursting
    while(next < c.currentTime + 0.15){ play(step, next); next += STEP; step = (step+1) % STEPS; }
  }
  return {
    get playing(){ return playing; },
    start(){
      SFX.init(); if(!SFX.ctx || playing) return;
      playing = true;
      bus = SFX.ctx.createGain(); bus.gain.value = 0.5; bus.connect(SFX.master);
      step = 0; next = SFX.ctx.currentTime + 0.08;
      timer = setInterval(tick, 25); tick();
    },
    stop(){
      if(!playing) return;
      playing = false; clearInterval(timer);
      const b = bus, t = SFX.ctx.currentTime;
      b.gain.setTargetAtTime(0, t, 0.08); setTimeout(()=>b.disconnect(), 600);
    }
  };
})();
