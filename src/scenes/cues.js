// cues.js — 全片拍点与人声时间（唯一入口；改时间只改这里）
// src: 'analysis' = 音频分析/本文实测；'init' = 初值，待耳朵确认；'grid' = 拍点网格

export const TEMPO = { bpm: 130, beat: 0.4615384615, bar: 1.846153846, origin: 0.344 };

export const B = (n) => TEMPO.origin + n * TEMPO.beat;
export const BAR = (n) => TEMPO.origin + n * TEMPO.bar;

export const CUES = {
  // ---- 导歌二：性别那一句（第 57 行）----
  'pre2.gender.letter1': { t: 90.80, src: 'analysis', note: 'B(49) F，格子填实+巨大字母' },
  'pre2.gender.d1': { t: 91.05, src: 'analysis', note: 'D1，游标按住第二格' },
  'pre2.gender.letter2': { t: 91.72, src: 'analysis', note: 'Bt(198) M，主事件，匹配剪辑 boy_bust' },
  'pre2.gender.d2': { t: 91.98, src: 'analysis', note: 'D2，长发落下/整张震一下' },
  'pre2.gender.next': { t: 92.65, src: 'grid', note: 'B(50) 切到「一天」' },

  // ---- 导歌二：一天 ----
  'pre2.day.grab': { t: 92.65, src: 'grid', note: '游标抓住太阳' },
  'pre2.day.drag': { t: 94.04, src: 'init', note: '开始加速拖' },
  'pre2.day.am': { t: 94.50, src: 'init', note: 'AM' },
  'pre2.day.d3': { t: 94.93, src: 'analysis', note: 'D3 太阳最高点' },
  'pre2.day.pm': { t: 95.16, src: 'init', note: 'PM' },
  'pre2.day.d4': { t: 95.63, src: 'analysis', note: 'D4 入暮' },

  // ---- 导歌二：角色那一句（第 61 行）----
  'pre2.role.in': { t: 96.34, src: 'grid', note: 'D5 切入' },
  'pre2.role.d6': { t: 97.50, src: 'analysis', note: 'D6 握住旋钮' },
  'pre2.role.d7': { t: 97.97, src: 'analysis', note: 'D7 开始上推（预备）' },
  'pre2.role.letter1': { t: 98.19, src: 'analysis', note: 'B(53) S，主事件' },
  'pre2.role.release': { t: 98.70, src: 'init', note: '旋钮被拉下来' },
  'pre2.role.letter2': { t: 99.10, src: 'analysis', note: 'Bt(214) M，主事件' },
  'pre2.role.d8': { t: 99.35, src: 'analysis', note: 'D8 塌到底（下垂终点）' },

  // ---- 导歌二：收尾 ----
  'pre2.tail.d9': { t: 100.04, src: 'analysis', note: 'D9 打开 Loop' },
  'pre2.tail.d10': { t: 100.28, src: 'analysis', note: 'D10 点完成' },
  'pre2.tail.rise': { t: 103.26, src: 'analysis', note: '上升音' },
  'pre2.tail.click': { t: 103.26, src: 'analysis', note: '游标点进输入框' },
  'chorus2.downbeat': { t: 103.75, src: 'grid', note: '副歌二重拍' },

  // ---- 主歌二：四个名词 ----
  'verse2.eggplant': { t: 75.10, src: 'init', note: '茄子' },
  'verse2.tomato': { t: 78.80, src: 'init', note: '番茄' },
  'verse2.cat': { t: 82.50, src: 'init', note: '猫（cat_bust 耳朵弹出）' },
  'verse2.enjoyment': { t: 84.27, src: 'init', note: 'ENJOYMENT' },
  'verse2.god': { t: 86.19, src: 'init', note: 'god 日芒' },
  'verse2.existence': { t: 87.92, src: 'init', note: 'EXISTENCE 米白版套印' },

  // ---- 副歌一 ----
  'chorus1.stim': { t: 61.96, src: 'grid', note: 'STIMULATIONS 切点（弱拍）' },
  'chorus1.stim.hit': { t: 62.19, src: 'grid', note: '闪光劈下' },
  'chorus1.satis': { t: 65.42, src: 'grid', note: 'SATISFACTION 切点（重拍）' },
  'chorus1.satis.press': { t: 65.88, src: 'grid', note: '按下' },
  'chorus1.exec': { t: 69.34, src: 'grid', note: 'EXECUTION 切点（弱拍）' },
  'chorus1.exec.hit': { t: 69.57, src: 'grid', note: '清单落到第 07 行' },
  'chorus1.sim': { t: 73.27, src: 'grid', note: 'SIMULATION 切点（重拍）' },
  'chorus1.sim.out': { t: 73.73, src: 'grid', note: '推远' },
  'chorus1.reach': { t: 68.19, src: 'init', note: '游标落在手心，计数 1' },

  // ---- E 段 ----
  'alone.away': { t: 112.96, src: 'analysis', note: '状态→离开' },
  'alone.offline': { t: 114.81, src: 'analysis', note: '状态→离线' },
  'alone.isolation': { t: 117.34, src: 'init', note: 'ISOLATION' },
  'disheartened.hit': { t: 124.89, src: 'analysis', note: 'DISHEARTENED 人声进入' },
  'disheartened.sel': { t: 125.19, src: 'init', note: '删除控件出现' },
  'disheartened.press1': { t: 125.42, src: 'init', note: '第一次按下' },
  'disheartened.press2': { t: 125.65, src: 'grid', note: '第二次按下+擦除' },

  // ---- G 段 ----
  'exec.12.start': { t: 148.04, src: 'grid', note: '十二声开始' },
  'exec.12.end': { t: 159.11, src: 'grid', note: '切数数' },
  'exec.count.1': { t: 159.11, src: 'grid', note: '第 344 拍' },
  'exec.count.6': { t: 161.42, src: 'grid', note: '第 349 拍' },
  'exec.last': { t: 161.88, src: 'grid', note: '最后一声' },
  'exec.last.end': { t: 162.81, src: 'grid', note: '切最后副歌' },

  // ---- LOVE 音节 ----
  'love.1.a': { t: 179.93, src: 'init', note: '第一个 LOVE 音节 1' },
  'love.1.b': { t: 180.16, src: 'init', note: '音节 2' },
  'love.1.c': { t: 180.39, src: 'init', note: '音节 3' },
  'love.2.a': { t: 183.65, src: 'init', note: '第二个 LOVE 音节 1' },
  'love.2.b': { t: 183.88, src: 'init', note: '音节 2' },
  'love.2.c': { t: 184.11, src: 'init', note: '音节 3' },
  'love.3.a': { t: 187.67, src: 'init', note: '第三个 LOVE 音节 1' },
  'love.3.b': { t: 187.90, src: 'init', note: '音节 2' },
  'love.3.c': { t: 188.13, src: 'init', note: '音节 3' },
  'love.4.a': { t: 191.36, src: 'init', note: '第四个 LOVE 音节 1' },
  'love.4.b': { t: 191.66, src: 'init', note: '音节 2' },
  'love.4.c': { t: 192.05, src: 'init', note: '音节 3（切点前）' },

  // ---- 结尾 ----
  'outro.vocal.end': { t: 195.36, src: 'init', note: '人声收住的上限，待测' },
  'outro.like': { t: 194.65, src: 'init', note: '心形计数 0' },
  'outro.log': { t: 195.11, src: 'init', note: 'last message: unread' },
  'outro.love1': { t: 197.65, src: 'init', note: '删第 1 下' },
  'outro.love2': { t: 197.88, src: 'init', note: '删第 2 下' },
  'outro.love3': { t: 198.11, src: 'init', note: '删第 3 下' },
  'outro.undef': { t: 198.34, src: 'init', note: 'undefined' },
  'outro.last.1': { t: 205.73, src: 'init', note: '最后一声音节 1' },
  'outro.last.2': { t: 205.96, src: 'init', note: '音节 2' },
  'outro.last.3': { t: 206.19, src: 'init', note: '音节 3（回车）' },
  'outro.last.4': { t: 206.42, src: 'init', note: '音节 4' },

  // ---- 全局网格 ----
  'grid.163': { t: B(163), src: 'grid', note: '' },
  'bar.44': { t: BAR(44), src: 'grid', note: '' },
};

export function cue(name) {
  const c = CUES[name];
  if (!c) throw new Error('missing cue: ' + name);
  return c.t;
}

// 导歌二十个孤立重击
export const PRE2_HITS = [
  cue('pre2.gender.d1'), cue('pre2.gender.d2'), cue('pre2.day.d3'), cue('pre2.day.d4'),
  cue('pre2.role.in'), cue('pre2.role.d6'), cue('pre2.role.d7'), cue('pre2.role.d8'),
  cue('pre2.tail.d9'), cue('pre2.tail.d10'),
];

// 闪光检查区间（歌曲时间）
export const FLASH_RANGE = [148.0, 192.34];
export const PREROLL = 5.0;
