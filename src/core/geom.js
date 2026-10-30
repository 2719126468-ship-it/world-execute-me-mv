// geom.js — 纯几何构造（返回多边形环，屏幕坐标由调用方给）
import { circlePoly, quadToPoly, cubicToPoly } from './raster.js';

export function ellipse(cx, cy, rx, ry, n = 64, rot = 0) {
  const p = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    p.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return p;
}

export function arc(cx, cy, rx, ry, a0, a1, n = 32, rot = 0) {
  const p = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    p.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return p;
}

export function quad(p0, c, p1, steps = 16) { return quadToPoly(p0, c, p1, steps); }
export function cubic(p0, c1, c2, p1, steps = 20) { return cubicToPoly(p0, c1, c2, p1, steps); }

// 一串点 → 平滑闭合轮廓（Catmull-Rom 转三次贝塞尔）
export function smoothClosed(pts, steps = 10) {
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    const seg = cubicToPoly(p1, c1, c2, p2, steps);
    for (let k = 0; k < seg.length - 1; k++) out.push(seg[k]);
  }
  return out;
}

export function smoothOpen(pts, steps = 10) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    const seg = cubicToPoly(p1, c1, c2, p2, steps);
    for (let k = 0; k < seg.length - 1; k++) out.push(seg[k]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function roundRect(x, y, w, h, r, n = 8) {
  const p = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return p;
}

// 代数心形（隐式曲线的参数化，用于最后一帧）
export function heartCurve(cx, cy, s, n = 220) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([cx + (x / 16) * s, cy - (y / 16) * s * 0.92]);
  }
  return pts;
}

export function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a / 2);
}

export function bbox(polys) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

export function transformPolys(polys, { sx = 1, sy = 1, tx = 0, ty = 0, flipX = false, ox = 0, cx = 0 } = {}) {
  return polys.map((poly) => poly.map(([x, y]) => {
    let xx = flipX ? -(x - cx) + cx : x;
    return [cx + (xx - cx) * sx + tx, y * sy + ty];
  }));
}

// 线框球：返回线段列表
export function wireSphere(cx, cy, r, rot, tilt = 0.35, meridians = 10, parallels = 6) {
  const segs = [];
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const proj = (p) => {
    const x = p[0], y = p[1] * ct - p[2] * st, z = p[1] * st + p[2] * ct;
    return [cx + x * r, cy + y * r, z];
  };
  for (let m = 0; m < meridians; m++) {
    const a = rot + (m / meridians) * Math.PI;
    const line = [];
    for (let i = 0; i <= 24; i++) {
      const b = -Math.PI / 2 + (i / 24) * Math.PI;
      line.push(proj([Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)]));
    }
    segs.push(line);
  }
  for (let p = 1; p < parallels; p++) {
    const b = -Math.PI / 2 + (p / parallels) * Math.PI;
    const line = [];
    for (let i = 0; i <= 32; i++) {
      const a = rot + (i / 32) * Math.PI * 2;
      line.push(proj([Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)]));
    }
    segs.push(line);
  }
  return segs;
}

// 球体上的字符点投影（asciiSphere 用）
export function spherePoints(n, seedFn) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  return pts;
}

export function rotate3(p, rx, ry) {
  let [x, y, z] = p;
  let cy = Math.cos(ry), sy = Math.sin(ry);
  let x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
  let cx = Math.cos(rx), sx = Math.sin(rx);
  let y1 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
  return [x1, y1, z2];
}

export function project3(p, cx, cy, r, tilt = 0.35) {
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const y = p[1] * ct - p[2] * st;
  const z = p[1] * st + p[2] * ct;
  return [cx + p[0] * r, cy + y * r, z];
}
