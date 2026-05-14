"use strict";
/**
 * Git tools
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.gitTools = void 0;
exports.gitTools = [
    {
        name: 'git_status',
        description: 'Show git repository status including modified, staged, and untracked files.',
        category: 'git',
        parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false
        },
        handler: async (_args, { services }) => {
            const status = await services.git.status();
            const lines = [`Branch: ${status.branch}`];
            if (status.ahead > 0 || status.behind > 0) {
                lines.push(`Remote: ${status.ahead} ahead, ${status.behind} behind`);
            }
            if (status.staged.length > 0) {
                lines.push('', 'Staged changes:');
                status.staged.forEach(f => lines.push(`  ✅ ${f}`));
            }
            if (status.modified.length > 0) {
                lines.push('', 'Modified (unstaged):');
                status.modified.forEach(f => lines.push(`  📝 ${f}`));
            }
            if (status.untracked.length > 0) {
                lines.push('', 'Untracked files:');
                status.untracked.forEach(f => lines.push(`  ❓ ${f}`));
            }
            if (status.staged.length === 0 && status.modified.length === 0 && status.untracked.length === 0) {
                lines.push('', 'Working tree clean.');
            }
            return lines.join('\n');
        }
    },
    {
        name: 'git_diff',
        description: 'Show git diff for modified files.',
        category: 'git',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Optional file path to show diff for specific file.' },
                staged: { type: 'boolean', description: 'Show staged changes instead of unstaged. Default false.' }
            },
            additionalProperties: false
        },
        handler: async (args, { services }) => {
            return services.git.diff({
                path: args.path,
                staged: args.staged
            });
        }
    },
    {
        name: 'git_log',
        description: 'Show recent git commit history.',
        category: 'git',
        parameters: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Number of commits to show. Default 10.' },
                path: { type: 'string', description: 'Optional file path to show history for specific file.' }
            },
            additionalProperties: false
        },
        handler: async (args, { services }) => {
            const commits = await services.git.log({
                limit: args.limit || 10,
                path: args.path
            });
            if (commits.length === 0)
                return 'No commits found.';
            return commits.map(c => `${c.hash.substring(0, 8)} | ${c.date} | ${c.author} | ${c.message}`).join('\n');
        }
    },
    {
        name: 'git_branch',
        description: 'List, create, or delete git branches.',
        category: 'git',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['list', 'create', 'delete', 'current'], description: 'Action to perform: list, create, delete, or get current branch.' },
                name: { type: 'string', description: 'Branch name for create or delete actions.' },
                all: { type: 'boolean', description: 'List all branches including remote. Default false.' }
            },
            required: ['action'],
            additionalProperties: false
        },
        handler: async (args, { services }) => {
            const branches = await services.git.branch(args.action, args.name, args.all);
            return branches.join('\n');
        }
    },
    {
        name: 'git_checkout',
        description: 'Switch branches or restore working tree files.',
        category: 'git',
        parameters: {
            type: 'object',
            properties: {
                target: { type: 'string', description: 'Branch name to switch to, or file path to restore.' },
                create_branch: { type: 'boolean', description: 'Create a new branch and switch to it. Default false.' }
            },
            required: ['target'],
            additionalProperties: false
        },
        handler: async (args, { services }) => {
            const result = await services.git.checkout(args.target, args.create_branch);
            return result || `Switched to: ${args.target}`;
        }
    },
    {
        name: 'git_commit',
        description: 'Create a git commit with the staged changes. Can generate commit message from diff.',
        category: 'git',
        parameters: {
            type: 'object',
            properties: {
                message: { type: 'string', description: 'Commit message. If not provided, will show staged changes.' },
                all: { type: 'boolean', description: 'Automatically stage modified and deleted files. Default false.' }
            },
            additionalProperties: false
        },
        handler: async (args, { services }) => {
            const result = await services.git.commit({
                message: args.message,
                all: args.all
            });
            return result;
        }
    },
    {
        name: 'git_add',
        description: 'Stage file changes for commit.',
        category: 'git',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File or directory path to stage. Use "." for all changes.' }
            },
            required: ['path'],
            additionalProperties: false
        },
        handler: async (args, { services }) => {
            await services.git.add(args.path);
            return `Staged: ${args.path}`;
        }
    },
    {
        name: 'git_stash',
        description: 'Stash or unstash changes.',
        category: 'git',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['push', 'pop', 'list', 'drop'], description: 'Stash action to perform.' },
                message: { type: 'string', description: 'Message for stash push.' }
            },
            required: ['action'],
            additionalProperties: false
        },
        handler: async (args, { services }) => {
            const result = await services.git.stash(args.action, args.message);
            return result || `Stash ${args.action} completed.`;
        }
    },
    {
        name: 'git_blame',
        description: 'Show blame information for a file.',
        category: 'git',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'File path to show blame for.' }
            },
            required: ['path'],
            additionalProperties: false
        },
        handler: async (args, { services }) => {
            const entries = await services.git.blame(args.path);
            return entries.map(e => `${String(e.line).padStart(4)} | ${e.hash.substring(0, 8)} | ${e.author.padEnd(20)} | ${e.content}`).join('\n');
        }
    }
];
