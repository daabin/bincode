/**
 * Ink 适配的终端 Markdown 渲染器
 *
 * 将基于 marked 的终端渲染器输出适配到 Ink 组件
 * 支持代码高亮、GFM 扩展、表格等高级特性
 */

import React from 'react';
import { Text } from 'ink';
import { renderMarkdownToTerminal } from './utils/terminalMarkdownRenderer.js';

export interface MarkdownProps {
  children: string;
}

/**
 * Ink Markdown 组件
 *
 * 使用终端 Markdown 渲染器渲染内容，然后在 Ink 中显示
 *
 * 特性：
 * - 代码高亮（180+ 语言）
 * - GFM 扩展（表格、任务列表、删除线等）
 * - 自动颜色支持
 * - HTML 安全转义（Agent 输出不转义）
 * - 性能优化（useMemo 缓存）
 */
export function Markdown({ children }: MarkdownProps): JSX.Element {
  // 使用终端渲染器渲染 Markdown
  const rendered = React.useMemo(() => {
    if (!children || children.trim().length === 0) {
      return '';
    }

    try {
      return renderMarkdownToTerminal(children, {
        enableHighlight: true,
        enableColor: true,
        escapeHtml: false, // Agent 输出不需要转义
        enableStreaming: false
      });
    } catch (error) {
      console.error('[Markdown] Render error:', error);
      return children; // 渲染失败时返回原始文本
    }
  }, [children]);

  // Ink 中显示已渲染的内容
  // 注意：渲染后的内容已经包含 ANSI 颜色代码和换行符
  return <Text>{rendered}</Text>;
}

