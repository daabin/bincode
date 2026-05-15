#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Agent, createAgent } from '../../core/index.js';
import { getApiKey, getModel, getBaseUrl } from '../../config/index.js';
import {
  listSessions,
  loadSession,
  saveSession,
  updateSession,
  createSession,
  type SessionData
} from '../../session.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve the public directory relative to this file (works for both dev and dist)
const PUBLIC_DIR = join(__dirname, '..', '..', '..', 'public');

const app = express();
app.use(express.json());

// Serve the frontend
app.use(express.static(PUBLIC_DIR));

// In-memory session store: sessionId -> Agent
const sessions = new Map<string, Agent>();
// Session data store: sessionId -> SessionData (for persistence)
const sessionData = new Map<string, SessionData>();

function makeAgent(initialMessages?: SessionData['messages']): Agent {
  return createAgent({ initialMessages });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * POST /api/chat
 * Body: { message: string, sessionId?: string }
 * Returns: SSE stream of AgentEvent objects, preceded by a `session` event
 */
app.post('/api/chat', (req, res) => {
  const { message, sessionId: clientSessionId } = req.body as {
    message?: string;
    sessionId?: string;
  };

  if (!message || typeof message !== 'string' || message.trim() === '') {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json({
      error: 'DEEPSEEK_API_KEY is not set. Set the environment variable or use /setkey in the CLI.'
    });
    return;
  }

  // Resolve or create session
  let sessionId: string;
  if (clientSessionId && sessions.has(clientSessionId)) {
    sessionId = clientSessionId;
  } else if (clientSessionId) {
    // Try to restore from disk
    const persisted = loadSession(clientSessionId);
    if (persisted) {
      sessionId = clientSessionId;
      const agent = makeAgent(persisted.messages);
      sessions.set(sessionId, agent);
      sessionData.set(sessionId, persisted);
    } else {
      sessionId = generateId();
    }
  } else {
    sessionId = generateId();
  }

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, makeAgent());
    const model = getModel();
    const session = createSession('deepseek', model);
    // Override the auto-generated ID with our sessionId
    sessionData.set(sessionId, { ...session, meta: { ...session.meta, id: sessionId } });
  }

  const agent = sessions.get(sessionId)!;
  let data = sessionData.get(sessionId);
  if (!data) {
    const model = getModel();
    const session = createSession('deepseek', model);
    data = { ...session, meta: { ...session.meta, id: sessionId } };
    sessionData.set(sessionId, data);
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (payload: object) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // First event: session assignment
  send({ type: 'session', sessionId });

  let aborted = false;

  (async () => {
    try {
      for await (const event of agent.run(message.trim())) {
        if (aborted) break;
        send(event);

        if (event.type === 'done') {
          // Persist session after each completed turn
          try {
            const messages = agent.getConversation().getMessages();
            const updated = updateSession(data!, messages);
            sessionData.set(sessionId, updated);
            saveSession(updated);
          } catch {
            // Non-fatal
          }
        }
      }
      send({ type: 'done' });
    } catch (err) {
      send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      if (!res.writableEnded) res.end();
    }
  })();

  // Clean up if client disconnects (listen on res, not req)
  res.on('close', () => { aborted = true; });
});

/**
 * GET /api/sessions — list all persisted sessions (most recent first)
 */
app.get('/api/sessions', (_req, res) => {
  res.json(listSessions());
});

/**
 * GET /api/session/:id — get full session data (messages)
 */
app.get('/api/session/:id', (req, res) => {
  const session = loadSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});

/**
 * DELETE /api/session/:id — remove a session from memory and disk
 */
app.delete('/api/session/:id', (req, res) => {
  const { id } = req.params;
  sessions.delete(id);
  sessionData.delete(id);
  res.json({ deleted: id });
});

// SPA fallback: serve index.html for any unmatched route
app.get('/{*path}', (_req, res) => {
  try {
    const html = readFileSync(join(PUBLIC_DIR, 'index.html'), 'utf-8');
    res.type('html').send(html);
  } catch {
    res.status(404).send('Not found');
  }
});

const PORT = Number(process.env.PORT || 3000);
const server = createServer(app);

server.listen(PORT, () => {
  console.log(`\n🚀 bincode web server running at http://localhost:${PORT}\n`);
  console.log('  DEEPSEEK_API_KEY:', getApiKey() ? '✓ set' : '✗ not set (required)');
  console.log('  Model:', getModel());
  console.log('  Base URL:', getBaseUrl());
  console.log('\nPress Ctrl+C to stop.\n');
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Set PORT=<other> to use a different port.`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});
