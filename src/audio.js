export class EngineAudio {
  constructor(){this.context=null;this.volume=.28;}
  start(){
    if(this.context){this.context.resume();return;}
    try{
      this.context=new (window.AudioContext||window.webkitAudioContext)();
      this.gain=this.context.createGain();this.gain.gain.value=0;this.gain.connect(this.context.destination);
      this.engine=this.context.createOscillator();this.engine.type='sawtooth';
      this.filter=this.context.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=210;
      this.engine.connect(this.filter);this.filter.connect(this.gain);this.engine.start();
      const length=this.context.sampleRate*2,buffer=this.context.createBuffer(1,length,this.context.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*.4;
      this.wind=this.context.createBufferSource();this.wind.buffer=buffer;this.wind.loop=true;
      this.windGain=this.context.createGain();this.windGain.gain.value=0;
      this.wind.connect(this.windGain);this.windGain.connect(this.context.destination);this.wind.start();
    }catch{}
  }
  update(f,paused){
    if(!this.context)return;
    const now=this.context.currentTime,v=paused?0:this.volume;
    this.engine.frequency.setTargetAtTime(28+f.throttle*58+f.speed*.16,now,.12);
    this.gain.gain.setTargetAtTime(v*(.012+f.throttle*.045),now,.2);
    this.filter.frequency.setTargetAtTime(120+f.throttle*380,now,.2);
    this.windGain.gain.setTargetAtTime(v*Math.min(.04,f.speed*.00035),now,.3);
  }
  chime(){
    if(!this.context)return;
    const now=this.context.currentTime;
    for(let i=0;i<3;i++){
      const tone=this.context.createOscillator(),g=this.context.createGain();
      tone.frequency.value=[523.25,659.25,783.99][i];tone.connect(g);g.connect(this.context.destination);
      g.gain.setValueAtTime(0,now+i*.13);g.gain.linearRampToValueAtTime(this.volume*.12,now+i*.13+.01);g.gain.exponentialRampToValueAtTime(.001,now+i*.13+.4);
      tone.start(now+i*.13);tone.stop(now+i*.13+.45);
    }
  }
}
