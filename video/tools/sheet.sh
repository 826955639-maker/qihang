#!/bin/sh
# 用法: tools/sheet.sh <目录>  —— 按时间排序拼成 2x3 预览图
cd "$1" && rm -f seq_*.png sheet_*.png && i=0
for f in $(ls f_*.png | sort -t_ -k2 -g); do cp "$f" "seq_$(printf %03d $i).png"; i=$((i+1)); done
ffmpeg -loglevel error -y -i seq_%03d.png -vf "scale=640:360,tile=2x3:padding=4" sheet_%02d.png
