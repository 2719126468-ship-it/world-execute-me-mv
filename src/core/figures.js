// figures.js — 三色剪影的矢量定义（无位图，全部路径）
// 坐标系：f_bust 基准 1000×1400（y 向下）。其他图同坐标系，用 s/t 配准（与 PROMPT 一致）。
// op.ink: 'black' | 'cream' | 'me' | 'paper' | 'hole'
// 图层按数组顺序绘制。

import { ellipse, smoothClosed, smoothOpen, arc, roundRect, cubic, quad } from './geom.js';

const W = 1000, H = 1400;

// ---------- 共用部件 ----------
function shoulders(w = 1, drop = 0) {
  // 胸像的肩与胸，底边到 1400
  const sw = 480 * w;
  return smoothClosed([
    [500 - 110 * w, 700 + drop],
    [500 - sw * 0.62, 790 + drop],
    [500 - sw, 980 + drop],
    [500 - sw * 1.02, 1400],
    [500 + sw * 1.02, 1400],
    [500 + sw, 980 + drop],
    [500 + sw * 0.62, 790 + drop],
    [500 + 110 * w, 700 + drop],
    [500, 760 + drop],
  ], 8);
}

function neck(w = 1, top = 520, bot = 720) {
  return smoothClosed([
    [500 - 78 * w, top],
    [500 + 78 * w, top],
    [500 + 96 * w, bot],
    [500 - 96 * w, bot],
  ], 4);
}

function faceHole(rx = 158, ry = 196, cy = 372) {
  return ellipse(500, cy, rx, ry, 48);
}

// 长发：外轮廓 + 脸洞（evenOdd）
function longHair({ len = 1150, width = 1, fringe = 1, cx = 500 } = {}) {
  const outer = smoothClosed([
    [cx, 26],
    [cx + 106 * width, 44],
    [cx + 196 * width, 132],
    [cx + 240 * width, 280],
    [cx + 252 * width, 430],
    [cx + 292 * width, 610],
    [cx + 330 * width, 820],
    [cx + 344 * width, 1000],
    [cx + 318 * width, len],
    [cx + 246 * width, len + 44],
    [cx + 190 * width, len - 60],
    [cx + 168 * width, 940],
    [cx + 150 * width, 720],
    [cx + 120 * width, 600],
    [cx - 120 * width, 600],
    [cx - 150 * width, 720],
    [cx - 168 * width, 940],
    [cx - 190 * width, len - 60],
    [cx - 246 * width, len + 44],
    [cx - 318 * width, len],
    [cx - 344 * width, 1000],
    [cx - 330 * width, 820],
    [cx - 292 * width, 610],
    [cx - 252 * width, 430],
    [cx - 240 * width, 280],
    [cx - 196 * width, 132],
    [cx - 106 * width, 44],
  ], 8);
  const hole = faceHole(160, 200 * fringe, 372);
  return { outer, hole };
}

function shortHair({ cx = 500, ry = 190, top = 60 } = {}) {
  return smoothClosed([
    [cx, top],
    [cx + 108, top + 22],
    [cx + 188, top + 108],
    [cx + 214, 240],
    [cx + 206, 330],
    [cx + 176, 300],
    [cx + 156, 210],
    [cx - 156, 210],
    [cx - 176, 300],
    [cx - 206, 330],
    [cx - 214, 240],
    [cx - 188, top + 108],
    [cx - 108, top + 22],
  ], 8);
}

function bustBase({ shoulderW = 1, hair = 'long', neckTop = 520, cy = 372, faceRx = 158, faceRy = 196 } = {}) {
  const ops = [];
  ops.push({ ink: 'black', polys: [shoulders(shoulderW)] });
  ops.push({ ink: 'black', polys: [neck(1, neckTop, 730)] });
  if (hair === 'long') {
    const h = longHair({});
    ops.push({ ink: 'black', polys: [h.outer, h.hole], evenOdd: true });
  } else if (hair === 'short') {
    ops.push({ ink: 'black', polys: [shortHair({})] });
  }
  // 脸洞：纸色（发内空洞）
  if (hair === 'long') {
    // 已被 evenOdd 挖掉，无需再画
  } else {
    ops.push({ ink: 'paper', polys: [faceHole(faceRx, faceRy, cy)] });
  }
  return ops;
}

// ---------- f_bust：正面胸像，无脸，长发 ----------
function fBust() {
  const ops = bustBase({ shoulderW: 1, hair: 'long' });
  // 米白：领口（小而克制）
  ops.push({ ink: 'cream', polys: [smoothClosed([
    [500 - 56, 720], [500 + 56, 720], [500 + 84, 812], [500 + 24, 866], [500 - 24, 866], [500 - 84, 812],
  ], 8)] });
  ops.push({ ink: 'cream', polys: [smoothOpen([[500 - 190, 900], [500 - 120, 1010], [500 - 96, 1120]], 6)], stroke: 5 });
  ops.push({ ink: 'cream', polys: [smoothOpen([[500 + 190, 900], [500 + 120, 1010], [500 + 96, 1120]], 6)], stroke: 5 });
  // 橙：发丝高光
  for (let i = 0; i < 7; i++) {
    const s = i % 2 === 0 ? 1 : -1;
    const x0 = 500 + s * (120 + i * 12);
    ops.push({
      ink: 'me',
      polys: [smoothOpen([
        [x0, 120 + i * 8],
        [x0 + s * 46, 320 + i * 20],
        [x0 + s * 58, 620 + i * 30],
        [x0 + s * 40, 860 + i * 24],
      ], 6)],
      stroke: 11 - i,
    });
  }
  return { w: W, h: H, ops };
}

// ---------- f_profile：低头侧脸，完整胸像 ----------
function fProfile() {
  const ops = [];
  ops.push({ ink: 'black', polys: [shoulders(0.96)] });
  // 后脑与长发
  ops.push({ ink: 'black', polys: [smoothClosed([
    [470, 130], [610, 140], [700, 240], [740, 400], [752, 620], [770, 860], [742, 1080],
    [660, 1140], [600, 1020], [590, 820], [560, 700], [500, 640], [470, 600],
  ], 8)] });
  // 侧脸：额头→鼻→唇→下巴（低头，朝左）
  ops.push({ ink: 'black', polys: [smoothClosed([
    [470, 258], [430, 330], [404, 404], [378, 452], [400, 470], [392, 500],
    [420, 520], [410, 556], [452, 590], [520, 620], [560, 660], [560, 720],
    [470, 700], [440, 600], [470, 470],
  ], 8)] });
  // 闭眼：米白细线
  ops.push({ ink: 'cream', polys: [smoothOpen([[398, 420], [420, 432], [444, 428]], 5)], stroke: 7 });
  ops.push({ ink: 'cream', polys: [smoothOpen([[400, 468], [426, 476], [448, 470]], 5)], stroke: 5 });
  // 领口
  ops.push({ ink: 'cream', polys: [smoothClosed([[420, 760], [520, 780], [560, 900], [470, 930], [400, 860]], 8)] });
  return { w: W, h: H, ops };
}

// ---------- f_reach：一手伸出、一手抚胸，闭眼 ----------
function fReach() {
  const ops = bustBase({ shoulderW: 1.0, hair: 'long' });
  // 抚胸的手（米白）
  ops.push({ ink: 'cream', polys: [smoothClosed([
    [560, 900], [640, 880], [690, 940], [660, 1020], [580, 1020], [540, 960],
  ], 8)] });
  for (let i = 0; i < 4; i++) {
    ops.push({ ink: 'cream', polys: [ellipse(590 + i * 26, 890 - i * 4, 14, 26, 16)], stroke: 0 });
  }
  // 伸出的手：前臂 + 张开的掌（向画面右下）
  ops.push({ ink: 'black', polys: [smoothClosed([
    [700, 900], [800, 940], [900, 1010], [980, 1080], [960, 1120], [850, 1060], [760, 1000], [700, 980],
  ], 8)] });
  const palm = [900, 1120];
  ops.push({ ink: 'cream', polys: [ellipse(palm[0], palm[1], 74, 84, 32)] });
  const fingers = [
    [-58, -70, -0.95], [-18, -96, -0.35], [24, -96, 0.15], [62, -78, 0.6], [88, -34, 0.95],
  ];
  for (const [dx, dy, ang] of fingers) {
    const bx = palm[0] + dx * 0.55, by = palm[1] + dy * 0.55;
    const tx = palm[0] + dx, ty = palm[1] + dy;
    ops.push({ ink: 'cream', polys: [smoothOpen([[bx, by], [tx, ty]], 6)], stroke: 26 });
    ops.push({ ink: 'cream', polys: [ellipse(tx, ty, 15, 15, 16)] });
  }
  // 手心虚线心形由场景层画（这里留空）
  // 闭眼
  ops.push({ ink: 'cream', polys: [smoothOpen([[420, 388], [462, 400], [505, 392]], 6)], stroke: 8 });
  ops.push({ ink: 'cream', polys: [smoothOpen([[520, 392], [560, 400], [596, 388]], 6)], stroke: 8 });
  return { w: W, h: H, ops };
}

// ---------- f_eye：脸部特写，睁开一只眼（1254 见方） ----------
function fEye() {
  const S = 1254;
  const ops = [];
  // 底：整块黑（脸的暗面）
  ops.push({ ink: 'black', polys: [[[0, 0], [S, 0], [S, S], [0, S]]] });
  // 巩膜（米白）：杏仁形
  const upper = arc(627, 700, 500, 300, Math.PI * 1.06, Math.PI * 1.94, 60);
  const lower = arc(627, 700, 500, 300, Math.PI * 0.06, Math.PI * 0.94, 60);
  const eye = [...upper, ...lower.reverse()];
  ops.push({ ink: 'cream', polys: [eye] });
  // 虹膜（橙）
  const iris = ellipse(640, 690, 232, 232, 64);
  ops.push({ ink: 'me', polys: [iris] });
  // 虹膜纹理
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    ops.push({
      ink: 'black',
      polys: [smoothOpen([
        [640 + Math.cos(a) * 96, 690 + Math.sin(a) * 96],
        [640 + Math.cos(a) * 200, 690 + Math.sin(a) * 200],
      ], 4)],
      stroke: 4,
      alpha: 0.55,
    });
  }
  // 瞳孔
  ops.push({ ink: 'black', polys: [ellipse(640, 690, 96, 96, 40)] });
  // 高光
  ops.push({ ink: 'cream', polys: [ellipse(700, 620, 28, 28, 20)] });
  // 上眼睑（黑带，压住虹膜上缘）
  const lidOuter = arc(627, 640, 512, 330, Math.PI * 1.04, Math.PI * 1.96, 60);
  const lidInner = arc(627, 700, 500, 300, Math.PI * 1.06, Math.PI * 1.94, 60).reverse();
  ops.push({ ink: 'black', polys: [lidOuter, lidInner], evenOdd: true });
  // 睫毛
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const a = Math.PI * (1.12 + t * 0.76);
    const x = 627 + Math.cos(a) * 500, y = 700 + Math.sin(a) * 300;
    const len = 70 + (i % 2) * 26;
    ops.push({ ink: 'black', polys: [smoothOpen([[x, y], [x - 30 + i * 6, y - len]], 4)], stroke: 13 });
  }
  // 下眼睑线
  ops.push({ ink: 'black', polys: [arc(627, 760, 470, 250, Math.PI * 0.1, Math.PI * 0.9, 40)], stroke: 9 });
  // 眉毛
  ops.push({ ink: 'black', polys: [smoothOpen([[150, 330], [400, 250], [700, 262], [1000, 350]], 8)], stroke: 44 });
  // 鼻梁阴影
  ops.push({ ink: 'black', polys: [smoothOpen([[1080, 520], [1150, 760], [1090, 980]], 6)], stroke: 58 });
  return { w: S, h: S, ops };
}

// ---------- boy_bust：少年正面胸像，短发 ----------
function fBoy() {
  const ops = bustBase({ shoulderW: 0.84, hair: 'short', neckTop: 500, faceRx: 142, faceRy: 180 });
  // 短发的外缘（贴头的发片）
  ops.push({ ink: 'black', polys: [smoothClosed([
    [500 - 190, 250], [500 - 130, 120], [500 - 30, 84], [500 + 90, 96], [500 + 186, 190],
    [500 + 196, 300], [500 + 168, 300], [500 + 120, 210], [500 - 130, 214],
  ], 6)] });
  ops.push({ ink: 'cream', polys: [smoothClosed([[500 - 70, 690], [500 + 70, 690], [500 + 100, 800], [500, 840], [500 - 100, 800]], 8)] });
  ops.push({ ink: 'me', polys: [smoothOpen([[500 - 150, 200], [500 - 40, 150], [500 + 110, 168]], 6)], stroke: 8 });
  return { w: W, h: H, ops };
}

// ---------- man_bust：成年正面胸像 ----------
function fMan() {
  const ops = bustBase({ shoulderW: 1.12, hair: 'short', neckTop: 500, faceRx: 152, faceRy: 190 });
  ops.push({ ink: 'black', polys: [smoothClosed([
    [500 - 210, 240], [500 - 140, 96], [500 - 10, 60], [500 + 140, 96], [500 + 210, 240],
    [500 + 190, 300], [500 + 120, 210], [500 - 120, 210], [500 - 190, 300],
  ], 6)] });
  ops.push({ ink: 'cream', polys: [smoothClosed([[500 - 120, 700], [500, 760], [500 + 120, 700], [500 + 90, 800], [500 - 90, 800]], 8)] });
  return { w: W, h: H, ops };
}

// ---------- cat_bust：猫耳娘 ----------
function fCat() {
  const ops = fBust().ops.slice();
  // 猫耳（黑，内耳米白）
  for (const s of [-1, 1]) {
    const bx = 500 + s * 250;
    ops.push({ ink: 'black', polys: [smoothClosed([
      [bx - s * 40, 150], [bx + s * 20, 4], [bx + s * 96, 148], [bx + s * 30, 210],
    ], 5)] });
    ops.push({ ink: 'cream', polys: [smoothClosed([
      [bx - s * 8, 140], [bx + s * 26, 52], [bx + s * 66, 146], [bx + s * 28, 178],
    ], 5)] });
  }
  return { w: W, h: H, ops };
}

// ---------- cat_paws：双手猫爪，半闭眼 ----------
function fPaws() {
  const ops = [];
  ops.push({ ink: 'black', polys: [smoothClosed([
    [500 - 300, 1400], [500 - 360, 900], [500 - 300, 620], [500 - 150, 520], [500, 500],
    [500 + 150, 520], [500 + 300, 620], [500 + 360, 900], [500 + 300, 1400],
  ], 8)] });
  ops.push({ ink: 'paper', polys: [ellipse(500, 760, 150, 120, 40)] });
  // 半闭眼
  ops.push({ ink: 'black', polys: [ellipse(440, 740, 42, 16, 24)] });
  ops.push({ ink: 'black', polys: [ellipse(566, 740, 42, 16, 24)] });
  // 两只爪
  for (const s of [-1, 1]) {
    const cx = 500 + s * 260, cy = 1060;
    ops.push({ ink: 'cream', polys: [ellipse(cx, cy, 128, 118, 40)] });
    for (let i = 0; i < 4; i++) {
      const a = -0.9 + i * 0.6;
      ops.push({ ink: 'cream', polys: [ellipse(cx + Math.sin(a) * 86, cy - Math.cos(a) * 92, 30, 34, 20)] });
    }
    ops.push({ ink: 'black', polys: [ellipse(cx, cy + 26, 62, 54, 30)], alpha: 0.55 });
  }
  return { w: W, h: H, ops };
}

// ---------- 导出 ----------
const REGISTER = {
  f_bust: { s: 1, tx: 0, ty: 0 },
  f_profile: { s: 1, tx: 0, ty: 0 },
  f_reach: { s: 1, tx: 0, ty: 0 },
  f_eye: { s: 1, tx: 0, ty: 0 },
  boy_bust: { s: 0.89, tx: 60, ty: -18 },
  man_bust: { s: 0.873, tx: 81, ty: -4 },
  cat_bust: { s: 1.0, tx: -28, ty: -49 },
  cat_paws: { s: 1.0, tx: 0, ty: 0 },
};

let cache = null;
export function figures() {
  if (cache) return cache;
  cache = {
    f_bust: fBust(),
    f_profile: fProfile(),
    f_reach: fReach(),
    f_eye: fEye(),
    boy_bust: fBoy(),
    man_bust: fMan(),
    cat_bust: fCat(),
    cat_paws: fPaws(),
  };
  return cache;
}

export function figure(name) {
  const f = figures()[name];
  if (!f) throw new Error('unknown figure ' + name);
  return f;
}

export function registerOf(name) { return REGISTER[name] || { s: 1, tx: 0, ty: 0 }; }
