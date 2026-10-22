import sherpa_onnx, soundfile as sf, numpy as np, librosa, sys
M='/home/user/qihang/_work/models/kokoro-multi-lang-v1_1/'
cfg=sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
  model=M+'model.onnx',voices=M+'voices.bin',tokens=M+'tokens.txt',data_dir=M+'espeak-ng-data',dict_dir=M+'dict',
  lexicon=M+'lexicon-us-en.txt,'+M+'lexicon-zh.txt'),num_threads=4),
  rule_fsts=M+'phone-zh.fst,'+M+'date-zh.fst,'+M+'number-zh.fst',max_num_sentences=1)
tts=sherpa_onnx.OfflineTts(cfg)
A='/home/user/qihang/_work/models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/'
rec=sherpa_onnx.OfflineRecognizer.from_sense_voice(model=A+'model.int8.onnx',tokens=A+'tokens.txt',language='zh',use_itn=False,num_threads=4)
text='九十年前，他们用双脚丈量信仰；九十年后，我们用知识和汗水接过这一棒。'
ids=[int(x) for x in sys.argv[1].split(',')] if len(sys.argv)>1 else range(3,103)
for sid in ids:
  a=tts.generate(text,sid=sid,speed=0.92); y=np.array(a.samples); sr=a.sample_rate
  sf.write(f'/home/user/qihang/_work/tts/scan_{sid}.wav',y,sr)
  f0,v,_=librosa.pyin(librosa.resample(y,orig_sr=sr,target_sr=16000),fmin=60,fmax=400,sr=16000,frame_length=1024)
  f=f0[v]; st=12*np.log2(f/np.median(f))
  s=rec.create_stream(); s.accept_waveform(sr,y); rec.decode_stream(s)
  print(sid, f'dur={len(y)/sr:.2f} f0med={np.median(f):.0f} semitoneSD={st.std():.2f} voiced={v.mean():.2f}', s.result.text, flush=True)
