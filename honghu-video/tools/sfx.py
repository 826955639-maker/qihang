"""Procedurally synthesized foley for the collage film (no third-party samples).
usage: python3 sfx.py OUT_DIR
"""
import os, sys
import numpy as np, soundfile as sf
from scipy import signal

SR = 48000
rng = np.random.default_rng(7)
out = sys.argv[1] if len(sys.argv) > 1 else 'sfx'
os.makedirs(out, exist_ok=True)


def t(d): return np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR))


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'); return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    sos = signal.butter(order, f, 'lowpass', fs=SR, output='sos'); return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    sos = signal.butter(order, f, 'highpass', fs=SR, output='sos'); return signal.sosfilt(sos, x)


def env(n, a, d, curve=4.0):
    e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    tail = np.arange(n - na) / SR; e[na:] = np.exp(-curve * tail / max(d, 1e-3)); return e


def room(x, mix=0.18, size=0.06):
    """tiny early-reflection room so the foley sits on the same 'table'"""
    y = x.copy()
    for k, g in [(0.011, .5), (0.017, .4), (0.029, .3), (0.041, .22), (size, .15)]:
        d = int(k * SR); y[d:] += x[:-d] * g * mix * 3
    return y


def save(name, x, peak=0.8, stereo_spread=0.0):
    x = np.asarray(x, dtype=np.float64)
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    if stereo_spread:
        d = int(stereo_spread * SR); r = np.concatenate([np.zeros(d), x[:-d]]); x = np.stack([x, r], 1)
    sf.write(os.path.join(out, name + '.wav'), x.astype(np.float32), SR)


# paper: a sheet landing on the table — crinkly high band + soft body thump
def paper():
    d = 0.32; n = int(d * SR)
    crinkle = bp(noise(d), 1800, 7000) * env(n, .004, .09, 3)
    # crackles: sparse impulses
    imp = np.zeros(n); idx = rng.integers(0, int(.12 * SR), 18); imp[idx] = rng.uniform(.3, 1, 18)
    crackle = bp(imp, 2500, 9000) * 6
    body = lp(noise(d), 500) * env(n, .002, .05, 5) * 1.6
    return room(crinkle + crackle + body)


# stamp: rubber stamp hitting paper on wood
def stamp():
    d = 0.45; n = int(d * SR); tt = t(d)
    thump = np.sin(2 * np.pi * (95 * tt - 40 * tt ** 2)) * env(n, .001, .09, 5) * 1.3
    knock = bp(noise(d), 300, 1400) * env(n, .0005, .03, 6)
    slap = bp(noise(d), 2000, 6000) * env(n, .0003, .012, 6) * .6
    return room(thump + knock + slap, mix=.3)


# type: typewriter key / "pa" — sharp click with a little metal ring
def typekey():
    d = 0.18; n = int(d * SR); tt = t(d)
    click = hp(noise(d), 2500) * env(n, .0002, .008, 6)
    ring = np.sin(2 * np.pi * 2350 * tt) * env(n, .0005, .05, 6) * .25
    thud = lp(noise(d), 400) * env(n, .001, .03, 6) * 1.2
    return room(click + ring + thud, mix=.25)


# flap: three soft wing beats
def flap():
    d = 0.7; n = int(d * SR); x = np.zeros(n)
    for i, (s, g) in enumerate([(0, 1), (.2, .85), (.4, .65)]):
        m = int(.16 * SR); seg = lp(noise(.16), 1600) * np.sin(np.linspace(0, np.pi, m)) ** 2 * g
        a = int(s * SR); x[a:a + m] += seg
    return x


# whoosh: page sweeping across (used by scene wipes)
def whoosh():
    d = 0.75; n = int(d * SR); x = noise(d)
    sweep = np.zeros(n)
    f = np.linspace(600, 3000, n)
    # moving bandpass approximated in blocks
    blk = 1024
    for i in range(0, n, blk):
        fc = f[i]; seg = x[i:i + blk]
        sweep[i:i + blk] = bp(seg, fc * .6, min(fc * 1.6, 20000))[:len(seg)]
    shape = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return room(sweep * shape)


# water: gentle river lapping (looping bed)
def water():
    d = 6.0; n = int(d * SR); x = lp(noise(d), 900) * .6
    mod = 0.6 + 0.4 * np.sin(2 * np.pi * .35 * t(d)) * np.sin(2 * np.pi * .13 * t(d) + 1)
    x *= mod
    for _ in range(40):   # bubbles / laps
        s = rng.integers(0, n - SR // 4); dd = rng.uniform(.03, .08); m = int(dd * SR); tt = np.arange(m) / SR
        f0 = rng.uniform(300, 900)
        x[s:s + m] += np.sin(2 * np.pi * (f0 * tt + f0 * 3 * tt ** 2)) * np.exp(-tt * 60) * rng.uniform(.2, .5)
    fade = int(.4 * SR); x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
    return x


# steps: marching feet on dirt (loop)
def steps():
    d = 4.0; n = int(d * SR); x = np.zeros(n); per = 0.42
    k = 0
    while k * per < d - .2:
        s = int((k * per + rng.uniform(-.015, .015)) * SR); m = int(.12 * SR)
        st = lp(noise(.12), 700) * env(m, .002, .05, 5) + bp(noise(.12), 1500, 4000) * env(m, .001, .02, 6) * .35
        g = 1 if k % 2 == 0 else .8
        x[s:s + m] += st * g; k += 1
    return x


# step: a single soft footfall on paper
def step():
    d = .16; n = int(d * SR)
    return lp(noise(d), 600) * env(n, .002, .05, 5) + bp(noise(d), 1800, 5000) * env(n, .001, .015, 6) * .4


# clock: one tick
def clock():
    d = .12; n = int(d * SR); tt = t(d)
    return hp(noise(d), 3000) * env(n, .0002, .006, 6) + np.sin(2 * np.pi * 4200 * tt) * env(n, .0002, .02, 6) * .3


# pencil: scribbling graphite (loop, ~3 s)
def pencil():
    d = 3.0; n = int(d * SR); x = bp(noise(d), 2500, 9000)
    stroke = np.abs(np.sin(2 * np.pi * 3.2 * t(d))) ** .6 * (0.6 + 0.4 * np.sin(2 * np.pi * .7 * t(d)))
    grain = 1 + .5 * bp(noise(d), 20, 120) * 8
    x = x * stroke * np.clip(grain, 0, 2)
    fade = int(.1 * SR); x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
    return x


# pop: tiny paper heart popping up
def pop():
    d = .2; n = int(d * SR); tt = t(d)
    return np.sin(2 * np.pi * (500 * tt + 2200 * tt ** 2)) * env(n, .001, .05, 6) + bp(noise(d), 2000, 6000) * env(n, .0005, .01, 6) * .3


# kids: light classroom murmur isn't synthesizable convincingly — a soft hand-raise "whoop" chime instead
def chime():
    d = 1.2; n = int(d * SR); tt = t(d); x = np.zeros(n)
    for f, g in [(1318.5, 1), (1975.5, .5), (2637, .25)]:
        x += np.sin(2 * np.pi * f * tt) * g
    return x * env(n, .002, .6, 4)


def wrench():
    d = .35; n = int(d * SR); x = np.zeros(n)
    for k in range(6):   # ratchet clicks
        s = int(k * .05 * SR); m = int(.03 * SR)
        x[s:s + m] += hp(noise(.03), 2000) * env(m, .0002, .006, 6)
    return x


save('paper', paper(), .7)
save('stamp', stamp(), .9)
save('type', typekey(), .8)
save('flap', flap(), .7)
save('whoosh', whoosh(), .7)
save('water', water(), .6)
save('steps', steps(), .7)
save('clock', clock(), .6)
save('step', step(), .6)
save('pencil', pencil(), .6)
save('pop', pop(), .6)
save('chime', chime(), .5)
save('wrench', wrench(), .7)
print('sfx written to', out)
