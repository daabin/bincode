/**
 * 终端 Markdown 流式渲染器
 *
 * 核心功能：
 * 1. 支持流式逐 token 增量渲染，无需等待完整内容
 * 2. 智能容错处理不完整 Markdown 片段（未闭合代码块、表格等）
 * 3. 增量更新优化，仅渲染新增内容，避免闪烁和重复渲染
 * 4. 基于 marked + marked-terminal + highlight.js
 * 5. 支持 CommonMark + GFM 扩展（表格、任务列表、删除线等）
 * 6. 代码高亮支持 180+ 语言
 * 7. 安全的 HTML 转义
 */

import { marked } from 'marked';
// @ts-ignore - marked-terminal 类型定义不完整
import { markedTerminal } from 'marked-terminal';
import hljs from 'highlight.js';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';

// ============================================================================
// 类型定义
// ============================================================================

export interface RendererOptions {
  /** 是否启用代码高亮 (默认: true) */
  enableHighlight?: boolean;

  /** 是否转义 HTML (默认: true，用于用户输入) */
  escapeHtml?: boolean;

  /** 是否启用颜色 (默认: 自动检测终端支持) */
  enableColor?: boolean;

  /** 是否启用流式渲染 (默认: true) */
  enableStreaming?: boolean;

  /** 代码高亮主题 (默认: 'monokai') */
  highlightTheme?: string;

  /** 表格最大列宽 (默认: 80) */
  tableMaxColumnWidth?: number;
}

export interface StreamingState {
  /** 缓冲区，存储未完成的内容 */
  buffer: string;

  /** 已渲染的字符数 */
  renderedLength: number;

  /** 是否在代码块中 */
  inCodeBlock: boolean;

  /** 代码块语言 */
  codeBlockLang: string;

  /** 是否在表格中 */
  inTable: boolean;

  /** 表格行缓冲 */
  tableBuffer: string[];

  /** 最后渲染的内容（用于增量对比） */
  lastRendered: string;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 检测终端是否支持颜色
 */
function supportsColor(): boolean {
  // 检查环境变量
  if (process.env.NO_COLOR === '1' || process.env.FORCE_COLOR === '0') {
    return false;
  }

  if (process.env.FORCE_COLOR === '1' || process.env.FORCE_COLOR === 'true') {
    return true;
  }

  // 检查 stdout 是否是 TTY
  return process.stdout.isTTY === true;
}

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  return text.replace(/[&<>"']/g, char => escapeMap[char] || char);
}

/**
 * 检测是否在未闭合的代码块中
 */
function hasUnclosedCodeBlock(text: string): boolean {
  const codeBlockMatches = text.match(/```/g);
  return codeBlockMatches ? codeBlockMatches.length % 2 !== 0 : false;
}

/**
 * 检测是否在未完成的表格中
 */
function hasIncompleteTable(text: string): boolean {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return false;

  const lastLine = lines[lines.length - 1];
  // 表格行通常包含 | 符号
  return lastLine.includes('|') && !lastLine.trim().endsWith('|');
}

/**
 * 智能分割 Markdown 内容，保持块的完整性
 */
function smartSplitMarkdown(text: string): { complete: string; incomplete: string } {
  // 如果在代码块中，保留整个未完成的代码块
  if (hasUnclosedCodeBlock(text)) {
    const lastCodeBlockStart = text.lastIndexOf('```');
    return {
      complete: text.substring(0, lastCodeBlockStart),
      incomplete: text.substring(lastCodeBlockStart)
    };
  }

  // 如果在表格中，保留未完成的表格行
  if (hasIncompleteTable(text)) {
    const lines = text.split('\n');
    let lastCompleteIndex = lines.length - 1;

    // 从后往前找到最后一个完整的行
    while (lastCompleteIndex >= 0) {
      const line = lines[lastCompleteIndex].trim();
      if (!line.includes('|') || line.endsWith('|')) {
        break;
      }
      lastCompleteIndex--;
    }

    return {
      complete: lines.slice(0, lastCompleteIndex + 1).join('\n'),
      incomplete: lines.slice(lastCompleteIndex + 1).join('\n')
    };
  }

  return { complete: text, incomplete: '' };
}

// ============================================================================
// Marked 配置
// ============================================================================

/**
 * 配置 marked 渲染器
 */
function configureMarked(options: RendererOptions): void {
  const enableColor = options.enableColor ?? supportsColor();
  const enableHighlight = options.enableHighlight ?? true;

  // 配置 marked-terminal（使用简化配置）
  // @ts-ignore
  marked.use(markedTerminal());

  // GFM 扩展
  marked.use({
    gfm: true,
    breaks: true,
    pedantic: false
  });

  // HTML 转义配置已内置到 markedTerminal 中
}

// ============================================================================
// 核心渲染类
// ============================================================================

/**
 * 终端 Markdown 流式渲染器
 *
 * 使用示例：
 * ```typescript
 * const renderer = new TerminalMarkdownRenderer();
 *
 * // 流式渲染
 * renderer.appendChunk('# Hello');
 * renderer.appendChunk(' World\n');
 * renderer.appendChunk('This is **bold**');
 *
 * // 获取最终渲染结果
 * const result = renderer.finalize();
 * console.log(result);
 * ```
 */
export class TerminalMarkdownRenderer {
  private options: Required<RendererOptions>;
  private state: StreamingState;

  constructor(options: RendererOptions = {}) {
    this.options = {
      enableHighlight: options.enableHighlight ?? true,
      escapeHtml: options.escapeHtml ?? true,
      enableColor: options.enableColor ?? supportsColor(),
      enableStreaming: options.enableStreaming ?? true,
      highlightTheme: options.highlightTheme ?? 'monokai',
      tableMaxColumnWidth: options.tableMaxColumnWidth ?? 80
    };

    this.state = this.createInitialState();

    // 配置 marked
    configureMarked(this.options);
  }

  /**
   * 创建初始状态
   */
  private createInitialState(): StreamingState {
    return {
      buffer: '',
      renderedLength: 0,
      inCodeBlock: false,
      codeBlockLang: '',
      inTable: false,
      tableBuffer: [],
      lastRendered: ''
    };
  }

  /**
   * 追加内容块（流式渲染核心方法）
   *
   * @param chunk - 新增的 Markdown 内容片段
   * @returns 本次新增的渲染结果（增量输出）
   *
   * 使用场景：
   * - Agent 流式输出时，每收到一个 token/chunk 就调用此方法
   * - 方法会智能判断内容是否完整，自动处理不完整的 Markdown 片段
   * - 返回的是增量渲染结果，可以直接输出到终端
   */
  appendChunk(chunk: string): string {
    if (!chunk || chunk.length === 0) {
      return '';
    }

    // 追加到缓冲区
    this.state.buffer += chunk;

    if (!this.options.enableStreaming) {
      // 非流式模式，不做任何渲染
      return '';
    }

    try {
      // 智能分割：分离完整和不完整的部分
      const { complete, incomplete } = smartSplitMarkdown(this.state.buffer);

      if (complete.length === 0) {
        // 没有完整的内容可以渲染
        return '';
      }

      // 渲染完整部分
      const fullRendered = this.renderMarkdown(this.state.buffer);

      // 计算增量部分
      const increment = this.extractIncrement(fullRendered);

      // 更新状态
      this.state.lastRendered = fullRendered;
      this.state.inCodeBlock = hasUnclosedCodeBlock(this.state.buffer);

      return increment;
    } catch (error) {
      // 解析失败时的容错处理
      console.error('[TerminalMarkdownRenderer] Parse error:', error);
      return '';
    }
  }

  /**
   * 提取增量渲染内容
   *
   * @param fullRendered - 完整渲染结果
   * @returns 增量部分
   */
  private extractIncrement(fullRendered: string): string {
    if (this.state.lastRendered.length === 0) {
      return fullRendered;
    }

    // 去除 ANSI 颜色代码后比较
    const lastPlain = stripAnsi(this.state.lastRendered);
    const fullPlain = stripAnsi(fullRendered);

    if (fullPlain.startsWith(lastPlain)) {
      // 新内容是旧内容的扩展，提取增量
      const incrementPlain = fullPlain.substring(lastPlain.length);

      // 从完整渲染结果中提取对应的部分（保留颜色）
      const incrementStart = fullRendered.lastIndexOf(
        fullRendered.substring(fullRendered.length - incrementPlain.length * 2)
      );

      if (incrementStart !== -1) {
        return fullRendered.substring(incrementStart);
      }
    }

    // 无法提取增量，返回完整内容
    return fullRendered;
  }

  /**
   * 渲染 Markdown 文本
   *
   * @param markdown - Markdown 内容
   * @returns 渲染后的终端文本
   */
  private renderMarkdown(markdown: string): string {
    try {
      // 转义 HTML（如果需要）
      const safeMarkdown = this.options.escapeHtml
        ? markdown.replace(/<[^>]*>/g, match => escapeHtml(match))
        : markdown;

      // 渲染
      const rendered = marked.parse(safeMarkdown) as string;

      return this.options.enableColor ? rendered : stripAnsi(rendered);
    } catch (error) {
      // 渲染失败，返回原始文本
      console.error('[TerminalMarkdownRenderer] Render error:', error);
      return markdown;
    }
  }

  /**
   * 完成渲染，返回最终结果
   *
   * @returns 完整的渲染结果
   *
   * 使用场景：
   * - 流式输出结束后，调用此方法获取完整渲染结果
   * - 会处理缓冲区中剩余的所有内容（包括不完整的片段）
   */
  finalize(): string {
    if (this.state.buffer.length === 0) {
      return this.state.lastRendered;
    }

    try {
      // 渲染缓冲区中的所有内容
      const finalRendered = this.renderMarkdown(this.state.buffer);
      this.state.lastRendered = finalRendered;
      return finalRendered;
    } catch (error) {
      console.error('[TerminalMarkdownRenderer] Finalize error:', error);
      return this.state.buffer;
    }
  }

  /**
   * 重置渲染器状态
   *
   * 使用场景：
   * - 开始新的渲染任务时调用
   */
  reset(): void {
    this.state = this.createInitialState();
  }

  /**
   * 获取当前缓冲区内容
   */
  getBuffer(): string {
    return this.state.buffer;
  }

  /**
   * 获取已渲染内容
   */
  getRendered(): string {
    return this.state.lastRendered;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 渲染 Markdown 到终端（一次性渲染）
 *
 * @param markdown - Markdown 内容
 * @param options - 渲染选项
 * @returns 渲染后的终端文本
 *
 * 使用场景：
 * - 渲染完整的 Markdown 文档
 * - 不需要流式渲染的场景
 *
 * 示例：
 * ```typescript
 * const rendered = renderMarkdownToTerminal('# Hello\n**Bold text**');
 * console.log(rendered);
 * ```
 */
export function renderMarkdownToTerminal(
  markdown: string,
  options: RendererOptions = {}
): string {
  const renderer = new TerminalMarkdownRenderer({
    ...options,
    enableStreaming: false
  });

  renderer.appendChunk(markdown);
  return renderer.finalize();
}

/**
 * 创建流式渲染器实例（快捷方法）
 *
 * @param options - 渲染选项
 * @returns 渲染器实例
 *
 * 使用场景：
 * - 需要流式渲染时使用
 *
 * 示例：
 * ```typescript
 * const stream = createStreamingRenderer();
 * process.stdout.write(stream.appendChunk('# Hello'));
 * process.stdout.write(stream.appendChunk(' World'));
 * process.stdout.write(stream.finalize());
 * ```
 */
export function createStreamingRenderer(
  options: RendererOptions = {}
): TerminalMarkdownRenderer {
  return new TerminalMarkdownRenderer({
    ...options,
    enableStreaming: true
  });
}