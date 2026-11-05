# 04: 设置页覆盖层：保留会话现场

**What to build:** 从面板打开设置不再卸载会话树；返回后会话页签、轮次滚动位置、搜索词与交接弹窗原样保留；打开设置时面板不重新拉取会话列表。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 设置以覆盖层形式渲染在会话面板之上，会话树保持挂载；返回只关闭覆盖层
- [x] 覆盖层打开时会话层 `aria-hidden`、焦点进入设置区；Escape 与返回按钮等价
- [x] `initialPage="settings"` 仍可直接落在覆盖层；`plugins.bundle.config` slot 的 `{view}` 分派不变
- [x] 先红后绿：SSR seam（`settings.test.ts` 的 `renderToStaticMarkup`）断言设置区与会话区同时在册、返回不重建会话区
- [x] 既有设置与客户端测试全绿；类型检查通过
- [x] 产物重建与提交由整合步骤统一执行
