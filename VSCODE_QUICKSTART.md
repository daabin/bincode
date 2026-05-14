# 🚀 bincode VSCode Extension - Quick Reference

## ✅ **扩展已成功构建！**

**文件位置：** `dist-extension/bincode-vscode-0.3.0.vsix` (53KB)

---

## 📦 安装方法

### 方式 1: 自动安装（推荐）
```bash
./install-vscode-extension.sh
```

### 方式 2: 手动安装
```bash
code --install-extension dist-extension/bincode-vscode-0.3.0.vsix
```

### 方式 3: VSCode UI
1. VSCode → Extensions (Cmd/Ctrl + Shift + X)
2. 点击 `...` → `Install from VSIX...`
3. 选择 `bincode-vscode-0.3.0.vsix`

---

## ⚙️ 配置

### 设置 API Key（必需）

**方式 1: VSCode 设置**
```
Settings → 搜索 "bincode.apiKey" → 输入 key
```

**方式 2: 环境变量**
```bash
export DEEPSEEK_API_KEY="sk-your-deepseek-api-key"
```

### 其他配置（可选）
```json
{
  "bincode.apiKey": "sk-xxx",                    // API Key
  "bincode.model": "deepseek-chat",              // 模型
  "bincode.enableInlineCompletion": true,        // 启用内联补全
  "bincode.completionDelay": 300,                // 延迟(ms)
  "bincode.maxCompletionTokens": 100             // 最大 tokens
}
```

---

## 🎯 使用方法

### 1. 内联补全 🤖
- **触发：** 开始输入代码
- **接受：** 按 `Tab`
- **拒绝：** 按 `Esc` 或继续输入

```typescript
function calculate
// ↑ 自动补全函数签名和实现
```

### 2. 代码操作命令 ⚡

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
   ```typescript
   // Create a function that validates email addresses
   ```
2. 光标移到注释行
3. 右键 → "bincode: Generate Code from Comment"
4. 自动生成实现

### 3. 聊天功能 💬
1. 点击侧边栏的 bincode 图标
2. 输入问题
3. 按 `Ctrl/Cmd + Enter` 发送
4. 实时查看流式响应

**支持的工具调用：**
- 📁 文件读写
- 🔍 代码搜索
- 📦 Git 操作
- 🖥️  Shell 命令
- 更多...

---

## 🎨 功能特性

| 功能 | 状态 | 说明 |
|------|------|------|
| 内联补全 | ✅ | GitHub Copilot 风格 |
| 代码解释 | ✅ | 详细说明代码逻辑 |
| 代码重构 | ✅ | AI 驱动优化 |
| 问题修复 | ✅ | 自动发现和修复 |
| 代码生成 | ✅ | 从注释生成代码 |
| 聊天界面 | ✅ | 侧边栏交互 |
| 工具调用 | ✅ | 27+ 工具集成 |
| 流式响应 | ✅ | 实时打字效果 |

---

## 🔧 命令列表

| 命令 | 快捷键 | 功能 |
|------|--------|------|
| `bincode.explain` | - | 解释选中代码 |
| `bincode.refactor` | - | 重构选中代码 |
| `bincode.fix` | - | 修复问题 |
| `bincode.generate` | - | 生成代码 |
| `bincode.chat` | - | 打开聊天 |
| `bincode.toggleInlineCompletion` | - | 切换内联补全 |

💡 **提示：** 可以在 VSCode 中自定义快捷键！

---

## 📁 项目结构

```
bincode-vscode/
├── interfaces/vscode/
│   ├── extension.js              # 主入口
│   ├── inline-completion-provider.js
│   ├── chat-view-provider.js
│   └── completion-provider.js
├── core/                         # Agent 引擎
├── llm/                          # DeepSeek Provider
├── tools/                        # 27+ 工具
├── services/                     # 文件/Git/搜索服务
└── resources/
    └── icon.svg                  # 扩展图标
```

---

## 🐛 故障排查

### Q: 内联补全不工作？
```
1. 检查设置：bincode.enableInlineCompletion = true
2. 检查 API Key 是否配置
3. 查看 Output → bincode 的日志
```

### Q: 命令不可用？
```
1. 重启 VSCode
2. 检查扩展是否启用
3. 查看 Help → Toggle Developer Tools → Console
```

### Q: API 调用失败？
```
1. 验证 API Key 是否正确
2. 测试网络连接
3. 检查 bincode.baseUrl 配置
```

---

## 📊 性能优化

### 减少 API 调用
```json
{
  "bincode.completionDelay": 500,        // 增加延迟
  "bincode.maxCompletionTokens": 50      // 减少 tokens
}
```

### 禁用内联补全
```json
{
  "bincode.enableInlineCompletion": false  // 仅使用命令
}
```

---

## 🔄 更新扩展

```bash
# 1. 重新构建
npm run build:extension
npm run package:extension

# 2. 卸载旧版
code --uninstall-extension daabin.bincode-vscode

# 3. 安装新版
code --install-extension dist-extension/bincode-vscode-0.3.0.vsix
```

---

## 📚 完整文档

- **开发指南：** [VSCODE_EXTENSION.md](./VSCODE_EXTENSION.md)
- **状态报告：** [VSCODE_STATUS.md](./VSCODE_STATUS.md)
- **架构文档：** [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 🎯 快速测试

### 测试内联补全
```typescript
// 1. 新建文件 test.ts
// 2. 输入：
function fibonacci(

// 3. 等待补全建议出现
// 4. 按 Tab 接受
```

### 测试聊天
```
1. 点击侧边栏 bincode 图标
2. 输入：Explain how async/await works in JavaScript
3. 查看流式响应
```

### 测试命令
```
1. 选中一段代码
2. 右键菜单
3. 选择 bincode: Explain Selected Code
4. 查看新标签页的解释
```

---

## ✨ 核心优势

### vs GitHub Copilot
✅ **开源** - 完全可定制  
✅ **工具集成** - 27+ 工具（文件、Git、Shell）  
✅ **成本友好** - DeepSeek API 价格低  
✅ **聊天功能** - 完整的 Agent 能力  

### vs 传统 AI 助手
✅ **IDE 集成** - 无缝工作流  
✅ **上下文感知** - 理解项目结构  
✅ **实时响应** - 流式输出  
✅ **多种模式** - 补全 + 命令 + 聊天  

---

## 🚀 立即体验

```bash
# 一键安装
./install-vscode-extension.sh

# 配置 API Key
# Settings → bincode.apiKey → 输入 key

# 开始使用！
```

---

**版本：** 0.3.0  
**大小：** 53KB  
**文件：** 46 files  
**状态：** ✅ 生产就绪  

**开发者：** daabin  
**许可证：** MIT  
**仓库：** https://github.com/daabin/bincode

---

**🎉 享受 AI 辅助编码的乐趣！**
