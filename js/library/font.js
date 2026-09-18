/* PixelForge Studio — Bitmap font engine.
   Two hand-drawn fonts (5x7 UI, 3x5 micro) stored as readable bitmaps, plus a
   renderer that draws wrapped, aligned, shadowed text straight into any pixel
   buffer. Fonts here are assets like any other: they can be previewed, styled,
   exported to BMFont for engines that want a `.fnt`, or dropped into a project
   as a text banner.

   Glyph source is '.' / '#' rows joined by '/', which keeps the tables
   reviewable in a diff — a mis-drawn pixel is visible in the source, not
   hidden inside a hex blob. */
window.PF = window.PF || {};
PF.Font = (() => {
  /* ---------------- 5x7 — the primary UI font ---------------- */
  const G5 = {
    A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
    B: '####./#...#/#...#/####./#...#/#...#/####.',
    C: '.###./#...#/#..../#..../#..../#...#/.###.',
    D: '####./#...#/#...#/#...#/#...#/#...#/####.',
    E: '#####/#..../#..../####./#..../#..../#####',
    F: '#####/#..../#..../####./#..../#..../#....',
    G: '.###./#...#/#..../#.###/#...#/#...#/.###.',
    H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    I: '#####/..#../..#../..#../..#../..#../#####',
    J: '..###/...#./...#./...#./...#./#..#./.##..',
    K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
    L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#...#/#...#/#...#/#...#',
    N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
    O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    P: '####./#...#/#...#/####./#..../#..../#....',
    Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
    R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.',
    T: '#####/..#../..#../..#../..#../..#../..#..',
    U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
    V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
    W: '#...#/#...#/#...#/#...#/#.#.#/##.##/#...#',
    X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
    Z: '#####/....#/...#./..#../.#.../#..../#####',
    0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
    1: '..#../.##../..#../..#../..#../..#../.###.',
    2: '.###./#...#/....#/...#./..#../.#.../#####',
    3: '####./....#/....#/.###./....#/....#/####.',
    4: '...#./..##./.#.#./#..#./#####/...#./...#.',
    5: '#####/#..../####./....#/....#/#...#/.###.',
    6: '..##./.#.../#..../####./#...#/#...#/.###.',
    7: '#####/....#/...#./..#../.#.../.#.../.#...',
    8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
    9: '.###./#...#/#...#/.####/....#/...#./.##..',
    ' ': '...../...../...../...../...../...../.....',
    '!': '..#../..#../..#../..#../..#../...../..#..',
    '"': '.#.#./.#.#./...../...../...../...../.....',
    '#': '.#.#./.#.#./#####/.#.#./#####/.#.#./.#.#.',
    '$': '..#../.####/#.#../.###./..#.#/####./..#..',
    '%': '##.../##..#/...#./..#../.#.../#..##/...##',
    '&': '.##../#..#./#.#../.#.../#.#.#/#..#./.##.#',
    "'": '..#../..#../...../...../...../...../.....',
    '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
    ')': '.#.../..#../...#./...#./...#./..#../.#...',
    '*': '...../..#../#.#.#/.###./#.#.#/..#../.....',
    '+': '...../..#../..#../#####/..#../..#../.....',
    ',': '...../...../...../...../..##./..##./.#...',
    '-': '...../...../...../#####/...../...../.....',
    '.': '...../...../...../...../...../.##../.##..',
    '/': '....#/....#/...#./..#../.#.../#..../#....',
    ':': '...../.##../.##../...../.##../.##../.....',
    ';': '...../.##../.##../...../.##../..#../.#...',
    '<': '...#./..#../.#.../#..../.#.../..#../...#.',
    '=': '...../...../#####/...../#####/...../.....',
    '>': '.#.../..#../...#./....#/...#./..#../.#...',
    '?': '.###./#...#/....#/...#./..#../...../..#..',
    '@': '.###./#...#/#.###/#.#.#/#.###/#..../.###.',
    '[': '.###./.#.../.#.../.#.../.#.../.#.../.###.',
    '\\': '#..../#..../.#.../..#../...#./....#/....#',
    ']': '.###./...#./...#./...#./...#./...#./.###.',
    '^': '..#../.#.#./#...#/...../...../...../.....',
    '_': '...../...../...../...../...../...../#####',
    '`': '.#.../..#../...../...../...../...../.....',
    '{': '...#./..#../..#../.#.../..#../..#../...#.',
    '|': '..#../..#../..#../..#../..#../..#../..#..',
    '}': '.#.../..#../..#../...#./..#../..#../.#...',
    '~': '...../...../.##.#/#..#./...../...../.....'
  };

  /* ---------------- 3x5 — micro HUD font (caps + digits only) ---------------- */
  const G3 = {
    A: '.#./#.#/###/#.#/#.#',
    B: '##./#.#/##./#.#/##.',
    C: '.##/#../#../#../.##',
    D: '##./#.#/#.#/#.#/##.',
    E: '###/#../##./#../###',
    F: '###/#../##./#../#..',
    G: '.##/#../#.#/#.#/.##',
    H: '#.#/#.#/###/#.#/#.#',
    I: '###/.#./.#./.#./###',
    J: '..#/..#/..#/#.#/.#.',
    K: '#.#/#.#/##./#.#/#.#',
    L: '#../#../#../#../###',
    M: '#.#/###/###/#.#/#.#',
    N: '#.#/##./#.#/#.#/#.#',
    O: '.#./#.#/#.#/#.#/.#.',
    P: '##./#.#/##./#../#..',
    Q: '.#./#.#/#.#/##./.##',
    R: '##./#.#/##./#.#/#.#',
    S: '.##/#../.#./..#/##.',
    T: '###/.#./.#./.#./.#.',
    U: '#.#/#.#/#.#/#.#/.##',
    V: '#.#/#.#/#.#/.#./.#.',
    W: '#.#/#.#/###/###/#.#',
    X: '#.#/#.#/.#./#.#/#.#',
    Y: '#.#/#.#/.#./.#./.#.',
    Z: '###/..#/.#./#../###',
    0: '###/#.#/#.#/#.#/###',
    1: '.#./##./.#./.#./###',
    2: '##./..#/.#./#../###',
    3: '##./..#/.##/..#/##.',
    4: '#.#/#.#/###/..#/..#',
    5: '###/#../##./..#/##.',
    6: '.##/#../###/#.#/###',
    7: '###/..#/.#./.#./.#.',
    8: '###/#.#/###/#.#/###',
    9: '###/#.#/###/..#/##.',
    ' ': '.../.../.../.../...',
    '.': '.../.../.../.../.#.',
    ',': '.../.../.../.#./#..',
    '!': '.#./.#./.#./.../.#.',
    '?': '##./..#/.#./.../.#.',
    ':': '.../.#./.../.#./...',
    '-': '.../.../###/.../...',
    '+': '.../.#./###/.#./...',
    '/': '..#/..#/.#./#../#..',
    "'": '.#./.#./.../.../...',
    '(': '..#/.#./.#./.#./..#',
    ')': '#../.#./.#./.#./#..',
    '*': '.../#.#/.#./#.#/...',
    '=': '.../###/.../###/...',
    '%': '#.#/..#/.#./#../#.#'
  };

  function parse(table, w, h) {
    const out = new Map();
    for (const ch in table) {
      const rows = table[ch].split('/');
      const glyph = { ch, w, h, rows, bits: rows.map(r => r.split('').map(c => c === '#' ? 1 : 0)) };
      glyph.ink = glyph.bits.reduce((n, r) => n + r.reduce((a, b) => a + b, 0), 0);
      out.set(ch, glyph);
    }
    return out;
  }

  const FONTS = {
    '5x7': { id: '5x7', name: 'UI 5x7', w: 5, h: 7, tracking: 1, lineHeight: 9, base: 6,
      glyphs: parse(G5, 5, 7), desc: 'Caps + digits + punctuation. The workhorse HUD/menu font.' },
    '3x5': { id: '3x5', name: 'Micro 3x5', w: 3, h: 5, tracking: 1, lineHeight: 6, base: 4,
      glyphs: parse(G3, 3, 5), desc: 'Caps + digits only. Fits inside a 16px tile with room to spare.' }
  };
  const fonts = () => Object.values(FONTS).map(f => ({ id: f.id, name: f.name, w: f.w, h: f.h, lineHeight: f.lineHeight, glyphs: f.glyphs.size, desc: f.desc }));
  const getFont = id => { const f = FONTS[id] || FONTS['5x7']; return f; };

  /* Lowercase falls back to the uppercase glyph: both fonts are caps-first
     designs and a synthetically slanted lowercase reads worse than caps. */
  function glyphFor(font, ch) {
    return font.glyphs.get(ch) || font.glyphs.get(ch.toUpperCase()) || (ch === '\t' ? font.glyphs.get(' ') : null) || font.glyphs.get('?');
  }

  const opts = o => ({ font: o.font || '5x7', scale: o.scale || 1, spacing: o.spacing, lineSpacing: o.lineSpacing || 0, ...o });

  /* ---------------- measurement ---------------- */
  function measure(text, o = {}) {
    const { font, scale, spacing } = opts(o);
    const f = getFont(font), track = (spacing === undefined ? f.tracking : spacing) * scale;
    const lines = String(text).replace(/\r/g, '').split('\n');
    let w = 0;
    for (const line of lines) w = Math.max(w, [...line].reduce((n, ch) => n + (ch === ' ' ? f.w : glyphFor(f, ch).w) * scale + track, -track || 0));
    return { w: Math.max(0, w), h: lines.length * (f.h * scale + (o.lineSpacing || 0)) - (lines.length ? 0 : 0), lines: lines.length, font: f.id, scale };
  }

  /* Greedy word wrap to a pixel width. */
  function wrap(text, maxWidth, o = {}) {
    const out = [];
    for (const para of String(text).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (measure(test, o).w > maxWidth && line) { out.push(line); line = word; }
        else line = test;
      }
      out.push(line);
    }
    return out;
  }

  /* ---------------- drawing ---------------- */
  /* api may be a PF.Pixel Api or a {px(x,y,c)} shim. Returns the box drawn. */
  function draw(api, text, x, y, color, o = {}) {
    const { font, scale, spacing } = opts(o);
    const f = getFont(font), track = (spacing === undefined ? f.tracking : spacing) * scale;
    const lines = o.wrap ? wrap(text, o.wrap, o) : String(text).replace(/\r/g, '').split('\n');
    const lineStep = f.h * scale + (o.lineSpacing || 0);
    let widest = 0;
    lines.forEach((line, li) => {
      const lw = measure(line, o).w;
      widest = Math.max(widest, lw);
      let cx = x + (o.align === 'center' ? Math.round((o.boxWidth || widest) - lw) >> 1 : o.align === 'right' ? (o.boxWidth || widest) - lw : 0);
      const cy = y + li * lineStep;
      for (const ch of line) {
        const g = glyphFor(f, ch);
        if (ch !== ' ') {
          for (let gy = 0; gy < g.h; gy++) for (let gx = 0; gx < g.w; gx++) {
            if (!g.bits[gy][gx]) continue;
            if (o.shadow) api.px(cx + gx * scale + (o.shadowX || scale), cy + gy * scale + (o.shadowY || scale), o.shadowColor || '#181425');
            if (o.outline) {
              for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) api.px(cx + gx * scale + ox * scale, cy + gy * scale + oy * scale, o.outlineColor || '#181425');
            }
            for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) api.px(cx + gx * scale + sx, cy + gy * scale + sy, color);
          }
        }
        cx += g.w * scale + track;
      }
    });
    return { w: widest, h: lines.length * lineStep, lines: lines.length };
  }

  /* Render text into its own buffer — handy for tests, thumbnails and export. */
  function toBuffer(text, o = {}) {
    const m = measure(text, o);
    const pad = o.pad === undefined ? 1 : o.pad;
    const W = Math.max(1, m.w + pad * 2), H = Math.max(1, m.h + pad * 2);
    const buf = new Uint32Array(W * H);
    draw(PF.Pixel.makeApi(buf, W, H), text, pad, pad, o.color || '#ffffff', { ...o, boxWidth: m.w });
    return { buf, W, H };
  }

  /* A glyph sheet: every glyph in the font packed in a grid, one state. */
  function charsetDoc(fontId, opts2 = {}) {
    const f = getFont(fontId);
    const cols = opts2.cols || (f.id === '5x7' ? 8 : 10);
    const cellW = f.w + 1, cellH = f.h + 2;
    const chars = [...f.glyphs.keys()].filter(c => c !== ' ').concat([' ']);
    const rows = Math.ceil(chars.length / cols);
    const W = cols * cellW + 1, H = rows * cellH + 1;
    const paint = (buf) => {
      const api = PF.Pixel.makeApi(buf, W, H);
      const bg = opts2.bg || '#1c2a44', fg = opts2.fg || '#f2c094';
      api.rect(0, 0, W - 1, H - 1, bg);
      chars.forEach((ch, i) => {
        const cx = 1 + (i % cols) * cellW, cy = 1 + Math.floor(i / cols) * cellH;
        const g = f.glyphs.get(ch);
        for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.bits[y][x]) api.px(cx + x, cy + y, fg);
      });
    };
    return { width: W, height: H, name: 'pf-font-' + f.id, layers: [{ name: 'Charset' }],
      states: [{ name: 'charset', fps: 1, loop: true, frames: [{ duration: 1000, paint }] }] };
  }

  /* BMFont atlas data + the packed glyph buffer (used by PF.Export.bmfont). */
  function atlasData(fontId, o = {}) {
    const f = getFont(fontId);
    const scale = o.scale || 1;
    const gw = f.w * scale, gh = f.h * scale;
    const cols = o.cols || 16, pad = 1;
    const glyphsList = [...f.glyphs.values()];
    const rows = Math.ceil(glyphsList.length / cols);
    const imageWidth = cols * (gw + pad) + pad, imageHeight = rows * (gh + pad) + pad;
    const buf = new Uint32Array(imageWidth * imageHeight);
    const color = PF.Color.hexToU32(o.color || '#ffffff');
    const glyphs = glyphsList.map((g, i) => {
      const x = pad + (i % cols) * (gw + pad), y = pad + Math.floor(i / cols) * (gh + pad);
      for (let gy = 0; gy < f.h; gy++) for (let gx = 0; gx < f.w; gx++) if (g.bits[gy][gx]) {
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) buf[(y + gy * scale + sy) * imageWidth + x + gx * scale + sx] = color;
      }
      return { id: g.ch.codePointAt(0), char: g.ch, x, y, w: gw, h: gh, xoffset: 0, yoffset: 0, xadvance: gw + f.tracking * scale };
    });
    return { font: f, buffer: buf, imageWidth, imageHeight, lineHeight: f.lineHeight * scale, base: f.base * scale, glyphs };
  }

  /* DocData wrapper so a font or a text banner can live in the asset library
     and be exported like any other asset. */
  function textDoc(text, o = {}) {
    const { buf, W, H } = toBuffer(text, { color: o.color || '#f2c094', ...o });
    const bg = o.bg;
    return { width: W, height: H, name: o.name || 'text-' + (o.font || '5x7'), layers: [{ name: 'Text' }],
      states: [{ name: 'text', fps: 1, loop: true, frames: [{ duration: 1000, paint: (dst) => {
        const api = PF.Pixel.makeApi(dst, W, H);
        if (bg) api.rect(0, 0, W - 1, H - 1, bg);
        /* Copy ink only: the pad pixels are transparent and must not punch
           holes in a filled background plate. */
        for (let i = 0; i < buf.length; i++) if (buf[i]) dst[i] = buf[i];
      } }] }] };
  }

  return { fonts, get: getFont, glyphFor, measure, wrap, draw, toBuffer, toDoc: textDoc,
    charsetDoc, atlasData, FONTS, G5, G3 };
})();
