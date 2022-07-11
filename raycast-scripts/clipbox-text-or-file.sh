#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Clipbox text or file
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 📋
# @raycast.packageName Clipbox

# Documentation:
# @raycast.description Upload the clipboard contents or a selected file to s3, put URL on clipboard
# @raycast.author Brian Schiller
# @raycast.authorURL https://brianschiller.com
set -euo pipefail

FILENAME=$(osascript clip-text-or-file.applescript)
if [[ $FILENAME == ~/.clipbox/clip.txt ]]; then
  # ignore illegal byte sequences from /dev/urandom
  export LC_ALL=C
  UPLOAD_NAME=$(cat /dev/urandom | tr -dc '[:alpha:]' | fold -w 7 | head -n 1)-$(date -I date).txt
else
  UPLOAD_NAME=$(basename $FILENAME)
fi
echo -n "https://clip.brianschiller.com/$UPLOAD_NAME" | pbcopy
aws --profile clipbox-writer s3 cp $FILENAME s3://brianschiller-clipbox/$UPLOAD_NAME --metadata-directive REPLACE --content-type $(file --mime-type --brief $FILENAME) --acl public-read
echo "Copied URL to clipboard"
