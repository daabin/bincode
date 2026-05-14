# bincode - AI Code Agent

AI-powered code assistance with DeepSeek.

## Features

- 🤖 **Inline Code Completion** - GitHub Copilot-like suggestions
- 💬 **Interactive Chat** - Ask questions about your code
- 🔍 **Code Explanation** - Understand complex code
- ♻️ **Code Refactoring** - Improve code quality
- 🔧 **Fix Issues** - Automatically fix bugs
- ✨ **Code Generation** - Generate code from comments

## Setup

1. Get a DeepSeek API key from [platform.deepseek.com](https://platform.deepseek.com)
2. Open VSCode Settings
3. Search for "bincode"
4. Enter your API key in `bincode.apiKey`

Or set the `DEEPSEEK_API_KEY` environment variable.

## Usage

### Inline Completion
Just start typing - suggestions will appear automatically.

### Commands
- **Explain Code**: Select code → Right-click → "bincode: Explain Selected Code"
- **Refactor Code**: Select code → Right-click → "bincode: Refactor Selected Code"
- **Fix Issues**: Select code → Right-click → "bincode: Fix Issues"
- **Generate Code**: Write a comment → Right-click → "bincode: Generate Code from Comment"
- **Chat**: Click bincode icon in sidebar or run "bincode: Open Chat"

### Keyboard Shortcuts
You can add custom keybindings in VSCode:
- `Ctrl+Shift+E`: Explain code
- `Ctrl+Shift+R`: Refactor code
- `Ctrl+Shift+F`: Fix issues

## Configuration

- `bincode.apiKey`: Your DeepSeek API key
- `bincode.baseUrl`: API base URL (default: https://api.deepseek.com)
- `bincode.model`: Model to use (default: deepseek-chat)
- `bincode.enableInlineCompletion`: Enable/disable inline completion
- `bincode.completionDelay`: Delay before showing completion (ms)
- `bincode.maxCompletionTokens`: Maximum tokens for completion

## Links

- [GitHub Repository](https://github.com/daabin/bincode)
- [DeepSeek Platform](https://platform.deepseek.com)

## License

MIT
