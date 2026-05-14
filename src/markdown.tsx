/**
 * Ink-compatible terminal Markdown renderer
 *
 * Two modes:
 *   streaming=false (default): one-shot full render via renderMarkdownToTerminal
 *   streaming=true: incremental render using a ref-persisted TerminalMarkdownRenderer
 *
 * Uses useMemo (synchronous) instead of useEffect+setState to avoid the
 * extra Ink render cycle that caused visible flashing.
 */

import React, { useRef, useMemo } from 'react';
import { Text } from 'ink';
import {
  renderMarkdownToTerminal,
  TerminalMarkdownRenderer
} from './utils/terminalMarkdownRenderer.js';

const RENDER_OPTS = { enableHighlight: true, enableColor: true, escapeHtml: false };

export interface MarkdownProps {
  children: string;
  /** Set to true while content is still streaming in; false (default) for finalized text */
  streaming?: boolean;
}

export function Markdown({ children, streaming = false }: MarkdownProps): JSX.Element {
  // Persistent incremental renderer for streaming mode.
  // Ref survives renders without triggering re-renders itself.
  const rendererRef = useRef<TerminalMarkdownRenderer | null>(null);
  const prevLenRef = useRef(0);

  // useMemo ensures rendering is synchronous with the Ink render pass —
  // no extra useState cycle, no second redraw.
  const rendered = useMemo(() => {
    if (!children) return '';

    if (streaming) {
      // Create renderer on first chunk; reuse on subsequent chunks.
      if (!rendererRef.current) {
        rendererRef.current = new TerminalMarkdownRenderer({ ...RENDER_OPTS, enableStreaming: true });
        prevLenRef.current = 0;
      }
      const newContent = children.slice(prevLenRef.current);
      if (newContent.length > 0) {
        rendererRef.current.appendChunk(newContent);
        prevLenRef.current = children.length;
      }
      return rendererRef.current.finalize();
    } else {
      // Finalize any leftover streaming renderer, then do a clean full render.
      rendererRef.current = null;
      prevLenRef.current = 0;
      return renderMarkdownToTerminal(children, RENDER_OPTS);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, streaming]);

  return <Text>{rendered}</Text>;
}
