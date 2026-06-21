# IDE Compatibility

## Summary

| IDE | Native AI usable with bridge? | Solution | Status |
|---|---|---|---|
| **Cursor** | ❌ Cursor Agent locked to cursor.sh | Continue.dev sidebar | ✅ Fully working |
| **Antigravity IDE** | ❌ Native Agent uses Google gRPC | Continue.dev sidebar | ✅ Fully working |
| **Zed** | ✅ Native Ollama integration | Built-in language_models config | ✅ Fully working |
| **VS Code** | ❌ Copilot locked to GitHub | Continue.dev or Cline extension | ✅ Fully working |
| **JetBrains** | Partial | AI Assistant with custom endpoint | ✅ Works with OpenAI port |

---

## Cursor

**Version tested:** 3.8.x  
**Method:** Continue.dev extension (v2.0.0)  
**Shortcut:** ⌘⇧L

Cursor's native Agent panel ("New Agent / Automations / Customize") routes through `cursor.sh` — this cannot be redirected. The bridge provides a full alternative via Continue's sidebar.

**Requirements:**
- `Continue.continue` extension (installed by `./install.sh`)
- `redhat.vscode-yaml` extension (installed by `./install.sh`) — **required for Agent mode to work**
- Custom CSS patch (applied by `./install.sh`) — matches Cursor's native look

**Status bar:** Green "Hyperspace" text appears next to "Continue (NE)" when bridge is live.

---

## Antigravity IDE

**Version tested:** 1.107.x (Google Labs)  
**Method:** Continue.dev extension (v2.0.0)  
**Shortcut:** ⌘L

Antigravity's built-in Agent uses Google Cloud Code Assist (`daily-cloudcode-pa.googleapis.com`) via gRPC-Connect with Google's proprietary Protobuf schema. This protocol cannot be redirected.

Continue provides equivalent functionality via the sidebar.

**Note:** Antigravity's native Agent already uses Claude Sonnet 4.6 (via Google's hosted Claude). If you prefer to use that, it works independently of the bridge.

---

## Zed

**Version tested:** 0.1xx  
**Method:** Native `language_models.ollama` config  
**Shortcut:** ⌘? (Assistant panel)

Zed has first-class support for Ollama and OpenAI-compatible endpoints. No extension required — just add the `language_models` config to `~/.config/zed/settings.json`.

```json
{
  "language_models": {
    "ollama": {
      "api_url": "http://localhost:11434",
      "available_models": [
        {
          "name": "hyperspace",
          "display_name": "Claude (via Hyperspace)",
          "max_tokens": 200000
        }
      ]
    }
  },
  "agent": {
    "default_model": { "provider": "ollama", "model": "hyperspace" }
  }
}
```

---

## VS Code

**Method:** Continue.dev or Cline extension  
**Config:** Same `~/.continue/config.yaml` works automatically

---

## JetBrains (IntelliJ, WebStorm, etc.)

**Method:** AI Assistant with OpenAI-compatible endpoint  
**Config:** Settings → AI Assistant → Custom OpenAI endpoint → `http://localhost:11435/v1`

---

## Any tool with `OPENAI_BASE_URL`

```bash
export OPENAI_BASE_URL=http://localhost:11435/v1
export OPENAI_API_KEY=sk-not-needed
```
