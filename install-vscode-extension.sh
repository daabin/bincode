#!/bin/bash

# bincode VSCode 扩展 - 安装指南
# ================================

echo "🎉 bincode VSCode Extension v0.3.0"
echo "===================================="
echo ""

VSIX_FILE="/Users/daabin/codinglab/bincode/dist-extension/bincode-vscode-0.3.0.vsix"

# 检查文件是否存在
if [ ! -f "$VSIX_FILE" ]; then
    echo "❌ Extension file not found: $VSIX_FILE"
    echo "   Run: npm run build:extension && npm run package:extension"
    exit 1
fi

echo "✅ Found extension: bincode-vscode-0.3.0.vsix (53KB)"
echo ""

# 显示功能列表
echo "📋 Features:"
echo "   🤖 Inline Code Completion (like GitHub Copilot)"
echo "   💬 Interactive Chat in Sidebar"
echo "   🔍 Code Explanation"
echo "   ♻️  Code Refactoring"
echo "   🔧 Automatic Bug Fixing"
echo "   ✨ Code Generation from Comments"
echo ""

# 询问是否安装
read -p "📥 Install extension to VSCode? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# 卸载旧版本
echo "🗑️  Uninstalling old version (if exists)..."
code --uninstall-extension daabin.bincode-vscode 2>/dev/null
sleep 1

# 安装新版本
echo "📥 Installing bincode-vscode-0.3.0.vsix..."
code --install-extension "$VSIX_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Installation successful!"
    echo ""
    echo "⚙️  Next Steps:"
    echo "1. Restart VSCode (Cmd/Ctrl + Q then reopen)"
    echo "2. Configure API Key:"
    echo "   • Open Settings (Cmd/Ctrl + ,)"
    echo "   • Search: bincode.apiKey"
    echo "   • Enter your DeepSeek API key"
    echo ""
    echo "   Or set environment variable:"
    echo "   export DEEPSEEK_API_KEY='sk-your-key-here'"
    echo ""
    echo "3. Try it out:"
    echo "   • Type code → See inline suggestions"
    echo "   • Select code → Right-click → bincode commands"
    echo "   • Click bincode icon in sidebar → Chat"
    echo ""
    echo "📚 Documentation: ./VSCODE_EXTENSION.md"
    echo ""

    # 询问是否打开 VSCode
    read -p "Open VSCode now? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        code .
    fi
else
    echo "❌ Installation failed"
    exit 1
fi
