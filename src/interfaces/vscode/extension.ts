/**
 * VSCode Extension Entry Point
 *
 * Provides AI-powered code assistance with:
 * - Inline code completion
 * - Code explanation and refactoring
 * - Interactive chat
 */

import * as vscode from 'vscode';
import { InlineCompletionProvider } from './inline-completion-provider.js';
import { ChatViewProvider } from './chat-view-provider.js';
import { getApiKey, getBaseUrl, getModel } from '../../config/index.js';
import { DeepSeekProvider } from '../../llm/index.js';

let outputChannel: vscode.OutputChannel;
let completionProvider: vscode.Disposable | undefined;
let chatProvider: ChatViewProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('bincode');
  outputChannel.appendLine('🚀 bincode extension activated');

  // Register inline completion provider
  registerInlineCompletion(context);

  // Register chat view
  registerChatView(context);

  // Register commands
  registerCommands(context);

  // Watch configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('bincode.enableInlineCompletion')) {
        registerInlineCompletion(context);
      }
    })
  );

  outputChannel.appendLine('✓ bincode ready');
}

export function deactivate(): void {
  outputChannel?.appendLine('bincode extension deactivated');
  outputChannel?.dispose();
  completionProvider?.dispose();
}

function registerInlineCompletion(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('bincode');
  const enabled = config.get<boolean>('enableInlineCompletion', true);

  // Dispose existing provider
  if (completionProvider) {
    completionProvider.dispose();
    completionProvider = undefined;
  }

  if (enabled) {
    const provider = new InlineCompletionProvider();
    completionProvider = vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      provider
    );
    context.subscriptions.push(completionProvider);
    outputChannel.appendLine('✓ Inline completion enabled');
  } else {
    outputChannel.appendLine('✗ Inline completion disabled');
  }
}

function registerChatView(context: vscode.ExtensionContext) {
  chatProvider = new ChatViewProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('bincode.chatView', chatProvider)
  );
}

function registerCommands(context: vscode.ExtensionContext) {
  // Explain selected code
  context.subscriptions.push(
    vscode.commands.registerCommand('bincode.explain', async () => {
      await handleCodeAction('explain', 'Explain this code in detail:');
    })
  );

  // Refactor selected code
  context.subscriptions.push(
    vscode.commands.registerCommand('bincode.refactor', async () => {
      await handleCodeAction('refactor', 'Refactor this code to improve quality:');
    })
  );

  // Fix issues in selected code
  context.subscriptions.push(
    vscode.commands.registerCommand('bincode.fix', async () => {
      await handleCodeAction('fix', 'Find and fix issues in this code:');
    })
  );

  // Generate code from comment
  context.subscriptions.push(
    vscode.commands.registerCommand('bincode.generate', async () => {
      await handleGenerate();
    })
  );

  // Open chat
  context.subscriptions.push(
    vscode.commands.registerCommand('bincode.chat', async () => {
      await vscode.commands.executeCommand('bincode.chatView.focus');
    })
  );

  // Toggle inline completion
  context.subscriptions.push(
    vscode.commands.registerCommand('bincode.toggleInlineCompletion', async () => {
      const config = vscode.workspace.getConfiguration('bincode');
      const current = config.get<boolean>('enableInlineCompletion', true);
      await config.update('enableInlineCompletion', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `bincode inline completion ${!current ? 'enabled' : 'disabled'}`
      );
    })
  );
}

async function handleCodeAction(action: string, systemPrompt: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const selection = editor.selection;
  const code = editor.document.getText(selection);

  if (!code.trim()) {
    vscode.window.showWarningMessage('Please select some code first');
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    const response = await vscode.window.showErrorMessage(
      'DEEPSEEK_API_KEY not configured',
      'Open Settings'
    );
    if (response === 'Open Settings') {
      vscode.commands.executeCommand('workbench.action.openSettings', 'bincode.apiKey');
    }
    return;
  }

  const provider = new DeepSeekProvider();
  const language = editor.document.languageId;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `bincode: ${action}...`,
      cancellable: false
    },
    async () => {
      try {
        const result = await provider.createChatCompletion({
          apiKey,
          baseUrl: getBaseUrl(),
          model: getModel(),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Language: ${language}\n\n\`\`\`${language}\n${code}\n\`\`\`` }
          ],
          tools: []
        });

        const response = result.content || 'No response';

        // Show result in new document
        const doc = await vscode.workspace.openTextDocument({
          content: response,
          language: 'markdown'
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      } catch (error) {
        vscode.window.showErrorMessage(
          `bincode error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}

async function handleGenerate() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const position = editor.selection.active;
  const line = editor.document.lineAt(position.line);
  const comment = line.text.trim();

  // Check if current line is a comment
  const isComment = comment.startsWith('//') ||
                    comment.startsWith('#') ||
                    comment.startsWith('/*') ||
                    comment.startsWith('*');

  if (!isComment) {
    vscode.window.showWarningMessage('Place cursor on a comment line describing what code to generate');
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    vscode.window.showErrorMessage('DEEPSEEK_API_KEY not configured');
    return;
  }

  const provider = new DeepSeekProvider();
  const language = editor.document.languageId;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'bincode: generating code...',
      cancellable: false
    },
    async () => {
      try {
        const result = await provider.createChatCompletion({
          apiKey,
          baseUrl: getBaseUrl(),
          model: getModel(),
          messages: [
            {
              role: 'system',
              content: `You are a code generator. Generate only the code described in the comment. No explanations.`
            },
            {
              role: 'user',
              content: `Language: ${language}\nComment: ${comment}\n\nGenerate the code:`
            }
          ],
          tools: []
        });

        const code = (result.content || '').replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();

        // Insert generated code below the comment
        await editor.edit(editBuilder => {
          const nextLine = position.line + 1;
          const insertPosition = new vscode.Position(nextLine, 0);
          editBuilder.insert(insertPosition, code + '\n');
        });
      } catch (error) {
        vscode.window.showErrorMessage(
          `bincode error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}
