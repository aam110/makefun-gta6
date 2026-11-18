// Fully synthesized WebAudio sound: no audio files, no network.
// Engine hum, police siren, gunshots, pickups, UI — all oscillators + filtered noise.

export function createAudio() {
  const A = {
    ctx: null, master: null, noiseBuf: null,
    engine: null, siren: null,
    enabled: true, sirenOn: false,
  };

  function ensure() {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      A.ctx = new AC();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.5;
      A.master.connect(A.ctx.destination);
      const len = A.ctx.sampleRate * 1;
      A.noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const d = A.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch { return false; }
  }

  function noiseBurst({ dur = 0.15, freq = 1200, q = 0.8, gain = 0.5, type = 'lowpass', when = 0 }) {
    if (!ensure() || !A.enabled) return;
    const t = A.ctx.currentTime + when;
    const src = A.ctx.createBufferSource();
    src.buffer = A.noiseBuf;
    src.loop = true;
    const f = A.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(A.master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  function tone({ freq = 440, freqEnd = null, dur = 0.15, type = 'sine', gain = 0.3, when = 0 }) {
    if (!ensure() || !A.enabled) return;
    const t = A.ctx.currentTime + when;
    const o = A.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  return {
    ensure,
    setEnabled(v) { A.enabled = v; if (!v) { this.setEngine(0, false); this.setSiren(false); } },

    // Continuous engine loop: two detuned saws through a lowpass. speed01 = 0..1.
    setEngine(speed01, running) {
      if (!ensure() || !A.enabled) return;
      if (!running || speed01 <= 0.01) {
        if (A.engine) { try { A.engine.gain.gain.value = 0; } catch {} }
        return;
      }
      if (!A.engine) {
        const g = A.ctx.createGain(); g.gain.value = 0;
        const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
        const o1 = A.ctx.createOscillator(); o1.type = 'sawtooth';
        const o2 = A.ctx.createOscillator(); o2.type = 'square';
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(A.master);
        o1.start(); o2.start();
        A.engine = { o1, o2, gain: g, filter: f };
      }
      const base = 55 + speed01 * 130;
      A.engine.o1.frequency.value = base;
      A.engine.o2.frequency.value = base * 0.5 + 3;
      A.engine.filter.frequency.value = 350 + speed01 * 1400;
      A.engine.gain.gain.value = 0.05 + speed01 * 0.075;
    },

    // Two-tone police siren (wail). Call every frame with on/off.
    setSiren(on) {
      if (!ensure() || !A.enabled) { on = false; }
      if (on === A.sirenOn) return;
      A.sirenOn = on;
      if (!A.siren) {
        const o = A.ctx.createOscillator(); o.type = 'triangle';
        const lfo = A.ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 0.9;
        const lfoGain = A.ctx.createGain(); lfoGain.gain.value = 180;
        const g = A.ctx.createGain(); g.gain.value = 0;
        o.frequency.value = 820;
        lfo.connect(lfoGain); lfoGain.connect(o.frequency);
        o.connect(g); g.connect(A.master);
        o.start(); lfo.start();
        A.siren = { gain: g };
      }
      A.siren.gain.gain.setTargetAtTime(on ? 0.045 : 0, A.ctx.currentTime, 0.15);
    },

    shot(weapon) {
      if (weapon === 'smg') noiseBurst({ dur: 0.09, freq: 2600, gain: 0.32 });
      else { noiseBurst({ dur: 0.16, freq: 1500, gain: 0.5 }); tone({ freq: 160, freqEnd: 55, dur: 0.12, type: 'square', gain: 0.22 }); }
    },
    enemyShot() { noiseBurst({ dur: 0.12, freq: 1100, gain: 0.22 }); },
    crash(hard) { noiseBurst({ dur: hard ? 0.4 : 0.2, freq: 500, gain: hard ? 0.6 : 0.3 }); },
    explosion() {
      noiseBurst({ dur: 0.9, freq: 220, gain: 0.85 });
      tone({ freq: 90, freqEnd: 28, dur: 0.7, type: 'sine', gain: 0.6 });
    },
    pickup() { tone({ freq: 880, dur: 0.09, gain: 0.25 }); tone({ freq: 1320, dur: 0.14, gain: 0.25, when: 0.08 }); },
    cash() { tone({ freq: 1046, dur: 0.08, gain: 0.22 }); tone({ freq: 1568, dur: 0.16, gain: 0.22, when: 0.07 }); },
    click() { tone({ freq: 660, dur: 0.06, type: 'square', gain: 0.12 }); },
    wantedUp() { tone({ freq: 392, dur: 0.12, type: 'square', gain: 0.2 }); tone({ freq: 311, dur: 0.2, type: 'square', gain: 0.2, when: 0.12 }); },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.16, gain: 0.22, when: i * 0.11 }));
    },
    busted() { [330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.28, type: 'triangle', gain: 0.25, when: i * 0.22 })); },
    horn() { tone({ freq: 370, dur: 0.25, type: 'square', gain: 0.14 }); tone({ freq: 466, dur: 0.25, type: 'square', gain: 0.1 }); },
  };
}
