/**
 * CLI entry point
 */

import React from 'react';
import { render } from 'ink';
import { App } from './app.js';

export function runCLI(options: { initialInput?: string; cwd?: string } = {}) {
  const { waitUntilExit } = render(
    <App initialInput={options.initialInput} cwd={options.cwd} />
  );

  return waitUntilExit();
}
