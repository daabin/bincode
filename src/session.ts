import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ChatMessage } from './types.js';

/**
 * 会话元数据
 */
export interface SessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  provider: string;
  model: string;
}

/**
 * 完整会话数据
 */
export interface SessionData {
  meta: SessionMeta;
  messages: ChatMessage[];
}

/**
 * 会话存储目录
 */
function getSessionsDir(): string {
  return process.env.BINCODE_SESSIONS_DIR || path.join(os.homedir(), '.bincode', 'sessions');
}

/**
 * 确保会话目录存在
 */
function ensureSessionsDir(): void {
  const dir = getSessionsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { mode: 0o700, recursive: true });
  }
}

/**
 * 生成唯一会话 ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * 从消息生成会话标题
 */
export function generateSessionTitle(messages: ChatMessage[]): string {
  // 找到第一条用户消息作为标题
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage && typeof firstUserMessage.content === 'string') {
    const content = firstUserMessage.content;
    // 截取前 50 个字符
    const title = content.slice(0, 50);
    return title.length < content.length ? `${title}...` : title;
  }
  return 'New Session';
}

/**
 * 保存会话
 */
export function saveSession(session: SessionData): void {
  ensureSessionsDir();
  const sessionFile = path.join(getSessionsDir(), `${session.meta.id}.json`);
  fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), { mode: 0o600 });
}

/**
 * 加载会话
 */
export function loadSession(id: string): SessionData | null {
  try {
    const sessionFile = path.join(getSessionsDir(), `${id}.json`);
    if (!fs.existsSync(sessionFile)) {
      return null;
    }
    const content = fs.readFileSync(sessionFile, 'utf-8');
    return JSON.parse(content) as SessionData;
  } catch {
    return null;
  }
}

/**
 * 删除会话
 */
export function deleteSession(id: string): boolean {
  try {
    const sessionFile = path.join(getSessionsDir(), `${id}.json`);
    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 列出所有会话
 */
export function listSessions(): SessionMeta[] {
  ensureSessionsDir();
  
  const dir = getSessionsDir();
  const sessions: SessionMeta[] = [];
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const session = JSON.parse(content) as SessionData;
      sessions.push(session.meta);
    } catch {
      // Skip invalid session files
    }
  }
  
  // 按更新时间降序排序
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * 创建新会话
 */
export function createSession(provider: string, model: string): SessionData {
  const now = Date.now();
  const id = generateSessionId();
  
  return {
    meta: {
      id,
      title: 'New Session',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      provider,
      model
    },
    messages: []
  };
}

/**
 * 更新会话
 */
export function updateSession(
  session: SessionData,
  messages: ChatMessage[]
): SessionData {
  const now = Date.now();
  
  return {
    meta: {
      ...session.meta,
      title: session.meta.title === 'New Session' 
        ? generateSessionTitle(messages)
        : session.meta.title,
      updatedAt: now,
      messageCount: messages.length
    },
    messages
  };
}

/**
 * 获取会话存储路径
 */
export function getSessionsPath(): string {
  return getSessionsDir();
}

/**
 * 导出会话为 Markdown
 */
export function exportSessionAsMarkdown(session: SessionData): string {
  const lines: string[] = [
    `# ${session.meta.title}`,
    '',
    `**Session ID:** ${session.meta.id}`,
    `**Created:** ${new Date(session.meta.createdAt).toLocaleString()}`,
    `**Provider:** ${session.meta.provider}`,
    `**Model:** ${session.meta.model}`,
    '',
    '---',
    ''
  ];

  for (const message of session.messages) {
    if (message.role === 'system') {
      lines.push(`**System:** ${message.content}`);
      lines.push('');
    } else if (message.role === 'user') {
      lines.push(`## User`);
      lines.push('');
      lines.push(message.content || '');
      lines.push('');
    } else if (message.role === 'assistant') {
      lines.push(`## Assistant`);
      lines.push('');
      lines.push(message.content || '');
      lines.push('');
    } else if (message.role === 'tool') {
      lines.push(`**Tool Result:** \`${message.tool_call_id}\``);
      lines.push('```');
      lines.push(message.content || '');
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}