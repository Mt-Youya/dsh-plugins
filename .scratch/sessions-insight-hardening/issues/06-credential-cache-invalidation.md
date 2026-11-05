# 06: 失败缓存、失效事件与路由语义

**What to build:** (a) 余额的 failed / missing-credentials 结果不写缓存（或 ≤5s）；版本 failed 的 TTL 从 1h 降到 5min；(b) Host 侧监听 `credentials/reference-updated`，事件到达时 `BalanceReader.invalidate()`；(c) TTL 判断加时钟回拨保护（负差值视为过期）；(d) `/balance` 对 HEAD 返回 405，不再触发 provider 调用；(e) 两条 utility 路由统一顺序：guard → 参数校验 → 设置短路。

**Blocked by:** None

**Status:** done

- [x] 改 key 后下一次请求即重读，不再显示旧的失败结果
- [x] 失败结果不会在 30s/1h 内被反复返回
- [x] HEAD `/balance` 不发起 provider 请求
- [x] 关闭开关时非法 query 仍返回 400（与开启时一致）
