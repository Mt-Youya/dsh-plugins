# 新来源按存储家族接入，不按应用逐个堆适配器

面板原来只有三个来源：Claude Code、DSH、Codex。要继续覆盖 Cursor、Pi、Antigravity、VS Code 系（Copilot Chat 及沿用同一存储的派生 IDE）和 Cline / Roo，如果每来一个工具就写一套完整的「发现 + 解析 + 归因」，代价是四份几乎相同的扫描/缓存/工作目录聚合代码，而它们的差异其实只在「怎么找到一个会话」和「怎么读一个会话」。

**决策**：新增 `HarnessSource`（`plugins/sessions-insight/src/host/sources/harness/store.ts`）承担所有家族共用的部分——扫描 TTL、扫描结果去重、会话 LRU、工作目录聚合、列表行、失败形状；每个家族只实现 `HarnessCorpus` 的两件事：`scan()` 回答行，`read(row)` 回答 IR。`CONTEXT_SOURCES` 里的 `vscode` 与 `cline` 是**存储家族徽标**而不是单个应用：Copilot Chat / Kiro / Trae / Qoder 中沿用 `chatSessions` 布局的安装共用 `vscode`，Cline 与 Roo 共用 Cline 的任务布局。读取器在 `packages/session-readers/src/harness/`，与三个内置 adapter 平级。

**同时定下的三条红线**（详见 `docs/IR.md` 与 `docs/adr/0005-honest-attribution-residual.md`）：

1. **没有 usage 就不假装有**：这些工具大多不记录逐轮 token（Cursor 实测 275 个气泡只有 3 个非 0），缺 usage 的轮次按 IR 第 6 条回落为估算并记 `turn-without-usage`，`total` 不写 0。
2. **没有 prompt 就记下来**：日志里没有系统提示与工具定义，所以 `parts` 只覆盖对话本身，恒定记 `attribution-prompt-unknown`；有精确总量时差额留在 `residual`，视图画「未知」，不做等比摊平。
3. **只读**：这些数据库属于正在运行的应用。后接入的五个来源不实现 `remove`，删除路由返回 `source-unavailable`（`session-deletion-unavailable`），插件不往它们的库里写任何东西。

**Consequences**：来源胶囊从 3 个变成 8 个，未安装的工具会以「不可用」灰胶囊出现——这是诚实的状态，不是错误。新增一个**同布局**的应用只需在 `roots.ts` 的候选目录里加一行；格式不同的应用（Kiro 的 `.chat`/`workspace-sessions`、Trae 的 `solo-lite:*`、Qoder 的 `aicoding-*`）必须新增一个 `HarnessCorpus`，不能靠配置硬塞进现有家族。Antigravity 优先读 `brain/<id>` 的 transcript；没有 transcript 的旧版本回退到 `conversations/<id>.db` 的 protobuf 步骤，字段号来自逆向，未知字段按 wire type 跳过并记 `steps-unclassified`。这些读取器的测试夹具依据 `.scratch/harness-research/` 的格式调研，真实数据校验的边界写在各自的模块注释里。
