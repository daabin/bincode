"use strict";
/**
 * Shell command execution service
 * Provides secure command execution with whitelist/blacklist support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureShellService = void 0;
const node_child_process_1 = require("node:child_process");
class SecureShellService {
    cwd;
    allowedCommands;
    deniedCommands;
    defaultAllowedCommands = [
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
    constructor(cwd, allowedCommands, deniedCommands) {
        this.cwd = cwd;
        this.allowedCommands = allowedCommands;
        this.deniedCommands = deniedCommands;
    }
    getAllowedCommands() {
        return this.allowedCommands ?? this.defaultAllowedCommands;
    }
    isCommandAllowed(command) {
        const baseCommand = command.split('/').pop()?.split(' ')[0] || command;
        // Check denied list first
        if (this.deniedCommands?.includes(baseCommand)) {
            return false;
        }
        // Check allowed list
        const allowed = this.allowedCommands ?? this.defaultAllowedCommands;
        return allowed.includes(baseCommand);
    }
    async execute(command, args, timeout = 30) {
        if (!this.isCommandAllowed(command)) {
            throw new Error(`Command "${command}" is not in the allowed list. Allowed commands: ${this.getAllowedCommands().join(', ')}`);
        }
        return new Promise((resolve, reject) => {
            const child = (0, node_child_process_1.spawn)(command, args, {
                cwd: this.cwd,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: false,
                timeout: timeout * 1000
            });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr.on('data', (data) => {
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
exports.SecureShellService = SecureShellService;
