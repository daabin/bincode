"use strict";
/**
 * Inline Completion Provider
 *
 * Provides GitHub Copilot-like inline code suggestions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InlineCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
const completion_provider_js_1 = require("./completion-provider.js");
class InlineCompletionProvider {
    lastTriggerTime = 0;
    debounceTimer;
    async provideInlineCompletionItems(document, position, context, token) {
        // Check if triggered manually or by typing
        if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
            // Debounce automatic triggers
            const config = vscode.workspace.getConfiguration('bincode');
            const delay = config.get('completionDelay', 300);
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
            const request = {
                filePath: document.fileName,
                fileContent: document.getText(),
                cursorLine: position.line + 1,
                cursorColumn: position.character,
                language: document.languageId,
                maxTokens: vscode.workspace.getConfiguration('bincode').get('maxCompletionTokens', 100)
            };
            const result = await (0, completion_provider_js_1.codeComplete)(request);
            if (token.isCancellationRequested || result.completions.length === 0) {
                return undefined;
            }
            return result.completions.map(completion => {
                const item = new vscode.InlineCompletionItem(completion.text, new vscode.Range(position, position));
                item.command = {
                    command: 'bincode.logCompletion',
                    title: 'Log Completion',
                    arguments: [completion.type]
                };
                return item;
            });
        }
        catch (error) {
            console.error('bincode completion error:', error);
            return undefined;
        }
    }
}
exports.InlineCompletionProvider = InlineCompletionProvider;
