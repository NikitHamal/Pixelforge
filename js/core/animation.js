/* PixelForge Studio — Animation: playback engine, state presets, independent live preview */
window.PF = window.PF || {};
PF.Anim = (() => {
  /* Common game animation states: [name, frames, fps] */
  const PRESETS = [
    ['idle', 4, 6], ['idle_down', 4, 6], ['idle_side', 4, 6], ['idle_up', 4, 6],
    ['walk', 6, 10], ['walk_down', 4, 8], ['walk_side', 4, 8], ['walk_up', 4, 8],
    ['run', 6, 12], ['run_side', 6, 12], ['jump', 4, 10], ['fall', 2, 8], ['land', 3, 12],
    ['attack', 5, 12], ['attack2', 6, 14], ['attack_sword_side', 5, 12], ['attack_sword_down', 5, 12],
    ['bow_side', 4, 10], ['mine_pickaxe', 5, 10], ['chop_axe', 4, 10],
    ['cast', 5, 10], ['block', 2, 6], ['hurt', 2, 8], ['death', 5, 8],
    ['sleep', 4, 4], ['eat', 4, 6], ['sit', 2, 6], ['pickup', 3, 8],
    ['climb', 4, 8], ['dash', 3, 14], ['crouch', 2, 6], ['swim', 4, 8], ['spin', 6, 12],
    ['open', 4, 8], ['glow', 4, 6], ['float', 4, 6], ['fly', 4, 12], ['burn', 4, 8], ['flow', 4, 6]
  ];
  let playing = false, acc = 0, lastT = 0, raf = 0;

  function play() { if (playing) return; playing = true; acc = 0; lastT = performance.now(); raf = requestAnimationFrame(tick); PF.Store.emit('play', true); }
  function pause() { playing = false; cancelAnimationFrame(raf); PF.Store.emit('play', false); }
  const toggle = () => (playing ? pause() : play());
  const isPlaying = () => playing;
  function tick(t) {
    if (!playing) return;
    const d = PF.Store.get(), st = PF.Store.state(); acc += t - lastT; lastT = t;
    const fr = st.frames[d.activeFrame];
    if (acc >= fr.duration) {
      acc = acc % fr.duration; let next = d.activeFrame + 1;
      if (next >= st.frames.length) { if (!st.loop) { pause(); return; } next = 0; }
      PF.Store.setActive({ frame: next });
    }
    raf = requestAnimationFrame(tick);
  }

  /* Create a state from a preset (optionally copying the current frame into every new frame) */
  function createFromPreset(name, { copyCurrent = true } = {}) {
    const p = PF.Anim.PRESETS.find(x => x[0] === name) || [name, 4, 8];
    const d = PF.Store.get(), src = PF.Store.frame();
    const idx = PF.Store.addState({ name: uniqueName(p[0]), fps: p[2], frames: p[1] });
    if (copyCurrent) PF.Store.transact(doc => {
      doc.states[idx].frames.forEach(f => { for (const id in src.pixels) f.pixels[id].set(src.pixels[id]); });
    });
    return idx;
  }
  function uniqueName(base) {
    const names = new Set(PF.Store.get().states.map(s => s.name)); if (!names.has(base)) return base;
    let i = 2; while (names.has(`${base}-${i}`)) i++; return `${base}-${i}`;
  }

  /* Independent looping preview (does not touch the active frame) */
  const preview = (() => {
    let cv, idx = 0, pacc = 0, plast = 0, pr = 0, stateIdx = null, need = true;
    function init(el) {
      cv = el; plast = performance.now();
      PF.Store.on('change', () => { need = true; }); PF.Store.on('doc', () => { stateIdx = null; need = true; });
      pr = requestAnimationFrame(loop);
    }
    function loop(t) {
      const d = PF.Store.get(), si = stateIdx ?? d.activeState, st = d.states[si] || d.states[0];
      if (cv.width !== d.width * 4 || cv.height !== d.height * 4) { cv.width = d.width * 4; cv.height = d.height * 4; need = true; }
      if (idx >= st.frames.length) { idx = 0; need = true; }
      pacc += t - plast; plast = t;
      if (pacc >= st.frames[idx].duration) { pacc = 0; idx = (idx + 1) % st.frames.length; need = true; }
      if (need && document.visibilityState === 'visible' && cv.offsetParent !== null) { PF.Renderer.frameToCanvas(st.frames[idx], 4, cv); need = false; }
      pr = requestAnimationFrame(loop);
    }
    return { init, setState: i => { stateIdx = i; idx = 0; need = true; } };
  })();

  return { PRESETS, play, pause, toggle, isPlaying, createFromPreset, uniqueName, preview };
})();
