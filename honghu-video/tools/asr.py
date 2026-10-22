import sherpa_onnx, soundfile as sf, sys, numpy as np
M='/home/user/qihang/_work/models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/'
rec=sherpa_onnx.OfflineRecognizer.from_sense_voice(model=M+'model.int8.onnx',tokens=M+'tokens.txt',language='zh',use_itn=True,num_threads=4)
for f in sys.argv[1:]:
  a,sr=sf.read(f,dtype='float32')
  if a.ndim>1: a=a.mean(1)
  s=rec.create_stream(); s.accept_waveform(sr,a); rec.decode_stream(s)
  print(f, s.result.text)
