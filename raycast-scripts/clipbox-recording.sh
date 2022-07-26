#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Clipbox recording
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 🎥
# @raycast.packageName Clipbox

# Documentation:
# @raycast.description record your screen, upload to s3, and put the URL on your clipboard
# @raycast.author Brian Schiller
# @raycast.authorURL https://brianschiller.com

set -euo pipefail

osascript screen-recording.applescript
ffmpeg -y -i ~/.clipbox/recording.mov -c copy -map 0 -movflags +faststart ~/.clipbox/recording.mp4

# ignore illegal byte sequences from /dev/urandom
export LC_ALL=C
UPLOAD_NAME=$(cat /dev/urandom | tr -dc '[:alpha:]' | fold -w 7 | head -n 1)-$(date -I date).mp4
echo -n "https://clip.brianschiller.com/$UPLOAD_NAME" | pbcopy
aws --profile clipbox-writer s3 cp ~/.clipbox/recording.mp4 s3://brianschiller-clipbox/$UPLOAD_NAME --metadata-directive REPLACE --content-type video/mp4 --acl public-read
echo "Copied URL to clipboard"
