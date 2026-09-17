/* Runefall — procedural WebAudio SFX (no assets). Tiny osc/noise synth. */
window.RF = window.RF || {};
RF.Audio = (() => {
  let ctx = null, master = null, muted = localStorage.getItem('runefall_mute') === '1';
  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type = 'square', vol = 1, slide = 0, delay = 0) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol = 1, delay = 0, low = 400) {
    if (muted) return;
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }
  const api = {
    unlock() { ac(); },
    get muted() { return muted; },
    toggleMute() { muted = !muted; try { localStorage.setItem('runefall_mute', muted ? '1' : '0'); } catch {} return muted; },
    ui() { tone(660, 0.06, 'square', 0.5); },
    swing() { noise(0.12, 0.5, 0, 1800); },
    shoot() { tone(880, 0.08, 'square', 0.4, -500); },
    cast() { tone(320, 0.2, 'sawtooth', 0.35, 400); },
    hit() { noise(0.08, 0.7, 0, 900); tone(180, 0.07, 'square', 0.4, -60); },
    kill() { noise(0.15, 0.6, 0, 700); tone(140, 0.14, 'triangle', 0.5, -80); },
    hurt() { tone(220, 0.18, 'sawtooth', 0.6, -120); noise(0.1, 0.4, 0, 600); },
    gem() { tone(1320, 0.07, 'square', 0.3, 300); },
    meat() { tone(520, 0.1, 'triangle', 0.5, 160); tone(780, 0.12, 'triangle', 0.4, 120, 0.08); },
    levelup() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.45, 0, i * 0.09)); },
    chest() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.14, 'triangle', 0.4, 0, i * 0.07)); },
    boss() { tone(98, 0.5, 'sawtooth', 0.7, -30); noise(0.5, 0.5, 0, 300); tone(65, 0.7, 'sawtooth', 0.6, 20, 0.15); },
    shrine() { [659, 784, 1047, 784, 1047, 1568].forEach((f, i) => tone(f, 0.2, 'sine', 0.4, 0, i * 0.1)); },
    over() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.5, 0, i * 0.18)); },
    warn() { tone(440, 0.12, 'square', 0.5); tone(440, 0.12, 'square', 0.5, 0, 0.18); }
  };
  return api;
})();
