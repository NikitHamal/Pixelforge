/* PixelForge Studio — Landing: procedural hero demo (uses the same raster engine), reveal, nav, tools table */
(() => {
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];

  /* Logo mark: tiny 8x8 sprite */
  (() => {
    const cv = q('#logo-canvas'); if (!cv) return; cv.width = cv.height = 8; const ctx = cv.getContext('2d'), id = ctx.createImageData(8, 8), p = new Uint32Array(id.data.buffer);
    PF.Raster.paintRows(p, 8, 8, ['..####..', '.#WWWW#.', '#WWEWWE#', '#WWWWWW#', '#WWWWWW#', '.#W##W#.', '..####..', '.#....#.'], { '#': '#1a0066', W: '#ffffff', E: '#5a38f0' });
    ctx.putImageData(id, 0, 0);
  })();

  /* Hero demo: bouncing slime + spinning coin generated at runtime with PF.Raster (no image assets) */
  (() => {
    const cv = q('#hero-demo'); if (!cv) return; const W = 48, H = 32; cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), buf = new Uint32Array(img.data.buffer), R = PF.Raster, C = PF.Color;
    const slime = { G: '#63c74d', L: '#a8f28a', W: '#ffffff', O: '#265c42', D: '#3e8948' };
    const A = ['......GGGG......', '....GGGGGGGG....', '...GGGGGGGGGG...', '..GGLLGGGGGGGG..', '..GLWWGGGGGGGG..', '.GGLWWGGGGGGGGG.', '.GGGGGOOGGOOGGG.', '.GGGGGOOGGOOGGG.', '.GGGGGGGGGGGGGG.', '.GGGGGGGGGGGGGG.', '..DDDDDDDDDDDD..'];
    const B = ['.....GGGGGG.....', '...GGGGGGGGGG...', '..GGLLGGGGGGGG..', '.GGLWWGGGGGGGGG.', '.GGLWWGGGGGGGGG.', 'GGGGGGOOGGOOGGGG', 'GGGGGGOOGGOOGGGG', 'GGGGGGGGGGGGGGGG', '.DDDDDDDDDDDDDD.'];
    const coinW = [12, 8, 4, 2, 4, 8], ground = C.hexToU32('#3a4466'), grass = C.hexToU32('#3e8948');
    let f = 0, last = 0;
    function frame(t) {
      if (t - last > 125) { last = t; f++; }
      buf.fill(0);
      R.rect(buf, W, H, 0, 28, W - 1, H - 1, ground, { fill: true }); R.line(buf, W, H, 0, 28, W - 1, 28, grass, 1);
      const squash = f % 4 === 1 || f % 4 === 3, rows = squash ? B : A, y = 28 - rows.length - (f % 4 === 2 ? 1 : 0);
      R.paintRows(buf, W, H, rows, slime, 4, y);
      const w = coinW[f % 6], x = 34 - w / 2, cy = 8 + Math.round(Math.sin(f / 2) * 1.5);
      R.ellipse(buf, W, H, x, cy, x + w - 1, cy + 11, C.hexToU32('#feae34'), { fill: true });
      if (w >= 4) R.ellipse(buf, W, H, x + 1, cy + 1, x + w - 2, cy + 10, C.hexToU32('#fee761'), {});
      const o = R.outline(buf, W, H, C.hexToU32('#181425')); buf.set(o);
      R.rect(buf, W, H, 0, 28, W - 1, H - 1, ground, { fill: true }); R.line(buf, W, H, 0, 28, W - 1, 28, grass, 1);
      R.paintRows(buf, W, H, rows, slime, 4, y);
      ctx.putImageData(img, 0, 0);
      if (document.visibilityState === 'visible') requestAnimationFrame(frame);
      else setTimeout(() => requestAnimationFrame(frame), 500);
    }
    requestAnimationFrame(frame);
  })();

  /* Scroll reveal */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: .12 });
  qa('.reveal').forEach(el => io.observe(el));

  /* Nav active section */
  const links = qa('.topbar nav a'), sections = links.map(a => q(a.getAttribute('href'))).filter(Boolean);
  const nav = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(s => nav.observe(s));

  /* Live tools table + counters from the registry */
  const tbody = q('#tools-table tbody');
  if (tbody) PF.Tools.list().forEach(t => { const tr = document.createElement('tr');
    tr.innerHTML = `<td><code>${t.name}</code></td><td>${t.description}</td><td class="muted">${Object.keys(t.inputSchema.properties).join(', ') || '—'}</td>`; tbody.appendChild(tr); });
  qa('[data-count="tools"]').forEach(el => { el.textContent = PF.Tools.list().length; });
  qa('[data-count="formats"]').forEach(el => { el.textContent = PF.IO.FORMATS.length; });
  qa('[data-count="presets"]').forEach(el => { el.textContent = PF.Anim.PRESETS.length; });
  qa('[data-count="ui"]').forEach(el => { el.textContent = document.querySelectorAll('[data-agent-id]').length + '+'; });

  /* "Try in console" buttons in the agent section */
  qa('[data-try]').forEach(b => b.addEventListener('click', () => { q('#studio').scrollIntoView({ behavior: 'smooth', block: 'start' }); PF.UI.setView('agent'); setTimeout(() => { q('#agent-input').value = b.dataset.try; q('#agent-send').click(); }, 500); }));
  qa('[data-open-studio]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); q('#studio').scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => PF.Renderer.fit(), 600); }));

  /* Year */
  const y = q('#year'); if (y) y.textContent = new Date().getFullYear();
})();
