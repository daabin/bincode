#!/usr/bin/env node
/**
 * bincode Web Server Entry Point
 *
 * Starts the Express server for the web interface.
 * Provides REST API and Server-Sent Events for agent communication.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Agent, createAgent } from './core/index.js';
import { getApiKey, getModel, getBaseUrl } from './config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

const sessions = new Map<string, Agent>();

function makeAgent(): Agent {
  return createAgent();
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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

  const sessionId = (clientSessionId && sessions.has(clientSessionId))
    ? clientSessionId
    : generateId();

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, makeAgent());
  }

  const agent = sessions.get(sessionId)!;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (data: object) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\\n\\n`);
  };

  send({ type: 'session', sessionId });

  let aborted = false;

  (async () => {
    try {
      for await (const event of agent.run(message.trim())) {
        if (aborted) break;
        send(event);
      }
      send({ type: 'done' });
    } catch (err) {
      send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      if (!res.writableEnded) res.end();
    }
  })();

  req.on('close', () => {
    aborted = true;
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', apiKey: !!getApiKey() });
});

export function startServer(port?: number): Promise<void> {
  const PORT = port ?? Number(process.env.PORT || 3000);

  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, () => {
      console.log(`\\n🚀 bincode web server running at http://localhost:${PORT}\\n`);
      console.log('  DEEPSEEK_API_KEY:', getApiKey() ? '✓ set' : '✗ not set (required)');
      console.log('  Model:', getModel());
      console.log('  Base URL:', getBaseUrl());
      console.log('\\nPress Ctrl+C to stop.\\n');
      resolve();
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Set PORT=<other> to use a different port.`);
      } else {
        console.error('Server error:', err.message);
      }
      reject(err);
    });
  });
}

// Run server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
