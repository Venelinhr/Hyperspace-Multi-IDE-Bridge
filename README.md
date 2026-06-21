# Hyperspace Bridge

> Connect Cursor, Antigravity IDE, and Zed to Claude via your local **SAP Hyperspace (Hai) proxy** — with live web search, GitHub access, and full coding capabilities.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![macOS](https://img.shields.io/badge/macOS-13%2B-brightgreen)](https://www.apple.com/macos/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

---

## What is this?

The **Hyperspace Bridge** is a lightweight local proxy that makes Claude available inside any Ollama or OpenAI-compatible IDE. It translates between the IDE's expected API format and the Anthropic Messages API that Hyperspace (Hai) speaks — with zero configuration required after installation.

```
Your IDE (Cursor / Antigravity / Zed)
         ↓  Ollama or OpenAI format
  Hyperspace Bridge  (:11434 / :11435)
         ↓  Anthropic Messages API
   Hai proxy  (:6655)
         ↓  Anthropic relay
  Claude (Sonnet / Haiku / Opus)
         +  Web search via Tavily
         +  GitHub via MCP
```

## Features

| Feature | Status |
|---|---|
| Claude Sonnet, Haiku, Opus via Hyperspace | ✅ |
| Cursor — Continue sidebar | ✅ |
| Antigravity IDE — Continue sidebar | ✅ |
| Zed — native Ollama integration | ✅ |
| Live web search (Tavily MCP) | ✅ optional |
| GitHub MCP (repo access) | ✅ optional |
| Auto-detect Hai API key | ✅ |
| Auto-detect Node.js (nvm / Homebrew / system) | ✅ |
| Auto-start on login (launchd) | ✅ |
| Hyperspace status indicator in IDE | ✅ |
| 127.0.0.1 only — LAN-isolated | ✅ |
| Zero npm dependencies (bridge itself) | ✅ |

## Quick Start

```bash
# 1. Clone
git clone https://github.com/YOUR_ORG/hyperspace-bridge.git
cd hyperspace-bridge

# 2. Install (one command — detects everything automatically)
./install.sh

# 3. Open your IDE, press ⌘L (Cursor/Antigravity) or ⌘? (Zed) — Claude is ready
```

## Requirements

- macOS 13+
- Node.js 18+ (`brew install node` or nvm)
- [Hai proxy](https://github.com/sap/hai) running locally (`hai proxy start`)
- `hai configure claude-code` already run once

## Documentation

| Doc | Description |
|---|---|
| [docs/INSTALL.md](docs/INSTALL.md) | Detailed installation guide |
| [docs/SETUP.md](docs/SETUP.md) | Initial setup and auto-detection |
| [docs/FEATURES.md](docs/FEATURES.md) | Full feature list with usage examples |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and solutions |
| [docs/FAQ.md](docs/FAQ.md) | Frequently asked questions |
| [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) | IDE compatibility details |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |

For a visual guide, see [docs/guide.html](docs/guide.html) — open it in your browser.

## IDE Configuration Summary

### Cursor / Antigravity IDE
The installer sets everything up automatically via the Continue.dev extension.
- Open Continue: **⌘⇧L** (Cursor) or **⌘L** (Antigravity)
- Switch to **Agent** mode for full capabilities

### Zed
Add to `~/.config/zed/settings.json`:
```json
"language_models": {
  "ollama": {
    "api_url": "http://localhost:11434",
    "available_models": [
      { "name": "hyperspace", "display_name": "Claude (via Hyperspace)", "max_tokens": 200000 }
    ]
  }
},
"agent": {
  "default_model": { "provider": "ollama", "model": "hyperspace" }
}
```
Open Assistant: **⌘?**

## Optional Add-ons

### Web Search (Tavily)
The installer prompts for a Tavily API key. Free tier: 1,000 searches/month.
Get a key at [app.tavily.com](https://app.tavily.com).

### GitHub Access (MCP)
Set your GitHub token and the installer adds it automatically:
```bash
export GITHUB_TOKEN=ghp_your_token
./install.sh
```

## Team Sharing

Each teammate runs `./install.sh` on their own Mac. The script:
1. Detects Node.js (nvm, Homebrew, system)
2. Detects the Hai API key from `~/.claude/settings.json`
3. Prompts for optional Tavily and GitHub tokens
4. Installs Continue.dev + YAML extension in all detected IDEs
5. Registers the bridge as a launchd agent (auto-starts on login)
6. Runs health checks and reports status

No shared server. Each person uses their own Hai proxy.

## License

MIT — see [LICENSE](LICENSE)

## Acknowledgements

Built on top of [SAP Hai CLI](https://github.com/sap/hai) and [Continue.dev](https://continue.dev).
