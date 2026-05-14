# bincode VSCode 扩展开发指南

## 📋 功能概述

bincode VSCode 扩展提供了强大的 AI 辅助编码功能：

### 核心功能

#### 1. **内联代码补全** 🤖
- 类似 GitHub Copilot 的实时代码建议
- 自动检测上下文并提供相关补全
- 支持所有编程语言
- 可配置触发延迟

#### 2. **代码解释** 🔍
- 选中代码 → 右键 → "bincode: Explain Selected Code"
- 在新标签页中显示详细解释
- 支持 Markdown 格式

#### 3. **代码重构** ♻️
- 选中代码 → 右键 → "bincode: Refactor Selected Code"
- AI 建议改进方案
- 保持代码功能不变

#### 4. **问题修复** 🔧
- 选中代码 → 右键 → "bincode: Fix Issues"
- 自动发现并修复 bug
- 给出修复建议

#### 5. **代码生成** ✨
- 写注释描述需求
- 光标移到注释行
- 右键 → "bincode: Generate Code from Comment"
- 自动生成实现代码

#### 6. **交互式聊天** 💬
- 侧边栏聊天界面
- 实时流式响应
- 完整的工具调用支持
- 会话持久化

## 🚀 构建扩展

### 前置要求

```bash
# Node.js >= 18.17
node --version

# 安装依赖
npm install
```

### 构建步骤

```bash
# 1. 构建扩展
npm run build:extension

# 输出目录: dist-extension/
# 包含:
# - extension.js (编译后的代码)
# - package.json (扩展清单)
# - README.md (扩展说明)
# - resources/ (图标等资源)
```

### 打包扩展

```bash
# 2. 打包为 .vsix 文件
npm run package:extension

# 生成: dist-extension/bincode-vscode-0.3.0.vsix
```

### 发布到市场

```bash
# 3. 发布到 VSCode Marketplace
npm run publish:extension

# 需要先配置 Personal Access Token
# https://code.visualstudio.com/api/working-with-extensions/publishing-extension
```

## 📦 安装使用

### 方式 1: 从 VSIX 安装（开发测试）

```bash
# 1. 构建并打包
npm run build:extension
npm run package:extension

# 2. 在 VSCode 中安装
# 方法 A: 命令面板
code --install-extension dist-extension/bincode-vscode-0.3.0.vsix

# 方法 B: VSCode UI
# Extensions → ... → Install from VSIX → 选择 .vsix 文件
```

### 方式 2: 开发模式（实时调试）

```bash
# 1. 在 VSCode 中打开项目
code /Users/daabin/codinglab/bincode

# 2. 按 F5 或 Run → Start Debugging
# 会打开新的 Extension Development Host 窗口

# 3. 在新窗口中测试扩展功能
```

### 方式 3: 从市场安装（发布后）

```bash
# 在 VSCode Extensions 中搜索 "bincode"
# 或访问: https://marketplace.visualstudio.com/items?itemName=daabin.bincode-vscode
```

## ⚙️ 配置

### 1. 设置 API Key

```json
// settings.json
{
  "bincode.apiKey": "sk-your-deepseek-api-key",
  "bincode.baseUrl": "https://api.deepseek.com",
  "bincode.model": "deepseek-chat"
}
```

或设置环境变量：
```bash
export DEEPSEEK_API_KEY="sk-your-key"
```

### 2. 配置内联补全

```json
{
  "bincode.enableInlineCompletion": true,
  "bincode.completionDelay": 300,        // 延迟 300ms
  "bincode.maxCompletionTokens": 100     // 最多 100 tokens
}
```

### 3. 完整配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `bincode.apiKey` | string | "" | DeepSeek API Key |
| `bincode.baseUrl` | string | "https://api.deepseek.com" | API 地址 |
| `bincode.model` | string | "deepseek-chat" | 使用的模型 |
| `bincode.enableInlineCompletion` | boolean | true | 启用内联补全 |
| `bincode.completionDelay` | number | 300 | 补全延迟 (ms) |
| `bincode.maxCompletionTokens` | number | 100 | 补全最大 tokens |

## 🎯 使用示例

### 内联补全

```typescript
// 1. 开始输入
function calculateSum(

// 2. 等待 300ms，出现补全建议
// 建议: a: number, b: number): number {
//   return a + b;
// }

// 3. 按 Tab 接受建议
```

### 代码解释

```typescript
// 1. 选中这段代码
const fibonacci = (n: number): number => {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
};

// 2. 右键 → "bincode: Explain Selected Code"

// 3. 在新标签页看到解释：
// # 斐波那契数列递归实现
// 
// 这段代码实现了斐波那契数列的递归算法...
```

### 代码生成

```typescript
// 1. 写注释
// Create a React component that displays user profile with avatar and name

// 2. 光标放在注释行
// 3. 右键 → "bincode: Generate Code from Comment"

// 4. 自动生成：
interface UserProfileProps {
  avatar: string;
  name: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ avatar, name }) => {
  return (
    <div className="user-profile">
      <img src={avatar} alt={name} />
      <h3>{name}</h3>
    </div>
  );
};
```

### 聊天功能

```
1. 点击侧边栏的 bincode 图标
2. 在聊天框输入问题：
   "How do I optimize this React component for performance?"

3. 实时获得回答，包括：
   - 文字解释
   - 代码示例
   - 工具调用（如读取文件、搜索代码）
```

## 🔧 开发调试

### 调试扩展

1. **打开调试面板**
   ```
   F5 或 Run → Start Debugging
   ```

2. **查看日志**
   ```
   View → Output → 选择 "bincode"
   ```

3. **断点调试**
   - 在 `src/interfaces/vscode/` 中的文件设置断点
   - Extension Development Host 窗口触发功能
   - 回到主窗口查看断点

### 修改代码

```bash
# 1. 修改源代码
# src/interfaces/vscode/extension.ts

# 2. 重新构建
npm run build:extension

# 3. 在 Extension Development Host 中
# Ctrl+R (Cmd+R) 重新加载窗口
```

### 常见问题

#### Q: 内联补全不工作？
```bash
# 检查配置
# 1. 打开设置，搜索 "bincode.enableInlineCompletion"
# 2. 确保为 true
# 3. 检查 Output → bincode 的日志
```

#### Q: API 调用失败？
```bash
# 检查 API Key
# 1. 设置中查看 bincode.apiKey
# 2. 或检查环境变量 DEEPSEEK_API_KEY
# 3. 测试 API: curl https://api.deepseek.com/chat/completions
```

#### Q: 扩展无法激活？
```bash
# 1. 查看错误信息
# Help → Toggle Developer Tools → Console

# 2. 重新安装
code --uninstall-extension daabin.bincode-vscode
code --install-extension dist-extension/bincode-vscode-0.3.0.vsix
```

## 📁 项目结构

```
src/interfaces/vscode/
├── extension.ts                    # 主入口
├── inline-completion-provider.ts   # 内联补全
├── chat-view-provider.ts          # 聊天视图
└── completion-provider.ts          # 补全逻辑

resources/
├── icon.svg                        # 扩展图标 (SVG)
└── icon.png                        # 扩展图标 (PNG)

scripts/
└── build-extension.js              # 构建脚本

extension.package.json              # 扩展清单
tsconfig.extension.json             # TypeScript 配置
```

## 🎨 自定义扩展

### 添加新命令

```typescript
// src/interfaces/vscode/extension.ts

context.subscriptions.push(
  vscode.commands.registerCommand('bincode.myCommand', async () => {
    // 你的逻辑
  })
);
```

### 修改图标

```bash
# 1. 替换图标文件
resources/icon.svg    # 推荐 SVG
resources/icon.png    # 或 PNG (128x128)

# 2. 重新构建
npm run build:extension
```

### 添加配置项

```json
// extension.package.json → contributes.configuration.properties

"bincode.myNewSetting": {
  "type": "string",
  "default": "value",
  "description": "My custom setting"
}
```

## 📊 性能优化

### 减少 API 调用

```json
// 增加补全延迟
{
  "bincode.completionDelay": 500  // 从 300ms 增加到 500ms
}
```

### 限制补全长度

```json
{
  "bincode.maxCompletionTokens": 50  // 从 100 减少到 50
}
```

### 禁用内联补全

```json
{
  "bincode.enableInlineCompletion": false  // 只使用命令
}
```

## 🚢 发布清单

- [ ] 更新版本号 (`extension.package.json`)
- [ ] 更新 CHANGELOG
- [ ] 测试所有功能
- [ ] 构建扩展 (`npm run build:extension`)
- [ ] 打包 (`npm run package:extension`)
- [ ] 本地测试 `.vsix` 文件
- [ ] 发布到市场 (`npm run publish:extension`)

## 📚 相关链接

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [DeepSeek API](https://platform.deepseek.com/docs)

---

**开发者**: daabin  
**许可证**: MIT  
**仓库**: https://github.com/daabin/bincode
