# bincode 快速入门

## 概述

bincode 是一个强大的 CLI 代码智能助手，由 **DeepSeek** 驱动，支持代码搜索、智能工具和会话管理。

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

## 配置

### 1. 设置 API Key

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

## 基本使用

### 自然语言交互

```text
> 帮我查看 README.md 并优化文档结构
> 在 src 目录里搜索 agent loop 的实现
> 运行 npm test 看看测试是否通过
> 分析 /path/to/image.png 这张图片
```

### CLI 命令

| 命令 | 说明 |
|------|------|
| `/setkey <key>` | 保存 API Key |
| `/stats` | 查看 Token 使用统计 |
| `/config` | 显示当前配置 |
| `/clear` | 清空对话历史 |
| `/help` | 显示帮助信息 |
| `/exit` | 退出 CLI |

## 下一步

- 查看 [工具指南](./TOOLS.md) 了解所有可用工具
- 查看 [VSCode 扩展使用指南](./VSCODE.md) 在编辑器中使用 bincode
- 查看 [常见问题](./FAQ.md) 解决常见问题
