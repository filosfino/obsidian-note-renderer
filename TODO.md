# TODO — Note Renderer

## P0

- 给导出流程补更贴近真实使用的 integration-style 测试
- 评估 `preview-view.ts` 里 file watcher 与切 note 重置 working config 的竞态边界

## P1

- 继续收紧 `schema.ts` grouped note config 的类型，减少剩余 `Record<string, unknown>` 桥接
- 梳理 `settings-panel.ts` 的大型 UI 构建函数，考虑按 preset / cover / effects 分块
- 给导出链路补大页面 / 多页场景下的性能观察，确认 `html-to-image` 和 `scaleBlob()` 的成本上限
- 给 cover playground 补 demo note / preset 载入能力，复用 `examples/` 里的示例来调 autosize、逐行排版、effects 组合

## P2

- 探索新封面效果：gradient / emboss / long shadow / glitch
- 如要继续做效果扩展，优先沿 `schema.ts` + `effects.ts` registry 路线扩，不要回退到 `renderer.ts` 内联 switch
