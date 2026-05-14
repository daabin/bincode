"use strict";
/**
 * VSCode Extension Entry Point
 *
 * Provides AI-powered code assistance with:
 * - Inline code completion
 * - Code explanation and refactoring
 * - Interactive chat
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const inline_completion_provider_js_1 = require("./inline-completion-provider.js");
const chat_view_provider_js_1 = require("./chat-view-provider.js");
const index_js_1 = require("../../config/index.js");
const index_js_2 = require("../../llm/index.js");
let outputChannel;
let completionProvider;
let chatProvider;
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('bincode');
    outputChannel.appendLine('🚀 bincode extension activated');
    // Register inline completion provider
    registerInlineCompletion(context);
    // Register chat view
    registerChatView(context);
    // Register commands
    registerCommands(context);
    // Watch configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('bincode.enableInlineCompletion')) {
            registerInlineCompletion(context);
        }
    }));
    outputChannel.appendLine('✓ bincode ready');
}
function deactivate() {
    outputChannel?.appendLine('bincode extension deactivated');
    outputChannel?.dispose();
    completionProvider?.dispose();
}
function registerInlineCompletion(context) {
    const config = vscode.workspace.getConfiguration('bincode');
    const enabled = config.get('enableInlineCompletion', true);
    // Dispose existing provider
    if (completionProvider) {
        completionProvider.dispose();
        completionProvider = undefined;
    }
    if (enabled) {
        const provider = new inline_completion_provider_js_1.InlineCompletionProvider();
        completionProvider = vscode.languages.registerInlineCompletionItemProvider({ pattern: '**' }, provider);
        context.subscriptions.push(completionProvider);
        outputChannel.appendLine('✓ Inline completion enabled');
    }
    else {
        outputChannel.appendLine('✗ Inline completion disabled');
    }
}
function registerChatView(context) {
    chatProvider = new chat_view_provider_js_1.ChatViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('bincode.chatView', chatProvider));
}
function registerCommands(context) {
    // Explain selected code
    context.subscriptions.push(vscode.commands.registerCommand('bincode.explain', async () => {
        await handleCodeAction('explain', 'Explain this code in detail:');
    }));
    // Refactor selected code
    context.subscriptions.push(vscode.commands.registerCommand('bincode.refactor', async () => {
        await handleCodeAction('refactor', 'Refactor this code to improve quality:');
    }));
    // Fix issues in selected code
    context.subscriptions.push(vscode.commands.registerCommand('bincode.fix', async () => {
        await handleCodeAction('fix', 'Find and fix issues in this code:');
    }));
    // Generate code from comment
    context.subscriptions.push(vscode.commands.registerCommand('bincode.generate', async () => {
        await handleGenerate();
    }));
    // Open chat
    context.subscriptions.push(vscode.commands.registerCommand('bincode.chat', async () => {
        await vscode.commands.executeCommand('bincode.chatView.focus');
    }));
    // Toggle inline completion
    context.subscriptions.push(vscode.commands.registerCommand('bincode.toggleInlineCompletion', async () => {
        const config = vscode.workspace.getConfiguration('bincode');
        const current = config.get('enableInlineCompletion', true);
        await config.update('enableInlineCompletion', !current, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`bincode inline completion ${!current ? 'enabled' : 'disabled'}`);
    }));
}
async function handleCodeAction(action, systemPrompt) {
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
    const apiKey = (0, index_js_1.getApiKey)();
    if (!apiKey) {
        const response = await vscode.window.showErrorMessage('DEEPSEEK_API_KEY not configured', 'Open Settings');
        if (response === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'bincode.apiKey');
        }
        return;
    }
    const provider = new index_js_2.DeepSeekProvider();
    const language = editor.document.languageId;
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `bincode: ${action}...`,
        cancellable: false
    }, async () => {
        try {
            const result = await provider.createChatCompletion({
                apiKey,
                baseUrl: (0, index_js_1.getBaseUrl)(),
                model: (0, index_js_1.getModel)(),
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
        }
        catch (error) {
            vscode.window.showErrorMessage(`bincode error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
async function handleGenerate() {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
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
    const apiKey = (0, index_js_1.getApiKey)();
    if (!apiKey) {
        vscode.window.showErrorMessage('DEEPSEEK_API_KEY not configured');
        return;
    }
    const provider = new index_js_2.DeepSeekProvider();
    const language = editor.document.languageId;
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'bincode: generating code...',
        cancellable: false
    }, async () => {
        try {
            const result = await provider.createChatCompletion({
                apiKey,
                baseUrl: (0, index_js_1.getBaseUrl)(),
                model: (0, index_js_1.getModel)(),
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
        }
        catch (error) {
            vscode.window.showErrorMessage(`bincode error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
