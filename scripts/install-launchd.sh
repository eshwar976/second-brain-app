#!/bin/zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_LABEL="com.vamshi.second-brain-app"
OPENCODE_LABEL="com.vamshi.second-brain-opencode"
PLIST_DIR="$HOME/Library/LaunchAgents"
APP_PLIST_PATH="$PLIST_DIR/$APP_LABEL.plist"
OPENCODE_PLIST_PATH="$PLIST_DIR/$OPENCODE_LABEL.plist"
LOG_DIR="$APP_DIR/.data/logs"
RUNNER_DIR="$HOME/Library/Application Support/SecondBrain"
APP_RUNNER_PATH="$RUNNER_DIR/run-webapp.sh"
OPENCODE_RUNNER_PATH="$RUNNER_DIR/run-opencode.sh"

env_value() {
  local key="$1"
  local fallback="${2:-}"
  local env_file="$APP_DIR/.env"
  if [ ! -f "$env_file" ]; then
    echo "$fallback"
    return
  fi
  local line
  line="$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)"
  if [ -z "$line" ]; then
    echo "$fallback"
    return
  fi
  local value="${line#*=}"
  value="${value%$'\r'}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  echo "$value"
}

OPENCODE_AUTO_START="$(env_value OPENCODE_AUTO_START true)"
VAULT_PATH_VALUE="$(env_value VAULT_PATH "")"
OPENCODE_HOST="$(env_value OPENCODE_HOST 127.0.0.1)"
OPENCODE_PORT="$(env_value OPENCODE_PORT 4096)"
OPENCODE_BIN="$(env_value OPENCODE_BIN "")"

mkdir -p "$PLIST_DIR" "$LOG_DIR" "$RUNNER_DIR"
touch "$LOG_DIR/launchd.out.log" "$LOG_DIR/launchd.err.log"

if [ ! -f "$APP_DIR/scripts/run-service.sh" ]; then
  echo "Missing service runner: $APP_DIR/scripts/run-service.sh" >&2
  exit 1
fi

chmod +x "$APP_DIR/scripts/run-service.sh"

if ! /bin/zsh -n "$APP_DIR/scripts/run-service.sh"; then
  echo "Service runner has a syntax error: $APP_DIR/scripts/run-service.sh" >&2
  exit 1
fi

cat > "$APP_RUNNER_PATH" <<RUNNER
#!/bin/zsh
set -euo pipefail

APP_DIR="$APP_DIR"
VAULT_PATH="$VAULT_PATH_VALUE"
OPENCODE_AUTO_START="$OPENCODE_AUTO_START"
OPENCODE_HOST="$OPENCODE_HOST"
OPENCODE_PORT="$OPENCODE_PORT"
OPENCODE_BIN="$OPENCODE_BIN"
LOG_DIR="$LOG_DIR"
cd "\$APP_DIR"

mkdir -p "\$APP_DIR/.data/logs"

if [ -f "\$HOME/.zprofile" ]; then
  source "\$HOME/.zprofile"
fi

resolve_opencode_bin() {
  if [ -n "\$OPENCODE_BIN" ] && [ -x "\$OPENCODE_BIN" ]; then
    echo "\$OPENCODE_BIN"
    return 0
  fi
  if command -v opencode >/dev/null 2>&1; then
    command -v opencode
    return 0
  fi
  for BIN in /opt/homebrew/bin/opencode /usr/local/bin/opencode; do
    if [ -x "\$BIN" ]; then
      echo "\$BIN"
      return 0
    fi
  done
  return 1
}

OPENCODE_PID=""
if [ "\$OPENCODE_AUTO_START" != "false" ]; then
  if [ -z "\$VAULT_PATH" ]; then
    echo "\$(date -Iseconds) OpenCode auto-start skipped: VAULT_PATH is missing." >&2
  elif OPENCODE_RESOLVED_BIN="\$(resolve_opencode_bin)"; then
    (
      cd "\$VAULT_PATH"
      echo "\$(date -Iseconds) starting OpenCode from \$VAULT_PATH on \$OPENCODE_HOST:\$OPENCODE_PORT using \$OPENCODE_RESOLVED_BIN" >&2
      exec "\$OPENCODE_RESOLVED_BIN" serve --hostname "\$OPENCODE_HOST" --port "\$OPENCODE_PORT"
    ) &
    OPENCODE_PID="\$!"
  else
    echo "\$(date -Iseconds) OpenCode auto-start skipped: opencode binary was not found." >&2
  fi
fi

cleanup() {
  if [ -n "\$OPENCODE_PID" ]; then
    kill "\$OPENCODE_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_BIN="\$(command -v node)"
else
  for BIN in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [ -x "\$BIN" ]; then
      NODE_BIN="\$BIN"
      break
    fi
  done
fi

if [ -z "\$NODE_BIN" ]; then
  echo "Node.js was not found. Install Node 20+ or add it to PATH in ~/.zprofile." >&2
  exit 127
fi

"\$NODE_BIN" "\$APP_DIR/server.js"
RUNNER

chmod +x "$APP_RUNNER_PATH"

cat > "$APP_PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$APP_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>$APP_RUNNER_PATH</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$RUNNER_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>Crashed</key>
    <true/>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/launchd.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "$OPENCODE_PLIST_PATH" >/dev/null 2>&1 || true
rm -f "$OPENCODE_PLIST_PATH" "$OPENCODE_RUNNER_PATH"

launchctl bootout "gui/$(id -u)" "$APP_PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$APP_PLIST_PATH"
launchctl enable "gui/$(id -u)/$APP_LABEL"
launchctl kickstart -k "gui/$(id -u)/$APP_LABEL"

echo "Installed and started $APP_LABEL"
echo "Plist: $APP_PLIST_PATH"
if [ "$OPENCODE_AUTO_START" != "false" ]; then
  echo "OpenCode starts with $APP_LABEL"
  echo "OpenCode cwd: $VAULT_PATH_VALUE"
fi
echo "Logs: $LOG_DIR/launchd.out.log and $LOG_DIR/launchd.err.log"
