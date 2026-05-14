<<<<<<< HEAD
import { createProvider, type ProviderType } from './llm/index.js';
import type { LLMProvider } from './llm/types.js';
import { getProvider, getApiKey, getBaseUrl, getModel } from './config/index.js';
=======
import { DeepSeekProvider } from './llm/index.js';
import { getApiKey, getBaseUrl, getModel } from './config.js';
>>>>>>> agents/refactor-project-deepseek-web-support

/**
 * 代码补全请求
 */
export interface CompletionRequest {
  filePath: string;
  fileContent: string;
  cursorLine: number;
  cursorColumn: number;
  language?: string;
  maxTokens?: number;
}

/**
 * 代码补全结果
 */
export interface CompletionResult {
  completions: CompletionItem[];
  model: string;
}

/**
 * 补全项
 */
export interface CompletionItem {
  text: string;
  score: number;
  type: 'function' | 'variable' | 'statement' | 'block' | 'import' | 'other';
}

function getPrefixContext(content: string, line: number, column: number): string {
  const lines = content.split('\n');
  const prefixLines = lines.slice(Math.max(0, line - 20), line);
  const lastLine = lines[line - 1] || '';
  prefixLines[prefixLines.length - 1] = lastLine.slice(0, column);
  return prefixLines.join('\n');
}

function getSuffixContext(content: string, line: number, column: number): string {
  const lines = content.split('\n');
  const suffixLines = lines.slice(line - 1, line + 10);
  suffixLines[0] = (suffixLines[0] || '').slice(column);
  return suffixLines.join('\n');
}

function inferCompletionType(prefix: string, lastLine: string): CompletionItem['type'] {
  const trimmed = lastLine.trim();
  if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) return 'import';
  if (trimmed.startsWith('function ') || trimmed.startsWith('const ') || trimmed.startsWith('async ')) return 'function';
  if (trimmed.startsWith('if ') || trimmed.startsWith('for ') || trimmed.startsWith('while ') || trimmed.startsWith('switch ')) return 'statement';
  if (trimmed.endsWith('{') || trimmed.endsWith('(') || trimmed.endsWith('[')) return 'block';
  if (/^\s*(const|let|var)\s+\w+$/.test(trimmed)) return 'variable';
  return 'other';
}

/**
 * 代码补全（使用 FIM - Fill In the Middle）
 */
export async function codeComplete(request: CompletionRequest): Promise<CompletionResult> {
  const apiKey = getApiKey() || '';
  const baseUrl = getBaseUrl();
  const model = getModel();
  const provider = new DeepSeekProvider();

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
  } catch {
    return { completions: [], model };
  }
}

/**
 * 获取函数签名补全
 */
export async function functionSignatureHint(
  filePath: string,
  fileContent: string,
  functionName: string
): Promise<string> {
  const apiKey = getApiKey() || '';
  const baseUrl = getBaseUrl();
  const model = getModel();
  const provider = new DeepSeekProvider();

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
  } catch {
    return 'Not found';
  }
}
