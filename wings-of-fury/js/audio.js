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
  noise(dur, freq, vol, type='lowpass', q=1){
    if(!this.ctx||this.muted) return;
    const t=this.ctx.currentTime, s=this.ctx.createBufferSource(); s.buffer=this.noiseBuf;
    const f=this.ctx.createBiquadFilter(); f.type=type; f.frequency.setValueAtTime(freq,t); f.frequency.exponentialRampToValueAtTime(Math.max(40,freq*0.25),t+dur); f.Q.value=q;
    const g=this.ctx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()*0.5); s.stop(t+dur+0.05);
  },
  tone(f0,f1,dur,vol,type='square'){
    if(!this.ctx||this.muted) return;
    const t=this.ctx.currentTime, o=this.ctx.createOscillator(), g=this.ctx.createGain(); o.type=type;
    o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+dur+0.02);
  },
  gun(){ this.noise(0.06, 2500, 0.18, 'bandpass', 2); },
  enemyGun(){ this.noise(0.05, 1600, 0.07, 'bandpass', 2); },
  boom(big){ this.noise(big?1.4:0.7, big?900:1400, big?0.9:0.55); },
  flak(){ this.noise(0.35, 1100, 0.22); },
  drop(){ this.tone(900,300,0.5,0.05,'sine'); },
  rocket(){ this.noise(0.5, 3000, 0.2, 'highpass'); },
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
