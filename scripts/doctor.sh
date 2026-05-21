#!/bin/zsh
set -uo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$APP_DIR/.env"
APP_LABEL="com.vamshi.second-brain-app"
APP_PORT="3030"
OPENCODE_PORT="4096"
FAILURES=0
WARNINGS=0

section() {
  printf "\n==> %s\n" "$1"
}

ok() {
  printf "  ok   %s\n" "$1"
}

warn() {
  WARNINGS=$((WARNINGS + 1))
  printf "  warn %s\n" "$1"
}

fail() {
  FAILURES=$((FAILURES + 1))
  printf "  fail %s\n" "$1"
}

env_value() {
  local key="$1"
  local fallback="${2:-}"
  if [ ! -f "$ENV_FILE" ]; then
    echo "$fallback"
    return
  fi
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
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

git_ignored() {
  git -C "$APP_DIR" check-ignore -q "$1"
}

git_summary() {
  local repo="$1"
  if [ ! -d "$repo/.git" ]; then
    echo "not a git repo"
    return
  fi
  local count
  count="$(git -C "$repo" status --short 2>/dev/null | wc -l | tr -d " ")"
  if [ "$count" = "0" ]; then
    echo "clean"
  else
    echo "$count uncommitted change(s)"
  fi
}

section "Config"
if [ -f "$ENV_FILE" ]; then
  ok ".env exists"
else
  fail ".env is missing"
fi

VAULT_PATH_VALUE="$(env_value VAULT_PATH "")"
HOST_VALUE="$(env_value HOST "127.0.0.1")"
PORT_VALUE="$(env_value PORT "3030")"
APP_PORT="$PORT_VALUE"
OPENCODE_BASE_URL="$(env_value OPENCODE_BASE_URL "http://127.0.0.1:4096")"
OPENCODE_AUTO_START="$(env_value OPENCODE_AUTO_START "true")"
OPENCODE_PORT="$(env_value OPENCODE_PORT "4096")"
MCP_ENABLED_VALUE="$(env_value MCP_ENABLED "false")"
MCP_HOST_VALUE="$(env_value MCP_HOST "127.0.0.1")"
MCP_PORT_VALUE="$(env_value MCP_PORT "3031")"
MCP_TOKEN_VALUE="$(env_value MCP_TOKEN "")"
MCP_CLIENT_TOOL_ALLOWLISTS_VALUE="$(env_value MCP_CLIENT_TOOL_ALLOWLISTS "")"
MCP_ALLOWED_ORIGINS_VALUE="$(env_value MCP_ALLOWED_ORIGINS "")"
MCP_RATE_LIMIT_MAX_VALUE="$(env_value MCP_RATE_LIMIT_MAX "60")"
GITHUB_AUTH_HOSTS="$(env_value GITHUB_AUTH_HOSTS "")"
APP_SECRET_AUTH_HOSTS="$(env_value APP_SECRET_AUTH_HOSTS "")"
APP_SECRET_VALUE="$(env_value APP_SECRET "")"
GITHUB_CLIENT_ID_VALUE="$(env_value GITHUB_CLIENT_ID "")"
GITHUB_CLIENT_SECRET_VALUE="$(env_value GITHUB_CLIENT_SECRET "")"
SESSION_SECRET_VALUE="$(env_value SESSION_SECRET "")"
GITHUB_ALLOWED_LOGINS_VALUE="$(env_value GITHUB_ALLOWED_LOGINS "")"

if [ -n "$VAULT_PATH_VALUE" ] && [ -d "$VAULT_PATH_VALUE" ]; then
  ok "VAULT_PATH reachable: $VAULT_PATH_VALUE"
else
  fail "VAULT_PATH missing or unreachable: ${VAULT_PATH_VALUE:-unset}"
fi

if [ "$OPENCODE_AUTO_START" = "false" ]; then
  warn "OPENCODE_AUTO_START=false; OpenCode is manually managed"
else
  ok "OpenCode auto-start enabled"
fi

case "$OPENCODE_BASE_URL" in
  *":$OPENCODE_PORT"|*":$OPENCODE_PORT/"*) ok "OPENCODE_BASE_URL matches OPENCODE_PORT" ;;
  *) warn "OPENCODE_BASE_URL ($OPENCODE_BASE_URL) may not match OPENCODE_PORT ($OPENCODE_PORT)" ;;
esac

section "Auth"
if [ -n "$APP_SECRET_VALUE" ]; then
  ok "APP_SECRET is configured for passcode auth"
else
  warn "APP_SECRET is not configured"
fi

if [ -n "$GITHUB_CLIENT_ID_VALUE" ] && [ -n "$GITHUB_CLIENT_SECRET_VALUE" ] && [ -n "$SESSION_SECRET_VALUE" ] && [ -n "$GITHUB_ALLOWED_LOGINS_VALUE" ]; then
  ok "GitHub OAuth is configured"
else
  warn "GitHub OAuth is not fully configured"
fi

if [ -n "$GITHUB_AUTH_HOSTS" ]; then
  ok "GitHub auth hosts: $GITHUB_AUTH_HOSTS"
else
  warn "GITHUB_AUTH_HOSTS is empty; non-local hosts default to GitHub when OAuth is configured"
fi

if [ -n "$APP_SECRET_AUTH_HOSTS" ]; then
  ok "App passcode hosts: $APP_SECRET_AUTH_HOSTS"
else
  warn "APP_SECRET_AUTH_HOSTS is empty; local/private hosts default to passcode when APP_SECRET is configured"
fi

if [ "$MCP_ENABLED_VALUE" = "true" ]; then
  ok "MCP enabled on $MCP_HOST_VALUE:$MCP_PORT_VALUE"
  if [ -n "$MCP_TOKEN_VALUE" ]; then
    ok "MCP token is configured"
    if [ "$MCP_TOKEN_VALUE" = "$APP_SECRET_VALUE" ]; then
      warn "MCP_TOKEN matches APP_SECRET; use a separate token when possible"
    fi
  else
    fail "MCP is enabled without MCP_TOKEN"
  fi
  ok "MCP rate limit: $MCP_RATE_LIMIT_MAX_VALUE requests/window"
  if [ -n "$MCP_CLIENT_TOOL_ALLOWLISTS_VALUE" ]; then
    ok "MCP client scopes configured"
  else
    warn "MCP client scopes are not configured; all clients share MCP_ALLOWED_TOOLS"
  fi
  if [ -n "$MCP_ALLOWED_ORIGINS_VALUE" ]; then
    ok "MCP allowed origins: $MCP_ALLOWED_ORIGINS_VALUE"
  else
    ok "MCP browser CORS origins disabled"
  fi
else
  ok "MCP disabled"
fi

section "Repo Boundary"
if [ "$VAULT_PATH_VALUE" = "$APP_DIR" ]; then
  fail "App directory and vault path are the same"
elif [ -n "$VAULT_PATH_VALUE" ] && [[ "$APP_DIR" == "$VAULT_PATH_VALUE"/* ]]; then
  fail "App repo is inside the vault"
else
  ok "App repo is separate from vault"
fi

if git_ignored ".env"; then
  ok ".env is gitignored"
else
  fail ".env is not gitignored"
fi

if git_ignored ".data/index.sqlite"; then
  ok ".data runtime files are gitignored"
else
  fail ".data runtime files are not gitignored"
fi

if [ -e "$VAULT_PATH_VALUE/package.json" ] || [ -d "$VAULT_PATH_VALUE/node_modules" ]; then
  warn "Vault root contains app-like files; confirm they belong to vault-native OpenCode setup"
else
  ok "No obvious app runtime files at vault root"
fi

section "Git"
ok "App repo: $(git_summary "$APP_DIR")"
if [ -n "$VAULT_PATH_VALUE" ]; then
  ok "Vault repo: $(git_summary "$VAULT_PATH_VALUE")"
fi

section "Services"
if launchctl print "gui/$(id -u)/$APP_LABEL" >/dev/null 2>&1; then
  ok "$APP_LABEL is loaded"
else
  warn "$APP_LABEL is not loaded"
fi

if lsof -nP -iTCP:"$APP_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  ok "Web app is listening on port $APP_PORT"
else
  fail "Web app is not listening on port $APP_PORT"
fi

if [ "$OPENCODE_AUTO_START" = "false" ]; then
  warn "Skipping OpenCode listener check because OPENCODE_AUTO_START=false"
elif lsof -nP -iTCP:"$OPENCODE_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  ok "OpenCode is listening on port $OPENCODE_PORT"
else
  fail "OpenCode is not listening on port $OPENCODE_PORT"
fi

if [ "$MCP_ENABLED_VALUE" = "true" ]; then
  if lsof -nP -iTCP:"$MCP_PORT_VALUE" -sTCP:LISTEN >/dev/null 2>&1; then
    ok "MCP is listening on port $MCP_PORT_VALUE"
  else
    fail "MCP is not listening on port $MCP_PORT_VALUE"
  fi
fi

section "Vault Native OpenCode"
if [ -d "$VAULT_PATH_VALUE/.opencode/agents" ]; then
  ok "Vault has .opencode/agents"
else
  warn "Vault is missing .opencode/agents"
fi

if [ -d "$VAULT_PATH_VALUE/.agents/skills" ]; then
  ok "Vault has .agents/skills"
else
  warn "Vault is missing .agents/skills"
fi

section "Summary"
if [ "$FAILURES" -gt 0 ]; then
  printf "  %s failure(s), %s warning(s)\n" "$FAILURES" "$WARNINGS"
  exit 1
fi

printf "  healthy enough: %s warning(s)\n" "$WARNINGS"
