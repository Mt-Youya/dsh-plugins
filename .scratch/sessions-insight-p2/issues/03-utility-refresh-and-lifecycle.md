# 03: 辅助功能刷新语义与 UtilityStore 生命周期

**What to build:** 自动检查在飞时点「刷新 / 检查」仍会得到一次强制刷新；并发强制点击合并；请求被取消不显示假错误；共享 store 被 dispose 后不再发布状态，避免辅助功能停在旧值。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 非强制调用遇到 in-flight 直接复用；强制调用等当前结算后再发起一次强制请求；等待期间的多次强制调用合并为一次
- [x] generation 计数保证晚到的旧结果不覆盖后发起请求的结果
- [x] 每个请求独立 `AbortController`；aborted 请求不落 `failed`、保留上一次成功值；`dispose()` 后不再 publish
- [x] 30s / 1h 客户端节流语义与现在一致
- [x] 先红后绿：在 `UtilityStore` + 假 Api seam（`client-utilities.test.ts`）覆盖请求次数与顺序、abort、并发合并
- [x] 既有客户端测试全绿；类型检查通过
- [x] 产物重建与提交由整合步骤统一执行
