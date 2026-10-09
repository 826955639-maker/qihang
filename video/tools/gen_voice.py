#!/usr/bin/env python3
"""配音生成 + "耳朵"自检。

1. 读取 js/script.js 里的台词，用离线语音合成模型（sherpa-onnx + Kokoro 中文）逐句生成配音；
2. 用语音识别模型（Paraformer）把每句配音听写回文字，和原稿逐字比对；
3. 把每句时长写进 js/timing.js，画面和音乐都按这个时间表对齐。

用法：python3 tools/gen_voice.py --models <模型目录>
模型目录里需要 kokoro-multi-lang-v1_1/ 和 sherpa-onnx-paraformer-zh-small-2024-03-09/
"""
import argparse, difflib, json, os, re, subprocess, sys

import numpy as np
import sherpa_onnx
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100


def load_js_json(path):
    src = open(path, encoding="utf-8").read()
    body = src[src.index("{"):src.rindex("}") + 1]
    return json.loads(body)


def make_tts(d):
    k = os.path.join(d, "kokoro-multi-lang-v1_1") + "/"
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=k + "model.onnx", voices=k + "voices.bin", tokens=k + "tokens.txt",
                data_dir=k + "espeak-ng-data", dict_dir=k + "dict",
                lexicon=k + "lexicon-us-en.txt," + k + "lexicon-zh.txt"),
            num_threads=4),
        rule_fsts=k + "date-zh.fst," + k + "phone-zh.fst," + k + "number-zh.fst")
    return sherpa_onnx.OfflineTts(cfg)


def make_asr(d):
    p = os.path.join(d, "sherpa-onnx-paraformer-zh-small-2024-03-09") + "/"
    return sherpa_onnx.OfflineRecognizer.from_paraformer(
        paraformer=p + "model.int8.onnx", tokens=p + "tokens.txt", num_threads=4)


def norm(s):
    # 只比对汉字和字母数字；英文统一小写
    return re.sub(r"[^一-鿿A-Za-z0-9]", "", s).lower()


def trim(x, sr, thr=0.01):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(0.03 * sr))
    b = min(len(x), idx[-1] + int(0.08 * sr))
    return x[a:b]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True)
    args = ap.parse_args()

    script = load_js_json(os.path.join(ROOT, "js", "script.js"))
    v = script["voice"]
    tts, asr = make_tts(args.models), make_asr(args.models)
    out_dir = os.path.join(ROOT, "audio", "lines")
    os.makedirs(out_dir, exist_ok=True)

    timing, t, report = {"scenes": []}, 0.0, []
    for sc in script["scenes"]:
        scene = {"id": sc["id"], "start": round(t, 3), "lines": []}
        lt = v["lead"]
        for i, line in enumerate(sc["lines"]):
            text = line.get("say", line["text"])
            audio = tts.generate(text, sid=v["sid"], speed=v["speed"])
            x = trim(np.asarray(audio.samples, dtype=np.float32), audio.sample_rate)
            raw = os.path.join(out_dir, "_tmp.wav")
            sf.write(raw, x, audio.sample_rate)
            name = f"{sc['id']}_{i}.wav"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-ar", str(SR),
                            "-ac", "1", os.path.join(out_dir, name)], check=True)
            os.remove(raw)
            dur = len(x) / audio.sample_rate

            # 用"耳朵"听一遍
            st = asr.create_stream()
            st.accept_waveform(audio.sample_rate, x)
            asr.decode_stream(st)
            heard = st.result.text
            ratio = difflib.SequenceMatcher(None, norm(line["text"]), norm(heard)).ratio()
            report.append((name, ratio, line["text"], heard))

            scene["lines"].append({"t": round(lt, 3), "d": round(dur, 3), "file": name})
            lt += dur + v["gap"]
        scene["dur"] = round(lt - v["gap"] + sc.get("tail", v["tail"]), 3)
        t += scene["dur"]
        timing["scenes"].append(scene)
    timing["total"] = round(t, 3)
    timing["asr"] = {"lines": len(report), "mean": round(sum(r for _, r, _, _ in report) / len(report), 3)}

    with open(os.path.join(ROOT, "js", "timing.js"), "w", encoding="utf-8") as f:
        f.write("// 自动生成：tools/gen_voice.py。每句配音在每一幕里的开始时间(t)和时长(d)，单位秒。\n")
        f.write("window.TIMING = " + json.dumps(timing, ensure_ascii=False, indent=1) + ";\n")

    print(f"总时长 {t:.1f} 秒\n")
    for name, r, a, b in report:
        flag = "OK " if r >= 0.85 else "!! "
        print(f"{flag}{r:.2f} {name}\n    原稿: {a}\n    听到: {b}")


if __name__ == "__main__":
    sys.exit(main())
