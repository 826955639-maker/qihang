"""Original score for 《鸿鹄远征》 — written as MIDI, rendered with FluidSynth.

96 BPM, 4/4: one bar = 2.5 s = 75 frames, so every scene boundary falls on a barline:
S0 b0  S1 b6  S2 b18  S3 b28  S4 b38  S5 b48  S6 b56  S7 b68  end b72 (3:00)
usage: python3 compose.py out.mid
"""
import sys
import mido

BPM = 96
TPB = 480
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def n(s):
    """'F#5' -> midi number"""
    name = s[0]; i = 1; acc = 0
    while i < len(s) and s[i] in '#b':
        acc += 1 if s[i] == '#' else -1; i += 1
    return 12 * (int(s[i:]) + 1) + NOTE[name] + acc


CHORDS = {
    'D': ['D', 'F#', 'A'], 'Dadd9': ['D', 'F#', 'A', 'E'], 'Bm': ['B', 'D', 'F#'], 'Bm7': ['B', 'D', 'F#', 'A'],
    'G': ['G', 'B', 'D'], 'Gmaj7': ['G', 'B', 'D', 'F#'], 'A': ['A', 'C#', 'E'], 'Asus4': ['A', 'D', 'E'],
    'A7': ['A', 'C#', 'E', 'G'], 'Em': ['E', 'G', 'B'], 'Em7': ['E', 'G', 'B', 'D'], 'F#m': ['F#', 'A', 'C#'],
    'F#': ['F#', 'A#', 'C#'], 'C': ['C', 'E', 'G'], 'A/C#': ['A', 'C#', 'E'],
}
BASS = {'A/C#': 'C#'}


def pc(name):
    return (NOTE[name[0]] + (1 if '#' in name else 0) - (1 if name.endswith('b') and len(name) > 1 else 0)) % 12


def root_pc(ch):
    b = BASS.get(ch)
    if b: return pc(b)
    r = ch[:2] if len(ch) > 1 and ch[1] == '#' else ch[:1]
    return pc(r)


def in_range(p, lo, hi):
    out = []
    for o in range(0, 10):
        m = 12 * o + p
        if lo <= m <= hi: out.append(m)
    return out


class Track:
    def __init__(self, name, ch, prog, vol=100, pan=64):
        self.name, self.ch, self.prog, self.vol, self.pan = name, ch, prog, vol, pan
        self.ev = []   # (beat, kind, data)

    def note(self, beat, dur, pitch, vel):
        if isinstance(pitch, str): pitch = n(pitch)
        vel = max(1, min(127, int(vel)))
        self.ev.append((beat, 1, ('on', pitch, vel)))
        self.ev.append((beat + dur * 0.98, 0, ('off', pitch, 0)))

    def cc(self, beat, num, val):
        self.ev.append((beat, -1, ('cc', num, max(0, min(127, int(val))))))

    def ramp(self, b0, b1, v0, v1, num=11, steps_per_beat=4):
        steps = max(1, int((b1 - b0) * steps_per_beat))
        for i in range(steps + 1):
            self.cc(b0 + (b1 - b0) * i / steps, num, v0 + (v1 - v0) * i / steps)


tracks = {}


def T(name, ch, prog, vol=100, pan=64):
    tracks[name] = Track(name, ch, prog, vol, pan)
    return tracks[name]


piano = T('piano', 0, 0, 110, 60)
pad = T('strings', 1, 48, 100, 64)
cello = T('cello', 2, 42, 100, 50)
bass = T('bass', 3, 43, 95, 64)
horn = T('horn', 4, 60, 90, 74)
flute = T('flute', 5, 73, 85, 80)
pizz = T('pizz', 6, 45, 95, 44)
glock = T('glock', 7, 9, 70, 90)
harp = T('harp', 8, 46, 90, 40)
drums = T('drums', 9, 0, 90, 64)
timp = T('timp', 10, 47, 100, 64)
violin = T('violins', 11, 49, 105, 70)
choir = T('choir', 12, 52, 80, 64)

B = lambda bar, beat=0: bar * 4 + beat   # absolute beat

# ---------------------------------------------------------------- themes
T1 = [('F#5', 1), ('E5', 1), ('D5', 2), ('A4', 3), ('B4', 1), ('D5', 1), ('E5', 1), ('F#5', 1), ('A5', 1), ('E5', 4)]
T2 = [('F#5', 1), ('E5', 1), ('D5', 2), ('B4', 2), ('A4', 1), ('B4', 1), ('D5', 1.5), ('E5', .5), ('D5', 1), ('B4', 1), ('D5', 4)]
M1 = [('B4', 1), ('A4', 1), ('F#4', 2), ('E4', 3), ('F#4', 1), ('A4', 1), ('B4', 1), ('D5', 1), ('B4', 1), ('A4', 4)]
M2 = [('B4', 1), ('A4', 1), ('F#4', 2), ('D4', 2), ('E4', 1), ('F#4', 1), ('A4', 1.5), ('F#4', .5), ('E4', 1), ('D4', 1), ('F#4', 4)]


def melody(tr, bar, mel, vel, transpose=0, legato=1.0, accent_first=0):
    b = B(bar)
    for i, (p, d) in enumerate(mel):
        v = vel + (accent_first if i == 0 else 0) + (6 if d >= 2 else 0)
        tr.note(b, d * legato, n(p) + transpose, v)
        b += d


# ---------------------------------------------------------------- harmony helpers
last_voicing = {}


def voicing(ch, lo, hi, key, nv=4):
    pcs = [pc(x) for x in CHORDS[ch]]
    cands = []
    for p in pcs:
        cands += [(m, p) for m in in_range(p, lo, hi)]
    prev = last_voicing.get(key)
    best = None
    import itertools
    pool = sorted(set(m for m, _ in cands))
    for combo in itertools.combinations(pool, nv):
        if set(x % 12 for x in combo) != set(pcs) and not (nv > len(pcs) and set(x % 12 for x in combo) >= set(pcs)):
            continue
        if max(combo) - min(combo) > 16: continue
        score = sum(abs(a - b) for a, b in zip(combo, prev)) if prev else abs(sum(combo) / nv - (lo + hi) / 2)
        if best is None or score < best[0]: best = (score, combo)
    if best is None:
        combo = tuple(sorted(in_range(p, lo, hi)[0] for p in pcs))[:nv]
    else:
        combo = best[1]
    last_voicing[key] = combo
    return list(combo)


def pad_chords(tr, bar0, chords, vel, lo=55, hi=74, nv=4, beats=4, key=None):
    for i, ch in enumerate(chords):
        for m in voicing(ch, lo, hi, key or tr.name, nv):
            tr.note(B(bar0 + i), beats, m, vel)


def bass_line(tr, bar0, chords, vel, octave_lo=33, octave_hi=45, pattern=(0,), dur=4):
    for i, ch in enumerate(chords):
        r = in_range(root_pc(ch), octave_lo, octave_hi)[0]
        for k, off in enumerate(pattern):
            d = dur if len(pattern) == 1 else (pattern[k + 1] - off if k + 1 < len(pattern) else 4 - off)
            tr.note(B(bar0 + i, off), d, r, vel)


def arpeggio(tr, bar0, chords, vel, sub=0.5, lo=50, shape=(0, 1, 2, 3, 2, 1, 2, 3), rh=False, swell=0):
    """broken-chord figure: root low, then chord tones ascending"""
    for i, ch in enumerate(chords):
        root = in_range(root_pc(ch), lo - 12 if not rh else lo, lo + 11)[0]
        tones = [pc(x) for x in CHORDS[ch]]
        stack = [root]
        cur = root
        while len(stack) < 6:
            cur += 1
            if cur % 12 in tones: stack.append(cur)
        steps = int(4 / sub)
        for k in range(steps):
            idx = shape[k % len(shape)]
            v = vel + (8 if k == 0 else 0) + swell * k / steps
            tr.note(B(bar0 + i, k * sub), sub * 1.6, stack[idx], v)


# ================================================================ S0 · bars 0-5  (piano solo)
piano.cc(0, 11, 100)
for i, (ch, notes) in enumerate([('Dadd9', ['D3', 'A3', 'E4', 'F#4', 'A4']), ('Bm7', ['B2', 'F#3', 'D4', 'A4'])]):
    for k, p in enumerate(notes):   # rolled chords, like someone opening the piano lid
        piano.note(B(i, k * 0.35), 4 - k * 0.35, p, 60 - k * 2)
melody(piano, 2, T1, 66, transpose=0)
arpeggio(piano, 2, ['D', 'Bm', 'G', 'A'], 44, sub=1, lo=38, shape=(0, 2, 3, 2))
harp.note(B(5, 3), 1, 'A5', 30)

# ================================================================ S1 · bars 6-17  (B minor, the Long March)
pad.cc(B(6), 11, 0)
pad.ramp(B(6), B(8), 0, 80)
pad_chords(pad, 6, ['Bm', 'Em', 'G', 'A'], 54, lo=50, hi=69)
bass_line(bass, 6, ['Bm', 'Em', 'G', 'A'], 50)
arpeggio(piano, 6, ['Bm', 'Em', 'G', 'A'], 30, sub=1, lo=38, shape=(0, 2, 3, 4))
# march: soft snare + timpani from bar 10
for bar in range(10, 16):
    for beat in (0, 1, 2, 3):
        drums.note(B(bar, beat), .2, 38, 22 + (10 if beat == 0 else 0))
        if beat in (1, 3): drums.note(B(bar, beat + .5), .2, 38, 14)
    timp.note(B(bar, 0), 1, 'B1' if bar % 4 in (2, 3) else 'F#2', 52)
cello.cc(B(10), 11, 95)
melody(cello, 10, M1, 64, transpose=-12)
pad_chords(pad, 10, ['Bm', 'Em', 'G', 'A'], 58, lo=50, hi=69)
bass_line(bass, 10, ['Bm', 'Em', 'G', 'A'], 56)
arpeggio(piano, 10, ['Bm', 'Em', 'G', 'A'], 30, sub=1, lo=38, shape=(0, 2, 3, 4))
violin.cc(B(14), 11, 70)
melody(violin, 14, M2[:-1], 56)                      # violins take the minor theme
melody(cello, 14, M2[:-1], 52, transpose=-12)
pad_chords(pad, 14, ['Bm', 'G', 'Em7'], 60, lo=50, hi=69)
bass_line(bass, 14, ['Bm', 'G', 'Em7'], 58)
arpeggio(piano, 14, ['Bm', 'G', 'Em7'], 32, sub=1, lo=38, shape=(0, 2, 3, 4))
# bar 16 last beat: timpani roll into the reunion (bar 17, D major)
for k in range(8):
    timp.note(B(16, 2 + k * .25), .25, 'A1', 30 + k * 6)
violin.note(B(17), 4, 'F#5', 70); violin.note(B(17), 4, 'A5', 62)
horn.cc(B(17), 11, 60); horn.ramp(B(17), B(17, 2), 60, 105)
for p in ['D4', 'F#4', 'A4']: horn.note(B(17), 4, p, 74)
cello.note(B(17), 4, 'D3', 66); bass.note(B(17), 4, 'D2', 66)
pad_chords(pad, 17, ['D'], 66, lo=50, hi=69)
timp.note(B(17), 1.5, 'D2', 78)
drums.note(B(17), 3, 49, 40)   # soft crash
harp.note(B(17, 0), 1, 'D5', 50); harp.note(B(17, .25), 1, 'F#5', 50); harp.note(B(17, .5), 1, 'A5', 50); harp.note(B(17, .75), 3, 'D6', 54)

# ================================================================ S2 · bars 18-27  (D major, the school's own march)
arpeggio(piano, 18, ['D', 'G', 'D', 'Bm', 'G', 'A', 'D', 'G', 'Asus4', 'D'], 34, sub=.5, lo=50, shape=(0, 2, 3, 4, 3, 2, 3, 4))
pad_chords(pad, 18, ['D', 'G'], 52, lo=52, hi=71)
bass_line(bass, 18, ['D', 'G', 'D', 'Bm', 'G', 'A', 'D', 'G', 'Asus4', 'D'], 54)
melody(cello, 20, T1, 66, transpose=-12)
pad_chords(pad, 20, ['D', 'Bm', 'G', 'A'], 56, lo=52, hi=71)
violin.ramp(B(23), B(24), 60, 92)
melody(violin, 24, T2, 66)
pad_chords(horn, 24, ['D', 'G', 'Asus4', 'D'], 52, lo=50, hi=67, nv=3)
pad_chords(pad, 24, ['D', 'G', 'A', 'D'], 60, lo=52, hi=71)
timp.note(B(24), 1, 'D2', 60); timp.note(B(26), 1, 'A1', 56); timp.note(B(27), 2, 'D2', 50)
glock.note(B(24), 2, 'F#6', 34); glock.note(B(27), 2, 'D6', 30)

# ================================================================ S3 · bars 28-37  (modern: lab & workshop, ostinato)
s3 = ['D', 'A/C#', 'Bm', 'G', 'D', 'A/C#', 'D', 'Bm', 'G', 'A']
for i, ch in enumerate(s3):
    tones = sorted(voicing(ch, 62, 79, 'ost', 3))
    pat = [tones[0], tones[2], tones[1], tones[2]] * 2    # minimalist eighth-note ostinato
    for k, p in enumerate(pat):
        piano.note(B(28 + i, k * .5), .45, p, 48 + (8 if k % 4 == 0 else 0))
bass_line(pizz, 28, s3, 58, octave_lo=38, octave_hi=50, pattern=(0, 1, 2, 3))
for i in range(10):
    for k in range(8):
        drums.note(B(28 + i, k * .5), .1, 70, 18 + (8 if k % 2 == 0 else 0))   # maracas tick, like a clock
    if i % 2 == 0: glock.note(B(28 + i, 2.5), 1, ['A6', 'F#6', 'E6', 'D6', 'A6'][i // 2], 30)
pad.cc(B(28), 11, 70)
pad_chords(pad, 30, ['Bm', 'G'], 44, lo=52, hi=71)
flute.cc(B(34), 11, 90)
melody(flute, 34, T1, 60)
pad_chords(pad, 34, ['D', 'Bm', 'G', 'A'], 48, lo=52, hi=71)
bass_line(bass, 34, ['D', 'Bm', 'G', 'A'], 44)

# ================================================================ S4 · bars 38-47  (pastoral: fields & the classroom)
s4 = ['G', 'D', 'Em', 'A', 'G', 'A', 'D', 'G', 'Asus4', 'D']
arpeggio(harp, 38, s4, 40, sub=.5, lo=50, shape=(0, 1, 2, 3, 4, 3, 2, 1))
pad_chords(pad, 38, s4, 46, lo=52, hi=71)
bass_line(bass, 38, s4, 46)
# a small pentatonic call on flute between narration lines
for b_, p, d in [(B(40, 2.5), 'A5', .5), (B(40, 3), 'B5', 1), (B(43, 2), 'D6', .5), (B(43, 2.5), 'B5', .5), (B(43, 3), 'A5', 1)]:
    flute.note(b_, d, p, 46)
for k, p in enumerate(['D6', 'E6', 'F#6']):      # three hands go up
    glock.note(B(42) + 1.5 + k * 1.5, 1, p, 36)
melody(flute, 44, T2, 58)
melody(violin, 44, T2, 46, transpose=-12)
piano.note(B(47), 4, 'D3', 30); piano.note(B(47), 4, 'A3', 30)

# ================================================================ S5 · bars 48-55  (design & making: playful)
s5 = ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'Em7', 'A']
bass_line(pizz, 48, s5, 56, octave_lo=38, octave_hi=50, pattern=(0, 1.5, 2, 3))
for i, ch in enumerate(s5):
    tones = sorted(voicing(ch, 60, 76, 'stac', 3))
    for off in (0.5, 1.5, 2.5, 3.5):
        for p in tones: piano.note(B(48 + i, off), .22, p, 42)
    drums.note(B(48 + i, 1), .1, 76, 26); drums.note(B(48 + i, 3), .1, 77, 22)    # wood blocks
motif = [('A5', .5), ('B5', .5), ('D6', 1), ('E6', .5), ('D6', .5), ('B5', 1)]
for bar in (48, 50):
    melody(glock, bar, motif, 40)
for k, p in enumerate(['D6', 'F#6', 'A6']):          # three hearts pop
    glock.note(B(50, 2.7) + k * 1.0, 1, p, 46)
melody(piano, 52, T1, 50)
pad_chords(pad, 52, ['D', 'Bm', 'Em7', 'A'], 44, lo=52, hi=71)
bass_line(bass, 52, ['D', 'Bm', 'Em7', 'A'], 42)

# ================================================================ S6 · bars 56-67  (relay — build to the climax)
s6a = ['D', 'G', 'Bm', 'A']
arpeggio(piano, 56, s6a + ['D', 'Bm', 'G', 'A'], 36, sub=.5, lo=50, shape=(0, 2, 3, 4, 3, 2, 3, 4), swell=10)
pad.ramp(B(56), B(64), 70, 105)
pad_chords(pad, 56, s6a, 54, lo=52, hi=71)
bass_line(bass, 56, s6a, 56)
for bar in range(56, 64):
    timp.note(B(bar, 0), 1, 'D2' if bar % 2 == 0 else 'A1', 40 + (bar - 56) * 3)
violin.ramp(B(60), B(64), 75, 110)
melody(violin, 60, T1, 70)
melody(cello, 60, T1, 60, transpose=-12)
pad_chords(horn, 60, ['D', 'Bm', 'G', 'A'], 54, lo=50, hi=67, nv=3)
pad_chords(pad, 60, ['D', 'Bm', 'G', 'A'], 62, lo=52, hi=71)
bass_line(bass, 60, ['D', 'Bm', 'G', 'A'], 62)
# bar 64: lead-in — A7, timpani + snare rolls, everything swells
for p in ['A3', 'E4', 'G4', 'C#5']: pad.note(B(64), 4, p, 74)
for p in ['E4', 'G4', 'C#5']: horn.note(B(64), 4, p, 70)
horn.ramp(B(64), B(65), 70, 120)
violin.note(B(64), 2, 'A5', 74); violin.note(B(64, 2), 1, 'C#6', 80); violin.note(B(64, 3), 1, 'E6', 86)
bass.note(B(64), 4, 'A1', 70); cello.note(B(64), 4, 'A2', 70)
choir.cc(B(64), 11, 40); choir.ramp(B(64), B(65), 40, 100)
for p in ['A3', 'E4', 'A4']: choir.note(B(64), 4, p, 60)
for k in range(16):
    timp.note(B(64, k * .25), .25, 'A1', 40 + k * 4)
    drums.note(B(64, k * .25), .2, 38, 20 + k * 5)
# bars 65-68: CLIMAX — theme T2 tutti
drums.note(B(65), 4, 49, 92); drums.note(B(65), 1, 36, 70)
melody(violin, 65, T2, 92, accent_first=8)
melody(flute, 65, T2, 70, transpose=12, legato=.95)
melody(cello, 65, T2, 82, transpose=-12)
pad_chords(horn, 65, ['D', 'G', 'Asus4', 'D'], 84, lo=50, hi=67, nv=3)
pad_chords(pad, 65, ['D', 'G', 'Asus4', 'D'], 84, lo=50, hi=74, nv=5)
pad_chords(choir, 65, ['D', 'G', 'Asus4', 'D'], 72, lo=52, hi=69, nv=3)
bass_line(bass, 65, ['D', 'G', 'Asus4', 'D'], 84, pattern=(0, 2))
arpeggio(harp, 65, ['D', 'G', 'Asus4', 'D'], 54, sub=.25, lo=50, shape=(0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3))
for bar in (65, 66, 67):
    timp.note(B(bar, 0), 1, 'D2' if bar != 67 else 'A1', 86)
    timp.note(B(bar, 2), 1, 'A1', 66)
timp.note(B(68), 2, 'D2', 90); drums.note(B(68), 4, 49, 70)
piano.note(B(68), 4, 'D2', 60); piano.note(B(68), 4, 'D3', 60)

# ================================================================ S7 · bars 68-71  (answer & credits)
pad.ramp(B(68, 2), B(71, 4), 100, 40)
horn.ramp(B(68, 2), B(70), 110, 30)
choir.ramp(B(68, 2), B(70), 100, 20)
violin.ramp(B(68, 2), B(70), 110, 50)
melody(piano, 69, [('F#5', 1), ('E5', 1), ('D5', 2), ('A4', 3), ('B4', 1)], 44)
for i, p in enumerate(['D3', 'A3', 'E4', 'F#4', 'A4', 'D5']):
    piano.note(B(71, i * .3), 5 - i * .3, p, 40 - i * 2)
pad_chords(pad, 69, ['G', 'Dadd9', 'Dadd9'], 46, lo=50, hi=71)
bass.note(B(69), 4, 'G1', 40); bass.note(B(70), 8, 'D2', 38)
glock.note(B(71, 1), 3, 'A6', 24)


# ---------------------------------------------------------------- write
def write(path):
    mid = mido.MidiFile(ticks_per_beat=TPB, type=1)
    meta = mido.MidiTrack(); mid.tracks.append(meta)
    meta.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM)))
    meta.append(mido.MetaMessage('time_signature', numerator=4, denominator=4))
    for tr in tracks.values():
        mt = mido.MidiTrack(); mid.tracks.append(mt)
        mt.append(mido.MetaMessage('track_name', name=tr.name))
        if tr.ch != 9:
            mt.append(mido.Message('program_change', channel=tr.ch, program=tr.prog, time=0))
        mt.append(mido.Message('control_change', channel=tr.ch, control=7, value=tr.vol, time=0))
        mt.append(mido.Message('control_change', channel=tr.ch, control=10, value=tr.pan, time=0))
        mt.append(mido.Message('control_change', channel=tr.ch, control=91, value=70, time=0))
        if not any(e[2][0] == 'cc' and e[2][1] == 11 and e[0] == 0 for e in tr.ev):
            mt.append(mido.Message('control_change', channel=tr.ch, control=11, value=100, time=0))
        evs = sorted(tr.ev, key=lambda e: (e[0], e[1]))
        t = 0
        for beat, _, (k, a, b) in evs:
            tick = int(round(beat * TPB)); dt = max(0, tick - t); t = max(t, tick)
            if k == 'on': mt.append(mido.Message('note_on', channel=tr.ch, note=a, velocity=b, time=dt))
            elif k == 'off': mt.append(mido.Message('note_off', channel=tr.ch, note=a, velocity=0, time=dt))
            else: mt.append(mido.Message('control_change', channel=tr.ch, control=a, value=b, time=dt))
    mid.save(path)
    print('wrote', path, 'length %.2fs' % mid.length)


write(sys.argv[1] if len(sys.argv) > 1 else 'score.mid')
