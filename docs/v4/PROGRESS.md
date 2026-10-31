# PROGRESS — v4

## 0. 起点（与原始提示词的差异）

这个仓库没有第三版可继承：没有 `backup/v3/`、没有 `docs/v3/`、没有 `maps/*.json`、没有 `圖片/` 剪影、没有 `音頻&歌詞/` 音轨。因此本轮是**从零建立**整条管线，`PROMPT_v4.md` 与 `PROMPT_v4_fix.md` 全部按设计直接实现，没有"在旧片上改"这一步。

| 原本依赖 | 本仓库的处理 |
| --- | --- |
| 13 张三色剪影 PNG | `src/core/figures.js` 以向量路径重画 8 张（f_bust / f_profile / f_reach / f_eye / boy_bust / man_bust / cat_bust / cat_paws），三墨在绘制时分版 |
| 原曲 wav | `tools/make_audio.mjs` 合成 212 秒占位音轨（130 BPM、Am–F–C–G、人声为共振峰哼唱） |
| 原作歌词 | `docs/v4/lyrics.json` 为原创占位歌词，关键词与行时间对齐画面 |
| 第三版基准缩图 | 不存在，改为按段落抽样渲染 + 网格亮度检查 |
| Windows + Chrome + playwright | Termux + 纯 Node 软件光栅器 + 系统 ffmpeg |

## 1. 已完成

- **引擎**：确定性软件光栅器（抗锯齿路径、模糊、合成、撕裂、RGB 分离、PNG）、零依赖 TrueType 解析与字形光栅化（ASCII 95/95、CJK 19/19）、三墨剪影 sprite 缓存、字符球/字符迸发/滚动字符流、纸底（缓存底版 + 平铺噪点）、泛光、日芒、光条、推进模糊、花屏、降帧。
- **片头**：−5–0 秒闪光警告页，灰阶、等宽、逐行出现、倒数、−0.4 秒淡出。
- **A–I 全部段落**：boot / title / pre1（含 Vision 快切、A.D→B.C. 时间旅行带）/ chorus1（四张版画）/ verse2（茄子、番茄专色，猫，唯一的神）/ pre2（导歌二）/ chorus2 / alone（FRAGMENTS、DISHEARTENED）/ error / execution（十二声）/ count / chorusx（最后副歌）/ outro（LOVE 四句与最后一帧）/ shutdown。
- **工具**：`storyboard.mjs`（69 镜头、0 后备）、`check.mjs`、`check_flash.py`、`check_sync.py`、`compare_sheets.py`、`preview.mjs`／`inspect.mjs`（字符画与网格亮度，用于无图像输入环境下的自检）、`scan.mjs`。
- **导出**：`export/export.mjs` 直通 ffmpeg；`out/fix_pre2.mp4`（88–101 秒，1080p60）、`out/fix_climax.mp4`（146–197 秒，1080p60）、`out/preview_360p30.mp4`（全片）。

## 2. 这一轮（fix）的三件事

1. **导歌二踩点改跟人声**：`cues.js` 四处改为 90.80（F）、91.72（M）、98.19（S）、99.10（M），标 `analysis`；性别镜头 90.80 切入、D1 按住第二格、91.72 松开并匹配剪辑成 `boy_bust`、D2 震一下；角色镜头 97.97 推、98.19 第一字母、98.6–99.0 拉回、99.10 第二字母、99.35 塌到底（下垂终点，不是主事件）。
2. **最后副歌人物镜头重做**：剪影静止、不推近；全部运动 60 帧连续，这一段不再用 `dropFrames`；层次 = 纸底 + 旋转日芒 + 字符球与线框（她被困的 world）+ 剪影底板（底鼓弹开再滑回）+ 剪影内部滚动屏幕 + 前景字符迸发 + 歌词逐词横滑 + 每底鼓一次花屏（撕裂 + RGB 分离，图案保持 ≥6 帧）+ 镜头 ≤3% 漂移。
3. **光更强**：人物镜头基准亮度抬高；关键词重拍一次会回落的闪光（0.5–0.6 量级）；177.57 全画面白场；LOVE 四句光效加强一档；最后一帧亮度推到全片最高（mean 0.47，高于其他所有画面）。

## 3. 没有照本文做的地方

- **渲染规格**：全片没有导出 1080p60 母版。2 核手机上 1080p60 每帧 0.2–0.5 秒，全片约 5–7 小时；本轮交付 360p30 全片预览 + 两段 1080p60 检查片段。4K 未导出（等预览确认）。
- **剪影与音轨**：见第 0 节，均为代码生成的替代物；接口（名称、配准表、三墨角色）与本文一致，替换真素材时只需改 `figures.js` 的路径来源或 `audio/track.wav`。
- **歌词**：原创占位，不是原作歌词；`text(i)` 接口保留。
- **简化**：部分次要镜头（如 pre1 的对话镜头、chorus2 的线程）用较简的构图；`f_eye` 特写的边缘未做 4K 逐像素检查（无图像输入）。这些写在这里，不假装做到。
- **DESHEARTENED 的选区**：按要求用下标取第 4–8 个字母，字母不写进代码。

## 4. 待人工确认（最需要耳朵的十处）

按 `check_sync.py` 的偏差排序（占位音轨为人声合成，偏差含音轨本身的音节网格误差）：

| 名称 | 歌曲时间 | 偏差 | 来源 |
| --- | --- | --- | --- |
| verse2.existence | 87.92 | -75 ms | init |
| love.2.a | 183.65 | -72 ms | init |
| love.3.a | 187.67 | +63 ms | init |
| love.2.b | 183.88 | -63 ms | init |
| love.3.c | 188.13 | -52 ms | init |
| love.3.b | 187.90 | -47 ms | init |
| love.2.c | 184.11 | +47 ms | init |
| outro.love1 | 197.65 | -44 ms | init |
| love.1.c | 180.39 | -40 ms | init |
| love.1.b | 180.16 | -39 ms | init |

`pre2.gender.letter1`（90.80）在占位音轨上偏 −76 ms，是合成人声的音节落点与本文实测值的差，不是画面问题；换正式音轨后需重新比对。

## 5. 未做

- 4K 导出与 4K 边缘检查（等预览确认）
- 60 秒以上的 1080p60 全片


## 6. 第二輪：換真人歌詞與「印刷校樣」母題

- `docs/v4/lyrics.json` 換成官方 85 行（LRC 行首時間）。核對過 PROMPT 的關鍵詞落點與行首的差值都是整拍：`To F, to M` 90.34 → F 90.80（一拍）→ M 91.72（三拍）；`To S, to M` 97.72 → 98.19 → 99.10 同樣吻合。所以時間軸不動，只換詞。
- 新增 `docs/v4/CONCEPT.md`：整片改成「一次印刷打樣」——校色條、印張號、套準十字、`PROOF` 章；十二張印張越印越不準，最後一幀去掉全部校樣標記。
- `art.js` 新增 `proofMarks()`，`ground()` 接受 `proof:{sheet}`；副歌一、主歌二、導歌二、最後副歌、LOVE 前三鏡啟用，最後一幀不啟用。
- 數數段六張卡改成六種印刷缺陷（套印偏移、飛墨、網點過重、背面透印、撕邊、墨流）。
- 已重導 `fix_pre2` 與 `fix_climax`（含校樣標記）。


## 7. 第三輪：AI 插畫層與 CI 渲染

- 生圖：23 張歌詞插畫，Nano Banana（webbanana 反代）+ 你的角色原圖為參考；`tools/banana_batch2.py` 會在每次生成前確認代理出口是美國（Gemini 對非支援地區直接 LOCATION_REJECTED）。
- 接入：`src/core/photo.js`（raw 直讀、底版/印張/LUT 快取）＋ `tools/prep_art.mjs`（ffmpeg 預處理）；每個版畫場景改用 `base(surf, ctx, t, '<plate>', ...)`，有插畫就用插畫、沒有就回退紙底，CI 與本地同一套行為。人物剪影在有插畫時自動跳過（`figOrSkip`）。
- 性能：LUT 調色、像素直寫網點、1/4 尺寸模糊、`fillPath` 預設 2 子採樣；1080p 每幀從 7s 降到 1.3–2.5s（手機）。
- CI：`.github/workflows/render.yml` 改成 8 片矩陣（每片約 814 幀），單片在 runner 上 106–180ms/幀，全片約 5 分鐘（手機要 4 小時以上）；merge job 合併、加音軌、跑閃光檢查、上傳 artifact。倉庫：https://github.com/2719126468-ship-it/world-execute-me-mv
- 交付：`wem_v5_illustrated_1080p30.mp4`（插畫版全片）與 `wem_v4_ci_1080p30.mp4`（純代碼版全片）已複製到 `/sdcard/DCIM/Camera/`，23 張插畫原圖在 `/sdcard/DCIM/Camera/wem_art/`。
