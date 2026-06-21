'use strict';

// hyperspace-bridge.js
// Local proxy bridge: Antigravity IDE ↔ Hai (Hyperspace AI) proxy
//
// Hai proxy speaks the Anthropic Messages API at http://localhost:6655/anthropic/v1/messages
// This bridge exposes two locally-bound translation endpoints so any IDE that speaks
// Ollama or OpenAI can talk to Claude through Hai:
//
//   Server A: 127.0.0.1:11434  (Ollama protocol)
//   Server B: 127.0.0.1:11435  (OpenAI protocol)
//
// Zero npm dependencies — built-in modules only.

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Hai proxy. Default matches `hai proxy start` (port 6655, /anthropic/ base path).
const HAI_BASE_URL = process.env.HAI_BASE_URL
                  || process.env.HYPERSPACE_URL
                  || 'http://localhost:6655/anthropic';

const OLLAMA_PORT = parseInt(process.env.OLLAMA_PORT || '11434', 10);
const OPENAI_PORT = parseInt(process.env.OPENAI_PORT || '11435', 10);

// API key auto-detection. Priority:
//   1. HAI_API_KEY env var
//   2. ANTHROPIC_AUTH_TOKEN env var
//   3. ~/.claude/settings.json → env.ANTHROPIC_AUTH_TOKEN
let HAI_API_KEY = process.env.HAI_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';
if (!HAI_API_KEY) {
  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings && settings.env && settings.env.ANTHROPIC_AUTH_TOKEN) {
        HAI_API_KEY = settings.env.ANTHROPIC_AUTH_TOKEN;
      }
    }
  } catch (_) { /* ignore — we'll surface the missing key at request time */ }
}

// Parse the Hai proxy URL once.
let haiHost, haiPort, haiBasePath;
try {
  const u = new URL(HAI_BASE_URL);
  haiHost     = u.hostname;                       // e.g. "localhost"
  haiPort     = u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 80);
  haiBasePath = u.pathname.replace(/\/$/, '');    // e.g. "/anthropic"
} catch (e) {
  console.error(`[bridge] Invalid HAI_BASE_URL: ${HAI_BASE_URL}`);
  process.exit(1);
}

// Default model when the caller doesn't specify or sends a generic name.
const DEFAULT_MODEL = process.env.HAI_DEFAULT_MODEL || 'claude-sonnet-latest';
const DEFAULT_MAX_TOKENS = 4096;

// Map common aliases callers might send to real Anthropic model IDs.
const MODEL_ALIASES = {
  'hyperspace':         DEFAULT_MODEL,
  'hyperspace:latest':  DEFAULT_MODEL,
  'claude':             DEFAULT_MODEL,
  'claude-3-5-sonnet':  'claude-sonnet-latest',
  'claude-3-5-sonnet-20241022': 'claude-sonnet-latest',
  'claude-sonnet':      'claude-sonnet-latest',
  'claude-haiku':       'claude-haiku-latest',
  'claude-opus':        'claude-opus-latest',
};

function resolveModel(name) {
  if (!name) return DEFAULT_MODEL;
  return MODEL_ALIASES[name] || name;
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(method, route, status, ms) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${method} ${route} → ${status} (${ms}ms)`);
}

function logErr(msg) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] [bridge] ${msg}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj, extraHeaders) {
  if (res.headersSent) return;
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }, extraHeaders || {}));
  res.end(JSON.stringify(obj));
}

function sendError(res, status, message, protocol) {
  if (res.headersSent) {
    try { res.end(); } catch (_) {}
    return;
  }
  if (protocol === 'openai') {
    sendJson(res, status, {
      error: { message, type: 'bridge_error', code: status },
    });
  } else if (protocol === 'ollama') {
    sendJson(res, status, { error: message });
  } else {
    sendJson(res, status, { error: message });
  }
}

// ---------------------------------------------------------------------------
// Anthropic message conversion
// ---------------------------------------------------------------------------

// Convert OpenAI/Ollama-style messages into Anthropic format.
//
// OpenAI/Ollama:
//   [{role:"system", content:"..."},
//    {role:"user", content:"..."},
//    {role:"assistant", content:"..."}]
//
// Anthropic:
//   { system: "...",
//     messages: [{role:"user", content:"..."}, {role:"assistant", content:"..."}] }
//
// Handles content as a string OR an OpenAI-style array of {type:"text", text:"..."}.
function toAnthropicMessages(rawMessages) {
  const messages = [];
  const systemParts = [];

  for (const m of (rawMessages || [])) {
    if (!m || !m.role) continue;
    const text = stringifyContent(m.content);
    if (m.role === 'system') {
      if (text) systemParts.push(text);
    } else if (m.role === 'user' || m.role === 'assistant') {
      messages.push({ role: m.role, content: text });
    }
    // Anthropic doesn't accept "tool" / "function" roles in this simple bridge.
  }

  // Anthropic requires the first message to be from "user" — if not, prepend one.
  if (messages.length === 0 || messages[0].role !== 'user') {
    messages.unshift({ role: 'user', content: '' });
  }

  return {
    system: systemParts.join('\n\n'),
    messages,
  };
}

function stringifyContent(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === 'string') return part;
      if (part && typeof part.text === 'string') return part.text;
      return '';
    }).join('');
  }
  return String(content);
}

// ---------------------------------------------------------------------------
// Hai upstream call
// ---------------------------------------------------------------------------

// Open a streaming or non-streaming POST to /anthropic/v1/messages.
// Calls handlers as data flows. handlers = { onStart, onText, onDone, onError }.
function callHai({ model, system, messages, maxTokens, stream }, handlers) {
  if (!HAI_API_KEY) {
    handlers.onError(new Error('No Hai API key found. Set HAI_API_KEY or run `hai configure claude-code`.'));
    return null;
  }

  const body = JSON.stringify({
    model: resolveModel(model),
    max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
    stream: !!stream,
    system: system || undefined,
    messages,
  });

  const options = {
    method: 'POST',
    hostname: haiHost,
    port: haiPort,
    path: haiBasePath + '/v1/messages',
    timeout: 120_000,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': HAI_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(body),
      'Accept': stream ? 'text/event-stream' : 'application/json',
    },
  };

  const req = http.request(options, (upstream) => {
    if (upstream.statusCode !== 200) {
      // Read the error body and surface it.
      const errChunks = [];
      upstream.on('data', c => errChunks.push(c));
      upstream.on('end', () => {
        const errBody = Buffer.concat(errChunks).toString('utf8');
        handlers.onError(new Error(`Hai ${upstream.statusCode}: ${errBody.slice(0, 500)}`), upstream.statusCode);
      });
      return;
    }

    handlers.onStart && handlers.onStart();

    if (stream) {
      // Parse Anthropic SSE stream. Each event is a block:
      //   event: content_block_delta\ndata: {...}\n\n
      // We only need the data lines; we handle the delta types we care about.
      let buffer = '';
      upstream.setEncoding('utf8');
      upstream.on('data', (chunk) => {
        buffer += chunk;
        let nlIdx;
        while ((nlIdx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx + 1);
          handleSseLine(line, handlers);
        }
      });
      upstream.on('end', () => {
        if (buffer.trim()) handleSseLine(buffer, handlers);
        handlers.onDone && handlers.onDone();
      });
      upstream.on('error', (err) => handlers.onError(err));
    } else {
      const chunks = [];
      upstream.on('data', c => chunks.push(c));
      upstream.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const parsed = JSON.parse(raw);
          // Anthropic non-streaming reply: { content: [{type:"text", text:"..."}], usage, stop_reason, ... }
          const text = (parsed.content || [])
            .filter(b => b && b.type === 'text')
            .map(b => b.text)
            .join('');
          handlers.onText && handlers.onText(text);
          handlers.onDone && handlers.onDone({
            stopReason: parsed.stop_reason,
            usage: parsed.usage,
            model: parsed.model,
          });
        } catch (e) {
          handlers.onError(e);
        }
      });
      upstream.on('error', (err) => handlers.onError(err));
    }
  });

  req.on('error', (err) => handlers.onError(err));
  req.on('timeout', () => req.destroy(new Error('Hai request timed out after 120s')));

  req.write(body);
  req.end();
  return req;
}

function handleSseLine(line, handlers) {
  // Anthropic SSE: "data: {json}" lines. We ignore the "event:" lines.
  if (!line || !line.startsWith('data:')) return;
  const json = line.slice(5).trim();
  if (!json) return;
  let parsed;
  try { parsed = JSON.parse(json); } catch (_) { return; }

  if (parsed.type === 'content_block_delta'
      && parsed.delta && parsed.delta.type === 'text_delta'
      && typeof parsed.delta.text === 'string') {
    handlers.onText && handlers.onText(parsed.delta.text);
  } else if (parsed.type === 'message_start' && parsed.message) {
    handlers.onMeta && handlers.onMeta({ model: parsed.message.model, id: parsed.message.id });
  } else if (parsed.type === 'message_delta') {
    handlers.onMeta && handlers.onMeta({ stopReason: parsed.delta && parsed.delta.stop_reason, usage: parsed.usage });
  }
  // message_stop is the natural end — onDone fires from the stream 'end' handler.
}

// ---------------------------------------------------------------------------
// Health check (does Hai answer?)
// ---------------------------------------------------------------------------

function pingHai() {
  return new Promise((resolve) => {
    const req = http.request({
      method: 'GET',
      hostname: haiHost,
      port: haiPort,
      path: '/',
      timeout: 3000,
    }, (res) => {
      // Drain
      res.on('data', () => {});
      res.on('end', () => resolve({ ok: res.statusCode < 500, status: res.statusCode }));
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.end();
  });
}

async function handleHealth(req, res, started, protocol) {
  const result = await pingHai();
  if (result.ok) {
    sendJson(res, 200, {
      status: 'ok',
      hai: 'reachable',
      hai_url: HAI_BASE_URL,
      api_key_configured: !!HAI_API_KEY,
    });
    log(req.method, req.url, 200, Date.now() - started);
  } else {
    sendJson(res, 503, {
      status: 'error',
      hai: 'unreachable',
      hai_url: HAI_BASE_URL,
      message: result.error || `HTTP ${result.status}`,
    });
    log(req.method, req.url, 503, Date.now() - started);
  }
}

// ---------------------------------------------------------------------------
// Server A — Ollama protocol (port 11434)
// ---------------------------------------------------------------------------

function ollamaTags() {
  return {
    models: [
      ollamaModelEntry('hyperspace:latest'),
      ollamaModelEntry('claude-sonnet-latest'),
      ollamaModelEntry('claude-haiku-latest'),
      ollamaModelEntry('claude-opus-latest'),
    ],
  };
}

function ollamaModelEntry(name) {
  return {
    name,
    model: name,
    modified_at: new Date().toISOString(),
    size: 0,
    digest: '',
    details: {
      parent_model: '',
      format: 'gguf',
      family: 'claude',
      families: ['claude'],
      parameter_size: '',
      quantization_level: '',
    },
  };
}

function ollamaChunk(model, contentDelta) {
  return JSON.stringify({
    model,
    created_at: new Date().toISOString(),
    message: { role: 'assistant', content: contentDelta },
    done: false,
  }) + '\n';
}

function ollamaFinalChunk(model, stopReason) {
  return JSON.stringify({
    model,
    created_at: new Date().toISOString(),
    message: { role: 'assistant', content: '' },
    done_reason: stopReason || 'stop',
    done: true,
    total_duration: 0,
    load_duration: 0,
    prompt_eval_count: 0,
    prompt_eval_duration: 0,
    eval_count: 0,
    eval_duration: 0,
  }) + '\n';
}

function ollamaGenChunk(model, response) {
  return JSON.stringify({
    model,
    created_at: new Date().toISOString(),
    response,
    done: false,
  }) + '\n';
}

function ollamaGenFinal(model, stopReason) {
  return JSON.stringify({
    model,
    created_at: new Date().toISOString(),
    response: '',
    done: true,
    done_reason: stopReason || 'stop',
    total_duration: 0,
    load_duration: 0,
    prompt_eval_count: 0,
    prompt_eval_duration: 0,
    eval_count: 0,
    eval_duration: 0,
  }) + '\n';
}

function handleOllamaChat(req, res, body, started) {
  const stream = body.stream !== false; // default true for /api/chat
  const modelIn = body.model || 'hyperspace:latest';
  const modelOut = resolveModel(modelIn);
  const { system, messages } = toAnthropicMessages(body.messages || []);
  const maxTokens = body.options && body.options.num_predict ? body.options.num_predict : DEFAULT_MAX_TOKENS;

  if (stream) {
    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    let stopReason = 'stop';
    callHai(
      { model: modelOut, system, messages, maxTokens, stream: true },
      {
        onText: (t) => { try { res.write(ollamaChunk(modelIn, t)); } catch (_) {} },
        onMeta: (m) => { if (m && m.stopReason) stopReason = m.stopReason; },
        onDone: () => {
          try { res.write(ollamaFinalChunk(modelIn, stopReason)); } catch (_) {}
          try { res.end(); } catch (_) {}
          log(req.method, req.url, 200, Date.now() - started);
        },
        onError: (err) => {
          logErr(err.message);
          try {
            if (!res.headersSent) sendError(res, 502, err.message, 'ollama');
            else { res.write(JSON.stringify({ error: err.message }) + '\n'); res.end(); }
          } catch (_) {}
          log(req.method, req.url, 502, Date.now() - started);
        },
      }
    );
  } else {
    let collected = '';
    let stopReason = 'stop';
    callHai(
      { model: modelOut, system, messages, maxTokens, stream: false },
      {
        onText: (t) => { collected += t; },
        onDone: (info) => {
          if (info && info.stopReason) stopReason = info.stopReason;
          sendJson(res, 200, {
            model: modelIn,
            created_at: new Date().toISOString(),
            message: { role: 'assistant', content: collected },
            done: true,
            done_reason: stopReason,
            total_duration: 0, load_duration: 0,
            prompt_eval_count: 0, prompt_eval_duration: 0,
            eval_count: 0, eval_duration: 0,
          });
          log(req.method, req.url, 200, Date.now() - started);
        },
        onError: (err) => {
          logErr(err.message);
          sendError(res, 502, err.message, 'ollama');
          log(req.method, req.url, 502, Date.now() - started);
        },
      }
    );
  }
}

function handleOllamaGenerate(req, res, body, started) {
  const stream = body.stream !== false;
  const modelIn = body.model || 'hyperspace:latest';
  const modelOut = resolveModel(modelIn);
  const promptText = stringifyContent(body.prompt) || '';
  const system = body.system || '';
  const maxTokens = body.options && body.options.num_predict ? body.options.num_predict : DEFAULT_MAX_TOKENS;
  const messages = [{ role: 'user', content: promptText }];

  if (stream) {
    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    let stopReason = 'stop';
    callHai(
      { model: modelOut, system, messages, maxTokens, stream: true },
      {
        onText: (t) => { try { res.write(ollamaGenChunk(modelIn, t)); } catch (_) {} },
        onMeta: (m) => { if (m && m.stopReason) stopReason = m.stopReason; },
        onDone: () => {
          try { res.write(ollamaGenFinal(modelIn, stopReason)); } catch (_) {}
          try { res.end(); } catch (_) {}
          log(req.method, req.url, 200, Date.now() - started);
        },
        onError: (err) => {
          logErr(err.message);
          try {
            if (!res.headersSent) sendError(res, 502, err.message, 'ollama');
            else { res.write(JSON.stringify({ error: err.message }) + '\n'); res.end(); }
          } catch (_) {}
          log(req.method, req.url, 502, Date.now() - started);
        },
      }
    );
  } else {
    let collected = '';
    let stopReason = 'stop';
    callHai(
      { model: modelOut, system, messages, maxTokens, stream: false },
      {
        onText: (t) => { collected += t; },
        onDone: (info) => {
          if (info && info.stopReason) stopReason = info.stopReason;
          sendJson(res, 200, {
            model: modelIn,
            created_at: new Date().toISOString(),
            response: collected,
            done: true,
            done_reason: stopReason,
            context: [],
            total_duration: 0, load_duration: 0,
            prompt_eval_count: 0, prompt_eval_duration: 0,
            eval_count: 0, eval_duration: 0,
          });
          log(req.method, req.url, 200, Date.now() - started);
        },
        onError: (err) => {
          logErr(err.message);
          sendError(res, 502, err.message, 'ollama');
          log(req.method, req.url, 502, Date.now() - started);
        },
      }
    );
  }
}

const ollamaServer = http.createServer(async (req, res) => {
  const started = Date.now();
  const { method, url } = req;

  // CORS preflight (some IDEs probe this).
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    res.end();
    return;
  }

  try {
    if (method === 'GET' && (url === '/' || url === '/api/version')) {
      sendJson(res, 200, { version: '0.1.0' });
      log(method, url, 200, Date.now() - started);
      return;
    }
    if (method === 'GET' && url === '/api/tags') {
      sendJson(res, 200, ollamaTags());
      log(method, url, 200, Date.now() - started);
      return;
    }
    if (method === 'GET' && url === '/api/ps') {
      sendJson(res, 200, { models: [] });
      log(method, url, 200, Date.now() - started);
      return;
    }
    if (method === 'GET' && url === '/health') {
      return handleHealth(req, res, started, 'ollama');
    }
    if (method === 'POST' && url === '/api/chat') {
      const body = await readJsonBody(req);
      return handleOllamaChat(req, res, body, started);
    }
    if (method === 'POST' && url === '/api/generate') {
      const body = await readJsonBody(req);
      return handleOllamaGenerate(req, res, body, started);
    }
    if (method === 'POST' && url === '/api/show') {
      const body = await readJsonBody(req);
      sendJson(res, 200, {
        license: '',
        modelfile: '',
        parameters: '',
        template: '',
        details: ollamaModelEntry(body.name || 'hyperspace:latest').details,
      });
      log(method, url, 200, Date.now() - started);
      return;
    }
    sendError(res, 404, `Not found: ${method} ${url}`, 'ollama');
    log(method, url, 404, Date.now() - started);
  } catch (err) {
    logErr(`Ollama handler error: ${err.message}`);
    sendError(res, 500, err.message, 'ollama');
    log(method, url, 500, Date.now() - started);
  }
});

// ---------------------------------------------------------------------------
// Server B — OpenAI protocol (port 11435)
// ---------------------------------------------------------------------------

function openaiModels() {
  const now = Math.floor(Date.now() / 1000);
  return {
    object: 'list',
    data: [
      { id: 'hyperspace',           object: 'model', created: now, owned_by: 'hyperspace' },
      { id: 'claude-sonnet-latest', object: 'model', created: now, owned_by: 'anthropic'  },
      { id: 'claude-haiku-latest',  object: 'model', created: now, owned_by: 'anthropic'  },
      { id: 'claude-opus-latest',   object: 'model', created: now, owned_by: 'anthropic'  },
    ],
  };
}

function openaiId() {
  return 'chatcmpl-' + Math.random().toString(36).slice(2, 12);
}

function openaiDeltaChunk(id, model, contentDelta, finishReason) {
  return 'data: ' + JSON.stringify({
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      delta: contentDelta == null ? {} : { content: contentDelta },
      finish_reason: finishReason || null,
    }],
  }) + '\n\n';
}

function openaiFullResponse(id, model, content, stopReason) {
  return {
    id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: mapStopReason(stopReason),
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

function mapStopReason(r) {
  if (r === 'end_turn' || !r) return 'stop';
  if (r === 'max_tokens') return 'length';
  return r;
}

function handleOpenAIChat(req, res, body, started) {
  const stream = !!body.stream;
  const modelIn = body.model || 'hyperspace';
  const modelOut = resolveModel(modelIn);
  const { system, messages } = toAnthropicMessages(body.messages || []);
  const maxTokens = body.max_tokens || DEFAULT_MAX_TOKENS;
  const id = openaiId();

  if (stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    });
    // First role-only chunk (OpenAI convention).
    try { res.write('data: ' + JSON.stringify({
      id, object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: modelIn,
      choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
    }) + '\n\n'); } catch (_) {}

    let stopReason = 'end_turn';
    callHai(
      { model: modelOut, system, messages, maxTokens, stream: true },
      {
        onText: (t) => { try { res.write(openaiDeltaChunk(id, modelIn, t, null)); } catch (_) {} },
        onMeta: (m) => { if (m && m.stopReason) stopReason = m.stopReason; },
        onDone: () => {
          try { res.write(openaiDeltaChunk(id, modelIn, null, mapStopReason(stopReason))); } catch (_) {}
          try { res.write('data: [DONE]\n\n'); } catch (_) {}
          try { res.end(); } catch (_) {}
          log(req.method, req.url, 200, Date.now() - started);
        },
        onError: (err) => {
          logErr(err.message);
          try {
            if (!res.headersSent) {
              sendError(res, 502, err.message, 'openai');
            } else {
              res.write('data: ' + JSON.stringify({ error: { message: err.message } }) + '\n\n');
              res.write('data: [DONE]\n\n');
              res.end();
            }
          } catch (_) {}
          log(req.method, req.url, 502, Date.now() - started);
        },
      }
    );
  } else {
    let collected = '';
    let stopReason = 'end_turn';
    callHai(
      { model: modelOut, system, messages, maxTokens, stream: false },
      {
        onText: (t) => { collected += t; },
        onDone: (info) => {
          if (info && info.stopReason) stopReason = info.stopReason;
          sendJson(res, 200, openaiFullResponse(id, modelIn, collected, stopReason));
          log(req.method, req.url, 200, Date.now() - started);
        },
        onError: (err) => {
          logErr(err.message);
          sendError(res, 502, err.message, 'openai');
          log(req.method, req.url, 502, Date.now() - started);
        },
      }
    );
  }
}

const openaiServer = http.createServer(async (req, res) => {
  const started = Date.now();
  const { method, url } = req;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    res.end();
    return;
  }

  try {
    if (method === 'GET' && (url === '/' || url === '/v1' || url === '/v1/')) {
      sendJson(res, 200, { name: 'hyperspace-bridge', version: '0.1.0' });
      log(method, url, 200, Date.now() - started);
      return;
    }
    if (method === 'GET' && url === '/v1/models') {
      sendJson(res, 200, openaiModels());
      log(method, url, 200, Date.now() - started);
      return;
    }
    if (method === 'GET' && url === '/health') {
      return handleHealth(req, res, started, 'openai');
    }
    if (method === 'POST' && url === '/v1/chat/completions') {
      const body = await readJsonBody(req);
      return handleOpenAIChat(req, res, body, started);
    }
    sendError(res, 404, `Not found: ${method} ${url}`, 'openai');
    log(method, url, 404, Date.now() - started);
  } catch (err) {
    logErr(`OpenAI handler error: ${err.message}`);
    sendError(res, 500, err.message, 'openai');
    log(method, url, 500, Date.now() - started);
  }
});

// ---------------------------------------------------------------------------
// Process-level safety nets
// ---------------------------------------------------------------------------

process.on('uncaughtException', (err) => {
  logErr(`uncaughtException: ${err && err.stack ? err.stack : err}`);
});
process.on('unhandledRejection', (err) => {
  logErr(`unhandledRejection: ${err && err.stack ? err.stack : err}`);
});

function shutdown() {
  console.log('[bridge] Bridge stopping.');
  ollamaServer.close(() => {
    openaiServer.close(() => process.exit(0));
  });
  // Hard exit after 5s in case sockets are stuck.
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

// ---------------------------------------------------------------------------
// Start both servers
// ---------------------------------------------------------------------------

let readyCount = 0;
function onReady() {
  if (++readyCount === 2) {
    console.log('Hyperspace Bridge running');
    console.log(`  Ollama   → http://127.0.0.1:${OLLAMA_PORT}`);
    console.log(`  OpenAI   → http://127.0.0.1:${OPENAI_PORT}`);
    console.log(`  Hai      → ${HAI_BASE_URL}`);
    console.log(`  API key  → ${HAI_API_KEY ? 'configured (' + HAI_API_KEY.slice(0, 8) + '…)' : 'NOT FOUND — set HAI_API_KEY'}`);
    console.log('Press Ctrl+C to stop.');
  }
}

ollamaServer.on('error', (e) => {
  console.error(`[bridge] Port ${OLLAMA_PORT} error: ${e.message}`);
  process.exit(1);
});
openaiServer.on('error', (e) => {
  console.error(`[bridge] Port ${OPENAI_PORT} error: ${e.message}`);
  process.exit(1);
});

ollamaServer.listen(OLLAMA_PORT, '127.0.0.1', onReady);
openaiServer.listen(OPENAI_PORT, '127.0.0.1', onReady);
