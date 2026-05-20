#!/bin/zsh
set -euo pipefail

labels=("com.vamshi.second-brain-app")

for LABEL in "${labels[@]}"; do
  PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"

  if [ ! -f "$PLIST_PATH" ]; then
    echo "$LABEL is not installed."
    continue
  fi

  echo "==> $LABEL"
  launchctl print "gui/$(id -u)/$LABEL"
done

echo "==> OpenCode HTTP"
lsof -nP -iTCP:4096 -sTCP:LISTEN || echo "No process is listening on 127.0.0.1:4096."
