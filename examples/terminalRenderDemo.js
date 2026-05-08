#!/usr/bin/env node

/**
 * 终端 Markdown 渲染器演示
 *
 * 演示两种渲染模式：
 * 1. 一次性渲染完整 Markdown
 * 2. 流式渲染（模拟 AI Agent 逐 token 输出）
 */

import {
  renderMarkdownToTerminal,
  createStreamingRenderer
} from '../dist/utils/terminalMarkdownRenderer.js';

// ============================================================================
// 测试数据
// ============================================================================

const FULL_MARKDOWN = `# 终端 Markdown 渲染演示

## 基础语法

这是一个**粗体文本**和*斜体文本*的示例。

你也可以使用\`行内代码\`来展示代码片段。

## 代码块

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55
\`\`\`

\`\`\`python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

print(quicksort([3, 6, 8, 10, 1, 2, 1]))
\`\`\`

## 列表

无序列表：

- 第一项
- 第二项
  - 嵌套项 A
  - 嵌套项 B
- 第三项

有序列表：

1. 首先做这个
2. 然后做那个
3. 最后完成

## 引用

> 这是一段引用文本。
> 可以跨越多行。
>
> 引用中也可以包含**格式化文本**。

## 链接

访问 [GitHub](https://github.com) 了解更多信息。

或者查看 [OpenAI](https://openai.com) 的最新动态。

## 表格

| 语言       | 类型     | 性能 | 学习曲线 |
|-----------|---------|------|---------|
| JavaScript | 动态    | 中等 | 简单    |
| TypeScript | 静态    | 中等 | 中等    |
| Python     | 动态    | 较慢 | 简单    |
| Rust       | 静态    | 极快 | 困难    |
| Go         | 静态    | 很快 | 中等    |

## 分隔线

---

## 任务列表

- [x] 完成 Markdown 解析器
- [x] 实现流式渲染
- [ ] 添加更多主题
- [ ] 优化性能

## 删除线和其他 GFM 扩展

~~这段文本已被删除~~

自动链接：https://example.com

## 结束

这就是终端 Markdown 渲染的演示！🎉
`;

// ============================================================================
// 演示函数
// ============================================================================

/**
 * 演示 1: 一次性渲染完整 Markdown
 */
function demo1_FullRender() {
  console.log('\n' + '='.repeat(80));
  console.log('演示 1: 一次性渲染完整 Markdown');
  console.log('='.repeat(80) + '\n');

  const rendered = renderMarkdownToTerminal(FULL_MARKDOWN, {
    enableHighlight: true,
    enableColor: true,
    escapeHtml: true
  });

  console.log(rendered);
}

/**
 * 演示 2: 流式渲染（模拟 Agent 输出）
 */
async function demo2_StreamingRender() {
  console.log('\n' + '='.repeat(80));
  console.log('演示 2: 流式渲染（模拟 AI Agent 逐 token 输出）');
  console.log('='.repeat(80) + '\n');

  const renderer = createStreamingRenderer({
    enableHighlight: true,
    enableColor: true,
    escapeHtml: false
  });

  // 模拟流式输入
  const chunks = [
    '# ',
    'Hello',
    ' ',
    'Stream',
    'ing\n\n',
    'This is ',
    '**bold** ',
    'and ',
    '*italic*',
    ' text.\n\n',
    '## Code Example\n\n',
    '```javascript\n',
    'const greeting = ',
    '"Hello, World!";\n',
    'console.log',
    '(greeting);\n',
    '```\n\n',
    '## List\n\n',
    '- Item 1\n',
    '- Item 2\n',
    '- Item 3\n\n',
    '> This is a ',
    'quote.\n\n',
    'Visit [GitHub]',
    '(https://github.com)',
    ' for more.\n\n',
    '---\n\n',
    'Done! ',
    '✓'
  ];

  console.log('[开始流式渲染...]\n');

  for (const chunk of chunks) {
    // 渲染增量内容
    const increment = renderer.appendChunk(chunk);

    if (increment) {
      process.stdout.write(increment);
    }

    // 模拟网络延迟
    await sleep(50);
  }

  // 完成渲染
  const final = renderer.finalize();
  console.log('\n\n[流式渲染完成]\n');
  console.log('最终渲染结果：');
  console.log('-'.repeat(80));
  console.log(final);
}

/**
 * 演示 3: 容错测试（不完整 Markdown）
 */
async function demo3_IncompleteMarkdown() {
  console.log('\n' + '='.repeat(80));
  console.log('演示 3: 容错测试（处理不完整的 Markdown 片段）');
  console.log('='.repeat(80) + '\n');

  const renderer = createStreamingRenderer();

  console.log('[测试 1: 未闭合代码块]\n');

  renderer.reset();
  const incomplete1 = [
    '# Code Block Test\n\n',
    '```javascript\n',
    'function test() {\n',
    '  console.log("incomplete");'
    // 故意不闭合代码块
  ];

  for (const chunk of incomplete1) {
    const increment = renderer.appendChunk(chunk);
    if (increment) process.stdout.write(increment);
    await sleep(30);
  }

  console.log('\n[缓冲区中有未闭合代码块，等待更多内容...]\n');
  await sleep(500);

  // 补充闭合
  const complete1 = '\n}\n```\n\nDone!';
  const increment = renderer.appendChunk(complete1);
  if (increment) process.stdout.write(increment);

  console.log('\n[代码块已闭合]\n');

  console.log('\n' + '-'.repeat(80) + '\n');
  console.log('[测试 2: 不完整表格]\n');

  renderer.reset();
  const incomplete2 = [
    '| Name | Age',
    // 表格未完成
  ];

  for (const chunk of incomplete2) {
    renderer.appendChunk(chunk);
    await sleep(30);
  }

  console.log('[表格行不完整，等待补充...]\n');
  await sleep(500);

  const complete2 = ' |\n| John | 30 |\n| Jane | 25 |\n\nTable complete!';
  process.stdout.write(renderer.appendChunk(complete2));

  console.log('\n[表格已完成]\n');
}

/**
 * 演示 4: 大文本流式渲染性能测试
 */
async function demo4_PerformanceTest() {
  console.log('\n' + '='.repeat(80));
  console.log('演示 4: 大文本流式渲染性能测试');
  console.log('='.repeat(80) + '\n');

  const largeMarkdown = `
# 性能测试文档

${Array(50).fill(0).map((_, i) => `
## Section ${i + 1}

这是第 ${i + 1} 个章节。包含**粗体**和*斜体*文本。

\`\`\`javascript
// 代码示例 ${i + 1}
const value = ${i + 1};
console.log("Section:", value);
\`\`\`

- 列表项 1
- 列表项 2
- 列表项 3
`).join('\n')}
`;

  const renderer = createStreamingRenderer();

  console.log(`[测试: 渲染 ${largeMarkdown.length} 字符的大文档]\n`);

  const startTime = Date.now();
  let chunkCount = 0;

  // 模拟按字符流式输入
  const chunkSize = 50; // 每次 50 字符
  for (let i = 0; i < largeMarkdown.length; i += chunkSize) {
    const chunk = largeMarkdown.substring(i, i + chunkSize);
    renderer.appendChunk(chunk);
    chunkCount++;

    // 不输出，只测试性能
    if (chunkCount % 100 === 0) {
      process.stdout.write('.');
    }
  }

  const finalResult = renderer.finalize();
  const endTime = Date.now();

  console.log('\n\n[性能测试结果]');
  console.log(`- 总字符数: ${largeMarkdown.length}`);
  console.log(`- 总块数: ${chunkCount}`);
  console.log(`- 耗时: ${endTime - startTime}ms`);
  console.log(`- 平均每块: ${((endTime - startTime) / chunkCount).toFixed(2)}ms`);
  console.log(`- 输出长度: ${finalResult.length} 字符`);
}

/**
 * 演示 5: 配置选项测试
 */
function demo5_ConfigOptions() {
  console.log('\n' + '='.repeat(80));
  console.log('演示 5: 不同配置选项的效果');
  console.log('='.repeat(80) + '\n');

  const testMarkdown = `
# Configuration Test

This is **bold** and *italic* text.

\`\`\`javascript
console.log("Hello");
\`\`\`

Visit [GitHub](https://github.com)
`;

  console.log('[配置 1: 禁用颜色]\n');
  console.log(renderMarkdownToTerminal(testMarkdown, {
    enableColor: false
  }));

  console.log('\n' + '-'.repeat(80) + '\n');

  console.log('[配置 2: 禁用代码高亮]\n');
  console.log(renderMarkdownToTerminal(testMarkdown, {
    enableHighlight: false
  }));

  console.log('\n' + '-'.repeat(80) + '\n');

  console.log('[配置 3: 启用 HTML 转义]\n');
  const htmlMarkdown = 'Test <script>alert("XSS")</script> and **bold**';
  console.log(renderMarkdownToTerminal(htmlMarkdown, {
    escapeHtml: true
  }));
}

// ============================================================================
// 工具函数
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('\n');
  console.log('█'.repeat(80));
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█' + ' '.repeat(20) + '终端 Markdown 流式渲染演示' + ' '.repeat(20) + '█');
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█'.repeat(80));

  // 检查命令行参数
  const args = process.argv.slice(2);
  const demoNumber = args[0] ? parseInt(args[0]) : 0;

  if (demoNumber === 0 || demoNumber === 1) {
    demo1_FullRender();
  }

  if (demoNumber === 0 || demoNumber === 2) {
    await demo2_StreamingRender();
  }

  if (demoNumber === 0 || demoNumber === 3) {
    await demo3_IncompleteMarkdown();
  }

  if (demoNumber === 0 || demoNumber === 4) {
    await demo4_PerformanceTest();
  }

  if (demoNumber === 0 || demoNumber === 5) {
    demo5_ConfigOptions();
  }

  console.log('\n' + '='.repeat(80));
  console.log('所有演示完成！');
  console.log('='.repeat(80) + '\n');

  console.log('使用方法:');
  console.log('  node examples/terminalRenderDemo.js       # 运行所有演示');
  console.log('  node examples/terminalRenderDemo.js 1     # 只运行演示 1');
  console.log('  node examples/terminalRenderDemo.js 2     # 只运行演示 2');
  console.log('  ...\n');
}

// 运行
main().catch(console.error);
