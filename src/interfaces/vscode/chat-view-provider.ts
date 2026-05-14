/**
 * Chat View Provider
 *
 * Provides a sidebar webview for interactive chat with the agent
 */

import * as vscode from 'vscode';
import { createAgent } from '../../core/factory.js';
import type { Agent } from '../../core/agent.js';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private agent?: Agent;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'sendMessage':
          await this.handleMessage(message.text);
          break;
        case 'clear':
          this.agent = undefined;
          break;
      }
    });
  }

  private async handleMessage(message: string) {
    if (!this.view) return;

    try {
      // Create agent if needed
      if (!this.agent) {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        const cwd = workspace?.uri.fsPath || process.cwd();
        this.agent = createAgent({ cwd });
      }

      // Stream response
      for await (const event of this.agent.run(message)) {
        this.view.webview.postMessage({
          type: 'agentEvent',
          event
        });
      }

      this.view.webview.postMessage({ type: 'done' });
    } catch (error) {
      this.view.webview.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private getHtmlContent(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>bincode Chat</title>
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
    }
    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .message {
      padding: 8px 12px;
      border-radius: 6px;
      max-width: 90%;
      word-wrap: break-word;
    }
    .user {
      align-self: flex-end;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .agent {
      align-self: flex-start;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
    }
    .tool {
      align-self: flex-start;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-size: 0.9em;
    }
    .error {
      align-self: center;
      background: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-errorForeground);
    }
    #input-area {
      padding: 12px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
    }
    #input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 8px;
      font-family: inherit;
      resize: none;
    }
    #send-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      padding: 0 16px;
      cursor: pointer;
      font-weight: 600;
    }
    #send-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    #send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .cursor::after {
      content: '▋';
      animation: blink 0.8s step-start infinite;
    }
    @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
  </style>
</head>
<body>
  <div id="messages"></div>
  <div id="input-area">
    <textarea id="input" placeholder="Ask anything..." rows="3"></textarea>
    <button id="send-btn">Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('send-btn');

    let currentAgentMsg = null;
    let agentText = '';
    let busy = false;

    function addMessage(text, type) {
      const div = document.createElement('div');
      div.className = 'message ' + type;
      div.textContent = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    function sendMessage() {
      const text = inputEl.value.trim();
      if (!text || busy) return;

      addMessage(text, 'user');
      inputEl.value = '';
      busy = true;
      sendBtn.disabled = true;

      vscode.postMessage({ type: 'sendMessage', text });
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendMessage();
      }
    });

    window.addEventListener('message', event => {
      const message = event.data;

      if (message.type === 'agentEvent') {
        const evt = message.event;

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
          addMessage(\`⚙ \${evt.name}(\${JSON.stringify(evt.args)})\`, 'tool');
        } else if (evt.type === 'tool_result') {
          const preview = (evt.result || '').split('\\n')[0];
          addMessage(\`↩ \${evt.name}: \${preview}\`, 'tool');
        }
      } else if (message.type === 'done') {
        if (currentAgentMsg) currentAgentMsg.classList.remove('cursor');
        currentAgentMsg = null;
        agentText = '';
        busy = false;
        sendBtn.disabled = false;
      } else if (message.type === 'error') {
        addMessage('Error: ' + message.message, 'error');
        busy = false;
        sendBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
  }
}
