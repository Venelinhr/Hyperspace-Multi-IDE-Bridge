# Troubleshooting

## Quick diagnostics

```bash
# 1. Is the bridge running?
curl http://localhost:11434/health

# 2. View logs
tail -50 ~/Library/Logs/hyperspace-bridge.log

# 3. Is Hai running?
hai proxy start --headless &
curl http://localhost:6655/
```

---

## Common Issues

### Bridge not responding

**Symptom:** `curl http://localhost:11434/health` times out or refuses connection.

**Fix:**
```bash
# Restart the bridge
launchctl bootout gui/$(id -u)/com.hyperspace.bridge 2>/dev/null || true
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.hyperspace.bridge.plist
sleep 3
curl http://localhost:11434/health
```

If it still fails, check the log:
```bash
tail -20 ~/Library/Logs/hyperspace-bridge.log
```

---

### `env: node: No such file or directory` in log

**Cause:** Node.js is installed via nvm but the launchd plist uses `/usr/bin/env node`, which can't find nvm's Node.

**Fix:** Re-run the installer. It detects the absolute Node path:
```bash
./install.sh
```

---

### `api_key_configured: false` in health response

**Cause:** The bridge can't find your Hai API key.

**Fix:**
```bash
# Re-run Hai configuration
hai configure claude-code

# Or set it manually
export HAI_API_KEY=your-key-here
./install.sh
```

---

### Continue not sending requests (Agent mode silent)

**Symptom:** You type in Continue and nothing happens. Bridge log shows only health checks, no `POST /api/chat`.

**Cause:** Missing `redhat.vscode-yaml` extension — Continue can't register its config schema without it.

**Fix:**
```bash
# Cursor:
"/Applications/Cursor.app/Contents/Resources/app/bin/cursor" \
  --install-extension redhat.vscode-yaml

# Antigravity:
"/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide" \
  --install-extension redhat.vscode-yaml
```
Then restart the IDE.

---

### Rainbow gradient fills the message bubble (Cursor)

**Cause:** Cursor's theme leaves `--vscode-input-background` unset, causing Continue's inner editor mask to be transparent.

**Fix:** Already patched in the Continue CSS via `install.sh`. If it reappears after a Continue update, re-run:
```bash
./install.sh
```

---

### Tavily search fails — "service error" or "credits limitation"

**Cause:** Wrong Tavily package version or expired key.

**Fix:**
```bash
# Test your key directly
curl -X POST https://api.tavily.com/search \
  -H "Content-Type: application/json" \
  -d '{"api_key":"YOUR_KEY","query":"test","max_results":1}'

# Pre-cache the correct version
TAVILY_API_KEY=your-key npx -y tavily-mcp@0.2.20
```

---

### `409 Conflict` errors in Cursor MCP log

**Cause:** The Claude Code Telegram MCP plugin running simultaneously in Cursor. This is a known conflict with the Claude Code plugin — it doesn't affect the bridge or Continue.

**Not a bug** — these errors come from a different process and don't impact chat functionality.

---

### `launchctl` returns "permission denied"

**Cause:** The plist file has a `com.apple.provenance` extended attribute from being downloaded.

**Fix:** Re-run `./install.sh` — it writes the plist fresh via shell heredoc, bypassing the quarantine attribute.

---

### Hai proxy not running

```bash
# Start it (runs in foreground)
hai proxy start

# Or background
hai proxy start --headless &

# Verify
curl http://localhost:6655/
# Should return: {"message":"Local Hai Proxy is running!"}
```

---

## Log locations

| Log | Path |
|---|---|
| Bridge | `~/Library/Logs/hyperspace-bridge.log` |
| Cursor MCP | `~/Library/Application Support/Cursor/logs/[date]/mcpprocess.log` |
| Continue (Cursor) | `~/Library/Application Support/Cursor/logs/[date]/window1/renderer.log` |
| Antigravity MCP | `~/Library/Application Support/Antigravity IDE/logs/[date]/mcpprocess.log` |

---

## Full reset

```bash
./uninstall.sh
./install.sh
```
