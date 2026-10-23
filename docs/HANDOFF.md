# 交接链路契约（已在隔离环境实测）

隔离环境：`DSH_HOME=/tmp/m7-dsh-home` + 独立端口。生产 `~/.dsh/sessions` 全程 136 → 136，未新增任何会话。

## create

```
POST /api/session/create
{ "type":"client-request", "rpcId":"…", "method":"session/create",
  "payload": { "args": { "request": { cwd, sessionId?, workspaceId?, agentPreset? } } } }
```

- **args 是按参数名索引的对象，不是数组；端点用斜杠。**
- **当前交接实现**先调用 `workspaceController.commands.create({path: cwd})`：按规范化目录复用已有工作区，没有则注册。再调用 `sessionController.commands.create({workspaceId})`，由宿主绑定会话并推送侧边栏更新。`cwd` 与 `workspaceId` 不能同时传。
- `cwd` 可选，**但省略即继承 dsh 进程的启动目录**（实测漏传把会话建到了本仓库桶下）。**交接必须显式传 cwd**，并在 UI 上让人看见它。
- `sessionId` 可自定义；`agentPreset` 合法值 `standard|ptc|minimal|cordis`（默认 standard）。
- 返回 `{sessionId, agentPreset}`。**create 不需要模型，成功不代表能跑模型**，不能当健康检查。

## prompt

```js
{ request: { requestId, sessionId, mode: 'queue'|'steer',
             content: [{type:'text', text}, {type:'image', …}, {type:'file', receiptId}],
             clientTimeZone? } }
```

- 没有 system 前缀字段；system prompt 只来自 profile 配置。
- 返回 `{accepted:true}`，往返 7–43 ms，`requestId` 重复提交仍 accepted（可安全重试）。
- **它立刻触发一次真实模型回合，但不回传任何结果。**

## 成功判定（强制）

`accepted:true` **不等于交接成功**。模型侧失败只出现在会话日志：

| 场景                  | 出现位置                       | code                     |
| --------------------- | ------------------------------ | ------------------------ |
| 无 API Key            | 仅会话日志 `assistant/attempt` | `MISSING_CREDENTIAL`     |
| prompt 到不存在的会话 | RPC                            | `session/not-found`      |
| content 全空白        | RPC                            | `gateway/bad-request`    |
| agentPreset 不存在    | RPC                            | `agent-preset/not-found` |

因此交接后的状态机必须是：`accepted` → 轮询该会话日志直到出现 `turn/end` → 读 `assistant/attempt` / `assistant/message` 的 `finish.reason` → 才能报「成功 / 失败 + 原因」。**在拿到 turn/end 之前，UI 只能说「已投递，等待模型响应」。**

## 简报格式（≤ 2000 字，按「模型自己推不出来的优先」排序）

1. 背景与目标 2. 已改动文件 3. 已定决策 4. 未决/风险 5. 下一步 6. 验证命令

文件清单模型可以从仓库重建，**决策与未决项重建不出来**，所以决策要放在未决之前先定调。真实样例（1140 字，已端到端投递成功）见 `/tmp/m7-handoff-spike/` 里的产出。

## 进程内等价入口

插件用 `ctx.sessions.create(...)` + agent loop 的 prompt 路径，语义与 HTTP 一致，但**参数名不经 wire 映射**（没有 `args.request` 这层包装），实现时不要照抄 RPC 的包封。

## 会话可见性与继续交互

客户端声明 `uiWorkspace` 服务依赖，通过 `uiWorkspace.openSession(sessionId)` 切回 DSH 原生会话界面，用户可在那里回答 `ask_user_question`。DSH 来源的详情页也提供「在 DSH 中打开」。

打开前，`POST /handoff/reveal` 从真实 DSH 日志读取工作目录，再通过官方工作区服务补齐成员关系，用于找回旧版本仅传 cwd 创建的游离会话；不重发简报、不新建会话、不修改会话日志。
