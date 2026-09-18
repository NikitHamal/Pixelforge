/* PixelForge Studio — bitmap fonts.
   Two hand-authored pixel faces plus a runtime text API, so a template (or a
   game built on PF) can stamp readable labels into a sprite buffer without
   shipping a font file or touching canvas text rendering (which is not
   pixel-exact across browsers).

   Glyph rows are '#'/'.' strings, 5 columns for `small`, 3 for `mini`.
   Row 4 is the baseline; rows 5-6 carry descenders. Missing rows pad blank. */
window.PF = window.PF || {};
PF.Font = (() => {
  const ROW = 7;

  /* ---- small: 5x7 cell, 5-row cap height, true descenders ---- */
  const SMALL = {
    ' ': '', '!': '..#../..#../..#../...../..#..', '"': '.#.#./.#.#.', '#': '.#.#./#####/.#.#./#####/.#.#.',
    '$': '..#../.####/.###./####./..#..', '%': '##..#/##.#./..#../.#.##/#..##', '&': '.##../#.#../.#.../#.#.#/.##.#',
    "'": '..#../..#..', '(': '...#./..#../..#../..#../...#.', ')': '.#.../..#../..#../..#../.#...',
    '*': '..#../#.#.#/.###./#.#.#/..#..', '+': '...../..#../.###./..#..', ',': '...../...../...../..#../..#../.#...',
    '-': '...../...../.###.', '.': '...../...../...../...../..#..', '/': '....#/...#./..#../.#.../#....',
    '0': '.###./#..##/#.#.#/##..#/.###.', '1': '..#../.##../..#../..#../.###.', '2': '.###./#...#/..##./.#.../#####',
    '3': '####./....#/.###./....#/####.', '4': '#..#./#..#./#####/...#./...#.', '5': '#####/#..../####./....#/####.',
    '6': '.###./#..../####./#...#/.###.', '7': '#####/...#./..#../.#.../.#...', '8': '.###./#...#/.###./#...#/.###.',
    '9': '.###./#...#/.####/....#/.###.',
    ':': '...../..#../...../..#..', ';': '...../..#../...../..#../..#../.#...', '<': '...#./..#../.#.../..#../...#.',
    '=': '...../.###./...../.###.', '>': '.#.../..#../...#./..#../.#...', '?': '.###./#...#/..##./...../..#..',
    '@': '.###./#..##/#.#.#/#..../.###.',
    'A': '.###./#...#/#...#/#####/#...#', 'B': '####./#...#/####./#...#/####.', 'C': '.###./#...#/#..../#...#/.###.',
    'D': '####./#...#/#...#/#...#/####.', 'E': '#####/#..../###../#..../#####', 'F': '#####/#..../###../#..../#....',
    'G': '.###./#..../#..##/#...#/.###.', 'H': '#...#/#...#/#####/#...#/#...#', 'I': '#####/..#../..#../..#../#####',
    'J': '..###/...#./...#./#..#./.##..', 'K': '#...#/#..#./###../#..#./#...#', 'L': '#..../#..../#..../#..../#####',
    'M': '#...#/##.##/#.#.#/#...#/#...#', 'N': '#...#/##..#/#.#.#/#..##/#...#', 'O': '.###./#...#/#...#/#...#/.###.',
    'P': '####./#...#/####./#..../#....', 'Q': '.###./#...#/#...#/#..#./.##.#', 'R': '####./#...#/####./#..#./#...#',
    'S': '.####/#..../.###./....#/####.', 'T': '#####/..#../..#../..#../..#..', 'U': '#...#/#...#/#...#/#...#/.###.',
    'V': '#...#/#...#/#...#/.#.#./..#..', 'W': '#...#/#...#/#.#.#/##.##/#...#', 'X': '#...#/.#.#./..#../.#.#./#...#',
    'Y': '#...#/.#.#./..#../..#../..#..', 'Z': '#####/...#./..#../.#.../#####',
    '[': '.###./.#.../.#.../.#.../.###.', '\\': '#..../.#.../..#../...#./....#', ']': '.###./...#./...#./...#./.###.',
    '^': '..#../.#.#./#...#', '_': '...../...../...../...../#####', '`': '.#.../..#..',
    'a': '...../.###./#..#./#..#./.##.#', 'b': '#..../#..../####./#...#/####.', 'c': '...../.###./#..../#..../.###.',
    'd': '....#/....#/.####/#...#/.####', 'e': '...../.###./#...#/#####/.####', 'f': '..##./.#.../###../.#.../.#...',
    'g': '...../.####/#...#/#...#/.####/....#/####.', 'h': '#..../#..../####./#...#/#...#',
    'i': '..#../...../.##../..#../.###.', 'j': '...#./...../..##./...#./...#./...#./.##..',
    'k': '#..../#..#./###../#.#../#..#.', 'l': '.##../..#../..#../..#../..###',
    'm': '...../##.##/#.#.#/#.#.#/#.#.#', 'n': '...../####./#...#/#...#/#...#', 'o': '...../.###./#...#/#...#/.###.',
    'p': '...../####./#...#/#...#/####./#..../#....', 'q': '...../.####/#...#/#...#/.####/....#/....#',
    'r': '...../#.##./##.../#..../#....', 's': '...../.####/##.../...##/####.', 't': '..#../.###./..#../..#../..###',
    'u': '...../#...#/#...#/#...#/.####', 'v': '...../#...#/#...#/.#.#./..#..', 'w': '...../#.#.#/#.#.#/#.#.#/.#.#.',
    'x': '...../...../.#.#./..#../.#.#.', 'y': '...../#...#/#...#/#...#/.####/....#/####.',
    'z': '...../#####/...#./.#.../#####',
    '{': '..##./..#../.##../..#../..##.', '|': '..#../..#../..#../..#../..#..', '}': '.##../..#../..###/..#../.##..',
    '~': '...../.#..#/#.##.'
  };

  /* ---- mini: 3x5 cell, uppercase + digits, for cramped HUDs ---- */
  const MINI = {
    ' ': '', '!': '.#./.#./.#./.../.#.', '"': '#.#/#.#', '#': '#.#/###/#.#/###/#.#',
    '%': '#.#/..#/.#./#../#.#', '&': '.#./#.#/.#./#.#/.##', "'": '.#./.#.',
    '(': '..#/.#./.#./.#./..#', ')': '#../.#./.#./.#./#..', '*': '#.#/.#./#.#', '+': '.../.#./###/.#.',
    ',': '.../.../.../.#./#..', '-': '.../.../###', '.': '.../.../.../.../.#.', '/': '..#/..#/.#./#../#..',
    '0': '###/#.#/#.#/#.#/###', '1': '.#./##./.#./.#./###', '2': '##./..#/.#./#../###', '3': '##./..#/.#./..#/##.',
    '4': '#.#/#.#/###/..#/..#', '5': '###/#../##./..#/##.', '6': '.##/#../##./#.#/.#.', '7': '###/..#/.#./.#./.#.',
    '8': '.#./#.#/.#./#.#/.#.', '9': '.#./#.#/.##/..#/##.',
    ':': '.../.#./.../.#.', '<': '..#/.#./#../.#./..#', '=': '.../###/.../###', '>': '#../.#./..#/.#./#..',
    '?': '##./..#/.#./.../.#.',
    'A': '.#./#.#/###/#.#/#.#', 'B': '##./#.#/##./#.#/##.', 'C': '.##/#../#../#../.##', 'D': '##./#.#/#.#/#.#/##.',
    'E': '###/#../##./#../###', 'F': '###/#../##./#../#..', 'G': '.##/#../#.#/#.#/.##', 'H': '#.#/#.#/###/#.#/#.#',
    'I': '###/.#./.#./.#./###', 'J': '..#/..#/..#/#.#/.#.', 'K': '#.#/#.#/##./#.#/#.#', 'L': '#../#../#../#../###',
    'M': '#.#/###/###/#.#/#.#', 'N': '##./#.#/#.#/#.#/#.#', 'O': '.#./#.#/#.#/#.#/.#.', 'P': '##./#.#/##./#../#..',
    'Q': '.#./#.#/#.#/###/.##', 'R': '##./#.#/##./#.#/#.#', 'S': '.##/#../.#./..#/##.', 'T': '###/.#./.#./.#./.#.',
    'U': '#.#/#.#/#.#/#.#/###', 'V': '#.#/#.#/#.#/#.#/.#.', 'W': '#.#/#.#/###/###/#.#', 'X': '#.#/#.#/.#./#.#/#.#',
    'Y': '#.#/#.#/.#./.#./.#.', 'Z': '###/..#/.#./#../###',
    '_': '.../.../.../.../###', '|': '.#./.#./.#./.#./.#.'
  };

  const FONTS = {
    small: { w: 5, h: ROW, advance: 6, baseline: 4, glyphs: SMALL },
    mini:  { w: 3, h: 5, advance: 4, baseline: 4, glyphs: MINI }
  };

  const face = f => (typeof f === 'string' ? FONTS[f] : f) || FONTS.small;
  // Uppercase fallback keeps mini usable with mixed-case source strings.
  const rowsOf = (font, ch) => {
    const g = font.glyphs[ch];
    if (g !== undefined) return g ? g.split('/') : [];
    const up = font.glyphs[ch.toUpperCase()];
    return up ? up.split('/') : (font.glyphs['?'] || '').split('/');
  };

  /* Draw one glyph. Returns the advance so callers can lay out manually. */
  function glyph(api, ch, x, y, color, fontName, scale = 1) {
    const font = face(fontName), rows = rowsOf(font, ch);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== '#') continue;
        if (scale === 1) api.px(x + c, y + r, color);
        else api.rect(x + c * scale, y + r * scale, x + c * scale + scale - 1, y + r * scale + scale - 1, color);
      }
    }
    return font.advance * scale;
  }

  function measure(str, opts = {}) {
    const font = face(opts.font), scale = opts.scale || 1;
    const tracking = (opts.tracking || 0) + (opts.bold ? 1 : 0);
    const lines = String(str).split('\n');
    const w = Math.max(...lines.map(l => l.length * (font.advance + tracking) * scale - tracking * scale));
    const lh = (opts.lineHeight || font.h + 1) * scale;
    return { width: Math.max(0, w), height: lines.length * lh, lineHeight: lh };
  }

  /* text(api, str, x, y, opts)
       font 'small'|'mini', color, scale, tracking, lineHeight,
       align 'left'|'center'|'right', shadow (hex, +1/+1), outline (hex, 4-way),
       bold (re-stamped 1px right). Draw order is outline → shadow → face so a
       styled label stays legible on any background. */
  function text(api, str, x, y, opts = {}) {
    const font = face(opts.font), scale = opts.scale || 1;
    const tracking = (opts.tracking || 0) + (opts.bold ? 1 : 0);
    const step = (font.advance + tracking) * scale;
    const lh = (opts.lineHeight || font.h + 1) * scale;
    const color = opts.color || '#ffffff';
    const lines = String(str).split('\n');
    lines.forEach((line, li) => {
      const w = line.length * step - tracking * scale;
      const lx = opts.align === 'center' ? Math.round(x - w / 2) : opts.align === 'right' ? x - w : x;
      const ly = y + li * lh;
      const stamp = (dx, dy, c) => {
        let cx = lx + dx;
        for (const ch of line) { glyph(api, ch, cx, ly + dy, c, font, scale); cx += step; }
      };
      if (opts.outline) { stamp(-scale, 0, opts.outline); stamp(scale, 0, opts.outline); stamp(0, -scale, opts.outline); stamp(0, scale, opts.outline); }
      if (opts.shadow) stamp(scale, scale, opts.shadow);
      stamp(0, 0, color);
      if (opts.bold) stamp(scale, 0, color);
    });
    return measure(str, opts);
  }

  /* ---- template suites ---- */
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  /* Deliberately no outline() pass here: a font sheet outlined per glyph is
     unusable. Outlining is offered as a text() option instead. */
  const sheet = painter => [Fr(250, (buf, W, H) => painter(PF.Pixel.makeApi(buf, W, H), W, H))];

  const RANGE = (from, to) => { let s = ''; for (let c = from; c <= to; c++) s += String.fromCharCode(c); return s; };
  const wrap = (s, n) => { const out = []; for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n)); return out.join('\n'); };

  function smallSuite() {
    return { width: 72, height: 64, name: 'font-small-5x7', layers: [{ name: 'Font' }], states: [
      D('sheet_upper', 4, false, sheet(a => text(a, wrap(RANGE(65, 90) + RANGE(48, 57), 12), 1, 2, { color: '#ffffff' }))),
      D('sheet_lower', 4, false, sheet(a => text(a, wrap(RANGE(97, 122), 12), 1, 2, { color: '#c0cbdc' }))),
      D('sheet_punct', 4, false, sheet(a => text(a, wrap(RANGE(32, 47) + RANGE(58, 64) + RANGE(91, 96) + RANGE(123, 126), 12), 1, 2, { color: '#fee761' }))),
      D('sample', 4, false, sheet(a => {
        text(a, 'The quick\nbrown fox\njumps over\nthe lazy\ndog. 0123', 1, 2, { color: '#e8ecf5', shadow: '#181425' });
        text(a, 'HP 128/200', 1, 52, { color: '#63c74d' });
      }))
    ] };
  }

  function miniSuite() {
    return { width: 64, height: 40, name: 'font-mini-3x5', layers: [{ name: 'Font' }], states: [
      D('sheet_chars', 4, false, sheet(a => text(a, wrap(RANGE(65, 90) + RANGE(48, 57), 16), 1, 2, { font: 'mini', color: '#ffffff' }))),
      D('sample', 4, false, sheet(a => {
        text(a, 'LEVEL UP', 1, 2, { font: 'mini', color: '#fee761' });
        text(a, 'SCORE 0042190', 1, 10, { font: 'mini', color: '#2ce8f5' });
        text(a, 'X3 COMBO', 1, 18, { font: 'mini', color: '#ff8d7a' });
        text(a, 'PRESS START', 1, 26, { font: 'mini', color: '#c0cbdc' });
      }))
    ] };
  }

  function styleSuite() {
    const S = 'Forge!';
    const row = (a, y, opts) => text(a, S, 2, y, opts);
    return { width: 64, height: 56, name: 'font-styles', layers: [{ name: 'Font' }], states: [
      D('styles', 4, false, sheet(a => {
        row(a, 1, { color: '#ffffff' });
        row(a, 10, { color: '#fee761', shadow: '#733e39' });
        row(a, 19, { color: '#ffffff', outline: '#181425' });
        row(a, 28, { color: '#63c74d', bold: true });
        row(a, 37, { color: '#2ce8f5', outline: '#124e89', bold: true });
        text(a, 'BIG', 2, 46, { font: 'mini', color: '#e43b44', scale: 2, outline: '#181425' });
      })),
      /* 12 chars x 4px advance = 48px per repeat, scrolled 4px over 12 frames,
         so the marquee wraps exactly and the loop is seamless. */
      D('marquee', 12, true, Array.from({ length: 12 }, (_, i) => Fr(84, (buf, W, H) => {
        const a = PF.Pixel.makeApi(buf, W, H);
        const msg = 'PIXELFORGE  ';
        text(a, msg.repeat(3), 1 - i * 4, 4, { font: 'mini', color: '#fee761' });
        text(a, 'READY', 32, 24, { color: i % 4 < 2 ? '#ffffff' : '#8b9bb4', align: 'center', outline: '#181425' });
        text(a, String(1000 + i * 137), 32, 40, { color: '#63c74d', align: 'center' });
      })))
    ] };
  }

  return { FONTS, SMALL, MINI, glyph, text, measure, smallSuite, miniSuite, styleSuite };
})();
