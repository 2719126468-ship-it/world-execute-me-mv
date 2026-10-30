// src/core/font.js
// 零依赖 TrueType（glyf）字形解析 + 软件光栅化器。
// 只依赖 node:fs，不引入任何 npm 包，不改动 raster.js。
//
// 能力：
//   - sfnt 表目录（0x00010000 / 'true'），head/maxp/hhea/hmtx/loca/glyf/cmap/OS/2
//   - simple glyph（flags 重复压缩、x/y 增量）与 composite glyph（2x2 变换、递归展开）
//   - 二次贝塞尔展平（自适应 6–10 步），TrueType on/off-curve 规则
//   - 垂直 4x 子采样 + 水平精确跨度覆盖的扫描线光栅化（nonzero 填充）
//   - 字形 mask 全局 LRU（600 项），字形轮廓 LRU，惰性读盘（大字体不整体加载）
//
// 限制：不合字（ligature）、不做 kern、不做 hinting、不做 CFF/OTF、不做 TTC。

import fs from 'node:fs';

// ───────────────────────────── 常量 ─────────────────────────────

const MASK_CACHE_MAX = 600;   // 像素 mask 缓存上限
const GLYPH_CACHE_MAX = 1500; // 字形轮廓缓存上限（CJK 字体字形多）
const MAX_COMPOSITE_DEPTH = 6;
const MAX_COMPONENTS = 64;

// ───────────────────────────── 字节工具 ─────────────────────────────

const u16 = (b, o) => (b[o] << 8) | b[o + 1];
const i16 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16)) >> 16;
const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const readTag = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

function readAt(fd, off, len) {
  if (len <= 0) return Buffer.alloc(0);
  const b = Buffer.allocUnsafe(len);
  let got = 0;
  while (got < len) {
    let n = 0;
    try { n = fs.readSync(fd, b, got, len - got, off + got); } catch { break; }
    if (!n) break;
    got += n;
  }
  return got === len ? b : b.subarray(0, got);
}

// ───────────────────────────── LRU ─────────────────────────────

class LRU {
  constructor(max) { this.max = max; this.map = new Map(); }
  get(k) {
    const v = this.map.get(k);
    if (v === undefined) return undefined;
    this.map.delete(k); this.map.set(k, v);
    return v;
  }
  set(k, v) {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
  }
  get size() { return this.map.size; }
  clear() { this.map.clear(); }
}

const maskCache = new LRU(MASK_CACHE_MAX);
const glyphCacheByFont = new Map(); // path -> LRU
const fontCache = new Map();        // path -> Font

// ───────────────────────────── 表解析 ─────────────────────────────

function parseFont(path) {
  const fd = fs.openSync(path, 'r');
  const stat = fs.fstatSync(fd);
  const fileSize = stat.size;
  const head0 = readAt(fd, 0, 12);
  if (head0.length < 12) throw new Error('font: 文件过短 ' + path);
  const sfntVersion = u32(head0, 0);
  if (sfntVersion !== 0x00010000 && sfntVersion !== 0x74727565) {
    // 'OTTO'(CFF) / 'ttcf' 等：仍解析度量，但无 glyf 轮廓
  }
  const numTables = u16(head0, 4);
  const dir = readAt(fd, 12, numTables * 16);
  const tables = new Map();
  for (let i = 0; i < numTables; i++) {
    const o = i * 16;
    if (o + 16 > dir.length) break;
    const tag = readTag(dir, o);
    const off = u32(dir, o + 8);
    const len = u32(dir, o + 12);
    if (off >= fileSize || len === 0 || off + len > fileSize + 4) { if (off >= fileSize) continue; }
    tables.set(tag, { off, len: Math.min(len, fileSize - off) });
  }
  const need = (t) => tables.get(t) || null;

  const headT = need('head');
  const maxpT = need('maxp');
  const hheaT = need('hhea');
  const hmtxT = need('hmtx');
  const locaT = need('loca');
  const glyfT = need('glyf');
  const cmapT = need('cmap');
  if (!headT || !maxpT) throw new Error('font: 缺少 head/maxp ' + path);

  const head = readAt(fd, headT.off, Math.min(headT.len, 54));
  const unitsPerEm = u16(head, 18) || 1000;
  const indexToLocFormat = i16(head, 50) || 0;

  const maxp = readAt(fd, maxpT.off, Math.min(maxpT.len, 6));
  const numGlyphs = u16(maxp, 4) || 0;

  let hheaAsc = 0, hheaDesc = 0, numberOfHMetrics = 0;
  if (hheaT) {
    const hhea = readAt(fd, hheaT.off, Math.min(hheaT.len, 36));
    hheaAsc = i16(hhea, 4);
    hheaDesc = i16(hhea, 6);
    numberOfHMetrics = u16(hhea, 34);
  }
  numberOfHMetrics = Math.max(1, Math.min(numberOfHMetrics || numGlyphs || 1, numGlyphs || 1));

  // OS/2 sTypoAscender/Descender（可选）
  let typoAsc = 0, typoDesc = 0;
  const os2T = need('OS/2');
  if (os2T) {
    const os2 = readAt(fd, os2T.off, Math.min(os2T.len, 72));
    if (os2.length >= 72) { typoAsc = i16(os2, 68); typoDesc = i16(os2, 70); }
  }

  // 度量：优先 OS/2 typo，其次 hhea；都为 0 时按 0.88/0.12 em 兜底
  let ascent = typoAsc > 0 ? typoAsc : hheaAsc;
  let descent = typoDesc < 0 ? typoDesc : hheaDesc;
  if (!(ascent > 0)) ascent = Math.round(unitsPerEm * 0.88);
  if (!(descent < 0)) descent = -Math.round(unitsPerEm * 0.12);

  // hmtx / loca 整表读（相对小）
  const hmtx = hmtxT ? readAt(fd, hmtxT.off, hmtxT.len) : Buffer.alloc(0);
  const loca = locaT ? readAt(fd, locaT.off, locaT.len) : Buffer.alloc(0);
  const cmapBuf = cmapT ? readAt(fd, cmapT.off, cmapT.len) : Buffer.alloc(0);
  const cmap = cmapBuf.length ? parseCmap(cmapBuf) : null;

  const font = {
    path,
    unitsPerEm,
    ascent,
    descent,
    numGlyphs,
    indexToLocFormat,
    sfntVersion,
    hasGlyf: !!glyfT,
    // 内部
    fd,
    fileSize,
    glyfOff: glyfT ? glyfT.off : 0,
    glyfLen: glyfT ? glyfT.len : 0,
    loca,
    hmtx,
    numberOfHMetrics,
    cmap,
    glyphCache: new LRU(GLYPH_CACHE_MAX),
  };

  // 公开接口
  font.glyphIndex = (cp) => cmapLookup(cmap, cp | 0);
  font.has = (cp) => {
    const gid = cmapLookup(cmap, cp | 0);
    return gid > 0 && gid < numGlyphs;
  };
  font.glyph = (cp) => {
    const gid = cmapLookup(cmap, cp | 0);
    if (!gid || gid >= numGlyphs) return null;
    return readGlyph(font, gid, 0);
  };
  // 内部用：按 gid 取字形（含 notdef）
  font.glyphById = (gid) => readGlyph(font, gid | 0, 0);

  return font;
}

// ───────────────────────────── cmap ─────────────────────────────

function parseCmap(buf) {
  const numTables = u16(buf, 2);
  const cands = [];
  for (let i = 0; i < numTables; i++) {
    const o = 4 + i * 8;
    if (o + 8 > buf.length) break;
    const pid = u16(buf, o), eid = u16(buf, o + 2), off = u32(buf, o + 4);
    if (off + 2 > buf.length) continue;
    const format = u16(buf, off);
    let score = 0;
    if (format === 12) score = 30;
    else if (format === 4) score = 20;
    else if (format === 6) score = 10;
    else continue;
    if (pid === 3 && eid === 10) score += 6;      // Windows UCS-4
    else if (pid === 0 && (eid === 4 || eid === 6)) score += 6; // Unicode full
    else if (pid === 3 && eid === 1) score += 4;  // Windows BMP
    else if (pid === 0) score += 3;
    else score -= 5;
    cands.push({ score, off, format });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score);
  for (const c of cands) {
    const sub = parseCmapSub(buf, c.off, c.format);
    if (sub) return sub;
  }
  return null;
}

function parseCmapSub(buf, off, format) {
  if (format === 4) {
    const segCountX2 = u16(buf, off + 6);
    const segCount = segCountX2 >> 1;
    if (!segCount) return null;
    const endOff = off + 14;
    const startOff = endOff + segCountX2 + 2;
    const deltaOff = startOff + segCountX2;
    const rangeOff = deltaOff + segCountX2;
    if (rangeOff + segCountX2 > buf.length) return null;
    const ends = new Uint16Array(segCount);
    const starts = new Uint16Array(segCount);
    const deltas = new Int16Array(segCount);
    const ranges = new Uint16Array(segCount);
    for (let i = 0; i < segCount; i++) {
      ends[i] = u16(buf, endOff + i * 2);
      starts[i] = u16(buf, startOff + i * 2);
      deltas[i] = i16(buf, deltaOff + i * 2);
      ranges[i] = u16(buf, rangeOff + i * 2);
    }
    return { format: 4, buf, segCount, ends, starts, deltas, ranges, rangeOff };
  }
  if (format === 12) {
    const nGroups = u32(buf, off + 12);
    if (off + 16 + nGroups * 12 > buf.length) return null;
    const starts = new Uint32Array(nGroups);
    const ends = new Uint32Array(nGroups);
    const gids = new Uint32Array(nGroups);
    for (let i = 0; i < nGroups; i++) {
      const o = off + 16 + i * 12;
      starts[i] = u32(buf, o);
      ends[i] = u32(buf, o + 4);
      gids[i] = u32(buf, o + 8);
    }
    return { format: 12, nGroups, starts, ends, gids };
  }
  if (format === 6) {
    const first = u16(buf, off + 6);
    const count = u16(buf, off + 8);
    return { format: 6, buf, first, count, arrayOff: off + 10 };
  }
  return null;
}

function cmapLookup(cmap, cp) {
  if (!cmap) return 0;
  if (cmap.format === 12) {
    let lo = 0, hi = cmap.nGroups - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cp < cmap.starts[mid]) hi = mid - 1;
      else if (cp > cmap.ends[mid]) lo = mid + 1;
      else return (cmap.gids[mid] + (cp - cmap.starts[mid])) >>> 0;
    }
    return 0;
  }
  if (cmap.format === 4) {
    const { segCount, ends, starts, deltas, ranges, rangeOff, buf } = cmap;
    let lo = 0, hi = segCount - 1, seg = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ends[mid] < cp) lo = mid + 1;
      else { seg = mid; hi = mid - 1; }
    }
    if (seg < 0 || cp < starts[seg]) return 0;
    const ro = ranges[seg];
    if (ro === 0) return (cp + deltas[seg]) & 0xffff;
    const addr = rangeOff + seg * 2 + ro + (cp - starts[seg]) * 2;
    if (addr + 2 > buf.length) return 0;
    const g = u16(buf, addr);
    return g === 0 ? 0 : (g + deltas[seg]) & 0xffff;
  }
  if (cmap.format === 6) {
    const i = cp - cmap.first;
    if (i < 0 || i >= cmap.count) return 0;
    const addr = cmap.arrayOff + i * 2;
    return addr + 2 <= cmap.buf.length ? u16(cmap.buf, addr) : 0;
  }
  return 0;
}

// ───────────────────────────── hmtx ─────────────────────────────

function advanceOf(font, gid) {
  const { hmtx, numberOfHMetrics } = font;
  if (!hmtx.length) return Math.round(font.unitsPerEm * 0.5);
  let i = gid;
  if (i >= numberOfHMetrics) i = numberOfHMetrics - 1;
  const o = i * 4;
  if (o + 2 > hmtx.length) return 0;
  return u16(hmtx, o);
}

function lsbOf(font, gid) {
  const { hmtx, numberOfHMetrics } = font;
  if (!hmtx.length) return 0;
  let o;
  if (gid < numberOfHMetrics) o = gid * 4 + 2;
  else o = numberOfHMetrics * 4 + (gid - numberOfHMetrics) * 2;
  return o + 2 <= hmtx.length ? i16(hmtx, o) : 0;
}

// ───────────────────────────── loca / glyf ─────────────────────────────

function locaOffsets(font, gid) {
  const { loca, indexToLocFormat } = font;
  if (!loca.length) return [0, 0];
  if (indexToLocFormat === 0) {
    const a = gid * 2;
    if (a + 4 > loca.length) return [0, 0];
    return [u16(loca, a) * 2, u16(loca, a + 2) * 2];
  }
  const a = gid * 4;
  if (a + 8 > loca.length) return [0, 0];
  return [u32(loca, a), u32(loca, a + 4)];
}

function readGlyph(font, gid, depth) {
  if (gid < 0 || gid >= font.numGlyphs) return null;
  const ck = gid;
  if (depth === 0) {
    const hit = font.glyphCache.get(ck);
    if (hit !== undefined) return hit;
  }
  const g = parseGlyph(font, gid, depth);
  if (depth === 0 && g) font.glyphCache.set(ck, g);
  return g;
}

function parseGlyph(font, gid, depth) {
  const advance = advanceOf(font, gid);
  const lsb = lsbOf(font, gid);
  const empty = { gid, advance, lsb, contours: [], bbox: [0, 0, 0, 0], empty: true, composite: false };
  if (!font.hasGlyf) return empty;
  const [s, e] = locaOffsets(font, gid);
  if (e <= s || s < 0) return empty;
  const len = Math.min(e - s, font.glyfLen - s);
  if (len <= 0) return empty;
  let buf;
  try { buf = readAt(font.fd, font.glyfOff + s, len); } catch { return empty; }
  if (buf.length < 10) return empty;
  try {
    return parseGlyphData(font, buf, gid, advance, lsb, depth);
  } catch {
    return empty;
  }
}

function parseGlyphData(font, buf, gid, advance, lsb, depth) {
  const numberOfContours = i16(buf, 0);
  if (numberOfContours >= 0) {
    const contours = parseSimpleGlyph(buf, numberOfContours);
    return finishGlyph(gid, advance, lsb, contours, false);
  }
  if (numberOfContours === -1) {
    if (depth >= MAX_COMPOSITE_DEPTH) {
      return finishGlyph(gid, advance, lsb, [], true);
    }
    const contours = parseCompositeGlyph(font, buf, depth);
    return finishGlyph(gid, advance, lsb, contours, true);
  }
  // 其他负值视为空
  return finishGlyph(gid, advance, lsb, [], false);
}

function finishGlyph(gid, advance, lsb, contours, composite) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of contours) {
    for (const p of c) {
      if (p.x < x0) x0 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.x > x1) x1 = p.x;
      if (p.y > y1) y1 = p.y;
    }
  }
  if (!isFinite(x0)) { x0 = y0 = x1 = y1 = 0; }
  return {
    gid, advance, lsb, contours, composite,
    empty: contours.length === 0,
    bbox: [x0, y0, x1, y1],
  };
}

// simple glyph：endPtsOfContours + flags 重复压缩 + x/y 增量
function parseSimpleGlyph(buf, numberOfContours) {
  let p = 10;
  const endPts = new Array(numberOfContours);
  let total = 0;
  for (let i = 0; i < numberOfContours; i++) {
    if (p + 2 > buf.length) return [];
    const v = u16(buf, p); p += 2;
    endPts[i] = v;
    total = v + 1;
  }
  if (!numberOfContours || total <= 0) return [];
  if (p + 2 > buf.length) return [];
  const instrLen = u16(buf, p); p += 2 + instrLen;
  if (p > buf.length) return [];

  const flags = new Uint8Array(total);
  let fi = 0;
  while (fi < total && p < buf.length) {
    const f = buf[p++];
    flags[fi++] = f;
    if (f & 0x08) {
      let rep = p < buf.length ? buf[p++] : 0;
      while (rep-- > 0 && fi < total) flags[fi++] = f;
    }
  }
  if (fi < total) return [];

  const xs = new Int32Array(total);
  let x = 0;
  for (let i = 0; i < total; i++) {
    const f = flags[i];
    if (f & 0x02) {
      if (p >= buf.length) break;
      const d = buf[p++];
      x += (f & 0x10) ? d : -d;
    } else if (!(f & 0x10)) {
      if (p + 2 > buf.length) break;
      x += i16(buf, p); p += 2;
    }
    xs[i] = x;
  }
  const ys = new Int32Array(total);
  let y = 0;
  for (let i = 0; i < total; i++) {
    const f = flags[i];
    if (f & 0x04) {
      if (p >= buf.length) break;
      const d = buf[p++];
      y += (f & 0x20) ? d : -d;
    } else if (!(f & 0x20)) {
      if (p + 2 > buf.length) break;
      y += i16(buf, p); p += 2;
    }
    ys[i] = y;
  }

  const contours = [];
  let start = 0;
  for (let i = 0; i < numberOfContours; i++) {
    const end = Math.min(endPts[i], total - 1);
    if (end < start) { start = end + 1; continue; }
    const pts = new Array(end - start + 1);
    let hasOff = false;
    for (let j = start; j <= end; j++) {
      const on = (flags[j] & 0x01) !== 0;
      if (!on) hasOff = true;
      pts[j - start] = { x: xs[j], y: ys[j], on };
    }
    if (pts.length) contours.push(pts);
    start = end + 1;
  }
  return contours;
}

// composite glyph：ARGS_ARE_XY_VALUES / MORE_COMPONENTS / 2x2 变换 / 递归
function parseCompositeGlyph(font, buf, depth) {
  let p = 10;
  const out = [];
  let guard = 0;
  let more = true;
  while (more && guard++ < MAX_COMPONENTS) {
    if (p + 4 > buf.length) break;
    const flags = u16(buf, p); p += 2;
    const gid2 = u16(buf, p); p += 2;
    let arg1 = 0, arg2 = 0;
    if (flags & 0x0001) { // ARG_1_AND_2_ARE_WORDS
      if (p + 4 > buf.length) break;
      arg1 = i16(buf, p); arg2 = i16(buf, p + 2); p += 4;
    } else {
      if (p + 2 > buf.length) break;
      arg1 = (buf[p] << 24) >> 24; arg2 = (buf[p + 1] << 24) >> 24; p += 2;
    }
    const f2 = (o) => i16(buf, o) / 16384;
    let a = 1, b = 0, c = 0, d = 1, e = 0, f = 0;
    if (flags & 0x0008) {          // WE_HAVE_A_SCALE
      if (p + 2 > buf.length) break;
      a = d = f2(p); p += 2;
    } else if (flags & 0x0040) {   // X_AND_Y_SCALE
      if (p + 4 > buf.length) break;
      a = f2(p); d = f2(p + 2); p += 4;
    } else if (flags & 0x0080) {   // TWO_BY_TWO
      if (p + 8 > buf.length) break;
      a = f2(p); b = f2(p + 2); c = f2(p + 4); d = f2(p + 6); p += 8;
    }
    if (flags & 0x0002) { // ARGS_ARE_XY_VALUES（否则为点匹配，容错为 0 偏移）
      e = arg1; f = arg2;
    }
    more = (flags & 0x0020) !== 0; // MORE_COMPONENTS
    if (gid2 === 0 || gid2 >= font.numGlyphs) continue;
    const child = readGlyph(font, gid2, depth + 1);
    if (!child || !child.contours.length) continue;
    for (const cpts of child.contours) {
      const pts = new Array(cpts.length);
      for (let i = 0; i < cpts.length; i++) {
        const pt = cpts[i];
        pts[i] = {
          x: a * pt.x + c * pt.y + e,
          y: b * pt.x + d * pt.y + f,
          on: pt.on,
        };
      }
      out.push(pts);
    }
  }
  return out;
}

// ───────────────────────────── 轮廓 → 屏幕多边形 ─────────────────────────────
// TrueType y 向上 → 屏幕 y 向下（取反），再按 scale 缩放并平移，最后展平二次贝塞尔。

function contourToPoly(pts, scale, tx, ty) {
  const n = pts.length;
  const out = [];
  if (!n) return out;

  // 屏幕坐标
  const sx = (i) => pts[i].x * scale + tx;
  const sy = (i) => -pts[i].y * scale + ty;

  const mid = (i, j) => [(sx(i) + sx(j)) * 0.5, (sy(i) + sy(j)) * 0.5];

  let startIdx, startX, startY;
  if (pts[0].on) {
    startX = sx(0); startY = sy(0); startIdx = 1;
  } else if (pts[n - 1].on) {
    startX = sx(n - 1); startY = sy(n - 1); startIdx = 0;
  } else {
    const m = mid(n - 1, 0);
    startX = m[0]; startY = m[1]; startIdx = 0;
  }
  out.push(startX, startY);

  let cx = startX, cy = startY;
  let pendingOff = -1;

  for (let k = 0; k < n; k++) {
    const i = (startIdx + k) % n;
    const on = pts[i].on;
    const px = sx(i), py = sy(i);
    if (on) {
      if (pendingOff >= 0) {
        emitQuad(out, cx, cy, sx(pendingOff), sy(pendingOff), px, py, 6);
        pendingOff = -1;
      } else {
        out.push(px, py);
      }
      cx = px; cy = py;
    } else {
      if (pendingOff >= 0) {
        const mx = (sx(pendingOff) + px) * 0.5;
        const my = (sy(pendingOff) + py) * 0.5;
        emitQuad(out, cx, cy, sx(pendingOff), sy(pendingOff), mx, my, 6);
        cx = mx; cy = my;
      }
      pendingOff = i;
    }
  }
  if (pendingOff >= 0) {
    emitQuad(out, cx, cy, sx(pendingOff), sy(pendingOff), startX, startY, 6);
  }
  return out;
}

// 二次贝塞尔展平：steps 由控制点折线长度自适应，夹在 6–10
function emitQuad(out, x0, y0, cx, cy, x1, y1, minSteps) {
  const d1x = cx - x0, d1y = cy - y0;
  const d2x = x1 - cx, d2y = y1 - cy;
  const len = Math.sqrt(d1x * d1x + d1y * d1y) + Math.sqrt(d2x * d2x + d2y * d2y);
  let steps = minSteps + Math.min(4, Math.floor(len / 6));
  if (steps < 6) steps = 6;
  if (steps > 10) steps = 10;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const a = mt * mt, b = 2 * mt * t, c = t * t;
    out.push(a * x0 + b * cx + c * x1, a * y0 + b * cy + c * y1);
  }
}

// ───────────────────────────── 扫描线光栅化 ─────────────────────────────
// 垂直 SS=4 子采样 + 水平精确跨度覆盖，nonzero 填充。
// polys: [[x0,y0,x1,y1,...], ...]（mask 局部坐标）

const SS = 4;
let covPool = new Float32Array(0);

function rasterize(polys, w, h) {
  const out = new Uint8Array(w * h);
  if (w <= 0 || h <= 0 || !polys.length) return out;
  const n = w * h;
  if (covPool.length < n) covPool = new Float32Array(n * 2);
  const cov = covPool;
  cov.fill(0, 0, n);

  // 收集边
  const eY0 = [], eY1 = [], eX = [], eDX = [], eDir = [];
  for (let pi = 0; pi < polys.length; pi++) {
    const p = polys[pi];
    const m = p.length;
    if (m < 6) continue; // 少于 3 点无法成面
    for (let i = 0; i < m; i += 2) {
      const j = (i + 2) % m;
      const ax = p[i], ay = p[i + 1], bx = p[j], by = p[j + 1];
      if (ay === by) continue;
      if (ay < by) {
        eY0.push(ay); eY1.push(by); eX.push(ax); eDX.push((bx - ax) / (by - ay)); eDir.push(1);
      } else {
        eY0.push(by); eY1.push(ay); eX.push(bx); eDX.push((ax - bx) / (ay - by)); eDir.push(-1);
      }
    }
  }
  const E = eY0.length;
  if (!E) return out;

  const K = h * SS;
  const kStart = new Int32Array(E);
  const kEnd = new Int32Array(E);
  const cnt = new Int32Array(K + 1);
  for (let i = 0; i < E; i++) {
    let ks = Math.ceil(eY0[i] * SS - 0.5);
    let ke = Math.ceil(eY1[i] * SS - 0.5);
    if (ks < 0) ks = 0;
    if (ke > K) ke = K;
    if (ke <= ks) { kStart[i] = -1; kEnd[i] = -1; continue; }
    kStart[i] = ks; kEnd[i] = ke;
    cnt[ks]++;
  }
  // 计数排序：按起始子扫描线分桶
  const bucketStart = new Int32Array(K + 1);
  for (let k = 0, acc = 0; k < K; k++) { bucketStart[k] = acc; acc += cnt[k]; }
  bucketStart[K] = E;
  const cursor = bucketStart.slice();
  const order = new Int32Array(E);
  for (let i = 0; i < E; i++) {
    const ks = kStart[i];
    if (ks < 0) continue;
    order[cursor[ks]++] = i;
  }

  const active = [];
  const cx = new Float64Array(256);
  const cd = new Int8Array(256);
  let ptr = 0;

  for (let k = 0; k < K; k++) {
    let from = ptr, to = ptr + cnt[k];
    for (let t = from; t < to; t++) active.push(order[t]);
    ptr = to;
    if (active.length) {
      // 移除已结束的边
      let w2 = 0;
      for (let t = 0; t < active.length; t++) {
        const ei = active[t];
        if (kEnd[ei] > k) active[w2++] = ei;
      }
      active.length = w2;
    }
    if (!active.length) continue;

    const ys = (k + 0.5) / SS;
    let nc = 0;
    for (let t = 0; t < active.length; t++) {
      const ei = active[t];
      const x = eX[ei] + (ys - eY0[ei]) * eDX[ei];
      const dir = eDir[ei];
      // 插入排序（交叉点数量少）
      let u = nc++;
      while (u > 0 && cx[u - 1] > x) { cx[u] = cx[u - 1]; cd[u] = cd[u - 1]; u--; }
      cx[u] = x; cd[u] = dir;
    }

    const row = (k / SS) | 0;
    const rowBase = row * w;
    let wind = 0;
    let spanStart = 0;
    for (let t = 0; t < nc; t++) {
      const before = wind;
      wind += cd[t];
      if (before === 0 && wind !== 0) spanStart = cx[t];
      else if (before !== 0 && wind === 0) addSpan(cov, rowBase, w, spanStart, cx[t]);
    }
  }

  for (let i = 0; i < n; i++) {
    const v = cov[i];
    if (v <= 0) continue;
    out[i] = v >= 1 ? 255 : (v * 255 + 0.5) | 0;
  }
  return out;
}

// 水平精确覆盖：把 [xa,xb] 按像素切开，按重叠长度累加
function addSpan(cov, rowBase, w, xa, xb) {
  if (xb <= xa) return;
  let a = xa < 0 ? 0 : xa;
  let b = xb > w ? w : xb;
  if (b <= a) return;
  const i0 = Math.floor(a);
  const i1 = Math.ceil(b);
  const wgt = 1 / SS;
  for (let i = i0; i < i1; i++) {
    const l = a > i ? a : i;
    const r = b < i + 1 ? b : i + 1;
    if (r > l) cov[rowBase + i] += (r - l) * wgt;
  }
}

// ───────────────────────────── 公开 API ─────────────────────────────

/**
 * 加载字体（按路径缓存，重复调用返回同一 Font 对象）。
 * @returns {{path:string, unitsPerEm:number, ascent:number, descent:number, numGlyphs:number,
 *            glyph(cp):object|null, has(cp):boolean}}
 * ascent/descent 单位为字体单位（descent 为负）。
 */
export function loadFont(path) {
  const hit = fontCache.get(path);
  if (hit) return hit;
  const font = parseFont(path);
  fontCache.set(path, font);
  return font;
}

const EMPTY_MASK = () => ({ w: 0, h: 0, left: 0, top: 0, advance: 0, a: new Uint8Array(0) });

/**
 * 单字形 mask。
 * @param px em 像素（字号）
 * @param opts {padding=2}
 * @returns {{w:number,h:number,left:number,top:number,advance:number,a:Uint8Array}|null}
 *   left/top 相对基线原点 (0,0)，top 向上为负；blit 到 (x+left, y+top)。
 */
export function glyphMask(font, cp, px, opts = {}) {
  if (!font) return null;
  const c = typeof cp === 'string' ? (cp.codePointAt(0) | 0) : (cp | 0);
  const pad = opts.padding == null ? 2 : (opts.padding | 0);
  const size = +px;
  if (!(size > 0) || !isFinite(size)) return null;

  const key = pad === 2 ? `${font.path}|${c}|${size}` : `${font.path}|${c}|${size}|${pad}`;
  const hit = maskCache.get(key);
  if (hit !== undefined) return hit;

  const gid = font.glyphIndex ? font.glyphIndex(c) : 0;
  if (!gid) { // 缺失字形：返回 null（advance 由调用方按 notdef 处理）
    maskCache.set(key, null);
    return null;
  }
  const glyph = font.glyphById ? font.glyphById(gid) : font.glyph(c);
  if (!glyph) { maskCache.set(key, null); return null; }

  const scale = size / font.unitsPerEm;
  const advPx = glyph.advance * scale;

  if (glyph.empty || !glyph.contours.length) {
    const m = { w: 0, h: 0, left: 0, top: 0, advance: advPx, a: new Uint8Array(0) };
    maskCache.set(key, m);
    return m;
  }

  // 轮廓 → 屏幕多边形（先不平移，求 bbox）
  const polys = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const cpts of glyph.contours) {
    const poly = contourToPoly(cpts, scale, 0, 0);
    if (poly.length < 6) continue;
    polys.push(poly);
    for (let i = 0; i < poly.length; i += 2) {
      const x = poly[i], y = poly[i + 1];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (!isFinite(x0) || !polys.length) {
    const m = { w: 0, h: 0, left: 0, top: 0, advance: advPx, a: new Uint8Array(0) };
    maskCache.set(key, m);
    return m;
  }

  const left = Math.floor(x0 - pad);
  const top = Math.floor(y0 - pad);
  const right = Math.ceil(x1 + pad);
  const bottom = Math.ceil(y1 + pad);
  const w = Math.max(0, right - left);
  const h = Math.max(0, bottom - top);
  if (!w || !h) {
    const m = { w: 0, h: 0, left: 0, top: 0, advance: advPx, a: new Uint8Array(0) };
    maskCache.set(key, m);
    return m;
  }

  // 平移到 mask 局部坐标
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i += 2) { poly[i] -= left; poly[i + 1] -= top; }
  }

  const a = rasterize(polys, w, h);
  const m = { w, h, left, top, advance: advPx, a };
  maskCache.set(key, m);
  return m;
}

/**
 * 单行文本 mask（advance 累加，无 kern / 无合字）。
 * 返回的 left/top 相对第一字符基线原点。
 */
export function textMask(font, str, px, opts = {}) {
  if (!font) return EMPTY_MASK();
  const s = str == null ? '' : String(str);
  const size = +px;
  if (!(size > 0) || !isFinite(size)) return EMPTY_MASK();

  const pad = opts.padding == null ? 2 : (opts.padding | 0);
  const parts = [];
  let pen = 0;
  let notdefAdv = null;

  for (const ch of s) {
    const c = ch.codePointAt(0);
    let m = glyphMask(font, c, size, opts);
    if (!m) {
      if (notdefAdv == null) {
        const g0 = font.glyphById ? font.glyphById(0) : null;
        notdefAdv = (g0 && g0.advance ? g0.advance : font.unitsPerEm * 0.5) * (size / font.unitsPerEm);
      }
      pen += notdefAdv;
      continue;
    }
    if (m.w > 0 && m.h > 0) {
      parts.push({ m, x: Math.round(pen + m.left), y: m.top });
    }
    pen += m.advance;
  }

  if (!parts.length) return { w: 0, h: 0, left: 0, top: 0, advance: pen, a: new Uint8Array(0) };

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of parts) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x + p.m.w > x1) x1 = p.x + p.m.w;
    if (p.y + p.m.h > y1) y1 = p.y + p.m.h;
  }
  const w = Math.max(0, Math.ceil(x1) - Math.floor(x0));
  const h = Math.max(0, Math.ceil(y1) - Math.floor(y0));
  if (!w || !h) return { w: 0, h: 0, left: 0, top: 0, advance: pen, a: new Uint8Array(0) };

  const left = Math.floor(x0);
  const top = Math.floor(y0);
  const a = new Uint8Array(w * h);
  for (const p of parts) {
    const dx = p.x - left;
    const dy = p.y - top;
    const ma = p.m.a;
    for (let yy = 0; yy < p.m.h; yy++) {
      const dRow = (yy + dy) * w + dx;
      const sRow = yy * p.m.w;
      for (let xx = 0; xx < p.m.w; xx++) {
        const v = ma[sRow + xx];
        if (v === 0) continue;
        const di = dRow + xx;
        if (v > a[di]) a[di] = v;
      }
    }
  }
  return { w, h, left, top, advance: pen, a };
}

/**
 * 文本度量。width 为 advance 总和（px）；ascent/descent 为正值（px）。
 */
export function measure(font, str, px) {
  const size = +px;
  if (!font || !(size > 0) || !isFinite(size)) {
    return { width: 0, ascent: 0, descent: 0 };
  }
  const s = str == null ? '' : String(str);
  const scale = size / font.unitsPerEm;
  let width = 0;
  let notdefAdv = null;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (font.has && font.has(c)) {
      const g = font.glyphById ? font.glyphById(font.glyphIndex(c)) : font.glyph(c);
      width += (g ? g.advance : 0) * scale;
    } else {
      if (notdefAdv == null) {
        const g0 = font.glyphById ? font.glyphById(0) : null;
        notdefAdv = (g0 && g0.advance ? g0.advance : font.unitsPerEm * 0.5) * scale;
      }
      width += notdefAdv;
    }
  }
  return {
    width,
    ascent: font.ascent * scale,
    descent: -font.descent * scale,
  };
}

/** 清空所有缓存（测试/调试用） */
export function clearCaches() {
  maskCache.clear();
  for (const f of fontCache.values()) f.glyphCache.clear();
}

/** 缓存统计（测试/调试用） */
export function cacheStats() {
  return { masks: maskCache.size, fonts: fontCache.size };
}
