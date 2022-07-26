#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Clipbox annotate
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 📸
# @raycast.packageName Clipbox

# Documentation:
# @raycast.description capture a selection of the screen, annotate in preview, upload to s3, and put the url on your clipboard
# @raycast.author Brian Schiller
# @raycast.authorURL https://brianschiller.com
set -euo pipefail

screencapture -i ~/.clipbox/capture.png
open -W ~/.clipbox/capture.png
# ignore illegal byte sequences from /dev/urandom
export LC_ALL=C
UPLOAD_NAME=$(cat /dev/urandom | tr -dc '[:alpha:]' | fold -w 7 | head -n 1)-$(date -I date).png
echo -n "https://clip.brianschiller.com/$UPLOAD_NAME" | pbcopy
aws --profile clipbox-writer s3 cp ~/.clipbox/capture.png s3://brianschiller-clipbox/$UPLOAD_NAME --metadata-directive REPLACE --content-type image/png --acl public-read
echo "Copied URL to clipboard"
