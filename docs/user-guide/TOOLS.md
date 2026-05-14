# bincode 工具指南

## 工具总览

bincode 提供 **15+ 个强大的工具**，涵盖文件操作、代码搜索、命令执行和版本控制。

## 📁 文件操作工具

### read_file - 读取文件
读取工作区内的文本文件。

```text
请读取 src/config.ts 文件
```

### write_file - 写入文件
写入完整文件内容，自动创建目录。

```text
请创建一个新文件 docs/guide.md，内容是项目使用指南
```

### edit_file - 编辑文件
精确替换文件中的特定文本，比 write_file 更高效。

```text
请将 src/config.ts 中的 'deepseek-v4-pro' 改为 'deepseek-v4-flash'
```

### list_directory - 列出目录
浏览目录内容，显示文件类型和大小。

```text
列出 src 目录的内容
列出整个项目结构（递归）
```

### get_file_info - 文件信息
获取文件元信息，不读取内容。

```text
查看 src/config.ts 的信息
```

### read_multiple_files - 批量读取
一次读取多个文件，提高效率。

```text
同时读取 package.json 和 tsconfig.json
```

### delete_file - 删除文件
删除文件或目录。

```text
删除 temp/cache.json
```

⚠️ **注意**: 此操作不可逆，请谨慎使用。

### move_file - 移动/重命名
移动或重命名文件/目录。

```text
将 src/old-name.ts 重命名为 src/new-name.ts
```

## 🔍 搜索工具

### find_files - 查找文件
按 glob 模式查找文件。

```text
查找所有 TypeScript 文件
查找 src 目录下的所有 .tsx 文件
```

### search_text - 文本搜索
在文件中搜索文本或正则表达式。

```text
在项目中搜索 "API_KEY"
在 src 目录中搜索 "function.*render"（正则）
```

### search_and_replace - 批量替换
在多个文件中搜索并替换文本。

```text
将所有 .ts 文件中的 'oldName' 替换为 'newName'
```

## ⚙️ 命令执行

### run_command - 执行命令
执行 shell 命令并返回输出。

**允许的命令**: npm, yarn, pnpm, node, git, tsc, eslint 等

```text
运行 npm test
运行 tsc --noEmit 检查类型
```

## 🔄 Git 工具

### git_status - Git 状态
查看 Git 仓库状态。

```text
查看 git 状态
```

### git_diff - Git 差异
查看文件修改差异。

```text
查看所有未暂存的更改
查看 src/config.ts 的更改
```

### git_log - Git 历史
查看提交历史。

```text
查看最近 5 次提交
```

## 🎯 使用场景示例

### 探索新项目

```text
1. 列出项目根目录
2. 查看 package.json
3. 列出 src 目录结构
4. 查找所有 TypeScript 文件
```

### 修改代码

```text
1. 读取文件
2. 编辑特定部分
3. 验证修改
```

### 运行测试

```text
1. 运行测试: npm test
2. 检查类型: tsc --noEmit
3. 构建项目: npm run build
```

## 安全特性

### 路径安全
- ✅ 所有文件操作限制在工作区内
- ✅ 自动检测和阻止路径遍历攻击

### 命令安全
- ✅ 白名单机制，只允许安全命令
- ✅ 禁止危险命令（rm -rf /, sudo 等）
- ✅ 超时保护，防止无限执行

### 输出限制
- ✅ 所有输出限制在 12,000 字符
- ✅ 超长内容自动截断

## 最佳实践

1. **优先使用高效工具**: 使用 `read_multiple_files` 而不是多次调用 `read_file`
2. **编辑文件选择合适工具**: 小范围修改使用 `edit_file`，大范围修改使用 `write_file`
3. **批量操作先预览**: 使用 `search_and_replace` 时先设置 `dry_run: true`
4. **删除前先确认**: 使用 `list_directory` 查看内容后再删除
