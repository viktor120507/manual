/* Small procedural game sounds. No downloads, timers, or background music. */
(()=>{
 'use strict';
 const preference='pgk-casino-sound-v1';
 class CasinoSound{
  constructor(onChange=()=>{}){
   this.onChange=onChange;this.context=null;this.master=null;this.voices=new Set();this.noiseBuffer=null;this.enabled=false;
   try{this.enabled=localStorage.getItem(preference)==='on';}catch{}
  }
  setEnabled(value){
   this.enabled=Boolean(value);
   try{localStorage.setItem(preference,this.enabled?'on':'off');}catch{}
   if(!this.enabled){this.stop();if(this.context?.state==='running')this.master.gain.setTargetAtTime(0,this.context.currentTime,.008);}
   this.onChange(this.enabled);
   if(this.enabled)this.unlock();
  }
  unlock(){
   if(!this.enabled||document.hidden)return;
   try{
    if(!this.context||this.context.state==='closed'){
     const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Audio unavailable');
     this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=.55;
     const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-16;limiter.knee.value=12;limiter.ratio.value=5;
     this.master.connect(limiter);limiter.connect(this.context.destination);
    }
    this.master.gain.setTargetAtTime(.55,this.context.currentTime,.012);
    const context=this.context,resumed=context.resume();
    resumed?.catch(()=>{if(this.enabled&&this.context===context)this.unavailable();});
   }catch{this.unavailable();}
  }
  unavailable(){this.setEnabled(false);this.onChange(false,true);}
  ready(){return this.enabled&&!document.hidden&&this.context&&this.context.state!=='closed'&&this.master;}
  register(source,gain,group,extra=[]){
   const voice={source,gain,group};this.voices.add(voice);
   source.onended=()=>{this.voices.delete(voice);for(const node of [source,gain,...extra])try{node.disconnect();}catch{}};
  }
  note(frequency,start,duration,volume=.035,type='sine',group='effect',endFrequency=frequency){
   if(!this.ready())return;
   const ctx=this.context,source=ctx.createOscillator(),gain=ctx.createGain();source.type=type;
   source.frequency.setValueAtTime(frequency,start);source.frequency.exponentialRampToValueAtTime(endFrequency,start+duration);
   gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+Math.min(.008,duration/4));gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
   source.connect(gain);gain.connect(this.master);this.register(source,gain,group);source.start(start);source.stop(start+duration+.02);
  }
  noise(start,duration,volume,frequency,endFrequency,group='spin'){
   if(!this.ready())return;
   const ctx=this.context;
   if(!this.noiseBuffer){
    this.noiseBuffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const data=this.noiseBuffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
   }
   const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=this.noiseBuffer;source.loop=true;
   filter.type='bandpass';filter.Q.value=.7;filter.frequency.setValueAtTime(frequency,start);filter.frequency.exponentialRampToValueAtTime(endFrequency,start+duration);
   gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+Math.min(.12,duration/4));gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
   source.connect(filter);filter.connect(gain);gain.connect(this.master);this.register(source,gain,group,[filter]);source.start(start);source.stop(start+duration+.02);
  }
  roulette(duration){
   if(!this.ready())return;this.stopSpin();const start=this.context.currentTime+.01,seconds=duration/1000;
   this.noise(start,seconds,.085,1600,180);
   // Dense wooden chatter opens into separated, quieter clicks as the wheel slows.
   for(let i=0;i<54;i++){
    const progress=i/53,time=start+seconds*(.02+.95*progress**1.9);
    this.note(1050-progress*450,time,.019,.026-progress*.012,'triangle','spin',650-progress*260);
   }
  }
  slots(duration){
   if(!this.ready())return;this.stopSpin();const start=this.context.currentTime+.01;
   this.noise(start,duration/1000,.07,900,160);
   for(let reel=0;reel<3;reel++){
    const seconds=(1700+reel*350)/1000;
    for(let i=0;i<18+reel*3;i++){
     const progress=i/(17+reel*3),time=start+seconds*(.02+.88*progress**1.5);
     this.note(440+reel*110,time,.025,.012,'triangle','spin',280+reel*70);
    }
   }
  }
  play(kind,detail){
   if(!this.ready())return;const now=this.context.currentTime+.01;
   if(kind==='select')this.note(660,now,.055,.024,'sine','effect',480);
   if(kind==='start'){this.note(180,now,.10,.035,'triangle','effect',100);this.noise(now,.08,.06,1300,500,'effect');}
   if(kind==='reel-stop'){
    this.note(170+(detail||0)*45,now,.11,.05,'triangle','effect',75);
    this.noise(now,.055,.08,1700,600,'effect');
   }
   if(kind==='ball-stop'){
    this.note(780,now,.055,.032,'triangle','effect',420);this.note(520,now+.075,.07,.022,'triangle','effect',280);
   }
   if(kind==='refill')for(const [i,f] of [660,880].entries())this.note(f,now+i*.08,.18,.04);
   if(kind==='enable')this.note(660,now,.12,.03);
   if(kind==='loss')this.note(165,now,.15,.026,'triangle','effect',130);
   if(kind==='win'){
    const rare=detail==='legendary',notes=rare?[523.25,659.25,783.99,1046.5,1318.5]:[523.25,659.25,783.99,1046.5];
    notes.forEach((f,i)=>{this.note(f,now+i*.105,.32,.045);this.note(f*2,now+i*.105,.19,.009);});
   }
  }
  stop(group){
   if(!this.context)return;const now=this.context.currentTime;
   for(const voice of this.voices){if(group&&voice.group!==group)continue;
    try{voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setTargetAtTime(0,now,.008);voice.source.stop(now+.04);}catch{}
   }
  }
  stopSpin(){this.stop('spin');}
  close(){this.stop();const context=this.context;this.context=null;this.master=null;this.noiseBuffer=null;this.voices.clear();context?.close().catch(()=>{});}
 }
 window.PGKCasinoSound=CasinoSound;
})();
