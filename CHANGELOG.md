# Changelog

## 0.1.0

Initial release.

### Features

- **Rendering engine**: Markdown → paginated PNG images, optimized for Xiaohongshu (1080×1800 / 1080×1440)
- **H2-based parsing**: Reads `## 标题` / `## 封面文字` / `## 封面图` / `## 正文` sections
- **9 built-in themes**: paper, graphite, ink-gold, amber, cream, latte, sage, mist, rose
- **Cover design**: Rich markdown covers, background image overlay, auto-scaling text by character count
- **Cover effects**: Stroke (4 styles), glow, decorative banner, text shadow, X/Y offset
- **Typography**: 50+ Chinese fonts (黑体/宋体/仿宋/楷体/圆体), adjustable font size (24-72px), line height, letter spacing
- **Auto-pagination**: Intelligent page breaks at paragraph boundaries
- **Manual pagination**: `---` horizontal rule for user-defined page breaks
- **Preset system**: Save/load/delete named rendering configurations
- **Per-note config**: `## renderer_config` JSON block for per-article overrides, with lock button
- **Two page modes**: Long (3:5) and Card (3:4)
- **Real-time preview**: Live sidebar preview with zoom and page navigation
- **One-click export**: All pages → ZIP archive (sequential PNGs)
- **Preview script**: Headless Chrome (puppeteer-core) renderer for CLI/AI-assisted layout review
- **Auto-refresh**: Updates on file change and active file switch
