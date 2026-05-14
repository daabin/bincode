/**
 * 流式 Markdown 渲染组件
 *
 * 使用 useStdout 直接写入终端,避免 React 重渲染导致的闪烁
 * 适用于 Agent 流式输出场景
 */

import React, { useEffect, useRef } from 'react';
import { useStdout } from 'ink';
import { createStreamingRenderer, type TerminalMarkdownRenderer } from './utils/terminalMarkdownRenderer.js';

export interface StreamingMarkdownProps {
  /** Markdown 内容 */
  children: string;
  /** 是否正在流式输出 */
  streaming?: boolean;
  /** 完成回调 */
  onComplete?: () => void;
}

/**
 * 流式 Markdown 组件
 *
 * 核心特性:
 * 1. 使用 useStdout.write() 直接写入终端
 * 2. 只输出增量内容,避免重复渲染
 * 3. 完全绕过 React 的重渲染机制
 * 4. 零闪烁,性能最优
 *
 * 使用示例:
 * ```tsx
 * <StreamingMarkdown streaming={true}>
 *   {accumulatedContent}
 * </StreamingMarkdown>
 * ```
 */
export function StreamingMarkdown({
  children,
  streaming = false,
  onComplete
}: StreamingMarkdownProps): JSX.Element {
  const { write } = useStdout();
  const rendererRef = useRef<TerminalMarkdownRenderer | null>(null);
  const lastContentRef = useRef<string>('');
  const hasWrittenRef = useRef(false);

  useEffect(() => {
    if (!children || children.trim().length === 0) {
      return;
    }

    try {
      if (streaming) {
        // ===== 流式模式 =====
        if (!rendererRef.current) {
          // 初始化渲染器
          rendererRef.current = createStreamingRenderer({
            enableHighlight: true,
            enableColor: true,
            escapeHtml: false
          });
          hasWrittenRef.current = false;
        }

        // 计算新增的内容
        const newContent = children.slice(lastContentRef.current.length);

        if (newContent.length > 0) {
          // 渲染新增内容
          const incrementRendered = rendererRef.current.appendChunk(newContent);

          if (incrementRendered) {
            // 直接写入终端,不触发 React 重渲染
            write(incrementRendered);
            hasWrittenRef.current = true;
          }

          lastContentRef.current = children;
        }
      } else {
        // ===== 非流式模式 (完成状态) =====
        if (rendererRef.current) {
          // 完成流式渲染
          const finalRendered = rendererRef.current.finalize();
          const lastRendered = rendererRef.current.getRendered();

          // 计算最后的增量部分
          if (finalRendered !== lastRendered) {
            const increment = finalRendered.substring(lastRendered.length);
            if (increment) {
              write(increment);
            }
          }

          // 添加换行符,确保后续内容不会接在同一行
          if (hasWrittenRef.current) {
            write('\n');
          }

          // 清理
          rendererRef.current = null;
          lastContentRef.current = '';
          hasWrittenRef.current = false;

          // 触发完成回调
          onComplete?.();
        }
      }
    } catch (error) {
      console.error('[StreamingMarkdown] Render error:', error);
      // 错误时输出原始文本
      write(children);
    }
  }, [children, streaming, write, onComplete]);

  // 清理
  useEffect(() => {
    return () => {
      rendererRef.current = null;
      lastContentRef.current = '';
      hasWrittenRef.current = false;
    };
  }, []);

  // 这个组件不渲染任何内容到 React tree
  // 所有输出都直接写入 stdout
  return <></>;
}
