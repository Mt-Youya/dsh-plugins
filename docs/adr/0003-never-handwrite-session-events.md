# 禁止手写会话事件，接管只走官方入口

往活会话里手写事件会撞两道闸：surface 类型事件缺 `surfaceOp` 被拒（`dsh-session/lib/index.js:308`），带 `sourceEventSeqs` 的 `assistant/message` 被拒（:317）。更要命的是 `assertMessageEventShape` 只在重放/seed 路径执行，`commit()` 里没有——形状不合法的事件会**成功落盘，下次加载才炸**，而日志是权威，等于污染真会话。

**决策**：接管只走官方 `session.create` / `session.prompt` / `session.fork`；「整段原样导入」若将来要做，也必须走 `fork` 或 `create`，不得自己拼 `append`。v1 只上摘要交接。

**Consequences**：接管时 assistant 侧内容由新模型重新生成，不是原样搬运；这一点必须在 UI 上说清楚，不能让人以为历史被完整迁移。
