# Contributing

Thank you for contributing to Hyperspace Bridge!

## Development Setup

```bash
git clone https://github.com/YOUR_ORG/hyperspace-bridge.git
cd hyperspace-bridge

# Install the bridge in dev mode (no launchd, run manually)
node hyperspace-bridge.js

# Test
curl http://localhost:11434/health
curl http://localhost:11435/health
```

## Project Structure

```
hyperspace-bridge/
├── hyperspace-bridge.js     # Core bridge server (~860 lines, zero deps)
├── install.sh               # macOS installer (10 steps)
├── uninstall.sh             # Clean removal
├── com.hyperspace.bridge.plist  # launchd agent template
├── docs/
│   ├── guide.html           # Visual HTML guide
│   ├── INSTALL.md           # Installation guide
│   ├── FEATURES.md          # Features and usage
│   ├── TROUBLESHOOTING.md   # Debug guide
│   ├── FAQ.md               # Common questions
│   └── COMPATIBILITY.md     # IDE compatibility
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## Making Changes

### Bridge server (`hyperspace-bridge.js`)

The bridge has two servers in one process:
- **Port 11434** — Ollama protocol (`/api/chat`, `/api/generate`, `/api/tags`)
- **Port 11435** — OpenAI protocol (`/v1/chat/completions`, `/v1/models`)

Both translate to Anthropic Messages API and forward to Hai.

Key functions:
- `callHai()` — makes the upstream Anthropic request
- `handleSseLine()` — parses Anthropic SSE events
- `toAnthropicMessages()` — converts OpenAI/Ollama messages to Anthropic format
- `ollamaChunk()` / `openaiDeltaChunk()` — format response chunks

### Testing changes

```bash
# Syntax check
node --check hyperspace-bridge.js

# Start manually
node hyperspace-bridge.js

# Test Ollama endpoint
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"hyperspace","stream":false,"messages":[{"role":"user","content":"ping"}]}'

# Test OpenAI endpoint
curl -X POST http://localhost:11435/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"hyperspace","stream":false,"messages":[{"role":"user","content":"ping"}]}'
```

### Installer (`install.sh`)

- Written in bash, macOS only
- Must be idempotent (safe to re-run)
- Test with `bash -n install.sh` for syntax check

## Pull Request Guidelines

1. Keep changes focused — one PR per feature/fix
2. Update `CHANGELOG.md` with your changes under a new version header
3. Test the installer on a clean Mac if touching `install.sh`
4. Keep `hyperspace-bridge.js` dependency-free

## Reporting Issues

Include:
1. Output of `curl http://localhost:11434/health`
2. Last 20 lines of `~/Library/Logs/hyperspace-bridge.log`
3. macOS version (`sw_vers`)
4. Node.js version (`node --version`)
5. Steps to reproduce
