import sherpa_onnx, soundfile as sf, sys, time
M='/home/user/qihang/_work/models/kokoro-multi-lang-v1_1/'
cfg=sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
  model=M+'model.onnx',voices=M+'voices.bin',tokens=M+'tokens.txt',data_dir=M+'espeak-ng-data',dict_dir=M+'dict',
  lexicon=M+'lexicon-us-en.txt,'+M+'lexicon-zh.txt'),num_threads=4),
  rule_fsts=M+'phone-zh.fst,'+M+'date-zh.fst,'+M+'number-zh.fst',max_num_sentences=1)
tts=sherpa_onnx.OfflineTts(cfg); print('speakers',tts.num_speakers)
text=sys.argv[1]; out=sys.argv[2]
for sid in [int(x) for x in sys.argv[3].split(',')]:
  t=time.time(); a=tts.generate(text,sid=sid,speed=float(sys.argv[4]) if len(sys.argv)>4 else 1.0)
  sf.write(f'{out}_{sid}.wav',a.samples,a.sample_rate); print(sid,len(a.samples)/a.sample_rate,time.time()-t)
