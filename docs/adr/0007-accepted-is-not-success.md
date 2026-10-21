# accepted 不等于交接成功

`session.prompt` 在 7–43 ms 内返回 `{accepted:true}`，但它只是把内容排进队列：模型回合随后才开始，而且**模型侧失败（例如没有 API Key 的 `MISSING_CREDENTIAL`）完全不出现在 RPC 回包里**，只落在那条会话的 `assistant/attempt` 事件里。

**决策**：交接的成功判定必须以被观察到的 `turn/end` 为准，而不是以 RPC 返回为准。在拿到 `turn/end` 之前，界面只允许显示「已投递，等待模型响应」。另外 `create` 不需要模型即可成功，因此它无法用作健康检查。

**Consequences**：交接是一个有状态的异步过程，需要轮询会话日志并解析 `finish.reason`；这比"一发即成功"慢，但避免用户拿到静默空转的交接。
