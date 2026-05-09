import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

/**
 * 代码索引存储目录
 */
function getIndexDir(): string {
  return process.env.BINCODE_INDEX_DIR || path.join(os.homedir(), '.bincode', 'index');
}

/**
 * 索引条目
 */
export interface IndexEntry {
  file: string;
  language: string;
  symbols: SymbolInfo[];
  hash: string;
  size: number;
  lastModified: number;
}

/**
 * 符号信息
 */
export interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'method' | 'property' | 'enum' | 'export';
  line: number;
  column: number;
  signature?: string;
  docstring?: string;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  file: string;
  line: number;
  column: number;
  symbol: string;
  kind: string;
  context: string;
  score: number;
}

/**
 * 索引统计
 */
export interface IndexStats {
  totalFiles: number;
  totalSymbols: number;
  languages: Record<string, number>;
  lastUpdated: number;
}

/**
 * 检测文件语言
 */
export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.sh': 'shell',
    '.bash': 'shell',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss'
  };
  return langMap[ext] || 'unknown';
}

/**
 * 提取代码符号（简单正则解析）
 */
export function extractSymbols(content: string, language: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // TypeScript / JavaScript
    if (language === 'typescript' || language === 'javascript') {
      // Functions
      const fnMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
      if (fnMatch) {
        symbols.push({ name: fnMatch[1], kind: 'function', line: lineNum, column: line.indexOf(fnMatch[1]) });
      }

      // Arrow functions / const
      const arrowMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/);
      if (arrowMatch) {
        symbols.push({ name: arrowMatch[1], kind: 'function', line: lineNum, column: line.indexOf(arrowMatch[1]) });
      }

      // Classes
      const classMatch = line.match(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
      if (classMatch) {
        symbols.push({ name: classMatch[1], kind: 'class', line: lineNum, column: line.indexOf(classMatch[1]) });
      }

      // Interfaces
      const ifaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
      if (ifaceMatch) {
        symbols.push({ name: ifaceMatch[1], kind: 'interface', line: lineNum, column: line.indexOf(ifaceMatch[1]) });
      }

      // Type aliases
      const typeMatch = line.match(/(?:export\s+)?type\s+(\w+)/);
      if (typeMatch) {
        symbols.push({ name: typeMatch[1], kind: 'type', line: lineNum, column: line.indexOf(typeMatch[1]) });
      }

      // Enums
      const enumMatch = line.match(/(?:export\s+)?enum\s+(\w+)/);
      if (enumMatch) {
        symbols.push({ name: enumMatch[1], kind: 'enum', line: lineNum, column: line.indexOf(enumMatch[1]) });
      }
    }

    // Python
    if (language === 'python') {
      const fnMatch = line.match(/(?:async\s+)?def\s+(\w+)\s*\(/);
      if (fnMatch) {
        symbols.push({ name: fnMatch[1], kind: 'function', line: lineNum, column: line.indexOf(fnMatch[1]) });
      }
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) {
        symbols.push({ name: classMatch[1], kind: 'class', line: lineNum, column: line.indexOf(classMatch[1]) });
      }
    }

    // Rust
    if (language === 'rust') {
      const fnMatch = line.match(/(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/);
      if (fnMatch) {
        symbols.push({ name: fnMatch[1], kind: 'function', line: lineNum, column: line.indexOf(fnMatch[1]) });
      }
      const structMatch = line.match(/(?:pub\s+)?struct\s+(\w+)/);
      if (structMatch) {
        symbols.push({ name: structMatch[1], kind: 'class', line: lineNum, column: line.indexOf(structMatch[1]) });
      }
      const traitMatch = line.match(/(?:pub\s+)?trait\s+(\w+)/);
      if (traitMatch) {
        symbols.push({ name: traitMatch[1], kind: 'interface', line: lineNum, column: line.indexOf(traitMatch[1]) });
      }
      const enumMatch = line.match(/(?:pub\s+)?enum\s+(\w+)/);
      if (enumMatch) {
        symbols.push({ name: enumMatch[1], kind: 'enum', line: lineNum, column: line.indexOf(enumMatch[1]) });
      }
    }

    // Go
    if (language === 'go') {
      const fnMatch = line.match(/func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/);
      if (fnMatch) {
        symbols.push({ name: fnMatch[1], kind: 'function', line: lineNum, column: line.indexOf(fnMatch[1]) });
      }
      const typeMatch = line.match(/type\s+(\w+)\s+(struct|interface)/);
      if (typeMatch) {
        symbols.push({ name: typeMatch[1], kind: typeMatch[2] === 'interface' ? 'interface' : 'class', line: lineNum, column: line.indexOf(typeMatch[1]) });
      }
    }
  }

  return symbols;
}

/**
 * 计算文件内容的简单哈希
 */
export function contentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * 索引工作区目录
 */
export function indexWorkspace(cwd: string): IndexEntry[] {
  const entries: IndexEntry[] = [];
  const ignoreDirs = new Set(['.git', 'node_modules', 'dist', '.next', '__pycache__', 'target', 'build', '.bincode']);

  function walk(dir: string): void {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          if (!ignoreDirs.has(item.name) && !item.name.startsWith('.')) {
            walk(fullPath);
          }
        } else if (item.isFile()) {
          const language = detectLanguage(item.name);
          if (language === 'unknown') continue;

          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const stat = fs.statSync(fullPath);
            const symbols = extractSymbols(content, language);

            entries.push({
              file: path.relative(cwd, fullPath),
              language,
              symbols,
              hash: contentHash(content),
              size: stat.size,
              lastModified: stat.mtimeMs
            });
          } catch {
            // Skip files that can't be read
          }
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  }

  walk(cwd);

  // 保存索引
  const indexDir = getIndexDir();
  if (!fs.existsSync(indexDir)) {
    fs.mkdirSync(indexDir, { recursive: true });
  }

  const indexPath = path.join(indexDir, `${contentHash(cwd)}-index.json`);
  fs.writeFileSync(indexPath, JSON.stringify({
    entries,
    stats: {
      totalFiles: entries.length,
      totalSymbols: entries.reduce((sum, e) => sum + e.symbols.length, 0),
      languages: entries.reduce((acc, e) => {
        acc[e.language] = (acc[e.language] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      lastUpdated: Date.now()
    }
  }, null, 2));

  return entries;
}

/**
 * 加载已有索引
 */
export function loadIndex(cwd: string): { entries: IndexEntry[]; stats: IndexStats } | null {
  const indexDir = getIndexDir();
  const indexPath = path.join(indexDir, `${contentHash(cwd)}-index.json`);

  try {
    if (fs.existsSync(indexPath)) {
      return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * 语义搜索（基于关键词匹配 + 符号名相似度）
 */
export function searchSymbols(
  entries: IndexEntry[],
  query: string,
  options: { kind?: string; language?: string; limit?: number } = {}
): SearchResult[] {
  const { kind, language, limit = 20 } = options;
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/);

  const results: SearchResult[] = [];

  for (const entry of entries) {
    if (language && entry.language !== language) continue;

    for (const symbol of entry.symbols) {
      if (kind && symbol.kind !== kind) continue;

      const nameLower = symbol.name.toLowerCase();
      let score = 0;

      // 精确匹配
      if (nameLower === queryLower) {
        score = 100;
      }
      // 包含查询
      else if (nameLower.includes(queryLower)) {
        score = 80;
      }
      // 查询包含符号名
      else if (queryLower.includes(nameLower)) {
        score = 60;
      }
      // 驼峰匹配
      else if (camelCaseMatch(nameLower, queryLower)) {
        score = 70;
      }
      // 术语匹配
      else {
        const matchedTerms = queryTerms.filter(t => nameLower.includes(t));
        if (matchedTerms.length > 0) {
          score = (matchedTerms.length / queryTerms.length) * 50;
        }
      }

      if (score > 0) {
        // 获取上下文行
        let context = '';
        try {
          const content = fs.readFileSync(entry.file, 'utf8');
          const lines = content.split('\n');
          context = lines.slice(Math.max(0, symbol.line - 2), symbol.line + 3).join('\n');
        } catch {
          // Ignore
        }

        results.push({
          file: entry.file,
          line: symbol.line,
          column: symbol.column,
          symbol: symbol.name,
          kind: symbol.kind,
          context,
          score
        });
      }
    }
  }

  // 按分数排序
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * 驼峰匹配
 */
function camelCaseMatch(name: string, query: string): boolean {
  const nameParts = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/\s+/);
  const queryParts = query.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/\s+/);

  let qi = 0;
  for (const np of nameParts) {
    if (np.startsWith(queryParts[qi])) {
      qi++;
      if (qi >= queryParts.length) return true;
    }
  }
  return false;
}

/**
 * 获取索引统计
 */
export function getIndexStats(cwd: string): IndexStats | null {
  const index = loadIndex(cwd);
  return index?.stats || null;
}