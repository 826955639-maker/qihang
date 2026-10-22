# Build a patched Kokoro model dir: fixes polyphones (鸿鹄 hú, 重来 chóng, 撒 sǎ) and 一 tone sandhi.
import os, sys
SRC = sys.argv[1]; DST = sys.argv[2]
os.makedirs(DST, exist_ok=True)
for f in os.listdir(SRC):
    if f in ('lexicon-zh.txt', 'dict'): continue
    p = os.path.join(DST, f)
    if not os.path.exists(p): os.symlink(os.path.join(SRC, f), p)
lex = {}
order = []
for line in open(os.path.join(SRC, 'lexicon-zh.txt'), encoding='utf8'):
    w, *ph = line.rstrip('\n').split(' ')
    if w not in lex: lex[w] = ph; order.append(w)
def ch(c): return lex[c]
def word(w, tone_over=None):
    ph = []
    for i, c in enumerate(w):
        p = list(ch(c))
        if tone_over and i in tone_over: p[-1] = str(tone_over[i])
        ph += p
    return ph
custom = {
    '鸿鹄': ch('鸿') + ['ㄏ', 'ㄨ', '2'],
    '重来': ch('重新')[:3] + ch('来'),
    '撒在': ['ㄙ', 'ㄚ', '3'] + ch('在'),
}
yi4 = ['一点点', '一张张', '一程', '一所', '一飞', '一株', '一本', '一起']   # yì before tones 1/2/3
yi2 = ['一遍遍', '一代代', '一棒', '一路', '一样', '一次次', '一个', '一步']  # yí before tone 4
for w in yi4: custom[w] = word(w, {0: 4})
for w in yi2: custom[w] = word(w, {0: 2})
custom['这一棒'] = word('这一棒', {1: 2})
custom['这一程'] = word('这一程', {1: 4})
for w, ph in custom.items():
    if w not in lex: order.append(w)
    lex[w] = ph
with open(os.path.join(DST, 'lexicon-zh.txt'), 'w', encoding='utf8') as f:
    for w in order: f.write(w + ' ' + ' '.join(lex[w]) + '\n')
os.makedirs(os.path.join(DST, 'dict'), exist_ok=True)
for f in os.listdir(os.path.join(SRC, 'dict')):
    p = os.path.join(DST, 'dict', f)
    if f == 'user.dict.utf8':
        txt = open(os.path.join(SRC, 'dict', f), encoding='utf8').read()
        with open(p, 'w', encoding='utf8') as o:
            o.write(txt.rstrip('\n') + '\n' + ''.join(f'{w} 100000 n\n' for w in custom))
    elif not os.path.exists(p):
        os.symlink(os.path.join(SRC, 'dict', f), p)
print('patched', len(custom), 'words:', ' '.join(f'{w}={"".join(custom[w])}' for w in custom))
