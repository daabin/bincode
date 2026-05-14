/**
 * Shell command execution service
 * Provides secure command execution with whitelist/blacklist support
 */

import { spawn } from 'node:child_process';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface IShellService {
  execute(command: string, args: string[], timeout?: number): Promise<CommandResult>;
  isCommandAllowed(command: string): boolean;
  getAllowedCommands(): string[];
}

export class SecureShellService implements IShellService {
  private readonly defaultAllowedCommands = [
    'npm', 'git', 'node', 'tsc', 'eslint', 'npx', 'yarn', 'pnpm',
    'cat', 'ls', 'pwd', 'echo', 'head', 'tail', 'wc', 'sort', 'uniq',
    'rg', 'grep', 'find', 'sed', 'awk',
    'curl', 'wget',
    'python', 'python3', 'node',
    'mkdir', 'cp', 'mv', 'rm',
    'docker', 'docker-compose',
    'make', 'cmake',
    'cargo', 'go', 'rustc',
    'deno', 'bun'
  ];

  constructor(
    private readonly cwd: string,
    private readonly allowedCommands?: string[],
    private readonly deniedCommands?: string[]
  ) {}

  getAllowedCommands(): string[] {
    return this.allowedCommands ?? this.defaultAllowedCommands;
  }

  isCommandAllowed(command: string): boolean {
    const baseCommand = command.split('/').pop()?.split(' ')[0] || command;

    // Check denied list first
    if (this.deniedCommands?.includes(baseCommand)) {
      return false;
    }

    // Check allowed list
    const allowed = this.allowedCommands ?? this.defaultAllowedCommands;
    return allowed.includes(baseCommand);
  }

  async execute(command: string, args: string[], timeout: number = 30): Promise<CommandResult> {
    if (!this.isCommandAllowed(command)) {
      throw new Error(
        `Command "${command}" is not in the allowed list. Allowed commands: ${this.getAllowedCommands().join(', ')}`
      );
    }

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: this.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        timeout: timeout * 1000
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to execute command: ${error.message}`));
      });

      child.on('close', (exitCode) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: exitCode ?? -1
        });
      });
    });
  }
}
