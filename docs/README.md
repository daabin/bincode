# bincode 项目文档

欢迎来到 bincode 项目文档！本文档将帮助您快速了解和使用 bincode。

## 📚 文档导航

### 👥 用户指南

面向 bincode 用户的使用文档：

- **[快速入门](./user-guide/GETTING_STARTED.md)** - 安装、配置和基本使用
- **[工具指南](./user-guide/TOOLS.md)** - 完整的工具列表和使用方法
- **[VSCode 扩展](./user-guide/VSCODE.md)** - VSCode 扩展的安装和使用
- **[常见问题](./user-guide/FAQ.md)** - 常见问题解答

### 🛠️ 开发文档

面向贡献者和开发者的技术文档：

- **[贡献指南](./development/CONTRIBUTING.md)** - 如何参与项目开发
- **[VSCode 扩展开发](./development/VSCODE_DEVELOPMENT.md)** - VSCode 扩展开发指南

### 🏗️ 架构文档

项目设计和变更记录：

- **[架构设计](./architecture/ARCHITECTURE.md)** - 系统架构和设计原则
- **[变更日志](./architecture/CHANGELOG.md)** - 版本历史和功能变更
- **[重构记录](./architecture/REFACTORING_CHANGELOG.md)** - 重要重构的详细说明

## 🚀 快速开始

### 安装 bincode

```bash
npm install -g @daabin/bincode
```

### 配置 API Key

```bash
export DEEPSEEK_API_KEY="sk-your-api-key"
bincode
```

### 开始使用

```text
> 帮我查看 README.md 并优化文档结构
> 在 src 目录里搜索 agent loop 的实现
```

详细步骤请查看 [快速入门指南](./user-guide/GETTING_STARTED.md)。

## 💡 核心特性

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

### 📊 高级功能
- **代码索引** - 符号搜索、语义查找
- **代码补全** - AI 驱动的智能补全
- **会话管理** - 持久化、导出 Markdown
- **Token 监控** - 使用统计、成本追踪
- **VSCode 集成** - 内联补全、命令、聊天

## 🎯 使用场景

### CLI 模式
```bash
# 启动交互式命令行
bincode

# 直接执行任务
bincode "分析这个项目的测试覆盖率"
```

### VSCode 扩展
- 内联代码补全
- 代码解释和重构
- 问题修复
- 侧边栏聊天

### 作为库使用
```typescript
import { createAgent } from '@daabin/bincode';

const agent = createAgent();
for await (const event of agent.run('你的问题')) {
  console.log(event);
}
```

## 📖 详细文档

### 按角色浏览

**我是用户** - 想要使用 bincode 提升工作效率
- 从 [快速入门](./user-guide/GETTING_STARTED.md) 开始
- 学习 [工具使用](./user-guide/TOOLS.md)
- 安装 [VSCode 扩展](./user-guide/VSCODE.md)

**我是开发者** - 想要为项目贡献代码
- 阅读 [贡献指南](./development/CONTRIBUTING.md)
- 了解 [架构设计](./architecture/ARCHITECTURE.md)
- 学习 [VSCode 扩展开发](./development/VSCODE_DEVELOPMENT.md)

**我是架构师** - 想要了解技术设计
- 研究 [架构文档](./architecture/ARCHITECTURE.md)
- 查看 [重构记录](./architecture/REFACTORING_CHANGELOG.md)
- 跟踪 [变更日志](./architecture/CHANGELOG.md)

## 🔗 相关链接

- **GitHub**: https://github.com/daabin/bincode
- **npm**: https://www.npmjs.com/package/@daabin/bincode
- **DeepSeek**: https://platform.deepseek.com
- **Issues**: https://github.com/daabin/bincode/issues

## 📝 许可证

[MIT License](../LICENSE)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！详见 [贡献指南](./development/CONTRIBUTING.md)。

---

**版本**: 0.3.0  
**更新**: 2026-05-14  
**维护**: [@daabin](https://github.com/daabin)
