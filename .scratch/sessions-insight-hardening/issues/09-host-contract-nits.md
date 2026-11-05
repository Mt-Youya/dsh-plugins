# 09: Host 契约细节（P2 backlog）

**What to build:** 逐项评估后再做：`deepseekAccount.getBalance` 的 `version` 应传 DSH 客户端版本而非插件版本；余额 credential ref 跟随 DSH 的 `apiKeyEnv`；删除不可达的 `process.env.DEEPSEEK_API_KEY` 回退；`/balance` 限速；`officialWallets` 对空 `balance_infos` 的策略确认。

**Blocked by:** None

**Status:** wontfix

- [ ] 每项有结论（修或明确不做）并记录理由

## Comments

2026-11-05：内容已由 [`.scratch/sessions-insight-p2/spec.md`](../../sessions-insight-p2/spec.md)（Status: ready-for-agent）取代并拆分细化；本条目不再单独实施。
