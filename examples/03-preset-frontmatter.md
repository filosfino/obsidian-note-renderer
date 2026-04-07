---
renderer_config:
  presetName: default
  fontSize: 30
  activeTheme: mist
  coverPagePaddingX: 40
  coverGlow: true
---

# Note Renderer Preset Frontmatter Example

## 标题

用预设做底，再做少量局部调整

## 封面文字

这份示例演示轻量 `renderer_config`。

上面的 frontmatter 会先读取 `default` 预设，再把当前笔记里的 `fontSize`、`activeTheme`、`coverPagePaddingX` 和 `coverGlow` 作为局部 override。

## 正文

推荐的使用方式：

1. 在插件面板里调好一个常用预设。
2. 大多数笔记只保存 `presetName`。
3. 特殊笔记再加少量 override。

这样笔记里不会保存一整份冗长配置，也更容易维护。

