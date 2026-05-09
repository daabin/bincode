# Bincode 工具完整指南

## 📚 工具总览

Bincode 现在提供 **15 个强大的工具**，涵盖文件操作、代码搜索、命令执行和版本控制。

---

## 📁 文件操作工具

### 1. read_file - 读取文件
读取工作区内的文本文件。

**参数**:
- `path` (必需): 相对路径

**示例**:
```
请读取 src/config.ts 文件
```

---

### 2. write_file - 写入文件
写入完整文件内容，自动创建目录。

**参数**:
- `path` (必需): 相对路径
- `content` (必需): 完整文件内容

**示例**:
```
请创建一个新文件 docs/guide.md，内容是项目使用指南
```

---

### 3. ✨ edit_file - 编辑文件
**【新增】** 精确替换文件中的特定文本，比 write_file 更高效。

**参数**:
- `path` (必需): 相对路径
- `old_text` (必需): 要替换的原文本（必须完全匹配）
- `new_text` (必需): 新文本

**示例**:
```
请将 src/config.ts 中的 'deepseek-v4-pro' 改为 'deepseek-v4-flash'
```

**优势**:
- ✅ 只传输修改部分，节省 token
- ✅ 精确匹配，避免误改
- ✅ 适合小范围修改

---

### 4. ✨ list_directory - 列出目录
**【新增】** 浏览目录内容，显示文件类型和大小。

**参数**:
- `path` (可选): 相对路径，默认为根目录
- `recursive` (可选): 是否递归，默认 false
- `max_depth` (可选): 最大递归深度，默认 2

**示例**:
```
列出 src 目录的内容
列出整个项目结构（递归）
```

**输出格式**:
```
📁 src/
  📄 index.ts (2.3KB)
  📄 config.ts (1.5KB)
  📁 utils/
    📄 helper.ts (800B)
```

---

### 5. ✨ get_file_info - 文件信息
**【新增】** 获取文件元信息，不读取内容。

**参数**:
- `path` (必需): 相对路径

**返回**:
```json
{
  "path": "src/config.ts",
  "size": 2048,
  "type": "file",
  "modified": "2026-05-08T10:30:00Z",
  "created": "2026-05-01T08:00:00Z"
}
```

**用途**:
- 检查文件是否存在
- 判断文件大小（避免读取超大文件）
- 查看修改时间

---

### 6. ✨ read_multiple_files - 批量读取
**【新增】** 一次读取多个文件，提高效率。

**参数**:
- `paths` (必需): 文件路径数组
- `max_files` (可选): 最多读取数量，默认 10

**示例**:
```
同时读取 package.json 和 tsconfig.json
```

**优势**:
- ✅ 减少工具调用次数
- ✅ 适合对比多个文件
- ✅ 提高响应速度

---

### 7. ✨ delete_file - 删除文件
**【新增】** 删除文件或目录。

**参数**:
- `path` (必需): 相对路径
- `recursive` (可选): 是否递归删除目录，默认 false

**示例**:
```
删除 temp/cache.json
删除整个 temp 目录
```

⚠️ **注意**: 此操作不可逆，请谨慎使用。

---

### 8. ✨ move_file - 移动/重命名
**【新增】** 移动或重命名文件/目录。

**参数**:
- `source` (必需): 源路径
- `destination` (必需): 目标路径

**示例**:
```
将 src/old-name.ts 重命名为 src/new-name.ts
将 src/utils 移动到 src/helpers
```

---

## 🔍 搜索工具

### 9. find_files - 查找文件
按 glob 模式查找文件。

**参数**:
- `pattern` (必需): glob 模式，如 "*.ts" 或 "src/**/*.tsx"

**示例**:
```
查找所有 TypeScript 文件
查找 src 目录下的所有 .tsx 文件
```

---

### 10. search_text - 文本搜索
在文件中搜索文本或正则表达式。

**参数**:
- `query` (必需): 搜索文本或正则
- `path` (可选): 限制搜索范围
- `case_sensitive` (可选): 是否区分大小写，默认 true

**示例**:
```
在项目中搜索 "API_KEY"
在 src 目录中搜索 "function.*render"（正则）
不区分大小写搜索 "todo"
```

**输出格式**:
```
src/config.ts:24:const API_KEY = process.env.API_KEY;
src/main.ts:10:  apiKey: API_KEY,
```

---

### 11. ✨ search_and_replace - 批量替换
**【新增】** 在多个文件中搜索并替换文本。

**参数**:
- `pattern` (必需): 文件 glob 模式
- `search` (必需): 搜索文本或正则
- `replace` (必需): 替换文本
- `dry_run` (可选): 预览模式，默认 true

**示例**:
```
将所有 .ts 文件中的 'oldName' 替换为 'newName'（先预览）
确认后执行实际替换
```

**两步流程**:
1. 先用 `dry_run: true` 预览
2. 确认后用 `dry_run: false` 执行

---

## ⚙️ 命令执行

### 12. ✨ run_command - 执行命令
**【新增】** 执行 shell 命令并返回输出。

**参数**:
- `command` (必需): 命令名（必须在白名单中）
- `args` (可选): 命令参数数组
- `timeout` (可选): 超时时间（秒），默认 30

**允许的命令**:
- **包管理**: npm, yarn, pnpm, bun
- **Node.js**: node, tsx, ts-node, deno
- **Git**: git
- **工具**: eslint, tsc, prettier
- **系统**: cat, ls, pwd, echo, which
- **其他**: python, cargo, go, java

**示例**:
```
运行 npm test
运行 tsc --noEmit 检查类型
运行 npm run build
查看 Node.js 版本
```

**安全机制**:
- ✅ 白名单控制，只允许安全命令
- ✅ 超时保护，防止卡死
- ✅ 输出长度限制

---

## 🔄 Git 工具

### 13. ✨ git_status - Git 状态
**【新增】** 查看 Git 仓库状态。

**无参数**

**示例**:
```
查看 git 状态
```

**输出格式**:
```
 M src/config.ts
 M src/tools.ts
?? docs/guide.md
```

---

### 14. ✨ git_diff - Git 差异
**【新增】** 查看文件修改差异。

**参数**:
- `path` (可选): 特定文件路径
- `staged` (可选): 查看已暂存的更改，默认 false

**示例**:
```
查看所有未暂存的更改
查看 src/config.ts 的更改
查看已暂存的更改
```

---

### 15. ✨ git_log - Git 历史
**【新增】** 查看提交历史。

**参数**:
- `limit` (可选): 显示条数，默认 10
- `path` (可选): 特定文件的历史

**示例**:
```
查看最近 5 次提交
查看 README.md 的修改历史
```

**输出格式**:
```
a1b2c3d (HEAD -> main) feat: add new tools
e4f5g6h fix: resolve merge conflict
h7i8j9k docs: update README
```

---

## 🎯 使用场景示例

### 场景 1: 探索新项目

```
1. 列出项目根目录
   → list_directory

2. 查看 package.json
   → read_file: package.json

3. 列出 src 目录结构
   → list_directory: src, recursive: true

4. 查找所有 TypeScript 文件
   → find_files: **/*.ts
```

### 场景 2: 修改代码

```
1. 读取文件
   → read_file: src/config.ts

2. 编辑特定部分
   → edit_file: 
      old_text: "const PORT = 3000"
      new_text: "const PORT = 8080"

3. 验证修改
   → read_file: src/config.ts
```

### 场景 3: 运行测试

```
1. 运行测试
   → run_command: npm, args: ["test"]

2. 检查类型
   → run_command: tsc, args: ["--noEmit"]

3. 构建项目
   → run_command: npm, args: ["run", "build"]
```

### 场景 4: 批量重命名

```
1. 搜索旧名称
   → search_text: "oldFunction"

2. 预览替换
   → search_and_replace:
      pattern: "src/**/*.ts"
      search: "oldFunction"
      replace: "newFunction"
      dry_run: true

3. 执行替换
   → search_and_replace:
      dry_run: false
```

### 场景 5: Git 工作流

```
1. 查看状态
   → git_status

2. 查看更改
   → git_diff

3. 查看历史
   → git_log: limit: 5
```

---

## 🔒 安全特性

### 路径安全
- ✅ 所有文件操作限制在工作区内
- ✅ 自动检测和阻止路径遍历攻击
- ✅ 相对路径自动解析

### 命令安全
- ✅ 白名单机制，只允许安全命令
- ✅ 禁止危险命令（rm -rf /, sudo 等）
- ✅ 超时保护，防止无限执行

### 输出限制
- ✅ 所有输出限制在 12,000 字符
- ✅ 超长内容自动截断
- ✅ 显示截断信息

---

## 📊 工具对比表

| 工具类别 | 工具数量 | 新增工具 |
|---------|---------|---------|
| 文件操作 | 8 | 6 个 |
| 搜索工具 | 3 | 1 个 |
| 命令执行 | 1 | 1 个 |
| Git 集成 | 3 | 3 个 |
| **总计** | **15** | **11 个** |

---

## 🎓 最佳实践

### 1. 优先使用高效工具

❌ **低效**:
```
多次调用 read_file 读取 10 个文件
```

✅ **高效**:
```
一次调用 read_multiple_files 读取所有文件
```

### 2. 编辑文件选择合适工具

❌ **低效**:
```
用 write_file 覆盖整个大文件（只改 1 行）
```

✅ **高效**:
```
用 edit_file 精确替换那 1 行
```

### 3. 批量操作先预览

❌ **危险**:
```
直接执行 search_and_replace（可能误改）
```

✅ **安全**:
```
先用 dry_run: true 预览，确认后再执行
```

### 4. 删除前先确认

❌ **危险**:
```
直接删除目录
```

✅ **安全**:
```
先用 list_directory 查看内容，确认后再删除
```

---

## 🚀 测试建议

在 CLI 中尝试以下命令来测试新工具：

```bash
# 1. 列出目录
> 列出当前项目的根目录内容

# 2. 编辑文件
> 将 README.md 中的 '0.1.0' 改为 '0.2.0'

# 3. 运行命令
> 运行 npm run typecheck

# 4. Git 状态
> 查看 git 状态

# 5. 批量替换（预览）
> 在所有 .ts 文件中搜索 'TODO' 并替换为 'FIXME'（先预览）
```

---

**🎉 恭喜！Bincode 现在拥有完整的 Code Agent 工具集！**
