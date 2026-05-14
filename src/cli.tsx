#!/usr/bin/env node

/**
 * bincode CLI entry point
 *
 * This is the main entry point for the CLI application.
 * It delegates to the modular CLI implementation in src/cli/.
 */

import { runCLI } from './cli/index.js';

// Parse command line arguments
const args = process.argv.slice(2);
const initialInput = args.length > 0 ? args.join(' ') : undefined;

runCLI({ initialInput }).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
