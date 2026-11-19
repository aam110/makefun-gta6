// Palmera Heat — synthesized sound, no audio files.
// Every sound is built from oscillators and filtered noise in the Web Audio
// API: engine hum, police siren, gunshots, pickups, explosions, and a small
// synthwave bassline that loops while driving. Everything is guarded so a
// missing or suspended AudioContext can never break the game.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicOn = false;
  }

  /** Create the context. Call from a user gesture (start button, key press). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      this._startEngineLoop();
      this._startSirenLoop();
    } catch (err) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(muted ? 0 : 0.9, this.ctx.currentTime);
    }
  }

  // --- Continuous loops ---------------------------------------------------

  _startEngineLoop() {
    const ctx = this.ctx;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 28;
    const g2 = ctx.createGain();
    g2.gain.value = 0.4;
    this.engineOsc.connect(filter);
    this.engineOsc2.connect(g2);
    g2.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineOsc2.start();
  }

  /** speed01: 0..1 of top speed. driving: whether the player is in a car. */
  setEngine(speed01, driving) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    const target = driving ? 0.05 + speed01 * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    const freq = 48 + speed01 * 130;
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(freq * 0.5, t, 0.05);
  }

  _startSirenLoop() {
    const ctx = this.ctx;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 720;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  /** level 0..1: how loud the nearest siren should be. Call every frame. */
  setSiren(level, dt) {
    if (!this.ctx || !this.sirenGain) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(level * 0.055, t, 0.1);
    if (level > 0.02) {
      this.sirenTimer += dt;
      if (this.sirenTimer > 0.42) {
        this.sirenTimer = 0;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 920 : 660, t, 0.02);
      }
    }
  }

  // --- One-shot sounds ----------------------------------------------------

  _noiseBuffer(seconds) {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _blip(freq, seconds, type, gain, slideTo) {
    if (!this.ctx) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + seconds);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + seconds + 0.02);
    } catch (err) { /* sound is never fatal */ }
  }

  _noise(seconds, gain, filterFreq, filterType = 'lowpass') {
    if (!this.ctx) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffer(seconds);
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = filterFreq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t);
    } catch (err) { /* sound is never fatal */ }
  }

  gunshot() {
    this._noise(0.14, 0.5, 2400, 'highpass');
    this._blip(160, 0.09, 'square', 0.25, 60);
  }

  distantShot() {
    this._noise(0.1, 0.12, 900);
  }

  explosion() {
    this._noise(0.8, 0.8, 320);
    this._blip(70, 0.6, 'sine', 0.6, 28);
  }

  crash() {
    this._noise(0.25, 0.4, 500);
  }

  pickup() {
    this._blip(660, 0.09, 'sine', 0.3);
    setTimeout(() => this._blip(990, 0.14, 'sine', 0.3), 80);
  }

  cashRegister() {
    this._blip(880, 0.08, 'triangle', 0.3);
    setTimeout(() => this._blip(1174, 0.08, 'triangle', 0.3), 90);
    setTimeout(() => this._blip(1568, 0.16, 'triangle', 0.3), 180);
  }

  uiClick() {
    this._blip(520, 0.06, 'sine', 0.2);
  }

  missionPass() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this._blip(f, 0.22, 'triangle', 0.3), i * 130));
  }

  missionFail() {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => setTimeout(() => this._blip(f, 0.25, 'triangle', 0.25), i * 150));
  }

  punch() {
    this._noise(0.08, 0.3, 700);
  }

  horn() {
    this._blip(370, 0.28, 'square', 0.12);
    this._blip(466, 0.28, 'square', 0.12);
  }

  // --- Music: a small synthwave bassline -----------------------------------

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    // A minor groove: root notes in Hz, one per 8th note at ~112 BPM.
    const bass = [55, 55, 65.41, 55, 49, 49, 58.27, 65.41];
    const stepMs = 268;
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const i = this.musicStep % bass.length;
      const freq = bass[i];
      this._blip(freq, 0.24, 'sawtooth', 0.055);
      if (i % 2 === 0) this._noise(0.03, 0.02, 6000, 'highpass');
      if (i === 0) this._blip(freq * 4, 0.5, 'sine', 0.02);
      this.musicStep++;
    }, stepMs);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
