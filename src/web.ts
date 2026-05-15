#!/usr/bin/env node
/**
 * bincode Web Server Entry Point
 *
 * Starts the Express server for the web interface.
 * Provides REST API and Server-Sent Events for agent communication.
 * Sessions are persisted as JSON files in ~/.bincode/sessions/.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Agent, createAgent } from './core/index.js';
import { getApiKey, getModel, getBaseUrl } from './config/index.js';
import {
  createSession,
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  updateSession,
  exportSessionAsMarkdown,
  getSessionsPath,
  type SessionData,
  type SessionMeta
} from './session.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// In-memory agent instances: sessionId -> Agent
const agentInstances = new Map<string, Agent>();

function makeAgent(): Agent {
  return createAgent();
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * POST /api/chat
 * Body: { message: string, sessionId?: string }
 * Returns: SSE stream of AgentEvent objects, preceded by a `session` event
 * Sessions are auto-saved after each turn.
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
  let sessionId = clientSessionId ?? '';
  let sessionData: SessionData | null = null;

  if (sessionId && agentInstances.has(sessionId)) {
    // Existing in-memory session
    sessionData = loadSession(sessionId);
  } else if (sessionId) {
    // Try to load from disk
    sessionData = loadSession(sessionId);
    if (sessionData) {
      // Re-create agent and restore conversation
      const agent = makeAgent();
      const conversation = agent.getConversation();
      for (const msg of sessionData.messages) {
        conversation.addMessage(msg);
      }
      agentInstances.set(sessionId, agent);
    } else {
      // Invalid session ID, create new
      sessionId = '';
    }
  }

  if (!sessionId) {
    sessionId = generateId();
    sessionData = createSession('deepseek', getModel());
    agentInstances.set(sessionId, makeAgent());
  }

  const agent = agentInstances.get(sessionId)!;

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (data: object) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  send({ type: 'session', sessionId, model: getModel() });

  let aborted = false;
  let hasError = false;

  (async () => {
    try {
      for await (const event of agent.run(message.trim())) {
        if (aborted) break;
        send(event);
        if (event.type === 'error') hasError = true;
      }

      // Auto-save session after completion
      if (!aborted && !hasError) {
        const conversation = agent.getConversation();
        const messages = conversation.getMessages();
        if (sessionData) {
          sessionData = updateSession(sessionData, messages);
        } else {
          sessionData = createSession('deepseek', getModel());
          sessionData = updateSession(sessionData, messages);
        }
        saveSession(sessionData);
      }

      send({ type: 'done' });
    } catch (err) {
      console.error('[Web] Error:', err);
      send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      if (!res.writableEnded) res.end();
    }
  })();

  res.on('close', () => {
    if (!res.writableFinished) {
      aborted = true;
    }
  });
});

/**
 * GET /api/sessions
 * Returns list of all saved session metadata, sorted by update time.
 */
app.get('/api/sessions', (_req, res) => {
  try {
    const sessions = listSessions();
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

/**
 * GET /api/sessions/:id
 * Returns full session data including messages.
 */
app.get('/api/sessions/:id', (req, res) => {
  const { id } = req.params;
  const session = loadSession(id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ session });
});

/**
 * DELETE /api/sessions/:id
 * Delete a session from disk and remove in-memory agent.
 */
app.delete('/api/sessions/:id', (req, res) => {
  const { id } = req.params;
  agentInstances.delete(id);
  const deleted = deleteSession(id);
  res.json({ deleted });
});

/**
 * GET /api/sessions/:id/export
 * Export session as Markdown.
 */
app.get('/api/sessions/:id/export', (req, res) => {
  const { id } = req.params;
  const session = loadSession(id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const markdown = exportSessionAsMarkdown(session);
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="bincode-session-${id.slice(0, 8)}.md"`);
  res.send(markdown);
});

/**
 * GET /api/health
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', apiKey: !!getApiKey() });
});

export function startServer(port?: number): Promise<void> {
  const PORT = port ?? Number(process.env.PORT || 3000);

  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 bincode web server running at http://localhost:${PORT}\n`);
      console.log('  DEEPSEEK_API_KEY:', getApiKey() ? '✓ set' : '✗ not set (required)');
      console.log('  Model:', getModel());
      console.log('  Base URL:', getBaseUrl());
      console.log('  Sessions dir:', getSessionsPath());
      console.log('\nPress Ctrl+C to stop.\n');
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
