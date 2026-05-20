#!/bin/zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

mkdir -p "$APP_DIR/.data/logs"

if [ -f "$HOME/.zprofile" ]; then
  source "$HOME/.zprofile"
fi

if command -v node >/dev/null 2>&1; then
  exec node server.js
fi

for NODE_BIN in /opt/homebrew/bin/node /usr/local/bin/node; do
  if [ -x "$NODE_BIN" ]; then
    exec "$NODE_BIN" server.js
  fi
done

echo "Node.js was not found. Install Node 20+ or add it to PATH in ~/.zprofile." >&2
exit 127
