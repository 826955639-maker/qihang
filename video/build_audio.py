"""生成配音、背景音乐、音效，混成一条音轨，并输出字幕时间轴。

用法: python3 build_audio.py <melo-tts 模型目录>
模型: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-melo-tts-zh_en.tar.bz2
"""
import json, os, sys, subprocess, hashlib
import numpy as np
import soundfile as sf

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get("TTS_CACHE", os.path.join(HERE, ".tts_cache"))

LEAD = 0.8          # 片头空白
LINE_GAP = 0.32     # 同一场景内两句之间
SCENE_PAD = 0.55    # 场景末尾留白
TAIL = 4.0          # 片尾留白


def load_tts(model_dir):
    import sherpa_onnx
    d = model_dir.rstrip("/") + "/"
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=d + "model.onnx", lexicon=d + "lexicon.txt",
                tokens=d + "tokens.txt", dict_dir=d + "dict"),
            num_threads=4),
        rule_fsts=f"{d}date.fst,{d}phone.fst,{d}number.fst")
    return sherpa_onnx.OfflineTts(cfg)


def speak(tts, text):
    os.makedirs(CACHE, exist_ok=True)
    text = text.replace("“", "").replace("”", "").replace("：", "，").replace("；", "，")
    key = hashlib.md5(text.encode()).hexdigest()[:12]
    path = os.path.join(CACHE, key + ".wav")
    if not os.path.exists(path):
        a = tts.generate(text, sid=0, speed=1.02)
        x = np.asarray(a.samples, dtype=np.float32)
        if a.sample_rate != SR:
            n = int(len(x) * SR / a.sample_rate)
            x = np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)
        sf.write(path, x, SR)
    x, _ = sf.read(path, dtype="float32")
    # 去掉首尾静音
    idx = np.where(np.abs(x) > 0.01)[0]
    if len(idx):
        x = x[max(0, idx[0] - 600): idx[-1] + 2000]
    return x


# ---------------- 音效 ----------------
rng = np.random.default_rng(7)


def env(n, a=0.005, r=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / r)


def lowpass(x, k):
    # 简单一阶低通, k 越小越闷
    y = np.empty_like(x); s = 0.0
    for i, v in enumerate(x):
        s += k * (v - s); y[i] = s
    return y


def sfx(name):
    if name == "pop":
        n = int(0.16 * SR); t = np.arange(n) / SR
        f = 500 + 900 * np.exp(-t * 30)
        return 0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.04)
    if name == "ding":
        n = int(1.0 * SR); t = np.arange(n) / SR
        x = np.sin(2 * np.pi * 1318 * t) + 0.4 * np.sin(2 * np.pi * 2636 * t) + 0.3 * np.sin(2 * np.pi * 1975 * t)
        return 0.28 * x * env(n, 0.002, 0.25)
    if name == "click":
        n = int(0.06 * SR); t = np.arange(n) / SR
        x = rng.uniform(-1, 1, n) * np.exp(-t * 120) + np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 80)
        return 0.6 * x
    if name == "boing":
        n = int(0.5 * SR); t = np.arange(n) / SR
        f = 220 + 140 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 5)
        return 0.4 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.005, 0.18)
    if name == "whoosh":
        n = int(1.1 * SR); t = np.arange(n) / SR
        noise = rng.uniform(-1, 1, n).astype(np.float32)
        y = lowpass(noise, 0.08) - lowpass(noise, 0.01)
        shape = np.sin(np.pi * t / t[-1]) ** 2
        return 0.9 * y * shape
    if name == "splash":
        n = int(1.2 * SR); t = np.arange(n) / SR
        noise = rng.uniform(-1, 1, n).astype(np.float32)
        y = lowpass(noise, 0.25) * env(n, 0.01, 0.3)
        bubbles = sum(np.sin(2 * np.pi * (600 + 500 * k) * t) * np.exp(-((t - 0.1 * k - 0.15) ** 2) / 0.0006)
                      for k in range(5))
        return 0.55 * y + 0.12 * bubbles
    if name == "sparkle":
        n = int(1.4 * SR); out = np.zeros(n, np.float32)
        for k, f in enumerate([1568, 1976, 2349, 2637, 3136]):
            s = int(k * 0.09 * SR); m = n - s; tt = np.arange(m) / SR
            out[s:] += 0.16 * np.sin(2 * np.pi * f * tt) * env(m, 0.002, 0.2)
        return out
    raise ValueError(name)


# ---------------- 背景音乐 ----------------
def bgm(total):
    bpm = 104; beat = 60 / bpm
    n = int(total * SR); out = np.zeros(n, np.float32)
    notes = {"C": 261.63, "D": 293.66, "E": 329.63, "F": 349.23, "G": 392.0, "A": 440.0, "B": 493.88}

    def hz(name, octv=0):
        return notes[name] * (2 ** octv)

    def pluck(f, start, dur, vol, bright=1.0):
        s = int(start * SR)
        if s >= n: return
        m = min(int(dur * SR), n - s); t = np.arange(m) / SR
        x = (np.sin(2 * np.pi * f * t) + 0.35 * bright * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 6)
             + 0.15 * bright * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 14))
        out[s:s + m] += vol * x * env(m, 0.004, dur * 0.35)

    chords = [("C", ["C", "E", "G"]), ("G", ["G", "B", "D"]), ("A", ["A", "C", "E"]), ("F", ["F", "A", "C"])]
    # 两小节一个乐句的小旋律 (音名, 八度, 拍位置, 时值)
    phrases = [
        [("E", 1, 0, 1), ("G", 1, 1, 0.5), ("A", 1, 1.5, 0.5), ("G", 1, 2, 1), ("E", 1, 3, 1)],
        [("D", 1, 0, 1), ("G", 0, 1, 1), ("B", 0, 2, 0.5), ("D", 1, 2.5, 1.5)],
        [("C", 1, 0, 1), ("E", 1, 1, 0.5), ("A", 1, 1.5, 1.5), ("G", 1, 3, 1)],
        [("A", 0, 0, 1), ("C", 1, 1, 1), ("D", 1, 2, 0.5), ("C", 1, 2.5, 1.5)],
    ]
    bar = 4 * beat; i = 0; t0 = 0.0
    while t0 < total:
        root, tri = chords[i % 4]
        # 低音
        pluck(hz(root, -2), t0, beat * 1.8, 0.22, 0.4)
        pluck(hz(tri[2], -2) if tri[2] != "C" else hz("C", -1), t0 + 2 * beat, beat * 1.8, 0.16, 0.4)
        # 尤克里里扫弦 (反拍)
        for b in [0, 1.5, 2, 3, 3.5]:
            for k, nn in enumerate(tri):
                pluck(hz(nn, 0), t0 + b * beat + k * 0.012, beat * 0.9, 0.05, 0.9)
        # 旋律 (第 3 小节以后进入, 每 8 小节休息 2 小节)
        if i >= 2 and (i % 8) < 6:
            for (nn, o, pos, d) in phrases[i % 4]:
                pluck(hz(nn, o), t0 + pos * beat, d * beat * 1.4, 0.075, 1.2)
        # 沙锤
        for b in range(8):
            s = int((t0 + b * beat / 2) * SR); m = int(0.05 * SR)
            if s + m < n:
                out[s:s + m] += (0.03 if b % 2 else 0.018) * rng.uniform(-1, 1, m) * env(m, 0.003, 0.015)
        t0 += bar; i += 1
    fade = int(2.5 * SR)
    out[:int(1.0 * SR)] *= np.linspace(0, 1, int(1.0 * SR))
    out[-fade:] *= np.linspace(1, 0, fade)
    return out


def main():
    model_dir = sys.argv[1]
    script = json.load(open(os.path.join(HERE, "script.json"), encoding="utf-8"))
    tts = load_tts(model_dir)

    clips = []; scenes = []; t = LEAD
    for sc in script["scenes"]:
        start = t if scenes else 0.0
        lines = []
        t += 0.25
        for text in sc["lines"]:
            x = speak(tts, text)
            lines.append({"text": text, "start": round(t, 3), "end": round(t + len(x) / SR, 3)})
            clips.append((t, x)); t += len(x) / SR + LINE_GAP
        t += SCENE_PAD - LINE_GAP
        sfx_list = [[name, round(lines[li]["start"] + off, 3)] for name, li, off in sc.get("sfx", [])]
        scenes.append({k: v for k, v in sc.items() if k not in ("lines", "sfx")} |
                      {"start": round(start, 3), "lines": lines, "sfx": sfx_list})
    total = t + TAIL
    for i, sc in enumerate(scenes):
        sc["end"] = scenes[i + 1]["start"] if i + 1 < len(scenes) else round(total, 3)

    n = int(total * SR)
    voice = np.zeros(n, np.float32)
    for st, x in clips:
        s = int(st * SR); voice[s:s + len(x)] += x
    voice *= 0.9 / (np.abs(voice).max() + 1e-6)

    fx = np.zeros(n, np.float32)
    for sc in scenes:
        for name, at in sc["sfx"]:
            x = sfx(name).astype(np.float32); s = int(at * SR); m = min(len(x), n - s)
            fx[s:s + m] += x[:m]

    music = bgm(total)
    # 说话时把音乐压低 (ducking)
    talk = np.convolve((np.abs(voice) > 0.02).astype(np.float32), np.ones(int(0.25 * SR)) / int(0.25 * SR), "same")
    talk = np.clip(talk * 4, 0, 1)
    gain = 0.55 - 0.3 * talk
    mix = voice + 0.32 * fx + music * gain
    mix /= max(1.0, np.abs(mix).max() / 0.97)

    wav = os.path.join(CACHE, "soundtrack.wav")
    sf.write(wav, mix, SR)
    os.makedirs(os.path.join(HERE, "assets"), exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-b:a", "160k",
                    os.path.join(HERE, "assets", "soundtrack.mp3")], check=True)

    tl = {"title": script["title"], "duration": round(total, 3), "scenes": scenes}
    with open(os.path.join(HERE, "timeline.js"), "w", encoding="utf-8") as f:
        f.write("// 由 build_audio.py 生成，请勿手改\nwindow.TIMELINE = ")
        json.dump(tl, f, ensure_ascii=False, indent=1)
        f.write(";\n")
    # 同时导出 SRT 字幕
    def ts(s):
        ms = int(round(s * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); sec, ms = divmod(ms, 1000)
        return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"
    k = 1
    with open(os.path.join(HERE, "assets", "subtitles.srt"), "w", encoding="utf-8") as f:
        for sc in scenes:
            for ln in sc["lines"]:
                f.write(f"{k}\n{ts(ln['start'])} --> {ts(ln['end'])}\n{ln['text']}\n\n"); k += 1
    print(f"total {total:.1f}s, {k - 1} lines")


if __name__ == "__main__":
    main()
