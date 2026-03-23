# Note Renderer

An Obsidian plugin that renders markdown notes into beautifully paginated images, optimized for publishing on Xiaohongshu (小红书).

[中文文档](#中文文档) | English

## Features

- **H2-based parsing**: Reads `## 标题` / `## 封面文字` / `## 封面图` / `## 正文` sections
- **9 built-in themes**: paper, graphite, ink-gold, amber, cream, latte, sage, mist, rose
- **Two page modes**: Long (3:5, 1080×1800) and Card (3:4, 1080×1440)
- **Typography**: 50+ Chinese fonts, adjustable font size (24–72px), line height, letter spacing
- **Cover design**: Rich markdown covers, background image overlay, auto-scaling text
- **Cover effects**: Stroke (4 styles), glow, decorative banner, text shadow, X/Y offset
- **Auto-pagination**: Intelligent page breaks at paragraph boundaries
- **Manual pagination**: `---` horizontal rule for user-defined page breaks
- **Preset system**: Save/load named rendering configurations
- **Per-note config**: `## renderer_config` JSON block for per-article overrides
- **Real-time preview**: Live sidebar preview with zoom and page navigation
- **One-click export**: All pages → ZIP archive (sequential PNGs)
- **Preview script**: Headless Chrome (puppeteer-core) renderer for CLI / AI-assisted layout review

## Themes

| Theme | Mood | Background | Accent |
|-------|------|------------|--------|
| paper | Minimal | White | None (weight only) |
| graphite | Cool, restrained | Dark grey | White |
| ink-gold | Ceremonial | Dark grey | Gold |
| amber | Warm story | Warm grey | Warm gold |
| cream | Soft daily | Cream white | Coral |
| latte | Warm vintage | Coffee | Brown |
| sage | Natural fresh | Grey-green | Sage |
| mist | Cool literary | Misty blue | Blue-grey |
| rose | Soft emotional | Dusty pink | Rose |

## Note Structure

The renderer reads the following H2 sections:

| Section | Purpose | Required |
|---------|---------|----------|
| `## 标题` | Cover title text | No (falls back to H1) |
| `## 封面文字` | Cover page content (supports rich markdown) | No |
| `## 封面图` | Cover background image, use `![[image]]` embed | No |
| `## 正文` | Body content, auto-paginated | Yes |

`## 封面` is accepted as an alias for `## 封面文字`.

### Cover Emphasis Syntax

- `<mark>keyword</mark>` — Highlighter effect (semi-transparent color block)
- `<u>keyword</u>` — Handwritten-style wavy underline
- `<span style="...">` — Fully custom styling (overrides theme defaults)

### Cover Text Auto-Scaling

| Characters | Font Size |
|-----------|-----------|
| ≤4 | 128px |
| ≤8 | 108px |
| ≤12 | 88px |
| ≤16 | 72px |
| ≤24 | 60px |
| >24 | 48px |

Elements with inline styles are excluded from auto-scaling.

## Preview Script

Headless Chrome rendering preview, generates per-page screenshots for AI-assisted layout review.

**Automatically reads Obsidian plugin config** (`.obsidian/plugins/note-renderer/data.json`) by default, no manual parameters needed. CLI arguments can override.

```bash
node scripts/preview.mjs <note.md> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--template` | From plugin config | Theme name |
| `--font-size` | From plugin config | Font size (px) |
| `--font-family` | From plugin config | Font family |
| `--mode` | From plugin config | Page ratio: long (3:5) / card (3:4) |
| `--out` | /tmp/nr-preview | Output directory |

Cover-only preview (faster):

```bash
node scripts/preview-cover.mjs <note.md> [--template cream]
```

## Development

```bash
npm run dev    # watch mode
npm run build  # production build, outputs main.js
```

Build output is automatically copied to the plugin directory (configured in esbuild.config.mjs).

## Page Dimensions

| Parameter | Value |
|-----------|-------|
| Page width | 1080px |
| Top padding | 120px |
| Bottom padding | 90px |
| Horizontal padding | 90px |
| Content area (long) | 900×1590px |
| Content area (card) | 900×1230px |

---

# 中文文档

Obsidian 插件，将 markdown 笔记渲染为分页图片，用于小红书图文发布。

## 功能

- 按 `## 封面文字` / `## 封面图` / `## 正文` 章节结构自动分页渲染
- 封面图作为全屏背景，封面文字叠加在上方
- 9 个内置配色主题
- 长文（3:5, 1080×1800）和图文（3:4, 1080×1440）两种页面比例
- 字号调整（24-72px）、50+ 中文字体可选（黑体、宋体、仿宋、楷体、圆体）
- 封面字体独立选择
- 一键导出 ZIP（每页一张 PNG）
- 封面文字自动缩放（按字数适配字号）
- `---` 手动分页、`**加粗**` 强调色高亮
- 预设系统：保存/加载命名配置
- 单篇配置：`## renderer_config` JSON 块覆盖全局设置
- 实时预览：侧边栏预览，支持缩放和翻页
- Preview 脚本：Headless Chrome 渲染，供 AI 辅助排版

## 主题

| 名称 | 气质 | 底色 | 强调色 |
|------|------|------|--------|
| paper | 极简留白 | 纯白 | 无（纯字重） |
| graphite | 冷静克制 | 深灰 | 白 |
| ink-gold | 仪式感 | 深灰 | 金 |
| amber | 温暖故事 | 暖灰 | 暖金 |
| cream | 柔和日常 | 奶油白 | 珊瑚 |
| latte | 温暖复古 | 奶咖 | 咖棕 |
| sage | 自然清新 | 灰豆绿 | 灰绿 |
| mist | 冷静文艺 | 雾霾蓝 | 雾蓝 |
| rose | 柔软感性 | 烟粉 | 烟粉 |

## 笔记结构

渲染器读取以下 H2 章节：

| 章节 | 用途 | 必需 |
|------|------|------|
| `## 标题` | 封面标题文字 | 否（fallback 到 H1） |
| `## 封面文字` | 封面页文字内容（支持多行 markdown） | 否 |
| `## 封面图` | 封面背景图，使用 `![[图片名]]` 嵌入 | 否 |
| `## 正文` | 正文内容，自动分页 | 是 |

`## 封面` 作为 `## 封面文字` 的兼容别名。

### 封面强调语法

- `<mark>关键词</mark>` — 马克笔高亮（半透明色块）
- `<u>关键词</u>` — 手写风波浪下划线
- `<span style="...">` — 完全自定义样式（覆盖主题默认）

### 封面文字自动缩放

| 字数 | 字号 |
|------|------|
| ≤4 | 128px |
| ≤8 | 108px |
| ≤12 | 88px |
| ≤16 | 72px |
| ≤24 | 60px |
| >24 | 48px |

有 inline style 的元素不参与自动缩放。

## Preview 脚本

Headless Chrome 渲染预览，生成每页截图供 AI 排版使用。

**默认自动读取 Obsidian 插件配置**（`.obsidian/plugins/note-renderer/data.json`），无需手动传参即可与 Obsidian 保持一致。CLI 参数可覆盖。

```bash
node scripts/preview.mjs <note.md> [options]
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--template` | 从插件配置读取 | 主题名称 |
| `--font-size` | 从插件配置读取 | 字号（px） |
| `--font-family` | 从插件配置读取 | 字体 |
| `--mode` | 从插件配置读取 | 页面比例：long (3:5) / card (3:4) |
| `--out` | /tmp/nr-preview | 输出目录 |

封面单独预览（更快）：

```bash
node scripts/preview-cover.mjs <note.md> [--template cream]
```

## 开发

```bash
npm run dev    # watch 模式
npm run build  # 生产构建，输出到 main.js
```

构建产物自动输出到插件目录（通过 esbuild.config.mjs 配置）。

## 页面尺寸

| 参数 | 值 |
|------|-----|
| 页面宽度 | 1080px |
| 上边距 | 120px |
| 下边距 | 90px |
| 左右边距 | 90px |
| 内容区（long） | 900×1590px |
| 内容区（card） | 900×1230px |
