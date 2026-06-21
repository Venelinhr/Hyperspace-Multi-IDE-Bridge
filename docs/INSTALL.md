# Installation Guide

## Prerequisites

Before running the installer, ensure you have:

1. **macOS 13+** (Ventura or later)
2. **Node.js 18+** — check with `node --version`
   - Install via Homebrew: `brew install node`
   - Or via nvm: `nvm install --lts`
3. **Hai proxy installed and authenticated**:
   ```bash
   # Check if hai is installed
   hai --version
   
   # Start the proxy
   hai proxy start
   
   # Configure for Claude Code (if not done yet)
   hai configure claude-code
   ```

## Install

```bash
git clone https://github.com/YOUR_ORG/hyperspace-bridge.git
cd hyperspace-bridge
./install.sh
```

## What the installer does (10 steps)

| Step | Action |
|---|---|
| 1 | Detects Node.js — nvm, Homebrew, or system |
| 2 | Creates `~/.hyperspace-bridge/` and support dirs |
| 3 | Copies `hyperspace-bridge.js` to install location |
| 4 | Auto-detects Hai API key from `~/.claude/settings.json` |
| 5 | Prompts for Tavily web search key (optional, free) |
| 6 | Prompts for GitHub token (optional) |
| 7 | Writes `~/.continue/config.yaml` with all models + MCP servers |
| 8 | Installs Continue.dev + YAML extension in Cursor/Antigravity |
| 9 | Writes and loads the launchd agent (auto-start on login) |
| 10 | Health checks both ports and reports status |

## Re-running the installer

The installer is **idempotent** — safe to run multiple times. Re-run it to:
- Add a Tavily key you skipped initially
- Add a GitHub token
- Update the bridge after a new release
- Fix a broken installation

```bash
./install.sh
```

## Uninstall

```bash
./uninstall.sh
```

This stops the bridge, removes the launchd agent, and removes `~/.hyperspace-bridge/`. Your `~/.continue/config.yaml` is preserved.

## Manual installation (if the script doesn't work)

```bash
# 1. Copy bridge
mkdir -p ~/.hyperspace-bridge
cp hyperspace-bridge.js ~/.hyperspace-bridge/

# 2. Find your Node.js path
which node   # copy this path

# 3. Edit the plist — replace NODE_PATH and USERNAME
sed -e "s|NODE_PATH|$(which node)|g" \
    -e "s|USERNAME|$(whoami)|g" \
    com.hyperspace.bridge.plist > \
    ~/Library/LaunchAgents/com.hyperspace.bridge.plist

# 4. Load
launchctl bootstrap gui/$(id -u) \
  ~/Library/LaunchAgents/com.hyperspace.bridge.plist

# 5. Verify
curl http://localhost:11434/health
```
