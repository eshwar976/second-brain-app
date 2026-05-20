#!/bin/zsh
set -euo pipefail

APP_LABEL="com.vamshi.second-brain-app"
OPENCODE_LABEL="com.vamshi.second-brain-opencode"
APP_PLIST_PATH="$HOME/Library/LaunchAgents/$APP_LABEL.plist"
OPENCODE_PLIST_PATH="$HOME/Library/LaunchAgents/$OPENCODE_LABEL.plist"
RUNNER_DIR="$HOME/Library/Application Support/SecondBrain"

launchctl bootout "gui/$(id -u)" "$APP_PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootout "gui/$(id -u)" "$OPENCODE_PLIST_PATH" >/dev/null 2>&1 || true
rm -f "$APP_PLIST_PATH" "$OPENCODE_PLIST_PATH"
rm -f "$RUNNER_DIR/run-webapp.sh" "$RUNNER_DIR/run-opencode.sh" "$RUNNER_DIR/run-service.sh"

echo "Uninstalled $APP_LABEL"
echo "Removed legacy $OPENCODE_LABEL if present"
