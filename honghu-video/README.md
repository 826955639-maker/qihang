# 《鸿鹄远征》拼贴风动画短片

1920×1080 · 30fps · 5400 帧（3:00）· H.264 + AAC。成片：`out/honghu_yuanzheng.mp4`

制作规范见 `CLAUDE.md`。按作者要求，渲染层改用 **JS + Canvas**（Node + `@napi-rs/canvas`/Skia，逐帧绘制后以原始 RGBA 管道送入 ffmpeg），
其余画面、节奏、配色、字体、时间线均按规范实现。

## 目录

```
script/narration.json   旁白 16 句 + 同学口述 3 句（字幕分条、读音修正 say 字段）
src/
  theme.js timeline.js  设计常量 / 分场帧表 / 旁白-字幕对齐（读取真实音频时长）
  lib/                  纸片系统：撕边、剪刀边、纸纹、硬投影、OnTwos、Jitter、DropIn、PeelOut、
                        RedLine（马克笔）、StampText、Tape、剪影小人、小鸿鹄贴纸
  scenes/s0..s7.js      八个场景（每个场景同时导出音效 cue）
  frame.js              单帧合成：翻页转场、历史滤镜、字幕、暗角、胶片颗粒、淡出
  render.js worker.js   多进程渲染 → out/video_nosound.mp4
  still.js sheet.js     静帧 / 联系表检查
tools/
  tts_build.py          Kokoro v1.1-zh（sherpa-onnx）合成旁白，SenseVoice 识别回检读音
  patch_lexicon.py      多音字与“一”变调修正（鸿鹄 hú、重来 chóng、撒 sǎ…）
  compose.py            原创配乐（MIDI，96 BPM，场景边界均落在小节线上）→ FluidSynth 渲染
  sfx.py                程序合成音效（纸张、盖章、打字、扇翅、流水、脚步、钟表、铅笔…）
  mix.py                混音：配乐音量曲线 + 人声闪避 70% + 音效 → -16 LUFS / -1 dBTP
assets/
  xiaohonghu/           小鸿鹄官方形象（front 正面 / back 背面，透明底，仅做等比缩放与旋转，不变形）
  fonts/                思源宋体 / 思源黑体 / 马善政（OFL）
  audio/                voice/（旁白+口述+manifest.json）、sfx/、music.wav
```

## 重新生成

```bash
npm install
# 1) 配音（需 _work/models 下的 Kokoro 与 SenseVoice 模型，见 tools/tts_build.py）
python3 tools/patch_lexicon.py <kokoro-dir> <kokoro-patched-dir>
python3 tools/tts_build.py assets/audio/voice --narrator 62 --speed 0.9 --voices 76,9,3
# 2) 配乐与音效
python3 tools/compose.py score.mid
fluidsynth -ni -F assets/audio/music.wav -r 48000 -g 0.5 -o synth.reverb.room-size=0.75 \
  -o synth.reverb.level=0.6 /usr/share/sounds/sf3/MuseScore_General.sf3 score.mid
python3 tools/sfx.py assets/audio/sfx
# 3) 画面 + 混音 + 合成
node src/export_cues.js && python3 tools/mix.py out/cues.json assets/audio/music.wav out/mix.wav
node src/render.js            # → out/video_nosound.mp4
ffmpeg -i out/video_nosound.mp4 -i out/mix.wav -c:v copy -c:a aac -b:a 256k -shortest out/honghu_yuanzheng.mp4
```

## 署名与占位

- 口述卡片署名暂用“—— 一位工大学子”；真实口述原文与署名可在 `script/narration.json` / `src/scenes/common.js` 替换后重渲。
- 片尾署名按规范：作者：温可掬 · 工业设计24-1班。
- 全部图形由代码绘制；配乐、音效均为原创程序生成；配音为本地开源 TTS 生成，无第三方版权素材。
