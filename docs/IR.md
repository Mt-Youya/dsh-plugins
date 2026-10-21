# IR 契约

`src/core/ir.ts` 的唯一真相。三个 adapter 都产出它，所有视图只读它。字段一旦定稿，改动要过 ADR。

```ts
type Source = "claude" | "dsh" | "codex"
type Precision = "exact" | "estimate"
type Basis = "usage" | "harness-projection" | "chars-per-token" | "byte-length"

interface Measure {
  tokens: number
  precision: Precision
  basis: Basis
}

type ContextPart =
  | "system-prompt"
  | "tool-definitions"
  | "memory-instructions"
  | "referenced-files"
  | "history"
  | "tool-results"
  | "images"
  | "user-input"
  | "assistant-output"
  | "thinking"

interface Attribution {
  windowSize?: number // 上下文窗口，来自日志字段而非猜测
  total: Measure // 有 usage 时恒为精确值；该轮无 usage 时回落到 Σparts 估算（见下）
  parts: { part: ContextPart; measure: Measure }[]
  residual?: Measure // 无法归因的那一份：total − Σparts，basis 为 'unattributed'
  reconciled?: { factor: number } // 仅在做过等比对账时出现；放大时 factor ≤ 1.25，缩小时无下限
}

interface Usage {
  // 恒 exact
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
  totalContext: number // 各来源按自己的口径归一后填入
}

interface ToolCall {
  id: string
  name: string
  input: unknown
  output?: unknown
  status: "ok" | "error" | "unknown"
  startedAt: number
  endedAt?: number
}

interface CompactionPoint {
  at: number
  before: Measure
  after: Measure
  trigger?: string
  replacedHistory: boolean // Codex 是替换，Claude 是摘要接续
}

interface Turn {
  index: number
  startedAt: number
  endedAt?: number
  userInput: string[] // 仅真实人类输入，剔除注入包装
  assistantText: string[]
  thinking?: string[] // Codex 无（密文），留 undefined
  toolCalls: ToolCall[]
  usage?: Usage
  attribution: Attribution
  compactions: CompactionPoint[]
  subagents: string[] // 附属会话 id
  model?: { provider: string; model: string }
}

interface Session {
  id: string
  source: Source
  workdir: string
  title?: string
  createdAt: number
  updatedAt: number
  turns: Turn[]
  segments: string[] // 同一逻辑会话的物理文件（Codex 分段、Claude 子代理）
  dataQuality: string[] // 例如 'compaction-values-inconsistent'
}
```

## adapter 必须遵守

1. **轮次边界由"一次用户输入"定义**，不由记录类型定义；工具调用与其结果必须落回发起它的那个轮次。
2. **任何 token 数只有两个合法来源**：日志里的 usage（`exact`/`usage`）或字符折算（`estimate`/`chars-per-token`）。禁止把估算值填成 `exact`。
3. **同一份数据不得双计**：Claude 的 `message.id` 归一、`toolUseResult.stdout` 与 `tool_result.content` 重复 846/1049 处；Codex 的三口径 usage、`last_token_usage` 双写。
4. **子代理会话不进入主会话的 turns**，只以 `Session.segments` + `Turn.subagents` 关联；导航里它们是父会话的附属子树。
5. **未知即未知**：无法归因的字节留在 `parts` 之外，用 `dataQuality` 记录原因，不要平摊进其他类别。
6. **某轮没有 usage 时，`total` 不得写成 0**：0 会被读成「窗口为 0」。此时 `total` 回落到 `Σparts` 的估算值（`precision:'estimate'`、`basis:'chars-per-token'`），`residual` 恒为 0，并记 `turn-without-usage`；`windowSize` 留空，无从得知就不要填。这条对所有 adapter 一致，跨来源不允许各写一套。

## dataQuality 的词表

`Session.dataQuality` 与 `Turn` 级标记都是**字符串**，不带常量表；按前缀分组渲染即可。已经出现的词根：

`uuid-`（去重）/ `sidechain-`（侧链）/ `prompt-snapshot-`（快照缺失·陈旧·沿用）/ `attribution-`（对账·残差·过计·估算轮次）/ `turn-`（无 usage·无 turn 事件）/ `compaction-`（值不自洽·摘要接续）/ `projection-`（陈旧·无行）/ `usage-`（总计不符）/ `bad-frames:` / `invalid-lines:` / `context-above-model-window` / `reasoning-encrypted` / `history-segment-chain`。

渲染规则：**前缀是分类，冒号后是参数**；面板不得把未知字符串当成错误吞掉，原样展示。

## 对账（reconcile）的边界

字符估计与精确总量之间必然有差。允许等比缩放把分区补齐，**但只有在差额属于测量误差时**：

边界是**不对称**的：往上摊可能是在掩盖缺失，往下摊只是承认我们系数偏高。

| 情形                                                                                        | 处置                                                                                                           |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 存在结构性缺失（该轮无 prompt_snapshot、快照被判陈旧而丢弃 tool-definitions、该轮无 usage） | **一律不缩放**；`parts` 保持原始估计，`residual = total − Σparts`（可为负，负值记 `attribution-over-counted`） |
| 无结构性缺失，且 `factor ≥ 1` 且 `factor ≤ 1.25`                                            | 等比放大，写 `reconciled.factor`，无 `residual`                                                                |
| 无结构性缺失，且 `factor ≥ 1` 且 `factor > 1.25`                                            | **不缩放**（缺口 >25% 更像整类缺失而非测量误差），写 `residual` 与 `dataQuality: attribution-residual`         |
| 无结构性缺失，且 `factor < 1`                                                               | **一律等比缩小**（没有任何数据缺失，只是系数偏高），写 `reconciled.factor`，无 `residual`                      |

`residual` 存在的轮次，视图必须画出「未知」切片并显示占比，**不得**把缺口摊进任何一个已知类别。
