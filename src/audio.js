export class GameAudio {
  constructor() {
    this.volume = 0.35;
    this.ctx = null;
    this.music = null;
    this.nextRadio = 0;
    this.note = 0;
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    this.ctx.resume().catch(() => {});
  }
  setVolume(v) {
    this.volume = Number(v);
    if (this.master) this.master.gain.value = this.volume;
    if (this.music) this.music.volume = this.volume;
  }
  tone(f = 440, duration = 0.1, type = "sine", gain = 0.15, end) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain(),
      t = this.ctx.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (end) o.frequency.exponentialRampToValueAtTime(end, t + duration);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  noise(duration=.12, frequency=900, gain=.14, filter='lowpass') {
    if(!this.ctx || this.ctx.state!=='running')return;
    if(!this.noiseBuffer){this.noiseBuffer=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);const data=this.noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}
    const source=this.ctx.createBufferSource(),shape=this.ctx.createBiquadFilter(),volume=this.ctx.createGain(),t=this.ctx.currentTime;
    source.buffer=this.noiseBuffer;source.playbackRate.value=.85+Math.random()*.3;
    shape.type=filter;shape.frequency.value=frequency;shape.Q.value=.7;
    volume.gain.setValueAtTime(gain,t);volume.gain.exponentialRampToValueAtTime(.001,t+duration);
    source.connect(shape);shape.connect(volume);volume.connect(this.master);source.start(t);source.stop(t+duration);
    source.onended=()=>{source.disconnect();shape.disconnect();volume.disconnect();};
  }
  material(type, strong=false) {
    const stone=['stone','ore','bedrock'].includes(type),wood=['wood','birch'].includes(type),gain=strong?.23:.11;
    this.noise(strong?.25:.09,stone?2400:wood?750:1100,gain,stone?'highpass':'lowpass');
    this.tone(stone?340:wood?180:90,strong?.12:.055,'triangle',gain*.8,stone?160:55);
  }
  footstep(type, water=false) {
    this.noise(.12,water?2200:type==='stone'?1500:650,.047);
    if(!water)this.tone(type==='stone'?140:90,.06,'sine',.05,40);
  }
  play(name, material='stone') {
    if (name === "mine") this.material(material);
    if(name === "break")this.material(material,true);
    if(name === "swing")this.noise(.12,1500,.024,"bandpass");
    if(name === "land")this.noise(.18,500,.11);
    if (name === "place") this.tone(190, 0.09, "sine", 0.18, 95);
    if (name === "hit") this.tone(110, 0.18, "sawtooth", 0.1, 40);
    if (name === "jump") this.tone(240, 0.15, "sine", 0.06, 420);
    if (name === "eat") {
      this.tone(520, 0.08, "triangle", 0.1);
      setTimeout(() => this.tone(680, 0.1, "triangle", 0.1), 110);
    }
    if (name === "lucky")
      [523, 659, 784, 1046].forEach((f, i) =>
        setTimeout(() => this.tone(f, 0.25, "triangle", 0.12), i * 90),
      );
    if (name === "explosion") {
      this.noise(.9,1600,.32);
      this.tone(64, 0.8, "sawtooth", 0.27, 18);
      this.tone(111, 0.5, "triangle", 0.23, 22);
    }
    if (name === "gnome") {
      this.tone(380, 0.24, "sine", 0.18, 310);
      setTimeout(() => this.tone(340, 0.32, "sine", 0.2, 260), 280);
    }
    if (name === "horn")
      [277, 349, 415].forEach((f) => this.tone(f, 1.8, "sawtooth", 0.07));
    if (name === "mega")
      [220, 330, 440].forEach((f) =>
        this.tone(f, 0.65, "square", 0.045, f * 0.6),
      );
  }
  loadMusic(file) {
    if (this.music) {
      this.music.pause();
      URL.revokeObjectURL(this.music.src);
    }
    this.music = new Audio(URL.createObjectURL(file));
    this.music.loop = true;
    this.music.volume = this.volume;
  }
  updateRadio(active, time) {
    if (this.music) {
      if (active && this.music.paused) this.music.play().catch(() => {});
      if (!active && !this.music.paused) this.music.pause();
      return;
    }
    if (active && time > this.nextRadio) {
      const notes = [
        330, 392, 494, 392, 440, 330, 294, 392, 330, 262, 294, 330,
      ];
      this.tone(notes[this.note++ % notes.length], 0.22, "sine", 0.035);
      this.nextRadio = time + 0.29;
    }
  }
}
