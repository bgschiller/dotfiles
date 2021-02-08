#!/usr/bin/env bash
gnome-screenshot --area
sleep 0.2
cp ~/Pictures/"$(ls ~/Pictures | tail -n1)" ~/clipbox/capture.png
python3 ~/bin/s3_upload.py ~/clipbox/capture.png | xclip -i -selection clipboard

