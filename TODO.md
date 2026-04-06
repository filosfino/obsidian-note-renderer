# TODO — Note Renderer

## 已完成

- note 内 `renderer_config` 已收敛为轻量 frontmatter：优先保存 `presetName + 局部 override`，并兼容旧的完整 config dump
- `schema.json` 已裁剪为紧凑 runtime export，不再输出 grouped / flat / semantic 多套兼容快照
- parser 会忽略 fenced code block 里的 `## ...`，正文示例不再误切分章节
- 图片解析带当前 note 路径上下文，重名附件优先按 source note 解析
- headless 导出缩放改为插件内置 blob/canvas 路径，不再依赖 `sips`
- `preview-view.ts` 已拆出 note session / UI sync / export helper 这几层，主要流程不再全部挤在单个大函数里
- preset / fallback / default 的读取已在 `main.ts` 和 `preview-view.ts` 里做了一轮类型化收口
- 页面基准尺寸已改为 `card 600×800 / long 720×1200`，最终导出尺寸为 `1200×1600 / 1440×2400`
- 页面主 padding 和正文结构 spacing 已按页面比例 / 页面变量收口，不再依赖旧尺寸固定 px
- schema 约束已按新尺寸收紧：正文 `fontSize` 为 `22-30px`
- browser cover playground 已落地：左侧 markdown，右侧复用真实 toolbar + preview，可直接在浏览器里调封面
- `==高亮==` 语法已支持，渲染为 `<mark>` 并带正文荧光标注样式

## P0

- 给 `refresh()` / 导出流程补更贴近真实使用的 integration-style 测试
- 评估 `preview-view.ts` 里 file watcher 与切 note 重置 working config 的竞态边界

## P1

- 继续收紧 `schema.ts` grouped note config 的类型，减少剩余 `Record<string, unknown>` 桥接
- 梳理 `settings-panel.ts` 的大型 UI 构建函数，考虑按 preset / cover / effects 分块
- 给导出链路补一次大页面/多页场景下的性能观察，确认 `html-to-image` 和 `scaleBlob()` 的成本上限
- 给 cover playground 补更明确的 demo note / preset 载入能力，方便专门调 autosize、逐行排版、effects 组合

## P2

- 新封面效果探索：gradient / emboss / long shadow / glitch
- 如要继续做效果扩展，优先沿 `schema.ts` + `effects.ts` registry 路线扩，不要回退到 `renderer.ts` 内联 switch
