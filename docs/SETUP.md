# Initial Setup & Auto-Detection

## How auto-detection works

The bridge finds your Hyperspace configuration automatically — no manual setup required.

### 1. Hai API key detection

The installer looks in this order:

```
$HAI_API_KEY       ← environment variable (highest priority)
$ANTHROPIC_AUTH_TOKEN ← environment variable
~/.claude/settings.json → env.ANTHROPIC_AUTH_TOKEN  ← written by `hai configure claude-code`
```

If `hai configure claude-code` has been run (standard Hyperspace setup), the key is already in `~/.claude/settings.json` and is picked up automatically.

### 2. Hai proxy URL detection

The bridge defaults to `http://localhost:6655/anthropic` — the standard address for `hai proxy start`. You can override:

```bash
HAI_BASE_URL=http://localhost:YOUR_PORT/anthropic ./install.sh
```

Or after install, set the env var in the plist:
```bash
# Edit ~/Library/LaunchAgents/com.hyperspace.bridge.plist
# Add inside EnvironmentVariables dict:
# <key>HAI_BASE_URL</key>
# <string>http://localhost:YOUR_PORT/anthropic</string>
```

### 3. Node.js detection

The installer resolves Node in this order:
1. `command -v node` (whatever's in your PATH)
2. `/opt/homebrew/bin/node` (Homebrew)
3. `/usr/local/bin/node` (legacy Homebrew / system)

It then resolves symlinks (important for nvm) to get the **absolute path**, which is embedded in the launchd plist. This ensures Node is found even when launchd starts the bridge with a minimal PATH.

## Expected install flow

```
$ ./install.sh

Hyperspace Bridge — installer
──────────────────────────────
ℹ Looking for Node.js...
✓ Node.js found: v24.x.x
  /Users/you/.nvm/versions/node/v24.x.x/bin/node

ℹ Creating ~/.hyperspace-bridge...
✓ Directories ready

ℹ Copying hyperspace-bridge.js...
✓ Bridge installed

✓ Hai API key found (~/.claude/settings.json)

─── Web Search (Tavily MCP) ───────────────────────────────
   Free tier: 1,000 searches/month
   Get a free key at: https://app.tavily.com

? Enter your Tavily API key (or press Enter to skip):
   Key (tvly-...): tvly-your-key

✓ Tavily key accepted

─── GitHub Access (GitHub MCP) ────────────────────────────
? Enter your GitHub token (or press Enter to skip):
   Token (ghp_...): ghp_your-token

✓ GitHub token accepted

ℹ Writing ~/.continue/config.yaml...
✓ ~/.continue/config.yaml written
✓ Tavily web search MCP configured
✓ GitHub MCP configured

ℹ Installing IDE extensions...
✓ Cursor: Continue.continue installed
✓ Cursor: redhat.vscode-yaml installed
✓ Antigravity IDE: Continue.continue installed
✓ Antigravity IDE: redhat.vscode-yaml installed

ℹ Writing LaunchAgent plist...
✓ LaunchAgent plist installed

ℹ Reloading agent...
✓ Agent loaded

ℹ Waiting for bridge to start...
✓ Ollama port 11434 is healthy
✓ OpenAI port 11435 is healthy

✓ Hyperspace Bridge is running.

  Configure your IDE — Continue.dev (Cursor / Antigravity / VS Code):
      ~/.continue/config.yaml   ← already written

  Zed:
      Ollama endpoint:  localhost:11434
      Model:            hyperspace

  Web search:  ✓ Tavily enabled
  GitHub:      ✓ Enabled

  Logs: ~/Library/Logs/hyperspace-bridge.log
```

## After install — what to do

1. **Cursor / Antigravity:** Restart the IDE → press ⌘L or ⌘⇧L → Continue sidebar opens → pick Agent mode → start chatting

2. **Zed:** Add the `language_models` config → press ⌘? → pick "Claude (via Hyperspace)"

3. **Verify:** The status bar shows green **"Hyperspace"** text next to "Continue (NE)" when the bridge is live
