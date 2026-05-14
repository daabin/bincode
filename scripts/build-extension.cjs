/**
 * VSCode Extension Build Script
 *
 * Builds the extension from TypeScript source
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building bincode VSCode extension...\n');

// 1. Compile TypeScript
console.log('1️⃣  Compiling TypeScript...');
try {
  execSync('tsc -p tsconfig.extension.json', { stdio: 'inherit' });
  console.log('   ✓ TypeScript compiled\n');
} catch (error) {
  console.error('   ✗ TypeScript compilation failed');
  process.exit(1);
}

// 2. Copy package.json
console.log('2️⃣  Preparing extension package...');
const extPackageJson = JSON.parse(
  fs.readFileSync('extension.package.json', 'utf8')
);

// VSCode extension doesn't need dependencies - code is pre-bundled
// Remove dependencies to avoid vsce package errors
delete extPackageJson.dependencies;

// Write to dist-extension
if (!fs.existsSync('dist-extension')) {
  fs.mkdirSync('dist-extension', { recursive: true });
}
fs.writeFileSync(
  'dist-extension/package.json',
  JSON.stringify(extPackageJson, null, 2)
);
console.log('   ✓ Package prepared\n');

// 3. Copy resources
console.log('3️⃣  Copying resources...');
const resourcesDir = path.join(__dirname, '..', 'resources');
const distResourcesDir = path.join(__dirname, '..', 'dist-extension', 'resources');

if (fs.existsSync(resourcesDir)) {
  if (!fs.existsSync(distResourcesDir)) {
    fs.mkdirSync(distResourcesDir, { recursive: true });
  }

  // Copy icon files if they exist
  ['icon.png', 'icon.svg'].forEach(file => {
    const src = path.join(resourcesDir, file);
    const dest = path.join(distResourcesDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`   ✓ Copied ${file}`);
    }
  });
}
console.log('\n   ✓ Resources copied\n');

// 3.5. Copy LICENSE
console.log('3️⃣.5  Copying LICENSE...');
if (fs.existsSync('LICENSE')) {
  fs.copyFileSync('LICENSE', 'dist-extension/LICENSE');
  console.log('   ✓ LICENSE copied\n');
} else {
  console.log('   ⚠️  LICENSE not found\n');
}

// 4. Create README for extension
console.log('4️⃣  Creating README...');
const readme = `# bincode - AI Code Agent

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
4. Enter your API key in \`bincode.apiKey\`

Or set the \`DEEPSEEK_API_KEY\` environment variable.

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
- \`Ctrl+Shift+E\`: Explain code
- \`Ctrl+Shift+R\`: Refactor code
- \`Ctrl+Shift+F\`: Fix issues

## Configuration

- \`bincode.apiKey\`: Your DeepSeek API key
- \`bincode.baseUrl\`: API base URL (default: https://api.deepseek.com)
- \`bincode.model\`: Model to use (default: deepseek-chat)
- \`bincode.enableInlineCompletion\`: Enable/disable inline completion
- \`bincode.completionDelay\`: Delay before showing completion (ms)
- \`bincode.maxCompletionTokens\`: Maximum tokens for completion

## Links

- [GitHub Repository](https://github.com/daabin/bincode)
- [DeepSeek Platform](https://platform.deepseek.com)

## License

MIT
`;

fs.writeFileSync('dist-extension/README.md', readme);
console.log('   ✓ README created\n');

console.log('✅ Build complete!\n');
console.log('📦 Extension ready in dist-extension/\n');
console.log('To package: npm run package');
console.log('To publish: npm run publish');
