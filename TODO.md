# TODO — Note Renderer

## 已完成

- `renderer_config` 默认写回 frontmatter，统一落盘为 grouped schema，并自动补 `rendererConfigVersion`
- frontmatter YAML 损坏时，写回会安全跳过，避免误删原 metadata
- parser 会忽略 fenced code block 里的 `## ...`，正文示例不再误切分章节
- 图片解析带当前 note 路径上下文，重名附件优先按 source note 解析
- headless 导出缩放改为插件内置 blob/canvas 路径，不再依赖 `sips`
- `preview-view.ts` 已拆出 note session / UI sync / export helper 这几层，主要流程不再全部挤在单个大函数里
- preset / fallback / default 的读取已在 `main.ts` 和 `preview-view.ts` 里做了一轮类型化收口
- browser cover playground 已落地：左侧 markdown，右侧复用真实 toolbar + preview，可直接在浏览器里调封面
- `==高亮==` 语法已支持，渲染为 `<mark>` 并带正文荧光标注样式

## P0

- 给 `refresh()` / 导出流程补更贴近真实使用的 integration-style 测试
- 把 `README.md` 里的 CLI / renderer_config 示例补成一组最小可运行 cookbook，覆盖单页导出、批量导出、迁移写回
- 评估 `preview-view.ts` 里 file watcher 与 note write guard 的竞态边界，特别是连续切 note + 自动保存的场景

## P1

- 继续收紧 `schema.ts` grouped note config 的类型，减少剩余 `Record<string, unknown>` 桥接
- 梳理 `settings-panel.ts` 的大型 UI 构建函数，考虑按 preset / cover / effects 分块
- 给导出链路补一次大页面/多页场景下的性能观察，确认 `html-to-image` 和 `scaleBlob()` 的成本上限
- 给 cover playground 补更明确的 demo note / preset 载入能力，方便专门调 autosize、逐行排版、effects 组合

## P2

- 新封面效果探索：gradient / emboss / long shadow / glitch
- 如要继续做效果扩展，优先沿 `schema.ts` + `effects.ts` registry 路线扩，不要回退到 `renderer.ts` 内联 switch
