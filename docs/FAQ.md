# FAQ

## General

**Q: What is the Hyperspace Bridge?**
A: A local proxy that translates between AI IDE protocols (Ollama/OpenAI) and the Anthropic Messages API that Hai (SAP Hyperspace) speaks. It runs on your Mac and auto-starts on login.

**Q: Do I need an internet connection?**
A: Only for the Hai proxy's outbound calls to Anthropic. The bridge itself is local. Web search (Tavily) also requires internet.

**Q: Is my code/data safe?**
A: The bridge binds to `127.0.0.1` only — no LAN exposure. No code is logged or stored. All traffic goes through your existing Hai proxy, which uses the same path as Claude Code in Terminal.

**Q: Does it work on Intel Macs?**
A: Yes. The bridge is a Node.js script with no native binaries. It runs on any Mac that can run Node.js 18+.

**Q: Can I use it without Hai/Hyperspace?**
A: No. The bridge forwards all requests to Hai. You need a running `hai proxy start` instance.

---

## IDE Questions

**Q: Why can't I use Cursor's native Agent mode with the bridge?**
A: Cursor Agent routes through `cursor.sh` (Cursor's cloud). There is no configurable endpoint. Use **Continue** (⌘⇧L) instead — it has equivalent capabilities.

**Q: Why can't I use Antigravity's native Agent with the bridge?**
A: Antigravity's Agent uses Google Cloud Code Assist via gRPC — a different protocol entirely. Use **Continue** (⌘L) instead.

**Q: What's the difference between Continue and the native IDE agents?**
A: Continue is an open-source extension that runs inside the IDE but uses its own AI pipeline, which you can point anywhere. The native agents are closed products tied to each IDE's cloud subscription.

**Q: Why do I need the `redhat.vscode-yaml` extension?**
A: Continue requires it to register its `config.yaml` schema in the IDE settings. Without it, Continue's model backend silently fails to initialize and Agent mode does nothing.

**Q: Continue is installed but I don't see it in the sidebar.**
A: Fully quit the IDE (⌘Q) and relaunch — Continue activates on `onStartupFinished` and needs a fresh launch to appear.

---

## Models & Features

**Q: Which Claude model should I use?**
A: Start with **Claude Sonnet (Hyperspace)** — best balance of speed and capability. Use Opus for complex architecture decisions; Haiku for quick tasks and autocomplete.

**Q: Can I use Claude for code completion (Copilot-style)?**
A: Yes. Set `continue.enableTabAutocomplete: true` in IDE settings. Claude Haiku runs inline suggestions as you type.

**Q: Web search isn't working — it says "credits limitation".**
A: This is Continue's own cloud search failing. Make sure you have a Tavily key configured and **Agent** mode (not Chat) is selected. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

**Q: Can I use my own OpenAI key instead of Hyperspace?**
A: Yes — add an `openai` provider to `~/.continue/config.yaml` with your OpenAI key. The bridge isn't involved in that path.

---

## Maintenance

**Q: What happens when Continue updates?**
A: The CSS patch (Cursor-native styling) and the status bar patch (`extension.js`) are overwritten. Re-run `./install.sh` to re-apply them. The bridge itself is unaffected.

**Q: How do I update the bridge to a new version?**
A: Pull the latest code and re-run:
```bash
git pull
./install.sh
```

**Q: How do I remove everything?**
A: Run `./uninstall.sh`. This stops the bridge, removes the launchd agent, and removes `~/.hyperspace-bridge/`. Your `~/.continue/config.yaml` is kept.

**Q: Can multiple people share one bridge?**
A: No — and you don't need to. Each person runs `./install.sh` on their own Mac, connecting to their own Hai proxy. Nothing is shared.
