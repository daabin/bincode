#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Agent } from './agent.js';
import { getApiKey, getBaseUrl, getModel } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve the public directory relative to this file (works for both dev and dist)
const PUBLIC_DIR = join(__dirname, '..', 'public');

const app = express();
app.use(express.json());

// Serve the frontend
app.use(express.static(PUBLIC_DIR));

// In-memory session store: sessionId -> Agent
const sessions = new Map<string, Agent>();

function makeAgent(): Agent {
  return new Agent({
    cwd: process.cwd(),
    apiKey: getApiKey() || '',
    baseUrl: getBaseUrl(),
    model: getModel(),
    maxIterations: 30
  });
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
  const sessionId = (clientSessionId && sessions.has(clientSessionId))
    ? clientSessionId
    : generateId();

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, makeAgent());
  }

  const agent = sessions.get(sessionId)!;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // First event: session assignment
  send({ type: 'session', sessionId });

  (async () => {
    try {
      for await (const event of agent.run(message.trim())) {
        send(event);
      }
      send({ type: 'done' });
    } catch (err) {
      send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      res.end();
    }
  })();

  // Clean up if client disconnects
  req.on('close', () => res.end());
});

/**
 * DELETE /api/session/:id — remove a session from memory
 */
app.delete('/api/session/:id', (req, res) => {
  const { id } = req.params;
  sessions.delete(id);
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
