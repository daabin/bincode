/**
 * Chat View Provider
 *
 * Provides a sidebar webview for interactive chat with the agent.
 * Sessions are persisted to ~/.bincode/sessions/ and restored per workspace.
 */

import * as vscode from 'vscode';
import { createAgent } from '../../core/factory.js';
import type { Agent } from '../../core/agent.js';
import {
  listSessions,
  loadSession,
  saveSession,
  updateSession,
  createSession,
  type SessionData
} from '../../session.js';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private agent?: Agent;
  private session?: SessionData;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Restore last session for this workspace
    this.restoreSession();

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'sendMessage':
          await this.handleMessage(message.text);
          break;
        case 'clear':
          this.agent = undefined;
          this.session = undefined;
          this.context.workspaceState.update('bincode.sessionId', undefined);
          break;
        case 'loadSessions':
          this.sendSessionList();
          break;
        case 'resumeSession':
          this.resumeSession(message.sessionId);
          break;
      }
    });
  }

  /** Restore the last session used in this workspace */
  private restoreSession(): void {
    const savedId = this.context.workspaceState.get<string>('bincode.sessionId');
    if (!savedId) return;
    const session = loadSession(savedId);
    if (!session) return;
    this.session = session;
    this.view?.webview.postMessage({
      type: 'sessionRestored',
      sessionId: session.meta.id,
      title: session.meta.title,
      messageCount: session.meta.messageCount
    });
  }

  /** Resume a session by ID */
  private resumeSession(id: string): void {
    const session = loadSession(id);
    if (!session) {
      this.view?.webview.postMessage({ type: 'error', message: `Session ${id} not found` });
      return;
    }
    this.session = session;
    this.agent = undefined; // Will be recreated with initialMessages on next message
    this.context.workspaceState.update('bincode.sessionId', id);
    this.view?.webview.postMessage({
      type: 'sessionResumed',
      sessionId: session.meta.id,
      title: session.meta.title,
      messages: session.messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: m.content
      }))
    });
  }

  /** Send list of recent sessions to webview */
  private sendSessionList(): void {
    const sessions = listSessions().slice(0, 20);
    this.view?.webview.postMessage({ type: 'sessionList', sessions });
  }

  private async handleMessage(message: string) {
    if (!this.view) return;

    try {
      // Create agent if needed, optionally with session history
      if (!this.agent) {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        const cwd = workspace?.uri.fsPath || process.cwd();
        this.agent = createAgent({
          cwd,
          initialMessages: this.session?.messages
        });
        // Create a new session if we don't have one
        if (!this.session) {
          this.session = createSession('deepseek', 'deepseek-chat');
        }
      }

      // Stream response
      for await (const event of this.agent.run(message)) {
        this.view.webview.postMessage({
          type: 'agentEvent',
          event
        });

        if (event.type === 'done') {
          // Persist session after each completed turn
          try {
            const messages = this.agent!.getConversation().getMessages();
            this.session = updateSession(this.session!, messages);
            saveSession(this.session!);
            this.context.workspaceState.update('bincode.sessionId', this.session!.meta.id);
          } catch {
            // Non-fatal
          }
        }
      }

      this.view.webview.postMessage({ type: 'done' });
    } catch (error) {
      this.view.webview.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private getHtmlContent(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>bincode</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Toolbar ── */
    #toolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 5px 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }
    .tb-btn {
      background: none;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 3px 5px;
      border-radius: 3px;
      font-size: 13px;
      opacity: 0.65;
      line-height: 1;
    }
    .tb-btn:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.08)); }
    .tb-btn.active { opacity: 1; background: var(--vscode-toolbar-activeBackground, rgba(255,255,255,0.12)); }
    #session-label {
      flex: 1;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 0 4px;
    }

    /* ── Views ── */
    .view { display: none; flex: 1; flex-direction: column; overflow: hidden; min-height: 0; }
    .view.active { display: flex; }

    /* ── Chat view ── */
    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 0;
    }
    .message {
      padding: 6px 10px;
      border-radius: 6px;
      max-width: 95%;
      word-wrap: break-word;
      font-size: 12px;
      line-height: 1.55;
      white-space: pre-wrap;
    }
    .user {
      align-self: flex-end;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .agent {
      align-self: flex-start;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-panel-border);
      white-space: normal;
    }
    .tool {
      align-self: flex-start;
      opacity: 0.7;
      font-size: 0.85em;
    }
    .error { color: var(--vscode-errorForeground); }
    .system-msg {
      align-self: center;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
    .cursor::after { content: '▋'; animation: blink 0.8s step-start infinite; }
    @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }

    #input-area {
      flex-shrink: 0;
      padding: 8px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 6px;
    }
    #input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 4px;
      padding: 6px 8px;
      font-family: inherit;
      font-size: 12px;
      resize: none;
      outline: none;
      min-height: 32px;
      max-height: 120px;
    }
    #input:focus { border-color: var(--vscode-focusBorder); }
    #send-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      padding: 0 10px;
      cursor: pointer;
      align-self: flex-end;
      height: 32px;
    }
    #send-btn:hover { background: var(--vscode-button-hoverBackground); }
    #send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Sessions view ── */
    #sessions-view {
      display: none;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }
    #sessions-view.active { display: flex; }

    .sessions-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--vscode-descriptionForeground);
    }
    #new-session-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 3px;
      padding: 3px 8px;
      font-size: 11px;
      cursor: pointer;
      text-transform: none;
      letter-spacing: 0;
      font-weight: normal;
    }
    #new-session-btn:hover { background: var(--vscode-button-hoverBackground); }

    #session-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
      min-height: 0;
    }
    .session-item {
      padding: 7px 10px;
      cursor: pointer;
      border-radius: 3px;
      margin: 0 4px 2px;
      border-left: 2px solid transparent;
    }
    .session-item:hover { background: var(--vscode-list-hoverBackground); }
    .session-item.active {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
      border-left-color: var(--vscode-focusBorder);
    }
    .s-title {
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .s-meta {
      font-size: 10px;
      opacity: 0.65;
      margin-top: 2px;
    }
    .no-sessions {
      padding: 20px 10px;
      text-align: center;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background, rgba(255,255,255,0.2)); border-radius: 2px; }
  </style>
</head>
<body>

  <!-- Toolbar -->
  <div id="toolbar">
    <span id="session-label">New chat</span>
    <button class="tb-btn" id="history-btn" title="Session history">🕐</button>
    <button class="tb-btn" id="new-chat-btn" title="New chat">＋</button>
  </div>

  <!-- Chat view -->
  <div class="view active" id="chat-view">
    <div id="messages"></div>
    <div id="input-area">
      <textarea id="input" placeholder="Ask anything… (Ctrl+Enter)" rows="2"></textarea>
      <button id="send-btn">➤</button>
    </div>
  </div>

  <!-- Sessions view -->
  <div id="sessions-view">
    <div class="sessions-toolbar">
      <span>History</span>
      <button id="new-session-btn">+ New chat</button>
    </div>
    <div id="session-list">
      <div class="no-sessions">No sessions yet</div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesEl   = document.getElementById('messages');
    const inputEl      = document.getElementById('input');
    const sendBtn      = document.getElementById('send-btn');
    const sessionLabel = document.getElementById('session-label');
    const historyBtn   = document.getElementById('history-btn');
    const newChatBtn   = document.getElementById('new-chat-btn');
    const chatView     = document.getElementById('chat-view');
    const sessionsView = document.getElementById('sessions-view');
    const sessionListEl= document.getElementById('session-list');
    const newSessionBtn= document.getElementById('new-session-btn');

    let currentAgentMsg = null;
    let agentText = '';
    let busy = false;
    let currentSessionId = null;

    // ── Views ─────────────────────────────────────────────────────────────

    function showChat() {
      chatView.classList.add('active');
      sessionsView.classList.remove('active');
      historyBtn.classList.remove('active');
    }

    function showHistory() {
      chatView.classList.remove('active');
      sessionsView.classList.add('active');
      historyBtn.classList.add('active');
      vscode.postMessage({ type: 'loadSessions' });
    }

    historyBtn.addEventListener('click', () => {
      sessionsView.classList.contains('active') ? showChat() : showHistory();
    });

    // ── New chat ──────────────────────────────────────────────────────────

    function startNewChat() {
      vscode.postMessage({ type: 'clear' });
      messagesEl.innerHTML = '';
      currentAgentMsg = null; agentText = '';
      busy = false; sendBtn.disabled = false; inputEl.disabled = false;
      currentSessionId = null;
      sessionLabel.textContent = 'New chat';
      showChat();
      inputEl.focus();
    }

    newChatBtn.addEventListener('click', startNewChat);
    newSessionBtn.addEventListener('click', startNewChat);

    // ── Helpers ───────────────────────────────────────────────────────────

    function addMessage(text, type) {
      const div = document.createElement('div');
      div.className = 'message ' + type;
      div.textContent = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    function addSystemMsg(text) {
      const div = document.createElement('div');
      div.className = 'system-msg';
      div.textContent = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    function formatDate(iso) {
      if (!iso) return '';
      const d = new Date(iso), diff = Date.now() - d;
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
      return d.toLocaleDateString();
    }

    // ── Send ──────────────────────────────────────────────────────────────

    function sendMessage() {
      const text = inputEl.value.trim();
      if (!text || busy) return;
      addMessage(text, 'user');
      inputEl.value = '';
      inputEl.style.height = 'auto';
      busy = true;
      sendBtn.disabled = true;
      inputEl.disabled = true;
      vscode.postMessage({ type: 'sendMessage', text });
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendMessage(); }
    });
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    });

    // ── Session list ──────────────────────────────────────────────────────

    function renderSessions(sessions) {
      if (!sessions || sessions.length === 0) {
        sessionListEl.innerHTML = '<div class="no-sessions">No sessions yet</div>';
        return;
      }
      sessionListEl.innerHTML = '';
      sessions.forEach(s => {
        const item = document.createElement('div');
        item.className = 'session-item' + (s.id === currentSessionId ? ' active' : '');
        item.dataset.id = s.id;
        item.innerHTML =
          '<div class="s-title">' + esc(s.title || 'Untitled') + '</div>' +
          '<div class="s-meta">' + (s.messageCount || 0) + ' msgs · ' + formatDate(s.updatedAt || s.createdAt) + '</div>';
        item.addEventListener('click', () => {
          vscode.postMessage({ type: 'resumeSession', sessionId: s.id });
          showChat();
        });
        sessionListEl.appendChild(item);
      });
    }

    // ── Extension messages ────────────────────────────────────────────────

    window.addEventListener('message', event => {
      const msg = event.data;

      if (msg.type === 'agentEvent') {
        const evt = msg.event;
        if (evt.type === 'assistant') {
          if (!currentAgentMsg) {
            currentAgentMsg = addMessage('', 'agent');
            currentAgentMsg.classList.add('cursor');
            agentText = '';
          }
          agentText += evt.content;
          currentAgentMsg.textContent = agentText;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        } else if (evt.type === 'tool_call') {
          if (currentAgentMsg) currentAgentMsg.classList.remove('cursor');
          addMessage('⚙ ' + evt.name, 'tool');
        } else if (evt.type === 'tool_result') {
          addMessage('↩ ' + evt.name + ': ' + (evt.result || '').split('\\n')[0], 'tool');
        }

      } else if (msg.type === 'done') {
        if (currentAgentMsg) currentAgentMsg.classList.remove('cursor');
        currentAgentMsg = null; agentText = '';
        busy = false; sendBtn.disabled = false; inputEl.disabled = false;

      } else if (msg.type === 'error') {
        if (currentAgentMsg) currentAgentMsg.classList.remove('cursor');
        currentAgentMsg = null; agentText = '';
        addMessage('Error: ' + msg.message, 'error');
        busy = false; sendBtn.disabled = false; inputEl.disabled = false;

      } else if (msg.type === 'sessionList') {
        renderSessions(msg.sessions);

      } else if (msg.type === 'sessionRestored') {
        currentSessionId = msg.sessionId;
        sessionLabel.textContent = (msg.title || 'Session').slice(0, 28);
        addSystemMsg('Session restored · ' + (msg.messageCount || 0) + ' messages');

      } else if (msg.type === 'sessionResumed') {
        currentSessionId = msg.sessionId;
        sessionLabel.textContent = (msg.title || 'Session').slice(0, 28);
        messagesEl.innerHTML = '';
        (msg.messages || []).forEach(m => {
          if (m.role === 'user') {
            const c = typeof m.content === 'string' ? m.content
              : (Array.isArray(m.content) ? m.content.filter(x => x.type==='text').map(x=>x.text).join('') : '');
            if (c) addMessage(c, 'user');
          } else if (m.role === 'assistant') {
            const c = typeof m.content === 'string' ? m.content
              : (Array.isArray(m.content) ? m.content.filter(x => x.type==='text').map(x=>x.text).join('') : '');
            if (c) addMessage(c, 'agent');
          }
        });
        addSystemMsg('↩ Continuing session…');
        // update active state
        sessionListEl.querySelectorAll('.session-item').forEach(el => {
          el.classList.toggle('active', el.dataset.id === msg.sessionId);
        });
      }
    });
  </script>
</body>
</html>`;
  }
}
