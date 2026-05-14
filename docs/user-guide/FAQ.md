# 常见问题 (FAQ)

## 安装和配置

### Q: 如何获取 DeepSeek API Key？
访问 [DeepSeek Platform](https://platform.deepseek.com) 注册账号并创建 API Key。

### Q: 支持其他 LLM Provider 吗？
目前 bincode 专注于 DeepSeek，暂不支持其他 provider。这样的设计让代码更简洁、维护更容易。

### Q: 可以在离线环境使用吗？
不可以。bincode 需要连接到 DeepSeek API 才能工作。

## 使用问题

### Q: 如何查看 token 使用情况？
在 CLI 中输入 `/stats` 命令查看详细的 token 使用统计。

### Q: 为什么某些命令执行失败？
bincode 使用白名单机制限制可执行的命令。只有安全的命令（如 npm, git, node）才被允许执行。危险命令（如 rm -rf /）会被阻止。

### Q: 如何清空对话历史？
在 CLI 中输入 `/clear` 命令清空当前会话的对话历史。

### Q: 支持分析图片吗？
支持！bincode 可以分析 PNG、JPG、WebP、GIF、BMP 等格式的图片。使用自然语言描述即可，例如："分析 /path/to/image.png 这张图片"。

## VSCode 扩展

### Q: 内联补全不工作？
检查以下几点：
1. 确保 `bincode.enableInlineCompletion` 设置为 `true`
2. 确保已配置正确的 API Key
3. 查看 Output → bincode 的日志排查错误

### Q: 如何自定义快捷键？
在 VSCode 中：
1. File → Preferences → Keyboard Shortcuts
2. 搜索 "bincode"
3. 为各个命令设置你喜欢的快捷键

### Q: 扩展占用太多资源？
可以通过以下方式优化：
1. 增加 `bincode.completionDelay` 减少 API 调用频率
2. 减少 `bincode.maxCompletionTokens` 限制补全长度
3. 禁用内联补全，只使用命令模式

## 性能优化

### Q: 如何减少 API 调用次数？
1. 使用 `read_multiple_files` 而不是多次调用 `read_file`
2. 使用 `edit_file` 进行小范围修改而不是 `write_file`
3. 配置合理的 `completionDelay` 参数

### Q: 响应速度慢怎么办？
1. 检查网络连接是否稳定
2. DeepSeek API 可能暂时负载较高
3. 尝试使用 `deepseek-chat` 模型（速度更快）

## 安全问题

### Q: 会不会访问敏感文件？
bincode 的所有文件操作都限制在工作区内，无法访问系统级文件或工作区外的文件。

### Q: 命令执行安全吗？
完全安全！bincode 使用严格的白名单机制，只允许执行安全的命令，自动阻止所有危险操作。

### Q: API Key 如何存储？
API Key 存储在本地配置文件 `~/.bincode/config.json` 中，不会上传到任何服务器（除了调用 DeepSeek API）。

## 开发相关

### Q: 如何作为库使用？
```typescript
import { createAgent } from '@daabin/bincode';

const agent = createAgent({
  cwd: process.cwd(),
  apiKey: process.env.DEEPSEEK_API_KEY
});

for await (const event of agent.run('你的问题')) {
  console.log(event);
}
```

### Q: 如何扩展新工具？
参考 [开发指南](../development/CONTRIBUTING.md) 了解如何添加自定义工具。

### Q: 如何贡献代码？
欢迎提交 Pull Request！请参考 [贡献指南](../development/CONTRIBUTING.md)。

## 错误处理

### Q: 遇到 "API Key is required" 错误？
请确保已通过以下任一方式配置 API Key：
1. CLI 命令: `/setkey sk-your-key`
2. 环境变量: `DEEPSEEK_API_KEY`
3. 配置文件: `~/.bincode/config.json`

### Q: 遇到 "Command not allowed" 错误？
该命令不在白名单中。可以通过配置文件的 `allowedCommands` 字段添加允许的命令。

### Q: 遇到 "Path outside workspace" 错误？
bincode 只能访问工作区内的文件。请使用相对路径而不是绝对路径。

## 其他问题

### Q: 支持哪些编程语言？
bincode 支持所有主流编程语言，包括但不限于：
- JavaScript/TypeScript
- Python
- Rust
- Go
- Java
- C/C++
- 更多...

### Q: 如何更新到最新版本？
```bash
npm install -g @daabin/bincode@latest
```

### Q: 在哪里报告 bug？
请在 [GitHub Issues](https://github.com/daabin/bincode/issues) 提交 bug 报告。

### Q: 有社区或讨论组吗？
目前可以通过 GitHub Issues 和 Discussions 参与讨论。

---

**还有其他问题？** 请在 [GitHub Issues](https://github.com/daabin/bincode/issues) 提问！
