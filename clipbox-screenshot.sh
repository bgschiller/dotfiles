#!/usr/bin/env bash
set -euo pipefail

env > ~/clipbox.env
gnome-screenshot --area
sleep 0.2
mv ~/Pictures/"$(ls ~/Pictures | tail -n1)" ~/clipbox/capture.png
python3 ~/bin/s3_upload.py ~/clipbox/capture.png 2>~/clipbox/upload.log | xclip -i -selection clipboard

