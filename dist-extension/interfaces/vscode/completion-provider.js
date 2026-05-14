"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.codeComplete = codeComplete;
exports.functionSignatureHint = functionSignatureHint;
const index_js_1 = require("../../llm/index.js");
const index_js_2 = require("../../config/index.js");
function getPrefixContext(content, line, column) {
    const lines = content.split('\n');
    const prefixLines = lines.slice(Math.max(0, line - 20), line);
    const lastLine = lines[line - 1] || '';
    prefixLines[prefixLines.length - 1] = lastLine.slice(0, column);
    return prefixLines.join('\n');
}
function getSuffixContext(content, line, column) {
    const lines = content.split('\n');
    const suffixLines = lines.slice(line - 1, line + 10);
    suffixLines[0] = (suffixLines[0] || '').slice(column);
    return suffixLines.join('\n');
}
function inferCompletionType(prefix, lastLine) {
    const trimmed = lastLine.trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('from '))
        return 'import';
    if (trimmed.startsWith('function ') || trimmed.startsWith('const ') || trimmed.startsWith('async '))
        return 'function';
    if (trimmed.startsWith('if ') || trimmed.startsWith('for ') || trimmed.startsWith('while ') || trimmed.startsWith('switch '))
        return 'statement';
    if (trimmed.endsWith('{') || trimmed.endsWith('(') || trimmed.endsWith('['))
        return 'block';
    if (/^\s*(const|let|var)\s+\w+$/.test(trimmed))
        return 'variable';
    return 'other';
}
/**
 * 代码补全（使用 FIM - Fill In the Middle）
 */
async function codeComplete(request) {
    const apiKey = (0, index_js_2.getApiKey)() || '';
    const baseUrl = (0, index_js_2.getBaseUrl)();
    const model = (0, index_js_2.getModel)();
    const provider = new index_js_1.DeepSeekProvider();
    const prefix = getPrefixContext(request.fileContent, request.cursorLine, request.cursorColumn);
    const suffix = getSuffixContext(request.fileContent, request.cursorLine, request.cursorColumn);
    const lastLine = request.fileContent.split('\n')[request.cursorLine - 1] || '';
    const completionType = inferCompletionType(prefix, lastLine);
    const systemPrompt = `You are a code completion assistant. Complete the code at the cursor position.
Only output the completion text, no explanations. Keep it concise and relevant.
Language: ${request.language || 'auto-detected'}
File: ${request.filePath}`;
    const userPrompt = `Complete the code after the cursor (marked with <|CURSOR|>):\n\n${prefix}<|CURSOR|>${suffix}\n\nProvide only the text that should replace <|CURSOR|>.`;
    try {
        const result = await provider.createChatCompletion({
            apiKey,
            baseUrl,
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            tools: []
        });
        const completionText = result.content || '';
        const lines = completionText.trim().split('\n');
        const mainCompletion = lines[0] || '';
        return {
            completions: [{ text: mainCompletion, score: 1.0, type: completionType }],
            model
        };
    }
    catch {
        return { completions: [], model };
    }
}
/**
 * 获取函数签名补全
 */
async function functionSignatureHint(filePath, fileContent, functionName) {
    const apiKey = (0, index_js_2.getApiKey)() || '';
    const baseUrl = (0, index_js_2.getBaseUrl)();
    const model = (0, index_js_2.getModel)();
    const provider = new index_js_1.DeepSeekProvider();
    try {
        const result = await provider.createChatCompletion({
            apiKey,
            baseUrl,
            model,
            messages: [
                {
                    role: 'user',
                    content: `In the file ${filePath}, what is the signature of function "${functionName}"? 
Only output the function signature, nothing else. If not found, output "Not found".\n\nFile content:\n${fileContent.slice(0, 5000)}`
                }
            ],
            tools: []
        });
        return result.content || 'Not found';
    }
    catch {
        return 'Not found';
    }
}
