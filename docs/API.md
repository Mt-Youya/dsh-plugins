# 宿主路由契约

宿主半边只注册`kind:'exact'`路由，全部**只读**（`/handoff/apply` 是唯一例外，且它只调官方 remote，不写源数据）。浏览器侧用 document-relative URL（去掉前导斜杠）。

## 通用信封

```ts
type Envelope<T> = { ok: true; value: T } | { ok: false; error: string; detail?: string }
```

- 错误码稳定字符串，不抛裸异常：`bad-request` / `method-not-allowed` / `forbidden` / `not-found` / `read-limit` / `parse-failed` / `source-unavailable` / `handoff-unavailable`。
- 每个 GET 必须过 Origin/Host 同源校验（失败 403），非 GET 必须校验 `content-type: application/json` 与请求体 schema。
- 路径参数只接受**白名单根目录下的已存在路径**；任何解析后的绝对路径必须仍在白名单内（防 `..` 与符号链接逃逸）。

## 路由

| 方法 | 路径                                                | 用途                                     | 关键约束                                                          |
| ---- | --------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| GET  | `/api/dsh-context-insight/health`                   | 存活与版本                               | 已实现（M1）                                                      |
| GET  | `/api/dsh-context-insight/sources`                  | 三源可用性、根路径、会话数、最后扫描时间 | 单源缺失不报错，返回 `available:false` 与原因                     |
| GET  | `/api/dsh-context-insight/workdirs`                 | 工作目录聚合（导航主轴）                 | 每项含 `workdir`、按来源分组的会话数与最近时间                    |
| GET  | `/api/dsh-context-insight/sessions?workdir=`        | 轻量会话列表                             | **不解析正文**；DSH 走 projcache、Claude/Codex 只读文件头与 mtime |
| GET  | `/api/dsh-context-insight/session?source=&id=`      | 单会话 IR                                | 按 `turnOffset/turnLimit` 分页；`dataQuality` 必须原样透出        |
| GET  | `/api/dsh-context-insight/search?q=&source=&limit=` | 全量正文搜索                             | 流式；响应含 `scanned`、`elapsedMs`、`truncated`                  |
| GET  | `/api/dsh-context-insight/cost`                     | 价格表元信息与估算                       | 必须带 `version`、`asOf`、`currency`；未覆盖模型 `null` 而不是 0  |
| POST | `/api/dsh-context-insight/handoff/prepare`          | 生成交接简报（规则抽取）                 | 只读源数据；返回 `brief` 文本与来源会话 id                        |
| POST | `/api/dsh-context-insight/handoff/apply`            | 在 DSH 新建会话并投递简报                | 仅调官方 `session.create`+`session.prompt`；见 ADR 0003           |

## 精度与来源的透出规则

1. 任何数值字段都必须能回答「这是 exact 还是 estimate、依据是什么」，即 IR 里的 `Measure` 原样透传，**不得在路由层降级成裸 number**。
2. 会话列表项必须带 `source` 与 `dataQuality` 摘要；前端据此显示来源徽标与「本视图含估算」提示。
3. 单源解析失败只能让该源的接口返回 `source-unavailable`，不得让整页 500。

## 多源与搜索（M6 补充）

三条来源同时在线后，契约补了四件事（全部为**新增字段**，旧字段语义不变）：

1. `/workdirs` 与 `/sessions` 的响应新增 `failures: SourceProblem[]`，`SourceProblem = { source, error, detail? }`。某源抛异常时它只出现在这里（`error: 'adapter-error'`），其余源的条目照常返回；整页不受影响。
2. `/sources` 的某项 `reason` 现在可能是 `adapter-error`，并附 `errorDetail`（长度上限 200 字符）。
3. 会话列表行新增可选 `firstInput`（首条人类输入，上限 200 字符）；`title` 只在有真实标题时出现，**任何形如 uuid / `session-<uuid>` / 长十六进制的值都不会作为 title 下发**，前端据此显示「未命名会话 + 首条输入前 60 字」。
4. `/search` 的计数口径：`scanned` 为**已完整解析的会话数**（命中 LRU 也算），`remaining` 为预算内没轮到的候选会话数，`elapsedMs` 为整次调用墙钟耗时，`truncated` 在「达到 limit」或「达到 `SEARCH_DEADLINE_MS`（2500ms）」时为 true。搜索字段只含人类输入、助手正文与工具调用的 name/input；**工具输出不参与搜索**（语料里最大的字段，会拖垮预算）。

## 交接与成本（M7 补充）

| 方法 | 路径                                                 | 用途                          | 关键约束                                                                                                                            |
| ---- | ---------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| POST | `/api/dsh-context-insight/handoff/prepare`           | 从单会话 IR 规则抽取 6 段简报 | 体 `{source,id}`；只读源数据；`defaultCwd` 取会话 workdir，workdir 未知时 400                                                       |
| POST | `/api/dsh-context-insight/handoff/apply`             | 建 DSH 会话并投递简报         | 体 `{source,id,cwd,brief,sessionId?}`；**`cwd` 必填且必须是绝对路径、已存在目录**；返回 `{sessionId,state:'delivered',pollAfterMs}` |
| GET  | `/api/dsh-context-insight/handoff/status?sessionId=` | 观察交接结果                  | 读该会话日志：拿到 `turn/end` 前只回 `delivered`/`running`；日志未落盘也回 `delivered`                                              |
| GET  | `/api/dsh-context-insight/cost?source=&id=`          | 会话成本                      | 必须带 `pricing.version/asOf/currency`；未覆盖模型单轮 `usd:null`，全会话无定价时 `totals.usd:null`                                 |

补充口径：

1. **`accepted` 不等于成功**：`apply` 只证明简报已入队；`status` 的终态只有两种——`succeeded`（观察到 `turn/end` 且 reason=`completed`，附 `seq`）与 `failed`（附 `reason`：`MISSING_CREDENTIAL` 等已知码，或 `turn/end` 的 reason kind，以及 `detail` 里的修复指引与宿主原始报错）。
2. **观察窗口按日志顺序，不按墙上时间**：`apply` 会在**发送 prompt 之前**记录该会话当前的最高 `seq`（`baselineSeq`，无事件则 -1），`status` 只把 `seq > baselineSeq` 的事件算进窗口；`time` 仅在整段日志都落在 baseline 之内（seq 无法区分新旧）时兜底。原因：宿主接受 prompt 后立刻发出 `turn/start`，实测它的 `time` 可能比 `apply` 返回早约 25ms，用墙上时间做下界会把 `turn/start` 滤掉、让长轮次永久停在 `delivered`。若窗口内没有 `turn/end` 而日志里已有 `turn/start`，状态至少是 `running`，不会回退成 `delivered`；窗口漏掉 `turn/end` 时退化为「prompt 对应的最后一条 `user/message` 之后的第一条 `turn/end`」。
3. **搜索两档**：`/search` 新增 `tier=fast|deep`（默认 `fast`）与 `cursor`（深搜续扫）；命中新增 `tier` 与 `field:'metadata'`。`fast` 只扫元数据（title/firstInput/workdir），**恒 `remaining:0`、`truncated:false`**，命中 `turnIndex:0` 表示"打开该会话"；`deep` 语义不变并新增 `nextCursor` 供续扫。
4. **成本口径**：Claude 的 `input` 是未缓存输入、`cacheRead`/`cacheWrite` 各自单列；DSH 的 `inputTokens` 是未缓存余量、`cacheReadTokens` 承载窗口（M4 实测），adapter 已分开，**不把 cacheRead 叠加进 input**；Codex 的 `input_tokens` 含缓存、adapter 已扣减。cache 命中率统一为 `cacheRead/(input+cacheRead+cacheWrite)`。
5. **列表快速路径（M13）**：`/sessions` 与 `/workdirs` 默认**排除 subagent 会话**（`delegationDepth > 0`），传 `includeSubagents=1` 才包含；返回的每一行都带 `delegationDepth`，前端可据此分组。两个端点在 TTL 内直接回缓存，TTL 过期时**先回旧数据**并带 `stale: true, refreshing: true`，重扫在后台进行（`refresh=1` 强制重扫）。列表行在扫描阶段就带上 `title`/`firstInput`（来自会话日志头部，DSH 走 `core/dsh/listmeta.ts`），不再等到点开才补。DSH 另维护轻量索引 `$DSH_HOME/dsh-context-insight/index.json`（仅 header 事实，`mtime+size` 命中即跳过读头）。
6. **两张表 + 主表只取 official（M12）**：价目分两张表——`official`（DeepSeek 官方 **USD** peak，4 条）、`openrouter`（**USD** 公开参考价，12 条），各自带 `version`/`asOf`/`currency`/`source`。**主价格只从 `official` 取**：`official` 有该模型 → official；否则 `null`。因此 DeepSeek 主显 USD，Claude/GPT 没有主价、只显示 `openrouter` 参考列。`/cost` 返回：`groups[]`（按 `(tableId, currency)` 分组的会话合计，可多组并列、**永不合并或折算**）、`reference`（openrouter 列，可为 null）、`tables`（每张表的明细，供 tooltip 标来源）；`tableId` 仅当全会话主价格同表时才给值，否则为 `null`；`totals.usd` 同理仅在全部已定价轮次为 USD 时给值。逐轮 `turns[]` 带 `tableId`/`currency`/`amount`/`partial` 与可选 `reference`。主表查不到的模型仍是 `null` + `unpricedModels`（如 `gpt-reserve`）。M11 的全局环境变量已移除——主表不再是一个全局选择。
7. **未列价通道 ≠ 免费**：价目里某个桶为 `null`（如 `gpt-5-5` 的 openrouter 参考价没有 cacheWrite 费率）表示该通道**未列价**，按 0 计入并置 `partial:true`、把通道名写进 `unlistedChannels`（形如 `openai/gpt-5-5#cacheWrite`），UI 用 `≥` 前缀表达「下限」。整个模型都不在表里时仍是 `null` + `unpricedModels`。模型 id 查表前做 `.`→`-` 归一化（`claude-sonnet-5.5` ↔ `claude-sonnet-5-5`），通道名保留日志原拼写。

## 缓存与失效

- 进程内 LRU：key = `source + id + mtimeMs + size`；不落盘、不建索引（PLAN 决策）。
- DSH 侧先读 projcache，用 `max(rows.*.seq)` 与日志末帧 `seq` 比较验鲜；落后则回落日志解析并在响应的 `dataQuality` 里标注。
- Claude/Codex 侧以文件 mtime+size 失效；Codex 的分段文件必须按 `history_base` 链整体失效（任一分段变化即整会话失效）。
