// raster.js — 确定性软件光栅器
// 只依赖 node:zlib。像素格式：RGB，Uint8ClampedArray，行优先。
// 所有绘制都走整数/浮点确定性运算，不用 Math.random。

import zlib from 'node:zlib';

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex([r, g, b]) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export const ease = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  outBack: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
};

export class Surface {
  constructor(w, h) {
    this.w = w | 0;
    this.h = h | 0;
    this.data = new Uint8ClampedArray(this.w * this.h * 3);
  }

  clone() {
    const s = new Surface(this.w, this.h);
    s.data.set(this.data);
    return s;
  }

  fill(rgb) {
    const d = this.data, n = d.length;
    const r = rgb[0], g = rgb[1], b = rgb[2];
    for (let i = 0; i < n; i += 3) { d[i] = r; d[i + 1] = g; d[i + 2] = b; }
    return this;
  }

  // ---------- 基本块 ----------
  rect(x, y, w, h, rgb, alpha = 1, mode = 'over') {
    if (alpha && typeof alpha === 'object') { mode = alpha.mode || 'over'; alpha = alpha.alpha ?? 1; }
    const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w)), y1 = Math.min(this.h, Math.round(y + h));
    if (x1 <= x0 || y1 <= y0) return this;
    const d = this.data;
    const r = rgb[0], g = rgb[1], b = rgb[2];
    if (alpha >= 1 && mode === 'over') {
      for (let yy = y0; yy < y1; yy++) {
        let i = (yy * this.w + x0) * 3;
        for (let xx = x0; xx < x1; xx++, i += 3) { d[i] = r; d[i + 1] = g; d[i + 2] = b; }
      }
    } else if (mode === 'over') {
      const ia = 1 - alpha;
      for (let yy = y0; yy < y1; yy++) {
        let i = (yy * this.w + x0) * 3;
        for (let xx = x0; xx < x1; xx++, i += 3) {
          d[i] = d[i] * ia + r * alpha;
          d[i + 1] = d[i + 1] * ia + g * alpha;
          d[i + 2] = d[i + 2] * ia + b * alpha;
        }
      }
    } else {
      for (let yy = y0; yy < y1; yy++) {
        let i = (yy * this.w + x0) * 3;
        for (let xx = x0; xx < x1; xx++, i += 3) blendPixel(d, i, r, g, b, alpha, mode);
      }
    }
    return this;
  }

  // 整数坐标快速填充（不混合，用于底色）
  fillRectRaw(x, y, w, h, rgb) {
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.w, (x + w) | 0), y1 = Math.min(this.h, (y + h) | 0);
    if (x1 <= x0 || y1 <= y0) return this;
    const d = this.data, [r, g, b] = rgb;
    for (let yy = y0; yy < y1; yy++) {
      let i = (yy * this.w + x0) * 3;
      for (let xx = x0; xx < x1; xx++, i += 3) { d[i] = r; d[i + 1] = g; d[i + 2] = b; }
    }
    return this;
  }

  // 读像素
  get(x, y) {
    const i = ((y | 0) * this.w + (x | 0)) * 3;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }

  // ---------- 合成 ----------
  composite(src, dx, dy, alpha = 1, mode = 'over', clip = null) {
    const sx0 = Math.max(0, -dx), sy0 = Math.max(0, -dy);
    const sx1 = Math.min(src.w, this.w - dx), sy1 = Math.min(src.h, this.h - dy);
    if (sx1 <= sx0 || sy1 <= sy0) return this;
    const d = this.data, s = src.data;
    for (let y = sy0; y < sy1; y++) {
      let di = ((y + dy) * this.w + dx + sx0) * 3;
      let si = (y * src.w + sx0) * 3;
      for (let x = sx0; x < sx1; x++, di += 3, si += 3) {
        if (clip && clip[(y + dy) * this.w + (x + dx)] === 0) continue;
        blendPixel(d, di, s[si], s[si + 1], s[si + 2], alpha, mode);
      }
    }
    return this;
  }

  // ---------- 路径填充 ----------
  // polys: [[[x,y],...],...]  已展平的多边形环
  // opt: {alpha, mode, evenOdd, aa, clip}
  fillPath(polys, rgb, opt = {}) {
    const alpha = opt.alpha ?? 1;
    const mode = opt.mode ?? 'over';
    const evenOdd = !!opt.evenOdd;
    const aa = opt.aa ?? 3;
    const clip = opt.clip ?? null;
    const W = this.w, H = this.h;
    const [cr, cg, cb] = rgb;

    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    const edges = [];
    for (const poly of polys) {
      const n = poly.length;
      if (n < 3) continue;
      for (let i = 0; i < n; i++) {
        const x1 = poly[i][0], y1 = poly[i][1];
        const x2 = poly[(i + 1) % n][0], y2 = poly[(i + 1) % n][1];
        if (x1 < minX) minX = x1; if (x1 > maxX) maxX = x1;
        if (x2 < minX) minX = x2; if (x2 > maxX) maxX = x2;
        if (y1 < minY) minY = y1; if (y1 > maxY) maxY = y1;
        if (y2 < minY) minY = y2; if (y2 > maxY) maxY = y2;
        if (y1 === y2) continue;
        edges.push({ x1, y1, x2, y2, dir: y2 > y1 ? 1 : -1, ymin: Math.min(y1, y2), ymax: Math.max(y1, y2) });
      }
    }
    if (!edges.length) return this;
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H - 1, Math.ceil(maxY) - 1);
    const xlo = Math.max(0, Math.floor(minX)), xhi = Math.min(W - 1, Math.ceil(maxX));
    if (y1 < y0 || xhi < xlo) return this;

    edges.sort((a, b) => a.ymin - b.ymin || a.x1 - b.x1);
    const cov = new Float32Array(xhi - xlo + 2);
    const xs = [];
    let ei = 0;
    const active = [];
    const data = this.data;

    for (let y = y0; y <= y1; y++) {
      // 维护活跃边
      while (ei < edges.length && edges[ei].ymin <= y + 1) active.push(edges[ei++]);
      for (let k = active.length - 1; k >= 0; k--) {
        if (active[k].ymax <= y) active.splice(k, 1);
      }
      if (!active.length) continue;
      cov.fill(0);
      let any = false;
      for (let s = 0; s < aa; s++) {
        const sy = y + (s + 0.5) / aa;
        xs.length = 0;
        for (let k = 0; k < active.length; k++) {
          const e = active[k];
          if (sy < e.ymin || sy >= e.ymax) continue;
          const t = (sy - e.y1) / (e.y2 - e.y1);
          xs.push([e.x1 + t * (e.x2 - e.x1), e.dir]);
        }
        if (xs.length < 2) continue;
        xs.sort((a, b) => a[0] - b[0]);
        if (evenOdd) {
          for (let k = 0; k + 1 < xs.length; k += 2) any = addSpan(cov, xs[k][0], xs[k + 1][0], 1 / aa, xlo) || any;
        } else {
          let wind = 0;
          for (let k = 0; k < xs.length - 1; k++) {
            wind += xs[k][1];
            if (wind !== 0) any = addSpan(cov, xs[k][0], xs[k + 1][0], 1 / aa, xlo) || any;
          }
        }
      }
      if (!any) continue;
      let i = (y * W + xlo) * 3;
      for (let x = xlo; x <= xhi; x++, i += 3) {
        const c = cov[x - xlo];
        if (c <= 0.0005) continue;
        if (clip && clip[y * W + x] === 0) continue;
        blendPixel(data, i, cr, cg, cb, alpha * Math.min(1, c), mode);
      }
    }
    return this;
  }

  // 描边：把折线转成带圆头的四边形集合（nonzero 填充）
  stroke(points, width, rgb, opt = {}) {
    const hw = width / 2;
    const polys = [];
    const caps = [];
    for (let i = 0; i + 1 < points.length; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[i + 1];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1e-6;
      const nx = (-dy / len) * hw, ny = (dx / len) * hw;
      polys.push([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]);
      if (opt.caps !== false) { caps.push([x1, y1, hw]); caps.push([x2, y2, hw]); }
    }
    if (opt.caps !== false) {
      for (const [cx, cy, r] of caps) polys.push(circlePoly(cx, cy, r, 12));
    }
    return this.fillPath(polys, rgb, { ...opt, evenOdd: false });
  }

  // 圆 / 椭圆
  ellipse(cx, cy, rx, ry, rgb, opt = {}) {
    const n = opt.segs ?? 48;
    const poly = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      poly.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return this.fillPath([poly], rgb, opt);
  }

  circle(cx, cy, r, rgb, opt = {}) { return this.ellipse(cx, cy, r, r, rgb, opt); }

  // 线段（带宽度）
  line(x1, y1, x2, y2, width, rgb, opt = {}) {
    return this.stroke([[x1, y1], [x2, y2]], width, rgb, opt);
  }

  // ---------- 模糊 ----------
  // 三次盒式模糊近似高斯；半径单位像素
  blur(r) {
    if (r <= 0) return this;
    const W = this.w, H = this.h;
    const a = new Float32Array(this.data.length);
    for (let i = 0; i < a.length; i++) a[i] = this.data[i];
    const tmp = new Float32Array(a.length);
    const box = (src, dst, rad, horiz) => {
      const n = horiz ? W : H, m = horiz ? H : W;
      const span = rad * 2 + 1;
      for (let j = 0; j < m; j++) {
        const base = horiz ? j * W * 3 : j * 3;
        const step = horiz ? 3 : W * 3;
        let sum0 = 0, sum1 = 0, sum2 = 0;
        for (let k = -rad; k <= rad; k++) {
          const kk = k < 0 ? 0 : k >= n ? n - 1 : k;
          const i = base + kk * step;
          sum0 += src[i]; sum1 += src[i + 1]; sum2 += src[i + 2];
        }
        for (let i = 0; i < n; i++) {
          const o = base + i * step;
          dst[o] = sum0 / span; dst[o + 1] = sum1 / span; dst[o + 2] = sum2 / span;
          const addK = i + rad + 1 >= n ? n - 1 : i + rad + 1;
          const subK = i - rad < 0 ? 0 : i - rad;
          const ai = base + addK * step, si = base + subK * step;
          sum0 += src[ai] - src[si];
          sum1 += src[ai + 1] - src[si + 1];
          sum2 += src[ai + 2] - src[si + 2];
        }
      }
    };
    for (let pass = 0; pass < 3; pass++) {
      box(a, tmp, Math.max(1, Math.round(r)), true);
      box(tmp, a, Math.max(1, Math.round(r)), false);
    }
    for (let i = 0; i < a.length; i++) this.data[i] = a[i];
    return this;
  }

  // 只保留亮部（用于 bloom 阈值）
  brightPass(threshold = 0.55) {
    const d = this.data;
    for (let i = 0; i < d.length; i += 3) {
      const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
      const k = l <= threshold ? 0 : Math.min(1, (l - threshold) / (1 - threshold));
      d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
    }
    return this;
  }

  // ---------- 效果 ----------
  noise(amount, seed = 1, mono = true) {
    const d = this.data;
    let s = (seed >>> 0) || 1;
    for (let i = 0; i < d.length; i += 3) {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      const n = ((s & 255) / 255 - 0.5) * amount;
      if (mono) { d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      else { d[i] += n; d[i + 1] += n * 0.6; d[i + 2] += n * 0.3; }
    }
    return this;
  }

  vignette(strength = 0.5, rgb = [0, 0, 0]) {
    const W = this.w, H = this.h, d = this.data;
    const cx = W / 2, cy = H / 2, maxd = Math.hypot(cx, cy);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const r = Math.hypot(x - cx, y - cy) / maxd;
        const k = Math.min(1, Math.max(0, (r - 0.45) / 0.55)) * strength;
        const i = (y * W + x) * 3;
        d[i] = d[i] * (1 - k) + rgb[0] * k;
        d[i + 1] = d[i + 1] * (1 - k) + rgb[1] * k;
        d[i + 2] = d[i + 2] * (1 - k) + rgb[2] * k;
      }
    }
    return this;
  }

  // 双线性缩放
  scaled(w, h) {
    const s = new Surface(w, h);
    const sx = this.w / w, sy = this.h / h;
    for (let y = 0; y < h; y++) {
      const fy = (y + 0.5) * sy - 0.5;
      const y0 = clamp(Math.floor(fy), 0, this.h - 1), y1 = clamp(y0 + 1, 0, this.h - 1);
      const ty = clamp(fy - y0, 0, 1);
      for (let x = 0; x < w; x++) {
        const fx = (x + 0.5) * sx - 0.5;
        const x0 = clamp(Math.floor(fx), 0, this.w - 1), x1 = clamp(x0 + 1, 0, this.w - 1);
        const tx = clamp(fx - x0, 0, 1);
        const i00 = (y0 * this.w + x0) * 3, i10 = (y0 * this.w + x1) * 3;
        const i01 = (y1 * this.w + x0) * 3, i11 = (y1 * this.w + x1) * 3;
        const o = (y * w + x) * 3;
        for (let c = 0; c < 3; c++) {
          const top = this.data[i00 + c] * (1 - tx) + this.data[i10 + c] * tx;
          const bot = this.data[i01 + c] * (1 - tx) + this.data[i11 + c] * tx;
          s.data[o + c] = top * (1 - ty) + bot * ty;
        }
      }
    }
    return s;
  }

  // 横向撕裂：rowOffset 由 y 决定；返回新表面
  tearRow(y0, y1, dx) {
    if (!dx) return this;
    const W = this.w, d = this.data;
    for (let y = Math.max(0, y0); y < Math.min(this.h, y1); y++) {
      const base = y * W * 3;
      const row = d.slice(base, base + W * 3);
      for (let x = 0; x < W; x++) {
        const sx = ((x - dx) % W + W) % W;
        d[base + x * 3] = row[sx * 3];
        d[base + x * 3 + 1] = row[sx * 3 + 1];
        d[base + x * 3 + 2] = row[sx * 3 + 2];
      }
    }
    return this;
  }

  // RGB 分离（水平错位，dx 像素）
  rgbSplit(dx) {
    if (!dx) return this;
    const W = this.w, H = this.h, d = this.data;
    const src = d.slice();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        const xr = clamp(x + Math.round(dx), 0, W - 1);
        const xb = clamp(x - Math.round(dx), 0, W - 1);
        d[i] = src[(y * W + xr) * 3];
        d[i + 2] = src[(y * W + xb) * 3 + 2];
      }
    }
    return this;
  }

  // 整幅平移（镜头漂移）
  shift(dx, dy) {
    if (!dx && !dy) return this;
    const W = this.w, H = this.h, d = this.data;
    const src = d.slice();
    const sdx = Math.max(0, Math.min(W - 1, dx | 0));
    for (let y = 0; y < H; y++) {
      const sy = Math.min(H - 1, Math.max(0, y - dy));
      const sb = (sy * W) * 3, db = (y * W) * 3;
      if (sdx === 0) {
        d.set(src.subarray(sb, sb + W * 3), db);
      } else {
        const n = (W - sdx) * 3;
        d.set(src.subarray(sb, sb + n), db + sdx * 3);
        d.set(src.subarray(sb + n, sb + W * 3), db);
      }
    }
    return this;
  }

  // 亮度乘数
  bright(k) {
    const d = this.data;
    for (let i = 0; i < d.length; i++) d[i] = d[i] * k;
    return this;
  }

  // 反相
  invert() {
    const d = this.data;
    for (let i = 0; i < d.length; i++) d[i] = 255 - d[i];
    return this;
  }

  // 灰度化（保留给 off 状态）
  desaturate(k = 1) {
    const d = this.data;
    for (let i = 0; i < d.length; i += 3) {
      const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] += (l - d[i]) * k; d[i + 1] += (l - d[i + 1]) * k; d[i + 2] += (l - d[i + 2]) * k;
    }
    return this;
  }

  // 从 alpha mask blit（文字用）
  blitMask(mask, x, y, rgb, alpha = 1, mode = 'over', clip = null) {
    const { w, h, a } = mask;
    const d = this.data;
    const [r, g, b] = rgb;
    const x0 = Math.max(0, -x), y0 = Math.max(0, -y);
    const x1 = Math.min(w, this.w - x), y1 = Math.min(h, this.h - y);
    for (let yy = y0; yy < y1; yy++) {
      let di = ((yy + y) * this.w + x + x0) * 3;
      let ai = yy * w + x0;
      const gy = yy + y;
      for (let xx = x0; xx < x1; xx++, di += 3, ai++) {
        const c = a[ai];
        if (c === 0) continue;
        if (clip && clip[gy * this.w + xx + x] < 100) continue;
        const k = (c / 255) * alpha;
        if (k <= 0) continue;
        blendPixel(d, di, r, g, b, k, mode);
      }
    }
    return this;
  }

  // ---------- PNG ----------
  toPNG() {
    return encodePNG(this.w, this.h, this.data);
  }

  // ---------- 统计 ----------
  // 平均亮度（0..1），可限定区域
  meanLuma(x = 0, y = 0, w = this.w, h = this.h, stride = 4) {
    let sum = 0, n = 0;
    const x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (let yy = Math.max(0, y); yy < y1; yy += stride) {
      for (let xx = Math.max(0, x); xx < x1; xx += stride) {
        const i = (yy * this.w + xx) * 3;
        sum += this.data[i] * 0.299 + this.data[i + 1] * 0.587 + this.data[i + 2] * 0.114;
        n++;
      }
    }
    return n ? sum / n / 255 : 0;
  }
}

function blendPixel(d, i, r, g, b, a, mode) {
  if (a <= 0) return;
  if (a >= 1) {
    if (mode === 'over' || mode === 'add') {
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    } else if (mode === 'mult') {
      d[i] *= r / 255; d[i + 1] *= g / 255; d[i + 2] *= b / 255;
    } else if (mode === 'screen') {
      d[i] = 255 - (255 - d[i]) * (255 - r) / 255;
      d[i + 1] = 255 - (255 - d[i + 1]) * (255 - g) / 255;
      d[i + 2] = 255 - (255 - d[i + 2]) * (255 - b) / 255;
    }
    return;
  }
  if (mode === 'over') {
    d[i] += (r - d[i]) * a;
    d[i + 1] += (g - d[i + 1]) * a;
    d[i + 2] += (b - d[i + 2]) * a;
  } else if (mode === 'add') {
    d[i] += r * a; d[i + 1] += g * a; d[i + 2] += b * a;
  } else if (mode === 'mult') {
    d[i] += (d[i] * (r / 255) - d[i]) * a;
    d[i + 1] += (d[i + 1] * (g / 255) - d[i + 1]) * a;
    d[i + 2] += (d[i + 2] * (b / 255) - d[i + 2]) * a;
  } else if (mode === 'screen') {
    const sr = 255 - (255 - d[i]) * (255 - r) / 255;
    const sg = 255 - (255 - d[i + 1]) * (255 - g) / 255;
    const sb = 255 - (255 - d[i + 2]) * (255 - b) / 255;
    d[i] += (sr - d[i]) * a; d[i + 1] += (sg - d[i + 1]) * a; d[i + 2] += (sb - d[i + 2]) * a;
  }
}

function addSpan(cov, xa, xb, wgt, xlo) {
  if (xa > xb) { const t = xa; xa = xb; xb = t; }
  const a = xa - xlo, b = xb - xlo;
  const i0 = Math.max(0, Math.floor(a)), i1 = Math.min(cov.length - 1, Math.ceil(b) - 1);
  if (i1 < i0) return false;
  for (let i = i0; i <= i1; i++) {
    const l = Math.max(a, i), r = Math.min(b, i + 1);
    if (r > l) cov[i] += (r - l) * wgt;
  }
  return true;
}

export function circlePoly(cx, cy, r, n = 24) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return p;
}

// 二次贝塞尔展平
export function quadToPoly(p0, c, p1, steps = 12) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
  return out;
}

export function cubicToPoly(p0, c1, c2, p1, steps = 16) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]]);
  }
  return out;
}

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

export function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    const o = y * (w * 3 + 1) + 1;
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), o);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
