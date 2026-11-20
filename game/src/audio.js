// CAYO BRAVO — audio.js: fully procedural WebAudio sound. Engine hum follows
// speed, the radio plays generative island melodies per station, and every
// gunshot, siren and UI blip is synthesised — no audio files needed.

import { RADIO_STATIONS } from './config.js';

export function createAudio() {
  const A = {
    ctx: null, master: null, engineOsc: null, engineGain: null,
    radioTimer: 0, nextNote: 0, station: 0, volume: 0.7,
    sirenOsc: null, sirenGain: null, sirenOn: false, muted: false,

    init() {
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
        // Engine: two detuned saws through a lowpass, pitch follows speed.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        const engineFilter = this.ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 420;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(engineFilter);
        engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        // Siren: alternating two-tone.
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 750;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      } catch { /* audio unavailable — game still plays */ }
    },

    setVolume(v) {
      this.volume = v;
      if (this.master) this.master.gain.value = v;
    },

    setStation(i) {
      this.station = ((i % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
      this.nextNote = 0;
    },

    // Generative radio: a pentatonic melody + soft bass over the station tempo.
    updateRadio(dt, driving) {
      if (!this.ctx || this.muted) return;
      this.radioTimer -= dt;
      if (this.radioTimer > 0) return;
      const st = RADIO_STATIONS[this.station];
      const beat = 60 / st.tempo;
      this.radioTimer = beat / 2;
      const step = this.nextNote++;
      const base = 220;
      if (step % 8 === 0) this.blip(base / 2, beat * 1.8, 'sine', 0.16); // bass root
      if (driving || step % 2 === 0) {
        const degree = st.scale[Math.floor(Math.random() * st.scale.length)];
        const octave = Math.random() < 0.25 ? 2 : 1;
        this.blip(base * octave * Math.pow(2, degree / 12), beat * 0.9, 'triangle', 0.10);
      }
      if (step % 4 === 2) this.noise(0.05, 0.05); // hat tick
    },

    blip(freq, dur, type, vol) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },

    noise(dur, vol) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.2;
      src.connect(g); g.connect(this.master);
      src.start(t);
    },

    updateEngine(speedKmh, driving) {
      if (!this.ctx || !this.engineGain) return;
      const target = driving ? 0.05 + Math.min(0.16, speedKmh / 900) : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      this.engineOsc.frequency.setTargetAtTime(50 + speedKmh * 1.1, this.ctx.currentTime, 0.1);
    },

    updateSiren(wanted) {
      if (!this.ctx || !this.sirenGain) return;
      const on = wanted > 0;
      this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, this.ctx.currentTime, 0.3);
      if (on) {
        const t = this.ctx.currentTime;
        this.sirenOsc.frequency.setValueAtTime(750 + Math.sin(t * 4) * 180, t);
      }
    },

    gunshot(vol) { this.noise(0.14, 0.35 * (vol ?? 1)); this.blip(120, 0.1, 'square', 0.12); },
    punch() { this.noise(0.07, 0.25); this.blip(90, 0.08, 'sine', 0.2); },
    dryFire() { this.blip(1400, 0.05, 'square', 0.08); },
    reload() { this.blip(500, 0.06, 'square', 0.1); setTimeout(() => this.blip(700, 0.06, 'square', 0.1), 120); },
    weaponSwap() { this.blip(900, 0.05, 'triangle', 0.1); },
    thud() { this.blip(70, 0.18, 'sine', 0.3); this.noise(0.1, 0.2); },
    explosion() { this.noise(0.8, 0.5); this.blip(45, 0.7, 'sine', 0.4); },
    sirenBlip() { this.blip(900, 0.12, 'triangle', 0.14); setTimeout(() => this.blip(700, 0.12, 'triangle', 0.14), 140); },
    engineStart() { this.blip(60, 0.4, 'sawtooth', 0.15); },
    missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.14), i * 110)); },
    stageClear() { [659, 880].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.14), i * 100)); },
    missionComplete() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'triangle', 0.15), i * 120)); },
    missionFail() { [400, 300, 200].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'sawtooth', 0.1), i * 140)); },
    uiClick() { this.blip(800, 0.06, 'triangle', 0.12); },
  };
  return A;
}
