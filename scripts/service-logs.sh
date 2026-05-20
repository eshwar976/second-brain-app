#!/bin/zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$APP_DIR/.data/logs"

mkdir -p "$LOG_DIR"
touch \
  "$LOG_DIR/launchd.out.log" \
  "$LOG_DIR/launchd.err.log"

tail -n 80 -f \
  "$LOG_DIR/launchd.out.log" \
  "$LOG_DIR/launchd.err.log"
