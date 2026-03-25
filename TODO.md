# TODO

## 待写文章：note-renderer 合作过程分享

计划写一篇小红书文章，分享 obsidian-note-renderer 插件从零到一的合作开发过程。

- 切入角度：不是"教程"，是"一个非前端的人怎么跟 AI 协作做出一个排版工具"
- 素材适合「脑机接口搭建日志」合集
- 写作时回溯关键节点：留白调整、模板设计、审美对齐、封面讨论

**发布要求：**
- 正文描述里 @科技薯
- 必须带 hashtag：`#黑客松巅峰赛` `#vibecoding`
- **截止日期：2026-04-30**

## Headless Chromium 迁移

MCP 功能稳定后，Chrome 实例切换为 headless chromium 模式（不弹窗、不抢 focus）。

- 修改 `~/bin/xhs-mcp-start.sh` 中的 Chrome 启动参数，加 `--headless=new`
- 需要用户协助 debug 时（登录、验证码），临时切回普通 Chrome
- 触发条件：用户确认 MCP 功能稳定
