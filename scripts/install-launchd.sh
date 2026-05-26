#!/bin/zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_LABEL="com.vamshi.second-brain-app"
PLIST_DIR="$HOME/Library/LaunchAgents"
APP_PLIST_PATH="$PLIST_DIR/$APP_LABEL.plist"
LOG_DIR="$APP_DIR/.data/logs"
RUNNER_DIR="$HOME/Library/Application Support/SecondBrain"
APP_RUNNER_PATH="$RUNNER_DIR/run-webapp.sh"

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

VAULT_PATH_VALUE="$(env_value VAULT_PATH "")"
HERMES_AUTO_START="$(env_value HERMES_AUTO_START true)"
HERMES_HOST="$(env_value HERMES_HOST 127.0.0.1)"
HERMES_PORT="$(env_value HERMES_PORT 8642)"
HERMES_BIN="$(env_value HERMES_BIN "")"
HYDRATE_VAULT_ON_START="$(env_value HYDRATE_VAULT_ON_START true)"
HYDRATE_VAULT_PATHS="$(env_value HYDRATE_VAULT_PATHS "")"

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
HERMES_AUTO_START="$HERMES_AUTO_START"
HERMES_HOST="$HERMES_HOST"
HERMES_PORT="$HERMES_PORT"
HERMES_BIN="$HERMES_BIN"
HYDRATE_VAULT_ON_START="$HYDRATE_VAULT_ON_START"
HYDRATE_VAULT_PATHS="$HYDRATE_VAULT_PATHS"
LOG_DIR="$LOG_DIR"
cd "\$APP_DIR"

mkdir -p "\$APP_DIR/.data/logs"

if [ -f "\$HOME/.zprofile" ]; then
  source "\$HOME/.zprofile"
fi

resolve_hermes_bin() {
  if [ -n "\$HERMES_BIN" ] && [ -x "\$HERMES_BIN" ]; then
    echo "\$HERMES_BIN"
    return 0
  fi
  if command -v hermes >/dev/null 2>&1; then
    command -v hermes
    return 0
  fi
  for BIN in "\$HOME/.local/bin/hermes" /opt/homebrew/bin/hermes /usr/local/bin/hermes; do
    if [ -x "\$BIN" ]; then
      echo "\$BIN"
      return 0
    fi
  done
  return 1
}

resolve_node_bin() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  for BIN in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [ -x "\$BIN" ]; then
      echo "\$BIN"
      return 0
    fi
  done
  return 1
}

if ! NODE_BIN="\$(resolve_node_bin)"; then
  echo "Node.js was not found. Install Node 20+ or add it to PATH in ~/.zprofile." >&2
  exit 127
fi

HERMES_PID=""
if [ "\$HERMES_AUTO_START" != "false" ]; then
  if [ -z "\$VAULT_PATH" ]; then
    echo "\$(date -Iseconds) Hermes auto-start skipped: VAULT_PATH is missing." >&2
  elif HERMES_RESOLVED_BIN="\$(resolve_hermes_bin)"; then
    (
      if [ "\$HYDRATE_VAULT_ON_START" != "false" ] && [ -f "\$APP_DIR/scripts/hydrate-vault-paths.mjs" ]; then
        echo "\$(date -Iseconds) hydrating Hermes skill paths from iCloud before Hermes startup." >&2
        "\$NODE_BIN" "\$APP_DIR/scripts/hydrate-vault-paths.mjs" "\$VAULT_PATH" "\$HYDRATE_VAULT_PATHS" || true
      fi
      cd "\$VAULT_PATH"
      echo "\$(date -Iseconds) starting Hermes gateway from \$VAULT_PATH on \$HERMES_HOST:\$HERMES_PORT using \$HERMES_RESOLVED_BIN" >&2
      exec "\$HERMES_RESOLVED_BIN" gateway run
    ) &
    HERMES_PID="\$!"
  else
    echo "\$(date -Iseconds) Hermes auto-start skipped: hermes binary was not found." >&2
  fi
fi

cleanup() {
  if [ -n "\$HERMES_PID" ]; then
    kill "\$HERMES_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

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

launchctl bootout "gui/$(id -u)" "$APP_PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$APP_PLIST_PATH"
launchctl enable "gui/$(id -u)/$APP_LABEL"
launchctl kickstart -k "gui/$(id -u)/$APP_LABEL"

echo "Installed and started $APP_LABEL"
echo "Plist: $APP_PLIST_PATH"
if [ "$HERMES_AUTO_START" != "false" ]; then
  echo "Hermes gateway starts with $APP_LABEL"
  echo "Hermes cwd: $VAULT_PATH_VALUE"
fi
echo "Logs: $LOG_DIR/launchd.out.log and $LOG_DIR/launchd.err.log"
