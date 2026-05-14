# bincode VSCode 扩展使用指南

## 功能概述

bincode VSCode 扩展提供了强大的 AI 辅助编码功能：

- 🤖 **内联代码补全** - 类似 GitHub Copilot 的实时代码建议
- 🔍 **代码解释** - 理解复杂代码逻辑
- ♻️ **代码重构** - AI 驱动的代码优化建议
- 🔧 **问题修复** - 自动发现并修复 bug
- ✨ **代码生成** - 从注释生成代码实现
- 💬 **交互式聊天** - 侧边栏 AI 助手

## 安装

### 方式 1: 从 VSIX 安装

```bash
# 构建扩展
npm run build:extension
npm run package:extension

# 安装到 VSCode
code --install-extension dist-extension/bincode-vscode-0.3.0.vsix
```

### 方式 2: 开发模式

1. 在 VSCode 中打开项目
2. 按 F5 或 Run → Start Debugging
3. 在新的 Extension Development Host 窗口中测试

## 配置

### 设置 API Key（必需）

**方式 1: VSCode 设置**
```
Settings → 搜索 "bincode.apiKey" → 输入 key
```

**方式 2: 环境变量**
```bash
export DEEPSEEK_API_KEY="sk-your-deepseek-api-key"
```

### 其他配置

```json
{
  "bincode.apiKey": "sk-xxx",
  "bincode.model": "deepseek-chat",
  "bincode.enableInlineCompletion": true,
  "bincode.completionDelay": 300,
  "bincode.maxCompletionTokens": 100
}
```

## 使用方法

### 1. 内联补全

- **触发**: 开始输入代码
- **接受**: 按 `Tab`
- **拒绝**: 按 `Esc` 或继续输入

```typescript
function calculate
// ↑ 自动补全函数签名和实现
```

### 2. 代码操作命令

#### 解释代码
1. 选中代码
2. 右键 → "bincode: Explain Selected Code"
3. 在新标签页查看详细解释

#### 重构代码
1. 选中代码
2. 右键 → "bincode: Refactor Selected Code"
3. 查看 AI 优化建议

#### 修复问题
1. 选中代码
2. 右键 → "bincode: Fix Issues"
3. 自动修复 bug

#### 生成代码
1. 写注释描述需求
2. 光标移到注释行
3. 右键 → "bincode: Generate Code from Comment"
4. 自动生成实现

### 3. 聊天功能

1. 点击侧边栏的 bincode 图标
2. 输入问题
3. 按 `Ctrl/Cmd + Enter` 发送
4. 实时查看流式响应

**支持的功能:**
- 📁 文件读写
- 🔍 代码搜索
- 📦 Git 操作
- 🖥️ Shell 命令
- 更多工具...

## 命令列表

| 命令 | 功能 |
|------|------|
| `bincode.explain` | 解释选中代码 |
| `bincode.refactor` | 重构选中代码 |
| `bincode.fix` | 修复问题 |
| `bincode.generate` | 生成代码 |
| `bincode.chat` | 打开聊天 |
| `bincode.toggleInlineCompletion` | 切换内联补全 |

## 故障排查

### Q: 内联补全不工作？
1. 检查设置: `bincode.enableInlineCompletion = true`
2. 检查 API Key 是否配置
3. 查看 Output → bincode 的日志

### Q: 命令不可用？
1. 重启 VSCode
2. 检查扩展是否启用
3. 查看 Help → Toggle Developer Tools → Console

### Q: API 调用失败？
1. 验证 API Key 是否正确
2. 测试网络连接
3. 检查 `bincode.baseUrl` 配置

## 性能优化

### 减少 API 调用
```json
{
  "bincode.completionDelay": 500,
  "bincode.maxCompletionTokens": 50
}
```

### 禁用内联补全
```json
{
  "bincode.enableInlineCompletion": false
}
```

## 快捷键

你可以在 VSCode 中自定义快捷键：

```json
{
  "key": "ctrl+shift+e",
  "command": "bincode.explain"
},
{
  "key": "ctrl+shift+r",
  "command": "bincode.refactor"
},
{
  "key": "ctrl+shift+f",
  "command": "bincode.fix"
}
```

## 核心优势

### vs GitHub Copilot
✅ 开源 - 完全可定制  
✅ 工具集成 - 27+ 工具（文件、Git、Shell）  
✅ 成本友好 - DeepSeek API 价格低  
✅ 聊天功能 - 完整的 Agent 能力  

### vs 传统 AI 助手
✅ IDE 集成 - 无缝工作流  
✅ 上下文感知 - 理解项目结构  
✅ 实时响应 - 流式输出  
✅ 多种模式 - 补全 + 命令 + 聊天
