# TODO — Note Renderer

## 封面文字效果重构（0.3）

### Bug 修复：颜色暴露

已完成：
- `coverStrokeColor`
- `coverShadowColor`
- `coverGlowColor`

现有 stroke/shadow/glow 的颜色全部硬编码，用户无法控制。

| 参数 | 当前 | 修复 |
|------|------|------|
| 描边颜色 | `rgba(0,0,0,α)` 硬编码 | 新增 `coverStrokeColor`，默认黑色 |
| 投影颜色 | `rgba(0,0,0,0.6)` 硬编码 | 新增 `coverShadowColor`，默认黑色半透明 |
| 发光颜色 | 用 `accentColor`（文字颜色） | 新增 `coverGlowColor`，默认跟随文字颜色 |

### 架构重构：glow 从 strokeStyle 中拆出

已完成：
- `coverGlow` 拆成独立开关
- `coverGlowColor` / `coverGlowSize` 独立控制
- `stroke + glow + shadow` 可组合
- 旧 `glow/shadow` 样式可迁移到新字段

当前 `coverStrokeStyle` 枚举曾经把描边方式和光效混在一起，互斥无法组合。

**改为三个独立维度：**

1. `coverStrokeStyle`：`none | stroke | double | hollow` — 纯描边类
2. `coverGlow: boolean` — 独立开关
3. `coverShadow: boolean` — 已有，保持

各自有颜色和强度参数，可以自由组合（stroke + glow + shadow 同时开启）。

已完成：`double` 改为两层不同颜色/粗细的描边，发光效果由 glow 独立控制。

### UI 优化：描边参数与 theme 颜色

已完成：
- 描边模式只显示必要参数
- `glow` 强度支持滚轮调整
- 双描边暴露内外两层颜色与粗细
- 切换描边模式时按当前 theme 重置默认参数
- 颜色点支持 theme 调色板 popover（背景 / 正文 / 标题 / 跟随 / 自定义）
- `renderer_config` 写回时自动带 `rendererConfigVersion`

### 新增效果

**P0 — 渐变文字（gradient）**
```css
background: linear-gradient(角度, 颜色1, 颜色2);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```
参数：`coverGradient: boolean`、`coverGradientAngle`（0-360）、`coverGradientFrom`、`coverGradientTo`。
小红书封面高频效果，金色渐变/日落渐变/冷暖对比。开启后 `coverFontColor` 降级为 fallback。

**P0 — 镂空文字（hollow）**
```css
-webkit-text-stroke: 2px #333;
-webkit-text-fill-color: transparent;
```
已完成：加入 `coverStrokeStyle` 枚举（`hollow`）。适合有封面背景图时露出背景。

**P1 — 浮雕（emboss / letterpress）**
```css
text-shadow: 0 1px 0 rgba(255,255,255,0.3), 0 -1px 0 rgba(0,0,0,0.2);
```
上亮下暗，文字从纸面凸出。适合 paper/cream 等纸质感主题。参数：`coverEmboss: boolean`。

**P1 — 霓虹（neon）**
glow 暴露颜色后自动覆盖，设置鲜艳的 `coverGlowColor` 即可。不需要单独实现。

**P2 — 长投影（long shadow）**
沿对角线延伸的投影堆叠。复古 poster 风格。参数：`coverLongShadow: boolean`、`coverLongShadowAngle`、`coverLongShadowColor`。

**P2 — 故障/赛博（glitch）**
RGB 位移：`text-shadow: -2px 0 red, 2px 0 cyan`。强风格化。参数：`coverGlitch: boolean`。

### 实现参考

当前效果实现全在 `renderer.ts` 第 130-189 行的 switch 块中。重构后建议：
- 效果逻辑移到 `effects.ts`（和封面特效 registry 统一管理模式）
- 每个效果一个纯函数，输入 config 输出 CSS string
- `renderer.ts` 只调用 `buildCoverTextCss(options)` 拿到最终 CSS

### glow 底层实现备注

当前 glow 实现是 `text-shadow` 三层同心扩散（0,0 偏移，不同半径），不是多方向投影。这种实现适合均匀光晕。如果需要方向性发光（如只向下发光），需要改为带偏移的 text-shadow。重构时考虑是否需要 `coverGlowDirection` 参数。
