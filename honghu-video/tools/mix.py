"""Final audio mix for 《鸿鹄远征》.

usage: python3 tools/mix.py out/cues.json assets/audio/music.wav out/mix.wav
- music: gentle leveling, then the §8 volume curve, ducked to 70% while any voice plays
- voices: high-pass, light compression, each clip normalised; placed on the exact frames from the timeline
- sfx: one-shots and looped beds from the cue list
- master: -16 LUFS integrated, true-peak ceiling -1 dBTP
"""
import json, os, sys
import numpy as np, soundfile as sf, librosa
from scipy import signal
import pyloudnorm as pyln

SR = 48000
cues_path, music_path, out_path = sys.argv[1:4]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUD = os.path.join(ROOT, 'assets', 'audio')
cues = json.load(open(cues_path))
FPS, TOTAL = cues['fps'], cues['total']
N = int(TOTAL / FPS * SR)
fr = lambda f: int(round(f / FPS * SR))


def load(path, mono=False):
    y, sr = sf.read(path, dtype='float32', always_2d=True)
    if sr != SR: y = librosa.resample(y.T, orig_sr=sr, target_sr=SR).T
    if mono: return y.mean(1)
    return y if y.shape[1] == 2 else np.repeat(y, 2, 1)


def envelope(points):
    """piecewise-linear gain curve from [(frame, gain), ...]"""
    t = np.arange(N) / SR * FPS
    fs, gs = zip(*points)
    return np.interp(t, fs, gs).astype(np.float32)


# ------------------------------------------------------------------ voices
voice_bus = np.zeros((N, 2), np.float32)
active = np.zeros(N, np.float32)
meter = pyln.Meter(SR)
sos_hp = signal.butter(2, 85, 'highpass', fs=SR, output='sos')
sos_pres = signal.butter(2, [2500, 6000], 'bandpass', fs=SR, output='sos')
for v in cues['voice']:
    y = load(os.path.join(AUD, v['file']), mono=True)
    y = signal.sosfilt(sos_hp, y)
    y = y + 0.18 * signal.sosfilt(sos_pres, y)                      # a touch of presence
    # gentle compression (2:1 above -24 dBFS, 10 ms / 120 ms)
    env = np.abs(y); a, r = np.exp(-1 / (0.01 * SR)), np.exp(-1 / (0.12 * SR))
    e = np.zeros_like(env); acc = 0.0
    for i in range(len(env)):
        c = env[i]; acc = a * acc + (1 - a) * c if c > acc else r * acc + (1 - r) * c; e[i] = acc
    thr = 10 ** (-24 / 20)
    g = np.where(e > thr, (thr / np.maximum(e, 1e-9)) ** 0.5, 1.0)
    y = y * g
    loud = meter.integrated_loudness(np.pad(y, (0, max(0, SR // 2 - len(y)))))
    gain = 10 ** ((-19 - loud) / 20) if np.isfinite(loud) else 1.0
    if v['id'].startswith('v'): gain *= 1.05
    y = y * gain
    s = fr(v['f']); e_ = min(N, s + len(y))
    voice_bus[s:e_, 0] += y[:e_ - s]; voice_bus[s:e_, 1] += y[:e_ - s]
    active[s:min(N, s + len(y))] = 1

# ------------------------------------------------------------------ music
m = load(music_path)
m = m[:N] if len(m) >= N else np.pad(m, ((0, N - len(m)), (0, 0)))
# leveling: halve the dynamic range (in dB) measured over 3 s windows
win = SR * 3
rms = np.sqrt(np.convolve(m.mean(1) ** 2, np.ones(win) / win, mode='same') + 1e-10)
target = np.sqrt(np.mean(m ** 2))
lev = np.clip((target / rms) ** 0.5, 10 ** (-8 / 20), 10 ** (10 / 20)).astype(np.float32)
m *= lev[:, None]
m *= 10 ** ((-14 - meter.integrated_loudness(m)) / 20)          # treat the score like a mastered cue (-14 LUFS)
# §8 curve (with short ramps so changes never click)
curve = envelope([(0, 0.35), (440, 0.35), (470, 0.25), (2090, 0.25), (2120, 0.28), (4190, 0.28), (4220, 0.25),
                  (4850, 0.25), (4900, 0.6), (5100, 0.6), (5130, 0.45), (5340, 0.4), (5400, 0.0), (TOTAL + 10, 0)])
# ducking to 70% while a voice is speaking (attack 120 ms, release 400 ms)
duck = np.ones(N, np.float32)
k_att, k_rel = int(0.12 * SR), int(0.4 * SR)
sm = signal.lfilter([1 / k_att], [1, -(1 - 1 / k_att)], active)
sm2 = np.maximum(sm, signal.lfilter([1 / k_rel], [1, -(1 - 1 / k_rel)], active))
duck -= 0.3 * np.clip(sm2 * 1.5, 0, 1)
music_bus = m * (curve * duck)[:, None] * 1.25

# ------------------------------------------------------------------ sfx
sfx_bus = np.zeros((N, 2), np.float32)
cache = {}
for c in cues['sfx']:
    name = c['sfx']
    if name not in cache:
        p = os.path.join(AUD, 'sfx', name + '.wav')
        if not os.path.exists(p): print('skip missing sfx', name); cache[name] = None; continue
        cache[name] = load(p)
    y = cache[name]
    if y is None: continue
    if c.get('rate'): y = librosa.resample(y.T, orig_sr=SR * c['rate'], target_sr=SR).T
    s = fr(c['f'])
    if s >= N: continue
    if c.get('until'):
        L = fr(c['until']) - s
        reps = int(np.ceil(L / len(y))) + 1
        y = np.concatenate([y] * reps)[:L].copy()
        fade = min(L // 4, int(0.3 * SR)); ramp = np.linspace(0, 1, fade)[:, None]
        y[:fade] *= ramp; y[-fade:] *= ramp[::-1]
    # tiny random pan per cue keeps the foley from stacking dead-centre
    pan = (hash((name, c['f'])) % 100) / 100 * 0.5 - 0.25
    g = c.get('gain', 0.3) * 0.8
    e = min(N, s + len(y))
    sfx_bus[s:e, 0] += y[:e - s, 0] * g * (1 - pan)
    sfx_bus[s:e, 1] += y[:e - s, 1] * g * (1 + pan)

# balance report: voice vs music (dB RMS) per scene while voice is active
db = lambda a: 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-9)
for name, a, b in [('S0', 0, 450), ('S1', 450, 1350), ('S2', 1350, 2100), ('S3', 2100, 2850), ('S4', 2850, 3600), ('S5', 3600, 4200), ('S6', 4200, 5100), ('S7', 5100, 5400)]:
    sl = slice(fr(a), fr(b)); act = active[sl] > 0
    vm = db(voice_bus[sl][act]) if act.any() else float('nan')
    mm = db(music_bus[sl][act]) if act.any() else db(music_bus[sl])
    print(f'{name}: music {db(music_bus[sl]):6.1f} dB | under voice {mm:6.1f} | voice {vm:6.1f} | sfx {db(sfx_bus[sl]):6.1f}')

# ------------------------------------------------------------------ master
mix = music_bus + voice_bus + sfx_bus
loud = meter.integrated_loudness(mix)
mix *= 10 ** ((-16 - loud) / 20)
# true-peak-ish limiter: 4x oversampled peak detection, smooth gain reduction
ceiling = 10 ** (-1.2 / 20)
up = signal.resample_poly(np.abs(mix).max(1), 4, 1)[::4][:N]
need = np.minimum(1, ceiling / np.maximum(up, 1e-9))
gr = signal.lfilter([1 / 480], [1, -(1 - 1 / 480)], 1 - need)       # ~10 ms smoothing
gr = np.maximum(gr, 1 - need)
mix *= (1 - gr)[:, None]
mix = np.clip(mix, -0.999, 0.999)
sf.write(out_path, mix.astype(np.float32), SR, subtype='PCM_24')
print('mix written', out_path, 'loudness %.1f LUFS' % meter.integrated_loudness(mix), 'peak %.2f dBFS' % (20 * np.log10(np.abs(mix).max())))
