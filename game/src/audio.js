// BLOCKBURST — audio.js (Worker 2)
// WebAudio synth only — no audio files, no network.
// All sounds are generated with oscillators (+ a tiny noise burst for the
// place "thock"). Safe to call before any user gesture: the AudioContext
// is created lazily and resumed on first use; in environments without
// WebAudio every method is a silent no-op (never throws).

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let _muted = false;

  // Lazily create (and resume) the context. Returns null when WebAudio is
  // unavailable or creation fails — callers must tolerate that.
  function ensure() {
    try {
      const AC =
        (typeof globalThis !== 'undefined' &&
          (globalThis.AudioContext || globalThis.webkitAudioContext)) ||
        (typeof window !== 'undefined' &&
          (window.AudioContext || window.webkitAudioContext));
      if (!AC) return null;
      if (!ctx) {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = _muted ? 0 : 0.5;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') {
        const p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
      return ctx;
    } catch (e) {
      return null;
    }
  }

  // One enveloped oscillator note. `at` is seconds from now.
  function tone({ freq, freqEnd, at = 0, dur = 0.15, type = 'sine', vol = 0.3 }) {
    const c = ensure();
    if (!c || !master) return;
    try {
      const t0 = c.currentTime + at;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(1, freq), t0);
      if (freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
      }
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (e) {
      // Never let audio break the game.
    }
  }

  // Short filtered noise burst (the woody knock inside the "thock").
  function noise({ at = 0, dur = 0.06, vol = 0.18, freq = 900 } = {}) {
    const c = ensure();
    if (!c || !master) return;
    try {
      if (!noiseBuf) {
        const len = Math.floor(c.sampleRate * 0.1);
        noiseBuf = c.createBuffer(1, len, c.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      const t0 = c.currentTime + at;
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const gain = c.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    } catch (e) {
      // Silent no-op.
    }
  }

  // Placement "thock": quick pitch drop + woody knock.
  function place() {
    tone({ freq: 210, freqEnd: 85, dur: 0.09, type: 'triangle', vol: 0.4 });
    noise({ dur: 0.05, vol: 0.16, freq: 1100 });
  }

  // Line-clear pop: one rising pop per line, staggered, pitch climbing
  // with the line count so a multi-line clear sounds bigger.
  function clear(nLines) {
    const n = clampInt(nLines, 1, 8);
    for (let i = 0; i < n; i++) {
      const base = 360 + i * 130;
      tone({ freq: base, freqEnd: base * 2.1, at: i * 0.06, dur: 0.14, type: 'sine', vol: 0.32 });
      tone({ freq: base * 2, freqEnd: base * 2.6, at: i * 0.06 + 0.02, dur: 0.1, type: 'triangle', vol: 0.12 });
    }
  }

  // Combo chime: bright 3-note arpeggio, rising a whole step per combo
  // level so higher combos sound higher.
  function combo(level) {
    const lv = clampInt(level, 2, 12);
    const base = 523.25 * Math.pow(2, (lv - 2) * 2 / 12); // +2 semitones/level
    const steps = [0, 4, 7, 12]; // major arpeggio
    steps.forEach((st, i) => {
      const f = base * Math.pow(2, st / 12);
      tone({ freq: f, at: i * 0.07, dur: 0.24, type: 'triangle', vol: 0.26 });
      tone({ freq: f * 2, at: i * 0.07, dur: 0.16, type: 'sine', vol: 0.08 });
    });
  }

  // Game-over jingle: gentle descending phrase.
  function gameOver() {
    const notes = [392.0, 329.63, 261.63, 196.0];
    notes.forEach((f, i) => {
      tone({ freq: f, at: i * 0.17, dur: 0.26, type: 'triangle', vol: 0.28 });
    });
    tone({ freq: 130.81, at: notes.length * 0.17, dur: 0.5, type: 'sine', vol: 0.22 });
  }

  function setMuted(b) {
    _muted = !!b;
    if (master && ctx) {
      try {
        master.gain.setTargetAtTime(_muted ? 0 : 0.5, ctx.currentTime, 0.01);
      } catch (e) {
        master.gain.value = _muted ? 0 : 0.5;
      }
    }
  }

  function clampInt(v, lo, hi) {
    const n = Number.isFinite(v) ? Math.floor(v) : lo;
    return Math.max(lo, Math.min(hi, n));
  }

  return {
    place,
    clear,
    combo,
    gameOver,
    setMuted,
    get muted() { return _muted; },
    isMuted() { return _muted; },
    // Call from the first pointer/key handler to unlock audio on iOS.
    resume() { ensure(); },
  };
}
