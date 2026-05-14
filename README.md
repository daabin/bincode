# bincode

一个强大的 CLI 代码智能助手，由 **DeepSeek** 驱动，支持代码搜索、智能工具和会话管理。

[![npm version](https://img.shields.io/npm/v/@daabin/bincode.svg)](https://www.npmjs.com/package/@daabin/bincode)
[![Node.js](https://img.shields.io/node/v/@daabin/bincode.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/daabin/bincode/actions/workflows/ci.yml/badge.svg)](https://github.com/daabin/bincode/actions/workflows/ci.yml)

## 功能特性

### 🤖 DeepSeek 驱动
- **高性价比** - 优秀的性能价格比
- **中文友好** - 对中文理解和生成的原生支持
- **快速响应** - 毫秒级的响应速度
- **强大推理** - 深度思考和代码理解能力

### 🔧 20+ 智能工具
| 类别 | 工具 |
|------|------|
| 📁 文件操作 | read, write, edit, delete, move, list, glob |
| 🔍 代码搜索 | grep, search_files, code_search |
| ⚡ 命令执行 | run_command (安全白名单) |
| 🔄 Git 集成 | git_status, git_diff, git_log |
| 🌐 Web 工具 | web_search, web_fetch |
| 🖼️ 图片分析 | analyze_image (多模态) |
| 📝 文档生成 | generate_docs |
| 🔀 文件对比 | compare_files |

### 📊 高级功能
- **代码索引** - 符号搜索、语义查找
- **代码补全** - AI 驱动的智能补全
- **会话管理** - 持久化、导出 Markdown
- **Token 监控** - 使用统计、成本追踪
- **插件系统** - 自定义工具扩展
- **MCP 协议** - Model Context Protocol 支持

---

## 安装

### 方式一：npm 全局安装（推荐）

```bash
npm install -g @daabin/bincode
bincode
```

### 方式二：npx 直接运行

```bash
npx @daabin/bincode
```

### 方式三：从源码构建

```bash
git clone https://github.com/daabin/bincode.git
cd bincode
npm install
npm run build
npm link
bincode
```

---

## 快速开始

### 1. 配置 API Key

**方式一：CLI 命令（推荐）**
```bash
bincode
> /setkey sk-your-api-key
```

**方式二：环境变量**
```bash
export DEEPSEEK_API_KEY="sk-your-api-key"
bincode
```

**方式三：配置文件**
```bash
# 编辑 ~/.bincode/config.json
{
  "apiKey": "sk-your-api-key",
  "model": "deepseek-chat"
}
```

### 2. 开始使用

```text
> 帮我查看 README.md 并优化文档结构
> 在 src 目录里搜索 agent loop 的实现
> 运行 npm test 看看测试是否通过
> 分析 /path/to/image.png 这张图片
```

---

## CLI 命令

| 命令 | 说明 |
|------|------|
| `/setkey <key>` | 保存 API Key |
| `/stats` | 查看 Token 使用统计 |
| `/config` | 显示当前配置 |
| `/clear` | 清空对话历史 |
| `/help` | 显示帮助信息 |
| `/exit` | 退出 CLI |

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEEPSEEK_API_KEY` | - | DeepSeek API Key (必需) |
| `BINCODE_API_KEY` | - | 备用 API Key |
| `BINCODE_MODEL` | `deepseek-chat` | 默认模型 |

---

## 配置文件

配置文件位置：`~/.bincode/config.json`

```json
{
  "apiKey": "sk-your-api-key",
  "baseUrl": "https://api.deepseek.com",
  "model": "deepseek-chat",
  "allowedCommands": ["npm", "node", "git"],
  "deniedCommands": ["rm -rf /"]
}
```

---

## 作为库使用

```typescript
import { createAgent } from '@daabin/bincode';

const agent = createAgent({
  cwd: process.cwd(),
  apiKey: process.env.DEEPSEEK_API_KEY
});

for await (const event of agent.run('帮我分析这个项目')) {
  if (event.type === 'assistant') {
    process.stdout.write(event.content);
  }
}
```

详细使用方法请查看 [开发文档](./docs/development/CONTRIBUTING.md)。

---

## 📚 文档

完整文档请访问 [docs/](./docs/) 目录：

- **[快速入门](./docs/user-guide/GETTING_STARTED.md)** - 安装和基本使用
- **[工具指南](./docs/user-guide/TOOLS.md)** - 所有可用工具
- **[VSCode 扩展](./docs/user-guide/VSCODE.md)** - VSCode 集成
- **[常见问题](./docs/user-guide/FAQ.md)** - 常见问题解答
- **[贡献指南](./docs/development/CONTRIBUTING.md)** - 如何参与开发
- **[架构设计](./docs/architecture/ARCHITECTURE.md)** - 技术架构

---

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 测试
npm test
```

更多开发信息请查看 [贡献指南](./docs/development/CONTRIBUTING.md)。

---

## 许可证

[MIT](LICENSE)

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**版本**: 0.2.1  
**Node.js**: >= 18.17  
**维护**: 活跃开发中