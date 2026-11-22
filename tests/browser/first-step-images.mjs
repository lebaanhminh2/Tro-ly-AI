import assert from 'node:assert/strict';
import { inflateSync, deflateSync } from 'node:zlib';
function decodePNG(png) {
  let pos = 8,
    w,
    h,
    type,
    compressed = [];
  while (pos < png.length) {
    const n = png.readUInt32BE(pos),
      t = png.toString('ascii', pos + 4, pos + 8),
      d = png.subarray(pos + 8, pos + 8 + n);
    if (t === 'IHDR') {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      type = d[9];
      assert(d[8] === 8, 'PNG bit depth');
    } else if (t === 'IDAT') compressed.push(d);
    pos += 12 + n;
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 0;
  assert(bpp, 'PNG format ' + type);
  const raw = inflateSync(Buffer.concat(compressed)),
    stride = w * bpp,
    rows = new Uint8Array(stride * h);
  let at = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[at++];
    for (let x = 0; x < stride; x++) {
      let v = raw[at++],
        a = x >= bpp ? rows[y * stride + x - bpp] : 0,
        b = y ? rows[(y - 1) * stride + x] : 0,
        c = y && x >= bpp ? rows[(y - 1) * stride + x - bpp] : 0;
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += Math.floor((a + b) / 2);
      else if (f === 4) {
        const p = a + b - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      rows[y * stride + x] = v & 255;
    }
  }
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    rgb[i * 3] = rows[i * bpp];
    rgb[i * 3 + 1] = rows[i * bpp + 1];
    rgb[i * 3 + 2] = rows[i * bpp + 2];
  }
  return { w, h, rgb };
}

function paletteFor(frames) {
  const histUI = new Map(),
    histKey = new Map();
  for (const f of frames)
    for (let i = 0; i < f.rgb.length; i += 3) {
      const r = f.rgb[i],
        g = f.rgb[i + 1],
        b = f.rgb[i + 2],
        k = (r << 16) | (g << 8) | b,
        pixel = i / 3,
        x = pixel % f.w,
        y = Math.floor(pixel / f.w);
      const hist = x > 16 && x < 716 && y > 16 && y < 244 ? histKey : histUI,
        v = hist.get(k) || [0, 0, 0, 0];
      v[0] += r;
      v[1] += g;
      v[2] += b;
      v[3]++;
      hist.set(k, v);
    }
  const build = (hist, size) => {
    const points = [...hist].map(([k, v]) => ({
        k,
        c: v.slice(0, 3).map((n) => n / v[3]),
        n: v[3],
      })),
      boxes = [points];
    while (boxes.length < size) {
      let choice = -1,
        score = -1,
        axis = 0;
      boxes.forEach((box, i) => {
        if (box.length < 2) return;
        const ranges = [0, 1, 2].map(
            (a) => Math.max(...box.map((v) => v.c[a])) - Math.min(...box.map((v) => v.c[a])),
          ),
          a = ranges.indexOf(Math.max(...ranges)),
          s = ranges[a] * Math.log2(box.reduce((n, v) => n + v.n, 1));
        if (s > score) {
          score = s;
          choice = i;
          axis = a;
        }
      });
      if (choice < 0) break;
      const box = boxes.splice(choice, 1)[0].sort((a, b) => a.c[axis] - b.c[axis]),
        sum = box.reduce((n, v) => n + v.n, 0);
      let acc = 0,
        split = box.length - 1;
      for (let i = 0; i < box.length - 1; i++) {
        acc += box[i].n;
        if (acc >= sum / 2) {
          split = i + 1;
          break;
        }
      }
      boxes.push(box.slice(0, split), box.slice(split));
    }
    return boxes.map((box) => {
      const n = box.reduce((s, v) => s + v.n, 0);
      return [0, 1, 2].map((a) => Math.round(box.reduce((s, v) => s + v.c[a] * v.n, 0) / n));
    });
  };
  return [...build(histUI, 32), ...build(histKey, 224)];
}
function gifEncode(frames, delay = 10) {
  const { w, h } = frames[0],
    pal = paletteFor(frames),
    lookup = new Map(),
    parts = [];
  const byte = (...n) => Buffer.from(n),
    word = (n) => byte(n & 255, n >> 8);
  parts.push(Buffer.from('GIF89a'), word(w), word(h), byte(0xf7, 0, 0));
  for (let i = 0; i < 256; i++) parts.push(byte(...(pal[i] || [255, 255, 255])));
  parts.push(byte(0x21, 0xff, 11), Buffer.from('NETSCAPE2.0'), byte(3, 1, 0, 0, 0));
  for (const [frameIndex, frame] of frames.entries()) {
    const indices = new Uint8Array(w * h);
    for (let i = 0; i < indices.length; i++) {
      const r = frame.rgb[i * 3],
        g = frame.rgb[i * 3 + 1],
        b = frame.rgb[i * 3 + 2],
        key = (r << 16) | (g << 8) | b;
      let v = lookup.get(key);
      if (v === undefined) {
        let best = Infinity;
        pal.forEach((c, j) => {
          const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
          if (d < best) {
            best = d;
            v = j;
          }
        });
        lookup.set(key, v);
      }
      indices[i] = v;
    }
    let dict = new Map(),
      next = 258,
      size = 9,
      bits = 0,
      nb = 0,
      packed = [];
    const emit = (code) => {
      bits |= code << nb;
      nb += size;
      while (nb >= 8) {
        packed.push(bits & 255);
        bits >>>= 8;
        nb -= 8;
      }
    };
    emit(256);
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i],
        key = (prefix << 8) | k,
        found = dict.get(key);
      if (found !== undefined) {
        prefix = found;
        continue;
      }
      emit(prefix);
      if (next < 4096) {
        dict.set(key, next++);
        if (next > 1 << size && size < 12) size++;
      } else {
        emit(256);
        dict = new Map();
        next = 258;
        size = 9;
      }
      prefix = k;
    }
    emit(prefix);
    emit(257);
    if (nb) packed.push(bits & 255);
    parts.push(
      byte(0x21, 0xf9, 4, 4),
      word(Array.isArray(delay) ? delay[frameIndex] : delay),
      byte(0, 0),
      byte(0x2c),
      word(0),
      word(0),
      word(w),
      word(h),
      byte(0, 8),
    );
    for (let i = 0; i < packed.length; i += 255) {
      const sub = packed.slice(i, i + 255);
      parts.push(byte(sub.length), Buffer.from(sub));
    }
    parts.push(byte(0));
  }
  parts.push(byte(0x3b));
  return Buffer.concat(parts);
}

function crop(frame, r, ratio = 1) {
  const w = Math.round(r.width * ratio),
    h = Math.round(r.height * ratio),
    rgb = new Uint8Array(w * h * 3),
    left = Math.round(r.x * ratio),
    top = Math.round(r.y * ratio);
  for (let y = 0; y < h; y++)
    rgb.set(
      frame.rgb.subarray(((top + y) * frame.w + left) * 3, ((top + y) * frame.w + left + w) * 3),
      y * w * 3,
    );
  return { w, h, rgb };
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function png(frame) {
  const { w, h, rgb } = frame,
    header = Buffer.alloc(13);
  header.writeUInt32BE(w);
  header.writeUInt32BE(h, 4);
  header[8] = 8;
  header[9] = 2;
  function chunk(type, data) {
    const t = Buffer.from(type),
      body = Buffer.concat([t, data]);
    let crc = 0xffffffff;
    for (const n of body) crc = crcTable[(crc ^ n) & 255] ^ (crc >>> 8);
    const n = Buffer.alloc(4),
      check = Buffer.alloc(4);
    n.writeUInt32BE(data.length);
    check.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([n, body, check]);
  }
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++)
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export { decodePNG, crop, png, gifEncode };
