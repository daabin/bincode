# bincode

一个基于 CLI 的最小可行 code agent，技术栈是 TypeScript、Node.js、Ink 和 DeepSeek。

## 功能特性

- 🎨 交互式 CLI（基于 Ink）
- 🤖 DeepSeek Chat Completions agent loop
- 🔧 支持工具调用（文件读写、搜索）
- 📝 **增强的 Markdown 渲染**
  - 代码高亮（180+ 语言）
  - GFM 支持（表格、任务列表）
  - 专业级终端渲染效果
- 💾 配置持久化（无需每次设置 API Key）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

**方式一：CLI 命令（推荐）**
```bash
npm run dev
# 输入: /setkey sk-your-api-key
```

**方式二：环境变量**
```bash
export DEEPSEEK_API_KEY="sk-your-api-key"
npm run dev
```

> API Key 获取：https://platform.deepseek.com/api_keys

### 3. 开始使用

```bash
npm run dev

# 或构建后运行
npm run build
npm start

# 全局安装
npm link
bincode
```

## 使用示例

```text
> 帮我查看 README.md 并优化文档结构
> 在 src 目录里搜索 agent loop 的实现
> 创建一个 notes/todo.md，写入今天的任务
> 查找所有 .tsx 文件并分析代码结构
```

### CLI 命令

- `/exit` - 退出 CLI
- `/setkey <api-key>` - 保存 API Key
- `Ctrl+C` - 强制退出

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DEEPSEEK_API_KEY` | 否* | — | DeepSeek API key |
| `DEEPSEEK_MODEL` | 否 | `deepseek-v4-pro` | 模型名称 |
| `DEEPSEEK_BASE_URL` | 否 | `https://api.deepseek.com` | API 基础地址 |

\* 可通过 `/setkey` 命令或配置文件设置

## 配置管理

配置文件位置：`~/.bincode/config.json`

```json
{
  "apiKey": "sk-your-api-key",
  "model": "deepseek-v4-pro",
  "baseUrl": "https://api.deepseek.com"
}
```

## 项目结构

```
bincode/
├── src/
│   ├── cli.tsx                 # Ink CLI 入口
│   ├── agent.ts                # Agent 主循环
│   ├── deepseek.ts             # DeepSeek API 封装
│   ├── tools.ts                # 工具定义与执行
│   ├── types.ts                # 类型定义
│   ├── config.ts               # 配置管理
│   ├── markdown.tsx            # Markdown 渲染（增强版）
│   └── utils/
│       └── terminalMarkdownRenderer.ts  # 终端渲染核心
├── examples/
│   └── terminalRenderDemo.js   # 渲染器功能演示
├── package.json
└── README.md
```

## Markdown 渲染特性

项目使用专业的终端 Markdown 渲染器，支持：

- ✅ **代码高亮**：JavaScript、Python、TypeScript 等 180+ 语言
- ✅ **GFM 扩展**：表格、任务列表、删除线、自动链接
- ✅ **美观排版**：带边框的表格、彩色列表符号
- ✅ **安全防护**：HTML 自动转义

**渲染演示：**

```bash
# 运行 Markdown 渲染器演示
node examples/terminalRenderDemo.js

# 运行特定演示
node examples/terminalRenderDemo.js 2  # 流式渲染
```

## 依赖说明

### 核心依赖
- `ink` - React 终端 UI 框架
- `marked` + `marked-terminal` - Markdown 解析与渲染
- `highlight.js` - 代码语法高亮
- `chalk` - 终端颜色

### 可选依赖
- `ripgrep` - 加速文件搜索（推荐安装）
  ```bash
  # macOS
  brew install ripgrep
  
  # Ubuntu/Debian
  sudo apt install ripgrep
  ```

## 开发

```bash
# 开发模式（热重载）
npm run dev

# 类型检查
npm run typecheck

# 构建
npm run build
```

## 故障排除

### API Key 未设置

```bash
# 检查配置
ls -la ~/.bincode/config.json

# 重新设置
npm run dev
/setkey sk-your-api-key
```

### 终端颜色问题

```bash
# 禁用颜色
NO_COLOR=1 npm run dev

# 强制启用颜色
FORCE_COLOR=1 npm run dev
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**版本**: 0.1.0  
**Node.js**: >= 18.17  
**维护**: 活跃开发中
