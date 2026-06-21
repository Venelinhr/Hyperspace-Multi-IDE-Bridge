#!/usr/bin/env bash
#
# Hyperspace Bridge installer.
# Idempotent: safe to re-run. Detects nvm/Homebrew/system Node automatically.
# Includes Tavily web search MCP for Claude in all IDEs (optional, free tier).

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; }
info() { echo -e "${YELLOW}ℹ${NC} $1"; }
dim()  { echo -e "${DIM}  $1${NC}"; }
ask()  { echo -e "${CYAN}?${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_NAME="$(whoami)"
UID_NUM="$(id -u)"
INSTALL_DIR="$HOME/.hyperspace-bridge"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.hyperspace.bridge.plist"
LOG_FILE="$HOME/Library/Logs/hyperspace-bridge.log"
LABEL="com.hyperspace.bridge"
CONTINUE_CONFIG="$HOME/.continue/config.yaml"

echo
echo "Hyperspace Bridge — installer"
echo "──────────────────────────────"

# ─── Step 1: Find Node.js ──────────────────────────────────────────────────
info "Looking for Node.js..."
NODE_BIN=""

if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [ -x /opt/homebrew/bin/node ]; then
  NODE_BIN="/opt/homebrew/bin/node"
elif [ -x /usr/local/bin/node ]; then
  NODE_BIN="/usr/local/bin/node"
fi

if [ -n "$NODE_BIN" ] && command -v readlink >/dev/null 2>&1; then
  RESOLVED="$(readlink -f "$NODE_BIN" 2>/dev/null || true)"
  if [ -z "$RESOLVED" ]; then
    RESOLVED="$(python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$NODE_BIN" 2>/dev/null || echo "$NODE_BIN")"
  fi
  NODE_BIN="$RESOLVED"
fi

if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  err "Node.js is not installed."
  echo "   Install with: brew install node"
  echo "   Or use nvm:   https://github.com/nvm-sh/nvm"
  exit 1
fi

NODE_VERSION="$("$NODE_BIN" --version)"
ok "Node.js found: $NODE_VERSION"
dim "$NODE_BIN"

# ─── Step 2: Create install directory ──────────────────────────────────────
info "Creating $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/Library/Logs"
mkdir -p "$HOME/.continue"
ok "Directories ready"

# ─── Step 3: Copy bridge script ────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/hyperspace-bridge.js" ]; then
  err "hyperspace-bridge.js not found in $SCRIPT_DIR"
  exit 1
fi
info "Copying hyperspace-bridge.js..."
cp "$SCRIPT_DIR/hyperspace-bridge.js" "$INSTALL_DIR/hyperspace-bridge.js"
ok "Bridge installed to $INSTALL_DIR/hyperspace-bridge.js"

# ─── Step 4: Detect Hai API key ─────────────────────────────────────────────
HAI_KEY_FOUND=""
if [ -n "${HAI_API_KEY:-}" ]; then
  HAI_KEY_FOUND="env: HAI_API_KEY"
elif [ -n "${ANTHROPIC_AUTH_TOKEN:-}" ]; then
  HAI_KEY_FOUND="env: ANTHROPIC_AUTH_TOKEN"
elif [ -f "$HOME/.claude/settings.json" ] && grep -q "ANTHROPIC_AUTH_TOKEN" "$HOME/.claude/settings.json" 2>/dev/null; then
  HAI_KEY_FOUND="~/.claude/settings.json"
fi

if [ -n "$HAI_KEY_FOUND" ]; then
  ok "Hai API key found ($HAI_KEY_FOUND)"
else
  echo
  err "No Hai API key found."
  echo "   Run:  hai configure claude-code"
  echo "   Or:   export HAI_API_KEY=<your-key>"
  echo "   The bridge will start but chat requests will fail until a key is set."
  echo
fi

# ─── Step 5: Tavily web search MCP ─────────────────────────────────────────
echo
echo "─── Web Search (Tavily MCP) ───────────────────────────────"
echo "   Gives Claude live web search in Cursor, Antigravity, and Zed."
echo "   Free tier: 1,000 searches/month — no credit card needed."
echo "   Get a free key at: https://app.tavily.com"
echo
TAVILY_KEY=""

# Check if already set in environment or existing config
if [ -n "${TAVILY_API_KEY:-}" ]; then
  TAVILY_KEY="${TAVILY_API_KEY}"
  ok "Tavily key found in environment"
elif [ -f "$CONTINUE_CONFIG" ] && grep -q "TAVILY_API_KEY" "$CONTINUE_CONFIG" 2>/dev/null; then
  TAVILY_KEY="$(grep -o 'tvly-[A-Za-z0-9_-]*' "$CONTINUE_CONFIG" 2>/dev/null | head -1 || true)"
  if [ -n "$TAVILY_KEY" ]; then
    ok "Tavily key found in existing config"
  fi
fi

if [ -z "$TAVILY_KEY" ]; then
  ask "Enter your Tavily API key (or press Enter to skip):"
  echo -n "   Key (tvly-...): "
  read -r TAVILY_INPUT
  TAVILY_INPUT="$(echo "$TAVILY_INPUT" | tr -d '[:space:]')"
  if [[ "$TAVILY_INPUT" == tvly-* ]]; then
    TAVILY_KEY="$TAVILY_INPUT"
    ok "Tavily key accepted"
  elif [ -n "$TAVILY_INPUT" ]; then
    err "Key must start with 'tvly-' — skipping Tavily"
    echo "   You can add it later by re-running install.sh"
  else
    info "Skipping Tavily — web search will not be available in IDEs"
    echo "   Re-run install.sh with your key to enable it later."
  fi
fi

# ─── Step 5b: GitHub MCP ────────────────────────────────────────────────────
echo
echo "─── GitHub Access (GitHub MCP) ────────────────────────────"
echo "   Gives Claude access to repos, PRs, issues, and code search."
echo "   Free: works with any GitHub account."
echo "   Get a token: GitHub → Settings → Developer settings → Personal access tokens"
echo
GITHUB_TOKEN=""

if [ -n "${GITHUB_TOKEN:-}" ]; then
  GITHUB_TOKEN="${GITHUB_TOKEN}"
  ok "GitHub token found in environment"
elif [ -f "$CONTINUE_CONFIG" ] && grep -q "GITHUB_PERSONAL_ACCESS_TOKEN" "$CONTINUE_CONFIG" 2>/dev/null; then
  GITHUB_TOKEN="$(grep -o 'ghp_[A-Za-z0-9_]*\|github_pat_[A-Za-z0-9_]*' "$CONTINUE_CONFIG" 2>/dev/null | head -1 || true)"
  if [ -n "$GITHUB_TOKEN" ]; then
    ok "GitHub token found in existing config"
  fi
fi

if [ -z "$GITHUB_TOKEN" ]; then
  ask "Enter your GitHub Personal Access Token (or press Enter to skip):"
  echo -n "   Token (ghp_...): "
  read -r GITHUB_INPUT
  GITHUB_INPUT="$(echo "$GITHUB_INPUT" | tr -d '[:space:]')"
  if [[ "$GITHUB_INPUT" == ghp_* ]] || [[ "$GITHUB_INPUT" == github_pat_* ]]; then
    GITHUB_TOKEN="$GITHUB_INPUT"
    ok "GitHub token accepted"
  elif [ -n "$GITHUB_INPUT" ]; then
    err "Token must start with 'ghp_' or 'github_pat_' — skipping GitHub"
  else
    info "Skipping GitHub — repo access will not be available in IDEs"
  fi
fi

# ─── Step 6: Write Continue config ─────────────────────────────────────────
info "Writing ~/.continue/config.yaml..."

# Build MCP servers block
MCP_BLOCK=""
RULES_BLOCK=""

if [ -n "$TAVILY_KEY" ] && [ -n "$GITHUB_TOKEN" ]; then
  MCP_BLOCK="
mcpServers:
  - name: tavily
    command: npx
    args: [-y, tavily-mcp@0.2.20]
    env:
      TAVILY_API_KEY: ${TAVILY_KEY}

  - name: github
    command: npx
    args: [-y, @modelcontextprotocol/server-github]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: ${GITHUB_TOKEN}
"
  RULES_BLOCK="# Rules — applied to every conversation
rules:
  - name: Use available tools
    rule: >
      Use tavily_search for live web data (weather, news, docs, prices).
      Use GitHub MCP tools for repo access (list PRs, search code, create issues).
      Prefer these tools over saying you can't access live data or repos."

elif [ -n "$TAVILY_KEY" ]; then
  MCP_BLOCK="
mcpServers:
  - name: tavily
    command: npx
    args: [-y, tavily-mcp@0.2.20]
    env:
      TAVILY_API_KEY: ${TAVILY_KEY}
"
  RULES_BLOCK="# Rules — applied to every conversation
rules:
  - name: Use Tavily for web search
    rule: >
      When you need live web data, use the tavily_search MCP tool.
      Always prefer it over saying \"I can't search the web\"."

elif [ -n "$GITHUB_TOKEN" ]; then
  MCP_BLOCK="
mcpServers:
  - name: github
    command: npx
    args: [-y, @modelcontextprotocol/server-github]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: ${GITHUB_TOKEN}
"
  RULES_BLOCK="# Rules — applied to every conversation
rules:
  - name: Use GitHub tools
    rule: >
      Use GitHub MCP tools to access repos, PRs, and issues when asked."

else
  RULES_BLOCK="# Rules — applied to every conversation
rules:
  - name: No live tools
    rule: >
      You don't have web search or GitHub tools configured. Tell the user directly
      if they ask for live data and suggest re-running install.sh to add them."
fi

cat > "$CONTINUE_CONFIG" <<YAML_EOF
name: Hyperspace Bridge
version: 1.2.0
schema: v1

# Route all Continue.dev AI through the local Hyperspace Bridge.
# Bridge endpoints: Ollama → localhost:11434 | OpenAI → localhost:11435/v1
# Upstream: Hai (SAP Hyperspace proxy) → Claude via Anthropic.

models:
  - name: Claude Sonnet (Hyperspace)
    provider: ollama
    model: claude-sonnet-latest
    apiBase: http://localhost:11434
    roles: [chat, edit, apply]
    defaultCompletionOptions:
      contextLength: 200000
      maxTokens: 8192

  - name: Claude Opus (Hyperspace)
    provider: ollama
    model: claude-opus-latest
    apiBase: http://localhost:11434
    roles: [chat, edit]
    defaultCompletionOptions:
      contextLength: 200000
      maxTokens: 8192

  - name: Claude Haiku (Hyperspace)
    provider: ollama
    model: claude-haiku-latest
    apiBase: http://localhost:11434
    roles: [chat, edit, autocomplete]
    defaultCompletionOptions:
      contextLength: 200000
      maxTokens: 4096

  - name: Claude Haiku Autocomplete
    provider: ollama
    model: claude-haiku-latest
    apiBase: http://localhost:11434
    roles: [autocomplete]
    defaultCompletionOptions:
      contextLength: 200000
      maxTokens: 256
      temperature: 0.1

  - name: Claude Sonnet (OpenAI path)
    provider: openai
    model: claude-sonnet-latest
    apiBase: http://localhost:11435/v1
    apiKey: sk-not-needed
    roles: [chat, edit]
    defaultCompletionOptions:
      contextLength: 200000
      maxTokens: 8192

context:
  - provider: code
  - provider: docs
  - provider: diff
  - provider: terminal
  - provider: problems
  - provider: folder
  - provider: codebase
${MCP_BLOCK}
${RULES_BLOCK}

docs: []
YAML_EOF

python3 -c "import yaml; yaml.safe_load(open('$CONTINUE_CONFIG'))" 2>/dev/null && \
  ok "~/.continue/config.yaml written" || \
  err "config.yaml may have a syntax issue — check it manually"

if [ -n "$TAVILY_KEY" ]; then
  ok "Tavily web search MCP configured"
  dim "Claude will use live web search in Agent mode"
fi

# ─── Step 7: Install IDE extensions ────────────────────────────────────────
# Continue.dev + YAML extension (required for Continue to function) in all
# detected IDEs. YAML extension is mandatory — without it Continue fails to
# register its config schema and Agent mode silently stops working.

install_extension() {
  local cli="$1" ide_name="$2" ext_id="$3"
  if [ ! -x "$cli" ]; then return; fi
  local existing
  existing="$("$cli" --list-extensions 2>/dev/null | grep -i "^${ext_id}$" || true)"
  if [ -n "$existing" ]; then
    ok "$ide_name: $ext_id already installed"
  else
    info "$ide_name: installing $ext_id..."
    "$cli" --install-extension "$ext_id" >/dev/null 2>&1 && \
      ok "$ide_name: $ext_id installed" || \
      err "$ide_name: failed to install $ext_id (install manually)"
  fi
}

CURSOR_CLI="/Applications/Cursor.app/Contents/Resources/app/bin/cursor"
ANTIGRAVITY_CLI="/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide"

for IDE_CLI in "$CURSOR_CLI" "$ANTIGRAVITY_CLI"; do
  [ ! -x "$IDE_CLI" ] && continue
  IDE_LABEL="$(basename "$(dirname "$(dirname "$(dirname "$IDE_CLI")")")" .app)"
  install_extension "$IDE_CLI" "$IDE_LABEL" "Continue.continue"
  install_extension "$IDE_CLI" "$IDE_LABEL" "redhat.vscode-yaml"
done

# ─── Step 8: Write the LaunchAgent plist ───────────────────────────────────
info "Writing LaunchAgent plist..."

TAVILY_PLIST_ENTRY=""
if [ -n "$TAVILY_KEY" ]; then
  TAVILY_PLIST_ENTRY="
		<key>TAVILY_API_KEY</key>
		<string>${TAVILY_KEY}</string>"
fi

cat > "$LAUNCH_AGENT" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>${LABEL}</string>
	<key>ProgramArguments</key>
	<array>
		<string>${NODE_BIN}</string>
		<string>${INSTALL_DIR}/hyperspace-bridge.js</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>KeepAlive</key>
	<true/>
	<key>StandardOutPath</key>
	<string>${LOG_FILE}</string>
	<key>StandardErrorPath</key>
	<string>${LOG_FILE}</string>
	<key>WorkingDirectory</key>
	<string>${INSTALL_DIR}</string>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>$(dirname "$NODE_BIN"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>${TAVILY_PLIST_ENTRY}
	</dict>
</dict>
</plist>
PLIST_EOF

if ! plutil -lint "$LAUNCH_AGENT" >/dev/null; then
  err "Generated plist is invalid"
  exit 1
fi
ok "LaunchAgent plist installed"

# ─── Step 9: Load agent ─────────────────────────────────────────────────────
info "Reloading agent..."
launchctl bootout "gui/${UID_NUM}/${LABEL}" 2>/dev/null || true
sleep 1
: > "$LOG_FILE"
launchctl bootstrap "gui/${UID_NUM}" "$LAUNCH_AGENT"
ok "Agent loaded"

# ─── Step 10: Health checks ──────────────────────────────────────────────────
info "Waiting for bridge to start..."
sleep 3

OK_OLLAMA=false
OK_OPENAI=false
if curl -sf --max-time 3 http://127.0.0.1:11434/health >/dev/null 2>&1; then
  ok "Ollama port 11434 is healthy"
  OK_OLLAMA=true
else
  err "Ollama port 11434 not responding"
fi
if curl -sf --max-time 3 http://127.0.0.1:11435/health >/dev/null 2>&1; then
  ok "OpenAI port 11435 is healthy"
  OK_OPENAI=true
else
  err "OpenAI port 11435 not responding"
fi

echo
if $OK_OLLAMA && $OK_OPENAI; then
  ok "Hyperspace Bridge is running."
  echo
  echo "  Configure your IDE — Continue.dev (Cursor / Antigravity / VS Code):"
  echo "      ~/.continue/config.yaml   ← already written"
  echo
  echo "  Zed:"
  echo "      Ollama endpoint:  localhost:11434"
  echo "      Model:            hyperspace"
  echo
  if [ -n "$TAVILY_KEY" ]; then
    echo "  Web search:  ✓ Tavily enabled — Claude can search the web in Agent mode"
  else
    echo "  Web search:  ✗ Not configured (re-run install.sh with a Tavily key)"
    echo "               Free key at: https://app.tavily.com"
  fi
  if [ -n "$GITHUB_TOKEN" ]; then
    echo "  GitHub:      ✓ Enabled — Claude can access repos, PRs, and issues"
  else
    echo "  GitHub:      ✗ Not configured (re-run install.sh with a GitHub token)"
  fi
  echo
  echo "  Logs:  $LOG_FILE"
  echo "  Stop:  launchctl bootout gui/$UID_NUM/$LABEL"
else
  err "Bridge did not come up cleanly. Check the log:"
  echo "   tail -50 $LOG_FILE"
  echo
  echo "Or run manually to see errors:"
  echo "   $NODE_BIN $INSTALL_DIR/hyperspace-bridge.js"
  exit 1
fi
