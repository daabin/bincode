# bincode

一个基于 CLI 的最小可行 code agent，技术栈是 TypeScript、Node.js、Ink 和 DeepSeek。

## 功能

- Ink 构建的交互式 CLI。
- DeepSeek Chat Completions agent loop。
- 支持模型发起工具调用。
- 本地文件读取、写入工具。
- 文件查找和文本搜索工具。

## 安装

### 前置要求

- **Node.js** >= 18.17（推荐使用 [nvm](https://github.com/nvm-sh/nvm) 或 [fnm](https://github.com/Schniz/fnm) 管理版本）
- **npm**（随 Node.js 一起安装）
- **DeepSeek API key**（[注册获取](https://platform.deepseek.com/api_keys)）
- **ripgrep**（可选，用于加速文件搜索，安装方式见下方）

#### 安装 ripgrep（推荐）

```bash
# macOS (Homebrew)
brew install ripgrep

# Ubuntu/Debian
sudo apt install ripgrep

# Arch Linux
sudo pacman -S ripgrep

# Windows (Scoop)
scoop install ripgrep

# Windows (winget)
winget install BurntSushi.ripgrep.MSVC
```

> 如果未安装 ripgrep，工具会自动降级为纯 JavaScript 实现，功能不变但搜索大项目时较慢。

### 安装步骤

```bash
# 1. 克隆仓库
git clone <repository-url>
cd bincode

# 2. 安装依赖
npm install

# 3. 配置 API key
export DEEPSEEK_API_KEY="sk-你的-api-key"
```

> 也可以将 API key 写入 `.env` 文件（已加入 `.gitignore`），避免每次重复导出：
>
> ```bash
> echo 'DEEPSEEK_API_KEY="sk-你的-api-key"' > .env
> ```

## 使用

### 开发模式（推荐）

```bash
npm run dev
```

### 构建后运行

```bash
npm run build
npm start
```

### 直接传参运行（非交互模式）

```bash
npm run dev -- "帮我查看 README.md"
```

### 全局安装（可选）

```bash
npm link
bincode "查看 src 目录结构"
```

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DEEPSEEK_API_KEY` | 是 | — | DeepSeek API key |
| `DEEPSEEK_MODEL` | 否 | `deepseek-v4-flash` | 模型名称 |
| `DEEPSEEK_BASE_URL` | 否 | `https://api.deepseek.com` | API 基础地址 |

## 使用示例

```text
> 帮我查看 README.md 并补充安装说明
> 在 src 目录里搜索 agent loop 的实现
> 创建一个 notes/todo.md，写入今天的任务
> 查找所有 .tsx 文件
```

输入 `/exit` 或按 `Ctrl+C` 退出。

## 项目结构

```
bincode/
├── src/
│   ├── cli.tsx       # Ink CLI 入口，交互式终端 UI
│   ├── agent.ts      # Agent 主循环
│   ├── deepseek.ts   # DeepSeek API 调用封装
│   ├── tools.ts      # 工具定义与执行
│   └── types.ts      # 类型定义
├── package.json
├── tsconfig.json
├── README.md
└── .gitignore
```
