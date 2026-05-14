#!/bin/bash

# bincode VSCode 扩展 - 快速测试脚本

echo "🚀 bincode VSCode Extension - Quick Test"
echo "========================================"
echo ""

# 检查环境
echo "📋 Step 1: Checking environment..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js >= 18"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

if ! command -v code &> /dev/null; then
    echo "❌ VSCode CLI not found. Please install VSCode"
    exit 1
fi
echo "✅ VSCode CLI: Available"
echo ""

# 构建扩展
echo "🔨 Step 2: Building extension..."
npm run build:extension
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi
echo "✅ Build successful"
echo ""

# 打包扩展
echo "📦 Step 3: Packaging extension..."
npm run package:extension
if [ $? -ne 0 ]; then
    echo "❌ Package failed"
    exit 1
fi
echo "✅ Package successful"
echo ""

# 查找 .vsix 文件
VSIX_FILE=$(find dist-extension -name "*.vsix" | head -n 1)
if [ -z "$VSIX_FILE" ]; then
    echo "❌ .vsix file not found"
    exit 1
fi
echo "📄 Extension file: $VSIX_FILE"
echo ""

# 询问是否安装
echo "📥 Step 4: Install extension?"
read -p "Install to VSCode now? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 卸载旧版本
    echo "🗑️  Uninstalling old version..."
    code --uninstall-extension daabin.bincode-vscode 2>/dev/null
    sleep 2

    # 安装新版本
    echo "📥 Installing extension..."
    code --install-extension "$VSIX_FILE"
    if [ $? -ne 0 ]; then
        echo "❌ Installation failed"
        exit 1
    fi
    echo "✅ Installation successful"
    echo ""

    # 配置提示
    echo "⚙️  Configuration needed:"
    echo "1. Open VSCode Settings (Cmd/Ctrl + ,)"
    echo "2. Search for 'bincode.apiKey'"
    echo "3. Enter your DeepSeek API key"
    echo ""
    echo "Or set environment variable:"
    echo "export DEEPSEEK_API_KEY='your-key-here'"
    echo ""

    # 打开 VSCode
    read -p "Open VSCode now? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        code .
    fi
fi

echo ""
echo "✨ Done! Extension ready to use."
echo ""
echo "📚 Next steps:"
echo "1. Configure API key in VSCode settings"
echo "2. Try inline completion by typing code"
echo "3. Select code → Right-click → bincode commands"
echo "4. Click bincode icon in sidebar for chat"
echo ""
echo "📖 Full documentation: ./VSCODE_EXTENSION.md"
