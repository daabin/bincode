/**
 * Inline Completion Provider
 *
 * Provides GitHub Copilot-like inline code suggestions
 */

import * as vscode from 'vscode';
import { codeComplete, type CompletionRequest } from './completion-provider.js';

export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private lastTriggerTime = 0;
  private debounceTimer: NodeJS.Timeout | undefined;

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    // Check if triggered manually or by typing
    if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
      // Debounce automatic triggers
      const config = vscode.workspace.getConfiguration('bincode');
      const delay = config.get<number>('completionDelay', 300);
      const now = Date.now();

      if (now - this.lastTriggerTime < delay) {
        return undefined;
      }
      this.lastTriggerTime = now;
    }

    // Don't complete in comments (simple heuristic)
    const lineText = document.lineAt(position.line).text;
    const beforeCursor = lineText.substring(0, position.character);
    if (beforeCursor.trim().startsWith('//') || beforeCursor.trim().startsWith('#')) {
      return undefined;
    }

    // Don't complete if there's already text after cursor on the same line
    const afterCursor = lineText.substring(position.character).trim();
    if (afterCursor.length > 0 && !afterCursor.startsWith('}') && !afterCursor.startsWith(')')) {
      return undefined;
    }

    try {
      const request: CompletionRequest = {
        filePath: document.fileName,
        fileContent: document.getText(),
        cursorLine: position.line + 1,
        cursorColumn: position.character,
        language: document.languageId,
        maxTokens: vscode.workspace.getConfiguration('bincode').get('maxCompletionTokens', 100)
      };

      const result = await codeComplete(request);

      if (token.isCancellationRequested || result.completions.length === 0) {
        return undefined;
      }

      return result.completions.map(completion => {
        const item = new vscode.InlineCompletionItem(
          completion.text,
          new vscode.Range(position, position)
        );
        item.command = {
          command: 'bincode.logCompletion',
          title: 'Log Completion',
          arguments: [completion.type]
        };
        return item;
      });
    } catch (error) {
      console.error('bincode completion error:', error);
      return undefined;
    }
  }
}
