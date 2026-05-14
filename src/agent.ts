/**
 * Agent - Backward-compatible wrapper
 *
 * Re-exports the new Agent from core/ for backward compatibility.
 * New code should import from './core/agent.js' directly.
 */

export { Agent } from './core/agent.js';
export type { AgentOptions } from './core/agent.js';
