"use strict";
/**
 * System tools (command execution, etc.)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemTools = void 0;
exports.systemTools = [
    {
        name: 'run_command',
        description: 'Execute a shell command and return output. Only whitelisted commands are allowed for security.',
        category: 'system',
        parameters: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'Command to execute (must be in whitelist: npm, git, node, tsc, eslint, etc).' },
                args: { type: 'array', items: { type: 'string' }, description: 'Command arguments.' },
                timeout: { type: 'number', description: 'Timeout in seconds. Default 30.' }
            },
            required: ['command'],
            additionalProperties: false
        },
        handler: async (args, { services }) => {
            const result = await services.shell.execute(args.command, args.args || [], args.timeout || 30);
            let output = `Exit code: ${result.exitCode}`;
            if (result.stdout)
                output += `\n\n${result.stdout}`;
            if (result.stderr)
                output += `\n\nSTDERR:\n${result.stderr}`;
            return output;
        }
    }
];
