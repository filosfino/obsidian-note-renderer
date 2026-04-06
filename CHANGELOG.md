# Changelog

## Unreleased

### Improvements

- Save note frontmatter `renderer_config` as `presetName + partial overrides` instead of dumping the full resolved config whenever a preset is active
- Keep reading legacy full note config dumps for backward compatibility
- Update README / CLAUDE / TODO docs to reflect the lightweight note frontmatter flow

## 0.5.1

### Improvements

- Remove note-level `renderer_config` parsing, writing, and migration code, and simplify preview/headless rendering around plugin working config plus presets
- Trim `schema.json` down to the runtime schema surface only, dropping compatibility snapshots and moving theme color semantics to `theme-colors.yaml`
- Shrink schema/runtime metadata further by keeping only the semantic field info the settings UI actually uses
- Update README / CLAUDE / TODO docs to match the new config and export model

## 0.5.0

### Improvements

- Shrink base page sizes to `600×800` (card) and `720×1200` (long) while keeping `pixelRatio: 2`, so final exports are `1200×1600` and `1440×2400`
- Make page padding and most body structure spacing scale with page dimensions instead of relying on legacy fixed px values
- Switch schema defaults to mode-aware values so `card` and `long` can carry different cover padding, glow, shadow, and texture defaults
- Tighten body typography controls to `22-30px` with `1px` steps to better match the new page sizes
- Allow note frontmatter to store just `renderer_config.presetName` when a note only references a preset, avoiding full config dumps
- Resolve preset-only note configs correctly across preview refreshes and headless rendering paths
- Update README / CLAUDE / TODO docs to reflect the new sizing, note-config, and preset flow

## 0.4.3

### Improvements

- Support Obsidian-style `==highlight==` syntax by rendering it as `<mark>`
- Add default body-page highlight styling for `<mark>` so fluorescence annotations show consistently outside cover content
- Add parser tests to ensure highlight syntax works without affecting inline code

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
