# Features & Usage Examples

## Available Models

| Model name | Upstream | Best for |
|---|---|---|
| `claude-sonnet-latest` | Claude Sonnet 4.5 | Default — chat, code, edits |
| `claude-opus-latest` | Claude Opus | Complex reasoning, architecture |
| `claude-haiku-latest` | Claude Haiku | Fast tasks, autocomplete |
| `hyperspace` | → Sonnet | Generic alias |

## Capabilities

### Coding & Development

**Chat about code:**
```
Explain what this function does: [paste code]
```

**Inline edit (⌘I in Cursor/Antigravity):**
Select a function → press ⌘I → describe the change:
```
Refactor this to use async/await instead of callbacks
```

**Multi-file agent (Agent mode):**
```
Add unit tests for all functions in src/utils/
```

**Debugging:**
```
@Terminal [paste error output] — what's causing this and how do I fix it?
```

**Refactoring:**
```
@Codebase Find all places where we directly mutate state and refactor to immutable patterns
```

### Web Search (requires Tavily key)

In **Agent** mode, Claude searches the web automatically:
```
What's the latest version of React and what changed?
What are the current best practices for JWT auth in Node.js?
```

### GitHub Access (requires GitHub token)

With the GitHub MCP configured:
```
List open PRs in this repo
Show me the diff for PR #42
Create an issue: "Bug: login fails on Safari"
Search for similar issues to this error: [paste error]
```

### Context Providers

Use `@` to attach context in Continue:

| Command | What it provides |
|---|---|
| `@File src/app.ts` | Full file content |
| `@Codebase` | Semantic search across repo |
| `@Diff` | Current git diff |
| `@Terminal` | Last terminal output |
| `@Problems` | VS Code lint/type errors |
| `@Docs` | Fetches documentation URL |
| `@Folder src/` | All files in a folder |

### Autocomplete

Haiku runs inline autocomplete as you type. In Cursor settings:
```json
"continue.enableTabAutocomplete": true
```

## Workflow Examples

### Debugging a production error
```
@Terminal
[paste stack trace]

Explain this error, identify the root cause, and suggest a fix.
```

### Code review
```
@Diff

Review these changes. Focus on: correctness, edge cases, and performance. 
Be specific about what line numbers have issues.
```

### Starting a new feature
```
I need to add user authentication to this Express app.
@Folder src/
@File package.json

Suggest an approach, then implement it step by step.
```

### Research + implement
```
What's the best way to implement rate limiting in Node.js in 2026?
After you research, implement it in @File src/middleware/rateLimiter.ts
```
