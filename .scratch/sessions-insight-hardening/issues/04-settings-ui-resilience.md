# 04: 设置页健壮性与 slot 渲染边界

**What to build:** (a) `registerSettings` 的整段注册包进 try/catch，失败只 `console.warn`，不得抛穿 `apply`；(b) 设置页在 configForms 不可用、读取失败或永不 ready 时渲染明确的错误行与「重试」按钮，并提示需要 rc.5 宿主；(c) `plugins.bundle.config` 注册的组件按 slot 的 `{view}` 分支，`page` 视图只渲染内容区（不画 h1/back/100% 高容器），`summary` 视图只渲染一行摘要。

**Blocked by:** None

**Status:** done

- [x] 注册异常不再冒泡出 client `apply`
- [x] 设置页覆盖 loading/ready/unavailable/save-failed 四态，失败态可重试
- [x] 插件页设置区块无重复标题、无嵌套全高滚动容器
