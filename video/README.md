# 一个只会打字的 AI，怎么做出视频？

一支 4 分钟的手绘风教学动画，给普通人讲 Claude Opus 5.5 是怎么"做"出一个视频的。
它本身就是用片中讲的办法做出来的：画面、动画、配音、背景音乐和检查，全部是写出来的代码。

- **直接看**：用浏览器打开 `index.html`（点播放，记得开声音），或者看导出的 `out/xiaoke.mp4`
- **彩蛋**：右下角的「透视」开关（或按 X）会露出每一笔背后的控制点和"源代码"；看完写上名字，可以领一张毕业证书

## 片子讲了什么

| 幕 | 内容 |
|---|---|
| 开场 | 作者没有手、没有眼睛、没有耳朵，只会打字 |
| 翻页书 | 视频 = 很多张图快速翻页（这个视频要画 7000 多张） |
| 画布 | 用 Canvas 指令一句一句画出一幅画 |
| 手绘感 | 故意让每一笔抖一点；每秒换 8 次抖法 = 线条沸腾 |
| 缓动 | 匀速像机器人；先加速再减速，加上压扁和拉长 |
| 配音 | 语音合成读台词，再用语音识别"听写"回来逐字比对 |
| 音乐 | 440 次/秒 = 啦；和弦 + 节奏，由程序一个音一个音弹出来 |
| 检查 | 给自己的画面拍照，找问题、改、再拍 |
| 收获 | 跟 AI 说话的公式：**对象 + 风格 + 目标** |

## 文件

| 路径 | 作用 |
|---|---|
| `js/script.js` | 剧本：台词、给配音的读法、音效提示 |
| `js/engine.js` | 手绘引擎：抖动笔画、线条沸腾、逐字手写、透视模式 |
| `js/characters.js` | 小克和各种手绘图标 |
| `js/scenes.js` | 12 幕分镜，靠 `S.at(句, "某个词")` 和配音对齐 |
| `js/music.js` | 背景音乐的乐谱（C–Am–F–G，96 BPM） |
| `js/player.js` | 播放器：以音轨为时钟，字幕、转场、控制条、证书 |
| `tools/gen_voice.py` | 离线语音合成（Kokoro）+ 语音识别自检（Paraformer），生成 `js/timing.js` |
| `tools/mix.mjs` | 纯 JS 合成音乐和音效（Karplus-Strong 拨弦、铃声、混响），自动闪避人声，混出音轨 |
| `tools/render.mjs` | 用无头浏览器逐帧截图，ffmpeg 合成 MP4 |

## 重新生成

```bash
pip install sherpa-onnx soundfile numpy
# 模型来自 github.com/k2-fsa/sherpa-onnx/releases：
#   tts-models/kokoro-multi-lang-v1_1.tar.bz2
#   asr-models/sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2
python3 tools/gen_voice.py --models <模型目录>   # 配音 + 听写比对 → js/timing.js
node tools/mix.mjs                              # 音乐 + 音效 + 混音 → audio/soundtrack.mp3
npm i playwright && node tools/render.mjs       # 可选：导出 out/xiaoke.mp4
```

字体：站酷快乐体（ZCOOL KuaiLe，SIL Open Font License）。
