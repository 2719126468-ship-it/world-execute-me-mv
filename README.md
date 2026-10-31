# world.execute(me); — 同人 MV v4

一支 130 BPM、全片由程式碼繪製的 MV。畫面只有三種：聊天介面、版畫（三色剪影與程式符號畫）、程式碼。

整體框是**一次印刷打樣**：每句歌詞是一次印刷，三種油墨是藍／白／近黑，錯誤是套印不準。版畫頁邊留著校色條、印張號（`SHEET 05/12`）、套準十字與 `PROOF` 章；十二張印張越印越不準，最後一幀去掉所有校樣標記——那是成品。概念全文見 `docs/v4/CONCEPT.md`。

- 片長：**216.96 秒**（歌曲 211.96 秒＋片頭 5 秒閃光警告頁）
- 畫幅：1920×1080 母版；向量重繪，4K 由同一組路徑輸出
- 片頭 −5.00–0.00 秒：編譯器警告樣式的閃光警告頁（無聲）
- 閃光區間：歌曲 **2:28–3:12**，成片 **2:33–3:17**

## 執行

```bash
npm run audio       # 生成占位音軌 audio/track.wav（212 秒）
npm run storyboard  # 重新生成 STORYBOARD.md
npm run check       # 分鏡、閃光、同步檢查

# 單幀
node export/frame.mjs --t 191.9 --out out/final_1080p.png --w 1920 --h 1080

# 片段（歌曲時間；-5 起為片頭）
node export/export.mjs --start -5 --end 212 --width 640 --height 360 --fps 30 --out out/preview_360p30.mp4
node export/export.mjs --start 88 --end 101 --width 1920 --height 1080 --fps 60 --out out/fix_pre2.mp4
node export/export.mjs --start 146 --end 197 --width 1920 --height 1080 --fps 60 --out out/fix_climax.mp4
```

## 結構

```
src/core/     raster.js（軟體光柵器） font.js（TrueType 解析＋字形光柵化）
              art.js（三墨剪影、字符版畫、紙底） figures.js（8 張剪影的向量定義）
              kit.js（光、撕裂、降幀、轉場） ui.js（聊天介面） ascii.js  geom.js
src/scenes/   00_preroll … 13_shutdown、cues.js（全部拍點）、texts.js（歌詞）
tools/        storyboard.mjs  check.mjs  check_flash.py  check_sync.py  compare_sheets.py
              make_audio.mjs  preview.mjs  inspect.mjs  scan.mjs
export/       export.mjs（rawvideo 管道給 ffmpeg） frame.mjs（單幀 PNG）
```

## 渲染

零 npm 依賴：Node 24 + 系統 `ffmpeg`。每幀只由 `t` 決定，沒有跨幀狀態，隨機數用 `prng.js` 的 seeded 版本；因此同一 `t` 永遠得到同一張圖。

- 540p 每秒約 15–20 幀；1080p60 每幀 0.2–0.5 秒（手機 2 核）
- 全片 1080p60 母版在教學機上約需 5–7 小時，本次交付：360p30 全片預覽＋兩段 1080p60 檢查片段

## 插畫層（v5）

全片 23 個歌詞節點各有一張插畫，由 **Nano Banana（Gemini 影像）**以你提供的角色原圖（`/sdcard/Pictures/bili/1792820813806.jpeg`，2560×3600）為參考生成，走 `free-image-gen` 的 `webbanana` 引擎、經鏈式代理 :2333 出口（Gemini 按地區放行，出口非 US 會被拒）。生成腳本 `tools/banana_batch2.py`（自帶「出口必須是美國」守衛）。

插畫不是直接鋪滿：每張被當成**一張印張**貼在版面上——模糊壓暗的同圖作底、清晰豎版居中、四角裁切線、旁邊留白寫關鍵詞。渲染器不依賴任何 JPEG 解碼器：`tools/prep_art.mjs` 用 ffmpeg 把插畫轉成 raw RGB，`src/core/photo.js` 直接讀像素並自建快取（底版、印張、調色 LUT 都只算一次）。

## 素材

- **剪影**：8 張（`f_bust` `f_profile` `f_reach` `f_eye` `boy_bust` `man_bust` `cat_bust` `cat_paws`）由 `src/core/figures.js` 以向量路徑定義，三墨分版（藍／白／近黑）在繪製時映射，放大到 4K 仍走路徑。
- **音軌**：`audio/track.wav` 為程式合成的占位音軌（130 BPM，Am–F–C–G，人聲為共振峰合成的哼唱）。原始歌曲與歌詞未隨專案提供；換上正式音軌時只需替換 `audio/track.wav`，時間軸（`cues.js`）不變。
- **字體**：全部使用系統 OFL 字體 — Noto Serif（AI 的襯線）、Roboto（介面）、Cutive Mono／Droid Sans Mono（系統與程式碼）、Droid Sans Chinese（中文警告行）。詳見 `CREDITS.md`。

## 檢查數字

- **閃光（全片）**：`out/preview_360p30.mp4` 逐秒往返 **最差 2.0 次**（歌曲 180.00 秒），FAIL 0 秒 / WARN 0 秒 → PASS
- **閃光（導歌二）**：`out/fix_pre2.mp4` 最差 1.0 次（歌曲 92 秒附近）→ PASS
- **同步**：74 條 cue，FAIL 0 / WARN 6 / ok 68（WARN 全為 ±60–75 ms 的 `init` 項）
- **分鏡**：70 個鏡頭，0 個後備鏡頭
- **歌詞**：官方 85 行（行時間取 LRC 行首），關鍵詞落點用實測值

## 已知限制

- 字形光柵化不含 kern、合字、hinting；CJK 逐字排版
- `f_eye`／`f_reach` 的特寫由向量重繪，邊緣品質以 4K 單幀檢查
- 片頭警告頁的中文使用 Noto Sans CJK 的繁體字面（Droid Sans Chinese）

## 聲明

非官方同人作品，與 Anthropic、Mili 無關。
