# bincode 开发指南

## 开发环境设置

### 前置要求

- Node.js >= 18.17
- npm >= 9.0

### 安装依赖

```bash
git clone https://github.com/daabin/bincode.git
cd bincode
npm install
```

## 项目结构

```
bincode/
├── src/
│   ├── interfaces/       # 接口适配器层
│   │   ├── cli/         # CLI 界面 (React Ink)
│   │   ├── web/         # Web 服务器 (Express + SSE)
│   │   └── vscode/      # VSCode 扩展
│   ├── core/            # 核心引擎
│   │   ├── agent.ts     # Agent 主循环
│   │   ├── tool-engine.ts
│   │   └── factory.ts   # Agent 工厂
│   ├── tools/           # 工具实现
│   ├── llm/             # LLM Provider (DeepSeek)
│   ├── services/        # 服务层抽象
│   ├── config/          # 配置管理
│   └── types/           # 类型定义
├── docs/                # 文档
├── dist/                # 编译输出
└── package.json
```

## 开发命令

### 构建

```bash
# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build

# 类型检查
npm run typecheck
```

### 测试

```bash
# 运行测试
npm test

# 监听模式
npm run test:watch

# 测试覆盖率
npm run test:coverage
```

### VSCode 扩展

```bash
# 构建扩展
npm run build:extension

# 打包为 .vsix
npm run package:extension

# 发布到市场
npm run publish:extension
```

## 架构设计

### Ports & Adapters (六边形架构)

```
┌─────────────────────────────────────────┐
│          Interfaces (Adapters)          │
│  ┌────────┐  ┌────────┐  ┌──────────┐  │
│  │  CLI   │  │  Web   │  │  VSCode  │  │
│  └───┬────┘  └───┬────┘  └────┬─────┘  │
│      │           │             │        │
└──────┼───────────┼─────────────┼────────┘
       │           │             │
       └───────────┴─────────────┘
                   │
       ┌───────────▼────────────┐
       │    Core (Ports)        │
       │  ┌─────────────────┐  │
       │  │  Agent Engine   │  │
       │  │  Tool Engine    │  │
       │  │  Factory        │  │
       │  └─────────────────┘  │
       └────────────────────────┘
```

**核心原则：**
1. **核心不依赖接口** - `core/` 不知道 CLI、Web 的存在
2. **接口依赖核心** - `interfaces/` 调用 `core/` 的 API
3. **依赖注入** - 通过工厂函数注入依赖

### Agent 生命周期

```typescript
// 1. 创建 Agent
const agent = createAgent({ cwd, apiKey, model });

// 2. 运行对话
for await (const event of agent.run(userMessage)) {
  // 3. 处理事件
  if (event.type === 'assistant') {
    // 显示 AI 响应
  } else if (event.type === 'tool_call') {
    // 显示工具调用
  }
}
```

## 添加新工具

### 1. 定义工具类型

```typescript
// src/types/tools.ts
export interface MyNewToolInput {
  param1: string;
  param2?: number;
}
```

### 2. 实现工具

```typescript
// src/tools/my-tool.ts
import { Tool } from '../types';

export const myNewTool: Tool<MyNewToolInput> = {
  name: 'my_new_tool',
  description: '工具描述，AI 会根据此描述决定何时使用',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: '参数1描述'
      },
      param2: {
        type: 'number',
        description: '参数2描述'
      }
    },
    required: ['param1']
  },
  
  async execute(input: MyNewToolInput, context) {
    // 实现工具逻辑
    const result = await doSomething(input.param1);
    return {
      content: `结果: ${result}`
    };
  }
};
```

### 3. 注册工具

```typescript
// src/core/factory.ts
import { myNewTool } from '../tools/my-tool';

export function createAgent(options) {
  // ...
  agent.registerTool(myNewTool);
  return agent;
}
```

### 4. 测试工具

```typescript
// src/tools/__tests__/my-tool.test.ts
import { describe, it, expect } from 'vitest';
import { myNewTool } from '../my-tool';

describe('myNewTool', () => {
  it('should work correctly', async () => {
    const result = await myNewTool.execute(
      { param1: 'test' },
      { cwd: process.cwd() }
    );
    expect(result.content).toContain('test');
  });
});
```

## 添加新接口

### 1. 创建接口目录

```bash
mkdir -p src/interfaces/my-interface
```

### 2. 实现接口

```typescript
// src/interfaces/my-interface/index.ts
import { createAgent } from '../../core/factory';

export async function startMyInterface() {
  const agent = createAgent();
  
  // 实现你的接口逻辑
  // 例如：启动服务器、注册命令等
}
```

### 3. 创建入口点

```typescript
// src/my-interface.ts
import { startMyInterface } from './interfaces/my-interface';

startMyInterface().catch(console.error);
```

### 4. 更新 package.json

```json
{
  "bin": {
    "bincode-my-interface": "./dist/my-interface.js"
  },
  "scripts": {
    "my-interface": "tsx src/my-interface.ts"
  }
}
```

## 代码规范

### TypeScript

- 使用 TypeScript strict 模式
- 优先使用 interface 而不是 type
- 使用明确的类型，避免 any
- 导出的函数必须有 JSDoc 注释

### 命名规范

- 文件名：kebab-case (`my-file.ts`)
- 类名：PascalCase (`MyClass`)
- 函数/变量：camelCase (`myFunction`)
- 常量：UPPER_SNAKE_CASE (`MAX_RETRIES`)
- 工具名：snake_case (`my_tool`)

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
refactor: 重构代码
test: 添加测试
chore: 其他修改
```

## 调试

### CLI 调试

```bash
# 启动调试模式
npm run dev

# 设置环境变量
export DEBUG=bincode:*
npm run dev
```

### VSCode 扩展调试

1. 打开项目
2. 按 F5 启动调试
3. 在 Extension Development Host 窗口测试
4. 在主窗口查看日志和断点

### 单元测试调试

```bash
# 调试单个测试
npm test -- --grep "test name"

# 查看详细输出
npm test -- --reporter verbose
```

## 发布流程

### 1. 更新版本号

```bash
npm version patch  # 0.3.0 -> 0.3.1
npm version minor  # 0.3.1 -> 0.4.0
npm version major  # 0.4.0 -> 1.0.0
```

### 2. 更新 CHANGELOG

记录所有重要变更。

### 3. 构建和测试

```bash
npm run build
npm test
npm run typecheck
```

### 4. 发布到 npm

```bash
npm publish
```

### 5. 创建 GitHub Release

1. 推送 tag: `git push --tags`
2. 在 GitHub 创建 Release
3. 上传构建产物

## 常见问题

### Q: 如何查看详细日志？
设置环境变量 `DEBUG=bincode:*`

### Q: 测试失败怎么办？
1. 确保依赖已安装
2. 检查 API Key 配置
3. 运行 `npm run typecheck` 检查类型错误

### Q: 如何贡献代码？
1. Fork 项目
2. 创建 feature 分支
3. 提交 Pull Request
4. 等待 review

## 相关资源

- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [React Ink 文档](https://github.com/vadimdemedes/ink)
- [VSCode Extension API](https://code.visualstudio.com/api)
- [DeepSeek API](https://platform.deepseek.com/docs)

---

**欢迎贡献！** 如有问题请提交 [Issue](https://github.com/daabin/bincode/issues)。
