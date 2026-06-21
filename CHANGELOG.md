# Changelog

All notable changes are documented here.

---

## [1.3.0] — 2026-06-21

### Added
- **Hyperspace status indicator** — green "Hyperspace" text in IDE status bar (next to "Continue") when bridge is live; disappears when offline
- **GitHub MCP integration** — Claude can access repos, PRs, issues, and code search with a GitHub token
- **Tavily web search MCP** — live web search in Agent mode (1,000 searches/month free)
- **YAML extension auto-install** — `install.sh` now installs `redhat.vscode-yaml` which is required for Continue's Agent mode to function
- Continue.dev extension auto-install in all detected IDEs (Cursor + Antigravity)
- Status bar polling every 15 seconds — instant feedback on bridge connectivity

### Fixed
- Agent mode silent failure when `redhat.vscode-yaml` was missing — root cause identified and fixed in installer
- Rainbow gradient filling message bubble in Cursor — `--vscode-input-background` CSS variable override
- Continue model picker items appearing transparent/dimmed — Tailwind opacity utility class overrides
- Mode dropdown overlapping "Last Session" text — opaque popover background
- Toolbar pill height not matching Cursor native — `data-testid` targeted CSS overrides
- `launchctl load` permission denied error — switched to modern `bootstrap`/`bootout` syntax
- `env: node: No such file or directory` in launchd — installer now resolves absolute Node path (nvm-compatible)
- Tavily MCP server version `0.1.4` failing — upgraded to `0.2.20`

### Changed
- `install.sh` expanded from 5 to 10 steps covering full IDE setup
- Continue config template upgraded to v1.2.0 with MCP servers block

---

## [1.2.0] — 2026-06-21 (early)

### Added
- Continue.dev integration for Cursor and Antigravity
- `~/.continue/config.yaml` auto-written by installer
- Mac-friendly keybindings (⌘L, ⌘I, ⌘⇧L)
- Custom CSS patch for Continue UI — Cursor-native styling

### Fixed
- Hyperspace URL parsing bug (`localhost:6655bd-...` was not valid) — bridge now correctly targets `localhost:6655`
- Upstream protocol mismatch — bridge was sending OpenAI format to Hai which speaks Anthropic format
- API key not included in requests
- `launchctl load` deprecated syntax warnings

---

## [1.1.0] — 2026-06-20 (late)

### Added
- OpenAI-compatible endpoint on port `:11435`
- Dual-server architecture (Ollama `:11434` + OpenAI `:11435`)
- Streaming SSE passthrough with no buffering
- Zed `settings.json` configuration
- `install.sh` with launchd registration
- `uninstall.sh` for clean removal
- `com.hyperspace.bridge.plist` with KeepAlive for crash recovery

### Fixed
- Duplicate `[DONE]` SSE sentinel on OpenAI streaming path
- Startup banner printing before both servers were ready
- SIGTERM/SIGINT not closing HTTP servers before `process.exit`

---

## [1.0.0] — 2026-06-20

### Initial release
- Single-file Node.js bridge, zero npm dependencies
- Ollama-compatible endpoint on port `:11434`
- Anthropic Messages API translation
- Auto-detect HAI_API_KEY from `~/.claude/settings.json`
- 127.0.0.1 binding for LAN isolation
- macOS launchd auto-start
