// Fully synthetic WebAudio sound: no audio files, everything is oscillators
// and filtered noise. Starts on the first user gesture (the start button).
import { S } from './config.js';

let ctx = null;
let master = null;
let engineOsc = null, engineOsc2 = null, engineGain = null;
let sirenOsc = null, sirenGain = null, sirenTimer = 0, sirenHigh = false;
let padOsc = [], padGain = null;
let noiseBuf = null;

function ensure() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = S.muted ? 0 : 0.55;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { return false; }
  return true;
}

function blip(freq, dur, type = 'sine', vol = 0.3, slideTo = null) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(master);
  o.start();
  o.stop(ctx.currentTime + dur + 0.02);
}

function noiseBurst(dur, vol, filterFreq, type = 'lowpass') {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(f).connect(g).connect(master);
  src.start();
  src.stop(ctx.currentTime + dur + 0.02);
}

export const AudioSys = {
  init() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    this.startPad();
  },
  setMuted(m) {
    S.muted = m;
    if (master) master.gain.value = m ? 0 : 0.55;
  },
  // Slow warm synth pad: a I–V–vi–IV loop in C major, very quiet.
  startPad() {
    if (!ctx || padOsc.length) return;
    padGain = ctx.createGain();
    padGain.gain.value = 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    padGain.connect(lp).connect(master);
    const chords = [[130.8, 164.8, 196.0], [98.0, 123.5, 146.8], [110.0, 130.8, 164.8], [87.3, 110.0, 130.8]];
    let ci = 0;
    const playChord = () => {
      if (!ctx) return;
      for (const o of padOsc) { try { o.stop(); } catch { /* already stopped */ } }
      padOsc = chords[ci % chords.length].map((f) => {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.connect(padGain);
        o.start();
        return o;
      });
      ci++;
    };
    playChord();
    setInterval(() => { if (!S.paused) playChord(); }, 6000);
  },
  engine(on, speed01) {
    if (!ctx) return;
    if (on && !engineOsc) {
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
      engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'square';
      engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      engineOsc.connect(lp); engineOsc2.connect(lp);
      lp.connect(engineGain).connect(master);
      engineOsc.start(); engineOsc2.start();
    }
    if (!on && engineOsc) {
      try { engineOsc.stop(); engineOsc2.stop(); } catch { /* noop */ }
      engineOsc = engineOsc2 = engineGain = null;
      return;
    }
    if (engineOsc) {
      const f = 55 + speed01 * 130;
      engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(f * 1.5 + 3, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.05, ctx.currentTime, 0.1);
    }
  },
  siren(on, dt) {
    if (!ctx) return;
    if (on && !sirenOsc) {
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle';
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0.045;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
      sirenTimer = 0; sirenHigh = false;
    }
    if (!on && sirenOsc) {
      try { sirenOsc.stop(); } catch { /* noop */ }
      sirenOsc = sirenGain = null;
      return;
    }
    if (sirenOsc) {
      sirenTimer += dt;
      if (sirenTimer > 0.45) { sirenTimer = 0; sirenHigh = !sirenHigh; }
      sirenOsc.frequency.setTargetAtTime(sirenHigh ? 920 : 660, ctx.currentTime, 0.05);
    }
  },
  shot(kind) {
    if (!ctx) return;
    if (kind === 'smg') { noiseBurst(0.09, 0.22, 1800, 'bandpass'); blip(160, 0.07, 'square', 0.1, 60); }
    else { noiseBurst(0.16, 0.35, 900); blip(120, 0.12, 'square', 0.16, 45); }
  },
  enemyShot() { if (ctx) noiseBurst(0.1, 0.1, 1400, 'bandpass'); },
  reload() { blip(700, 0.06, 'square', 0.12); setTimeout(() => blip(500, 0.08, 'square', 0.12), 120); },
  crash() { noiseBurst(0.25, 0.4, 500); blip(90, 0.2, 'sawtooth', 0.2, 40); },
  pickup() { blip(660, 0.1, 'sine', 0.25); setTimeout(() => blip(990, 0.14, 'sine', 0.25), 90); },
  cash() { blip(880, 0.09, 'triangle', 0.25); setTimeout(() => blip(1174, 0.09, 'triangle', 0.25), 90); setTimeout(() => blip(1568, 0.16, 'triangle', 0.25), 180); },
  missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.25), i * 110)); },
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'triangle', 0.28), i * 130)); },
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'sawtooth', 0.18), i * 200)); },
  wasted() { [330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.18), i * 220)); },
  click() { blip(900, 0.05, 'sine', 0.15); },
  horn() { blip(370, 0.25, 'square', 0.12); blip(466, 0.25, 'square', 0.1); },
};
