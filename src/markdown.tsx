/**
 * Ink 适配的终端 Markdown 渲染器
 *
 * 支持流式增量渲染，实时显示 Agent 输出
 */

import React, { useEffect, useRef } from 'react';
import { Text } from 'ink';
import {
  renderMarkdownToTerminal,
  createStreamingRenderer,
  type TerminalMarkdownRenderer
} from './utils/terminalMarkdownRenderer.js';

export interface MarkdownProps {
  children: string;
  streaming?: boolean;  // 是否正在流式输出
}

/**
 * Ink Markdown 组件
 *
 * 特性：
 * - 代码高亮（180+ 语言）
 * - GFM 扩展（表格、任务列表等）
 * - 流式渲染支持
 * - 自动颜色支持
 */
export function Markdown({ children, streaming = false }: MarkdownProps): JSX.Element {
  const rendererRef = useRef<TerminalMarkdownRenderer | null>(null);
  const lastContentRef = useRef<string>('');
  const [rendered, setRendered] = React.useState<string>('');

  useEffect(() => {
    if (!children || children.trim().length === 0) {
      setRendered('');
      return;
    }

    try {
      if (streaming) {
        // 流式模式：使用增量渲染
        if (!rendererRef.current) {
          rendererRef.current = createStreamingRenderer({
            enableHighlight: true,
            enableColor: true,
            escapeHtml: false
          });
        }

        // 计算新增的内容
        const newContent = children.slice(lastContentRef.current.length);
        if (newContent.length > 0) {
          // 追加新内容并获取完整渲染结果
          rendererRef.current.appendChunk(newContent);
          const fullRendered = rendererRef.current.getRendered() ||
                               rendererRef.current.getBuffer();
          setRendered(fullRendered);
          lastContentRef.current = children;
        }
      } else {
        // 非流式模式：完整渲染
        // 如果之前在流式模式，先完成渲染
        if (rendererRef.current) {
          const finalRendered = rendererRef.current.finalize();
          setRendered(finalRendered);
          rendererRef.current = null;
          lastContentRef.current = '';
        } else {
          // 直接渲染完整内容
          const result = renderMarkdownToTerminal(children, {
            enableHighlight: true,
            enableColor: true,
            escapeHtml: false
          });
          setRendered(result);
        }
      }
    } catch (error) {
      console.error('[Markdown] Render error:', error);
      setRendered(children); // 渲染失败时返回原始文本
    }
  }, [children, streaming]);

  // 清理：组件卸载时重置
  useEffect(() => {
    return () => {
      rendererRef.current = null;
      lastContentRef.current = '';
    };
  }, []);

  return <Text>{rendered}</Text>;
}

