# 01: 余额凭据引用跟随宿主 `apiKeyEnv`

**What to build:** 余额面板使用用户在 DSH 配置 / Models 页为 DeepSeek 官方适配器配置的 `apiKeyEnv` 引用读取余额；配置缺失或为空时回退 `DEEPSEEK_API_KEY`，再回退已登录账号。设置页与文档说明这一来源。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Host 半在每次余额读取时通过宿主 `settings` 服务解析 DeepSeek 官方适配器条目（patch id `llm-deepseek`）的 `apiKeyEnv`；非空则用它 resolve，否则回退默认引用
- [x] `settings` 服务或条目缺失、字段非法时静默回退默认引用，余额路由不因此报错
- [x] 余额响应 `source` 仍为 `api-key` / `account`，wire 协议不变
- [x] 设置页 hint 与插件 README / `docs/API.md` 写明「只跟随 DeepSeek 官方适配器的凭据引用」
- [x] 先红后绿：在既有 seam（`BalanceReader.read` 注入假 credentials + `apply` 假 ctx 提供 settings）上先写失败测试再实现
- [x] 既有 `host-utilities` / `host-apply` / `host-utility-routes` 测试全绿；类型检查通过
- [x] 产物重建与提交由整合步骤统一执行（避免并行构建冲突）
