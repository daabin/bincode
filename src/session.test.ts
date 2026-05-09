import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  generateSessionId,
  generateSessionTitle,
  saveSession,
  loadSession,
  deleteSession,
  listSessions,
  createSession,
  updateSession,
  exportSessionAsMarkdown,
  type SessionData
} from './session.js';

describe('session', () => {
  const testSessionsDir = path.join(os.tmpdir(), 'bincode-sessions-test');

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testSessionsDir)) {
      fs.rmSync(testSessionsDir, { recursive: true });
    }
    fs.mkdirSync(testSessionsDir, { recursive: true });
    
    // Override SESSIONS_DIR for tests
    process.env.BINCODE_SESSIONS_DIR = testSessionsDir;
  });

  afterEach(() => {
    if (fs.existsSync(testSessionsDir)) {
      fs.rmSync(testSessionsDir, { recursive: true });
    }
    delete process.env.BINCODE_SESSIONS_DIR;
  });

  describe('generateSessionId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      
      expect(id1).not.toBe(id2);
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('generateSessionTitle', () => {
    it('should generate title from first user message', () => {
      const messages = [
        { role: 'system' as const, content: 'You are helpful.' },
        { role: 'user' as const, content: 'Hello, how are you?' }
      ];
      
      const title = generateSessionTitle(messages);
      expect(title).toBe('Hello, how are you?');
    });

    it('should truncate long messages', () => {
      const longMessage = 'This is a very long message that should be truncated because it exceeds the maximum title length of 50 characters';
      const messages = [
        { role: 'user' as const, content: longMessage }
      ];
      
      const title = generateSessionTitle(messages);
      expect(title.length).toBe(53); // 50 + '...'
      expect(title.endsWith('...')).toBe(true);
    });

    it('should return default title for no user messages', () => {
      const messages = [
        { role: 'system' as const, content: 'You are helpful.' }
      ];
      
      const title = generateSessionTitle(messages);
      expect(title).toBe('New Session');
    });
  });

  describe('createSession', () => {
    it('should create a new session with correct metadata', () => {
      const session = createSession('deepseek', 'deepseek-chat');
      
      expect(session.meta.id).toBeDefined();
      expect(session.meta.title).toBe('New Session');
      expect(session.meta.provider).toBe('deepseek');
      expect(session.meta.model).toBe('deepseek-chat');
      expect(session.meta.messageCount).toBe(0);
      expect(session.messages).toEqual([]);
    });
  });

  describe('updateSession', () => {
    it('should update session with new messages', () => {
      const session = createSession('deepseek', 'deepseek-chat');
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' }
      ];
      
      const updated = updateSession(session, messages);
      
      expect(updated.meta.messageCount).toBe(2);
      expect(updated.meta.title).toBe('Hello');
      expect(updated.messages).toEqual(messages);
    });

    it('should preserve existing title if not "New Session"', () => {
      const session = createSession('deepseek', 'deepseek-chat');
      session.meta.title = 'Custom Title';
      
      const messages = [
        { role: 'user' as const, content: 'Hello' }
      ];
      
      const updated = updateSession(session, messages);
      expect(updated.meta.title).toBe('Custom Title');
    });
  });

  describe('saveSession and loadSession', () => {
    it('should save and load session correctly', () => {
      const session = createSession('deepseek', 'deepseek-chat');
      session.messages = [
        { role: 'user' as const, content: 'Test message' }
      ];
      
      saveSession(session);
      
      const loaded = loadSession(session.meta.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.meta.id).toBe(session.meta.id);
      expect(loaded?.messages).toHaveLength(1);
    });

    it('should return null for non-existent session', () => {
      const loaded = loadSession('non-existent-id');
      expect(loaded).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete existing session', () => {
      const session = createSession('deepseek', 'deepseek-chat');
      saveSession(session);
      
      const result = deleteSession(session.meta.id);
      expect(result).toBe(true);
      
      const loaded = loadSession(session.meta.id);
      expect(loaded).toBeNull();
    });

    it('should return false for non-existent session', () => {
      const result = deleteSession('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('listSessions', () => {
    it('should list all sessions sorted by update time', () => {
      const session1 = createSession('deepseek', 'deepseek-chat');
      const session2 = createSession('openai', 'gpt-4o');
      
      // Ensure different timestamps
      session1.meta.updatedAt = Date.now() - 1000;
      session2.meta.updatedAt = Date.now();
      
      saveSession(session1);
      saveSession(session2);
      
      const sessions = listSessions();
      
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe(session2.meta.id); // Most recent first
    });
  });

  describe('exportSessionAsMarkdown', () => {
    it('should export session as markdown', () => {
      const session: SessionData = {
        meta: {
          id: 'test-id',
          title: 'Test Session',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 2,
          provider: 'deepseek',
          model: 'deepseek-chat'
        },
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ]
      };
      
      const markdown = exportSessionAsMarkdown(session);
      
      expect(markdown).toContain('# Test Session');
      expect(markdown).toContain('**Provider:** deepseek');
      expect(markdown).toContain('## User');
      expect(markdown).toContain('Hello');
      expect(markdown).toContain('## Assistant');
      expect(markdown).toContain('Hi there!');
    });
  });
});