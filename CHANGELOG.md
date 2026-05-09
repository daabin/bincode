# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-01-XX

### Added

#### Multi-LLM Provider Support
- DeepSeek provider (default)
- OpenAI provider (GPT-4o, GPT-4-turbo)
- Anthropic provider (Claude 3.5 Sonnet)
- Ollama provider (local models)

#### New Tools
- `analyze_image` - Image analysis with multimodal support (PNG, JPG, WebP, GIF, BMP)
- `code_search` - Symbol search with code indexing
- `code_complete` - AI-powered code completion
- `web_search` - Web search using DuckDuckGo
- `web_fetch` - Fetch and parse web content
- `generate_docs` - Generate JSDoc/README/API documentation
- `compare_files` - File diff comparison

#### Advanced Features
- Code indexing with symbol extraction (TS/JS/Python/Rust/Go)
- Session persistence and management
- Token usage monitoring and statistics
- Plugin system with dynamic loading
- MCP (Model Context Protocol) client support
- Configurable command whitelist/blacklist
- Configuration file hot reload

#### CLI Enhancements
- `/stats` - View token usage statistics
- `/config` - Display current configuration
- `/clear` - Clear conversation history
- Spinner animation during AI processing
- Status bar showing provider and model info

#### CI/CD
- GitHub Actions CI workflow (Node 18/20/22)
- Multi-platform release workflow (Linux/macOS/Windows)
- Standalone binary builds with pkg

### Changed
- Package name changed to `@daabin/bincode`
- Removed `private: true` for npm publishing
- Enhanced error handling with retry mechanism
- Improved token management and context window optimization

### Fixed
- `edit_file` tool now handles multiple matches correctly
- Various bug fixes and performance improvements

## [0.1.0] - 2024-XX-XX

### Added
- Initial release
- Basic CLI interface with Ink
- DeepSeek agent integration
- File operations (read, write, edit, delete, move)
- Code search (grep, glob)
- Command execution with whitelist
- Git integration (status, diff, log)
- Markdown rendering with syntax highlighting
- Configuration persistence