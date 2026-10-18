# 坐一次会飞的车去跳岛（科普动画）

给普通人看的 3 分钟手绘风动画，讲贴水飞行汽车一次完整的跳岛流程（12 步）。
画面全部由 JS + Canvas 实时绘制，带配音、字幕、背景音乐和音效。

- `flying-car.mp4`：导出好的成片（1280×720，30fps，约 3 分钟）
- `index.html`：网页版播放器（可拖动进度、开关字幕，空格暂停，←/→ 快退快进）

## 本地播放网页版

```sh
cd video && python3 -m http.server 8765
# 浏览器打开 http://127.0.0.1:8765/
```

## 文件结构

| 文件 | 作用 |
| --- | --- |
| `script.json` | 文案：每个场景的台词和音效点位，改词从这里改 |
| `build_audio.py` | 离线 TTS 配音 + 合成背景音乐/音效 + 混音，生成 `assets/soundtrack.mp3`、`timeline.js`、`assets/subtitles.srt` |
| `timeline.js` | 每句台词的起止时间（自动生成），画面和字幕都按它对齐 |
| `js/draw.js` | 手绘风绘图工具（抖动线条、卡片、箭头、文字） |
| `js/world.js` | 天空、大海、小岛、人物、飞行汽车（侧视 / 正视） |
| `js/scenes.js` | 16 个场景的动画 |
| `js/player.js` | 播放器，以及导出视频用的逐帧渲染模式（`?render`） |
| `tools/render.cjs` | 用 Playwright 逐帧截取 Canvas，ffmpeg 合成 MP4 |
| `tools/snap.cjs` | 截取指定时间点的画面，检查用 |

## 改文案后重新生成

```sh
pip install sherpa-onnx soundfile numpy
# 中文 TTS 模型 (MeloTTS)
curl -LO https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-melo-tts-zh_en.tar.bz2
tar xjf vits-melo-tts-zh_en.tar.bz2

python3 build_audio.py vits-melo-tts-zh_en        # 配音、音乐、时间轴
python3 -m http.server 8765 &                      # 渲染需要本地服务
NODE_PATH=$(npm root -g) node tools/render.cjs flying-car.mp4 30
```

字体：站酷快乐体（ZCOOL KuaiLe），SIL Open Font License，见 `assets/OFL.txt`。
