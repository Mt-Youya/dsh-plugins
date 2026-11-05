# 02: `/balance` 限速与空钱包语义

**What to build:** `/balance` 对真正会触发 provider / 账号请求的调用做最小限速，超出返回可重试的 429；官方接口返回空 `balance_infos` 时按「余额为空」展示，而不是「响应无效」。

**Blocked by:** 01（同一 Host 模块与测试文件的写序）

**Status:** ready-for-agent

- [ ] 每 60 秒最多 6 次会真正触发 provider / 账号请求的调用；缓存命中、开关关闭、非法 query 不计数；超出返回 429、reason `rate-limited`、detail `balance-refresh-limited`
- [ ] 限速器接受注入时钟，可在既有 route seam 测试（不新增用户设置项）
- [ ] 空 `balance_infos` 返回 `ready` + 空钱包列表（`available` 取接口原值），面板显示「余额为空」
- [ ] `docs/API.md` 更新限速规则与空钱包语义
- [ ] 先红后绿：route seam 覆盖限速窗口 / 计数豁免 / 429；reader seam 覆盖空钱包归一化
- [ ] 既有余额与路由测试全绿；类型检查通过
- [ ] 产物重建与提交由整合步骤统一执行
