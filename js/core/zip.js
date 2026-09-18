/* PixelForge Studio — minimal ZIP writer.
   Store-only (no deflate) so it is a few dozen lines with no dependency and no
   worker: PNG and GIF payloads are already compressed, and JSON/text in an
   export bundle is small. Produces a Uint8Array that both `new Blob([...])` in
   the browser and `fs.writeFileSync` in Node accept unchanged. */
window.PF = window.PF || {};
PF.Zip = (() => {
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  const utf8 = s => {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    const out = []; for (const ch of s) { const cp = ch.codePointAt(0);
      if (cp < 128) out.push(cp);
      else if (cp < 2048) out.push(192 | cp >> 6, 128 | cp & 63);
      else if (cp < 65536) out.push(224 | cp >> 12, 128 | (cp >> 6) & 63, 128 | cp & 63);
      else out.push(240 | cp >> 18, 128 | (cp >> 12) & 63, 128 | (cp >> 6) & 63, 128 | cp & 63); }
    return new Uint8Array(out);
  };
  const bytes = data => data instanceof Uint8Array ? data : typeof data === 'string' ? utf8(data)
    : data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer || data);

  /* MS-DOS packed date/time — ZIP's own format, not unix epoch. */
  function dosTime(d = new Date()) {
    return {
      time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31),
      date: (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31)
    };
  }

  /* create([{ name, data }], opts) -> Uint8Array */
  function create(files, opts = {}) {
    const { time, date } = dosTime(opts.date || new Date());
    const parts = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = utf8(f.name), data = bytes(f.data), crc = crc32(data);
      const local = new Uint8Array(30 + name.length);
      const dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); // UTF-8 names
      dv.setUint16(8, 0, true); dv.setUint16(10, time, true); dv.setUint16(12, date, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true);
      dv.setUint16(26, name.length, true); dv.setUint16(28, 0, true);
      local.set(name, 30);
      parts.push(local, data);

      const cen = new Uint8Array(46 + name.length), cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
      cv.setUint16(12, time, true); cv.setUint16(14, date, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
      cen.set(name, 46);
      central.push(cen);
      offset += local.length + data.length;
    }
    const cenSize = central.reduce((n, c) => n + c.length, 0);
    const end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
    ev.setUint32(12, cenSize, true); ev.setUint32(16, offset, true);
    const all = [...parts, ...central, end];
    const total = all.reduce((n, p) => n + p.length, 0), out = new Uint8Array(total);
    let at = 0; for (const p of all) { out.set(p, at); at += p.length; }
    return out;
  }
  return { create, crc32, utf8 };
})();
