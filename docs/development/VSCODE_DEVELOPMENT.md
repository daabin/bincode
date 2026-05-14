# VSCode 扩展开发指南

## 概述

本文档专门针对 bincode VSCode 扩展的开发。关于项目整体开发，请参考 [贡献指南](./CONTRIBUTING.md)。

## 扩展架构

```
src/interfaces/vscode/
├── extension.ts                    # 主入口
├── inline-completion-provider.ts   # 内联补全
├── chat-view-provider.ts          # 聊天视图
└── completion-provider.ts          # 补全逻辑

resources/
├── icon.svg                        # 扩展图标 (SVG)
└── icon.png                        # 扩展图标 (PNG)

extension.package.json              # 扩展清单
tsconfig.extension.json             # TypeScript 配置
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建扩展

```bash
npm run build:extension
```

### 3. 调试扩展

1. 在 VSCode 中打开项目
2. 按 F5 或 Run → Start Debugging
3. Extension Development Host 窗口会自动打开
4. 在新窗口中测试功能

### 4. 打包扩展

```bash
npm run package:extension
```

生成的 `.vsix` 文件在 `dist-extension/` 目录。

## 核心功能实现

### 内联补全

```typescript
// inline-completion-provider.ts
export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[]> {
    // 1. 获取上下文
    const prefix = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position)
    );
    
    // 2. 调用 AI 获取补全
    const completion = await this.getCompletion(prefix);
    
    // 3. 返回补全项
    return [
      new vscode.InlineCompletionItem(
        completion,
        new vscode.Range(position, position)
      )
    ];
  }
}
```

### 命令注册

```typescript
// extension.ts
export function activate(context: vscode.ExtensionContext) {
  // 注册解释代码命令
  context.subscriptions.push(
    vscode.commands.registerCommand('bincode.explain', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      
      const selection = editor.selection;
      const code = editor.document.getText(selection);
      
      // 调用 Agent 解释代码
      const explanation = await explainCode(code);
      
      // 显示结果
      const doc = await vscode.workspace.openTextDocument({
        content: explanation,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    })
  );
}
```

### 聊天视图

```typescript
// chat-view-provider.ts
export class ChatViewProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true
    };
    
    // 设置 HTML 内容
    webviewView.webview.html = this.getHtmlContent();
    
    // 处理消息
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'send') {
        const response = await this.agent.run(message.text);
        webviewView.webview.postMessage({
          type: 'response',
          text: response
        });
      }
    });
  }
  
  private getHtmlContent(): string {
    return `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="chat"></div>
          <input id="input" type="text" />
          <button id="send">Send</button>
          <script>
            // Chat UI logic
          </script>
        </body>
      </html>
    `;
  }
}
```

## 配置项

### 添加新配置

1. 在 `extension.package.json` 中添加配置定义：

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "bincode.myNewSetting": {
          "type": "string",
          "default": "default value",
          "description": "My new setting description"
        }
      }
    }
  }
}
```

2. 在代码中读取配置：

```typescript
const config = vscode.workspace.getConfiguration('bincode');
const myValue = config.get<string>('myNewSetting');
```

3. 监听配置变更：

```typescript
vscode.workspace.onDidChangeConfiguration((e) => {
  if (e.affectsConfiguration('bincode.myNewSetting')) {
    // 处理配置变更
  }
});
```

## 调试技巧

### 1. 使用 Output Channel

```typescript
const outputChannel = vscode.window.createOutputChannel('bincode');
outputChannel.appendLine('Debug message');
outputChannel.show();
```

### 2. 使用断点

在代码中设置断点，按 F5 启动调试，断点会在主窗口触发。

### 3. 查看日志

- View → Output → 选择 "bincode"
- Help → Toggle Developer Tools → Console

### 4. 重新加载扩展

在 Extension Development Host 窗口：
- macOS: Cmd+R
- Windows/Linux: Ctrl+R

## 测试

### 手动测试

1. 构建扩展: `npm run build:extension`
2. 按 F5 启动调试
3. 在新窗口中测试各项功能
4. 查看 Output 和 Console 日志

### 测试清单

- [ ] 内联补全正常工作
- [ ] 代码解释命令可用
- [ ] 代码重构命令可用
- [ ] 问题修复命令可用
- [ ] 代码生成命令可用
- [ ] 聊天功能正常
- [ ] 配置更新生效
- [ ] 错误处理正常

## 性能优化

### 1. 减少 API 调用

```typescript
// 使用防抖
const debounce = (fn: Function, delay: number) => {
  let timer: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

const debouncedCompletion = debounce(getCompletion, 300);
```

### 2. 缓存结果

```typescript
const cache = new Map<string, string>();

async function getCachedCompletion(prefix: string) {
  if (cache.has(prefix)) {
    return cache.get(prefix);
  }
  
  const result = await getCompletion(prefix);
  cache.set(prefix, result);
  return result;
}
```

### 3. 取消过时请求

```typescript
async provideInlineCompletionItems(
  document: vscode.TextDocument,
  position: vscode.Position,
  context: vscode.InlineCompletionContext,
  token: vscode.CancellationToken
): Promise<vscode.InlineCompletionItem[]> {
  // 检查取消令牌
  if (token.isCancellationRequested) {
    return [];
  }
  
  // 执行补全...
}
```

## 发布流程

### 1. 更新版本号

在 `extension.package.json` 中更新 `version` 字段。

### 2. 构建和打包

```bash
npm run build:extension
npm run package:extension
```

### 3. 测试 .vsix 文件

```bash
code --install-extension dist-extension/bincode-vscode-0.3.0.vsix
```

### 4. 获取 Publisher Token

1. 访问 https://marketplace.visualstudio.com/manage
2. 创建 Personal Access Token
3. Scopes: Marketplace (Manage)

### 5. 登录 vsce

```bash
npx vsce login your-publisher-name
# 输入 token
```

### 6. 发布

```bash
npm run publish:extension
```

## 常见问题

### Q: 扩展无法激活？

检查 `extension.package.json` 中的 `activationEvents`。确保包含 `onStartupFinished` 或特定命令。

### Q: 命令不显示？

1. 检查 `contributes.commands` 是否正确配置
2. 确保命令已在 `extension.ts` 中注册
3. 重新加载窗口 (Cmd/Ctrl+R)

### Q: 配置不生效？

1. 检查配置键名是否正确（必须以 `bincode.` 开头）
2. 重启 VSCode
3. 检查 `workspace.getConfiguration()` 调用

### Q: 内联补全不显示？

1. 确保 `InlineCompletionItemProvider` 正确注册
2. 检查 `provideInlineCompletionItems` 返回值
3. 查看 Output 日志排查错误

## 相关资源

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Extension Guides](https://code.visualstudio.com/api/extension-guides/overview)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Samples](https://github.com/microsoft/vscode-extension-samples)

---

**需要帮助？** 请在 [GitHub Issues](https://github.com/daabin/bincode/issues) 提问。
