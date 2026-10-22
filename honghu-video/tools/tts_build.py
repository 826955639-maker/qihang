"""Synthesize narration + student voices with Kokoro v1.1-zh (sherpa-onnx), verify with SenseVoice ASR.

usage: python3 tts_build.py OUT_DIR [--narrator SID] [--speed S] [--voices SID,SID,SID] [--only n01,n02]
Writes OUT_DIR/{id}.wav (48 kHz mono) and OUT_DIR/manifest.json with exact per-chunk timings.
"""
import argparse, json, os, re
import numpy as np, soundfile as sf, librosa, sherpa_onnx

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODELS = os.environ.get('MODELS', os.path.join(os.path.dirname(ROOT), '_work', 'models'))
SR = 48000

ap = argparse.ArgumentParser()
ap.add_argument('out')
ap.add_argument('--narrator', type=int, default=61)
ap.add_argument('--speed', type=float, default=0.92)
ap.add_argument('--voices', default='99,6,9')
ap.add_argument('--only', default='')
args = ap.parse_args()
os.makedirs(args.out, exist_ok=True)

M = os.path.join(MODELS, 'kokoro-patched') + '/'
tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(
    model=sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
        model=M + 'model.onnx', voices=M + 'voices.bin', tokens=M + 'tokens.txt',
        data_dir=M + 'espeak-ng-data', dict_dir=M + 'dict',
        lexicon=M + 'lexicon-us-en.txt,' + M + 'lexicon-zh.txt'), num_threads=4),
    rule_fsts=M + 'phone-zh.fst,' + M + 'date-zh.fst,' + M + 'number-zh.fst', max_num_sentences=1))
A = os.path.join(MODELS, 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17') + '/'
asr = sherpa_onnx.OfflineRecognizer.from_sense_voice(model=A + 'model.int8.onnx', tokens=A + 'tokens.txt',
                                                     language='zh', use_itn=False, num_threads=4)


def synth(text, sid, speed):
    a = tts.generate(text, sid=sid, speed=speed)
    y = librosa.resample(np.asarray(a.samples, dtype=np.float32), orig_sr=a.sample_rate, target_sr=SR)
    # trim leading/trailing silence, keep a short natural tail
    idx = np.nonzero(np.abs(y) > 10 ** (-42 / 20))[0]
    if len(idx):
        y = y[max(0, idx[0] - int(0.02 * SR)): min(len(y), idx[-1] + int(0.08 * SR))]
    return y


def recognize(y):
    s = asr.create_stream(); s.accept_waveform(SR, y); asr.decode_stream(s)
    return s.result.text


DIG = '零一二三四五六七八九'


def spoken(t):
    t = re.sub(r'(\d{4})年', lambda m: ''.join(DIG[int(c)] for c in m.group(1)) + '年', t)
    t = t.replace('10月', '十月')
    return t


def norm(t):
    # compare toneless pinyin so homophones (于都/余都) are not counted as errors
    from pypinyin import lazy_pinyin
    t = re.sub(r'[^\w]', '', spoken(t))
    return [x for x in lazy_pinyin(t) if x.strip()]


def cer(ref, hyp):
    r, h = norm(ref), norm(hyp)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
    return d[len(h)] / max(1, len(r))


script = json.load(open(os.path.join(ROOT, 'script', 'narration.json'), encoding='utf8'))
only = set(filter(None, args.only.split(',')))
man_path = os.path.join(args.out, 'manifest.json')
manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}
vsids = [int(x) for x in args.voices.split(',')]
jobs = [(n['id'], n['chunks'], args.narrator, args.speed) for n in script['narration']]
jobs += [(v['id'], [{'text': v['text'], 'say': v.get('say')}], vsids[i], 0.95) for i, v in enumerate(script['voices'])]
total_err = 0
for nid, chunks, sid, speed in jobs:
    if only and nid not in only: continue
    parts, timing, t = [], [], 0.0
    for c in chunks:
        say = c.get('say') or c['text']
        y = synth(say, sid, speed)
        hyp = recognize(y)
        e = cer(say, hyp); total_err += e
        flag = '' if e < 0.08 else '   <-- CHECK'
        print(f'{nid} sid={sid} {len(y)/SR:5.2f}s cer={e:.2f} | {say} | {hyp}{flag}', flush=True)
        timing.append({'text': c['text'], 'start': round(t, 3), 'end': round(t + len(y) / SR, 3)})
        parts.append(y); t += len(y) / SR
        g = c.get('gap', 0)
        if g: parts.append(np.zeros(int(g * SR), np.float32)); t += g
    y = np.concatenate(parts)
    sf.write(os.path.join(args.out, nid + '.wav'), y, SR, subtype='PCM_16')
    manifest[nid] = {'sid': sid, 'duration': round(len(y) / SR, 3), 'chunks': timing}
json.dump(manifest, open(man_path, 'w'), ensure_ascii=False, indent=1)
print('total cer', round(total_err, 3))
