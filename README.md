# 上下文透视 · dsh-context-insight（Context Lens）

DSH Web GUI 的只读「上下文透视」面板：解析 **Claude Code / DSH / Codex** 三个来源的会话日志，把**模型每一轮实际收到的上下文**拆开给人看——系统提示、工具定义、记忆与指令、历史、工具结果、图片各占多少，以及每个数字是精确的 usage 还是按字符折算的估算。

![三源合并视图：左侧工作目录、中间会话与轮次、右侧单轮构成](docs/images/01-merged-tree.png)

> 全程只读：不写源数据、不建索引、不落盘。唯一的缓存是进程内 LRU，进程结束即消失。

> **v0.1.0 的范围**：只读洞察 + 摘要交接。交接把生成好的简报投递进 DSH 新会话，**只调官方 `session.create` / `session.prompt`**，不手写会话事件、不改写原会话（[docs/HANDOFF.md](./docs/HANDOFF.md)、[ADR 0003](./docs/adr/0003-never-handwrite-session-events.md)、[ADR 0007](./docs/adr/0007-accepted-is-not-success.md)）。

## 它能回答什么

- 这一轮 392K 的上下文里，工具 schema 占了 95% 还是 5%？历史又被压缩换掉了多少？
- 同一个会话在第 7 轮之后为什么突变——压缩点在哪，前后窗口各是多少？
- 这个 29,018 是日志里的 usage，还是 chars/token 折算？每个数值都带 `精确` / `估算` 徽标与口径。
- 三个来源里，某个工作目录一共有多少会话、多少轮、最近一次是什么时候？

![单轮构成与工具明细](docs/images/02-dsh-session.png)

## 导航模型

**工作目录是唯一主轴，来源只是徽标。**

`工作目录 → 会话 → 轮次`

- 会话列表**只读文件头**，点开才解析正文；首开大文件需要解压与解码。
- 轮次分页，每页 40 轮，底部「加载更多轮次」。
- 顶部「累计水位」折线是该会话每轮总上下文的走势，虚线竖条是压缩点。
- 右侧单轮面板：构成分块、数据质量标记、工具调用明细（名称 / 状态 / 耗时 / 输入输出）、子代理树。
- `⌘K`（Windows/Linux 上 `Ctrl+K`）打开全库搜索，命中后直接跳到那一轮。

![全库搜索](docs/images/03-search-palette.png)

## 三源与读取位置

| 来源        | 默认根目录           | 覆盖用的环境变量                  |
| ----------- | -------------------- | --------------------------------- |
| Claude Code | `~/.claude/projects` | `DSH_CONTEXT_INSIGHT_CLAUDE_ROOT` |
| DSH         | `~/.dsh/sessions`    | `DSH_CONTEXT_INSIGHT_DSH_ROOT`    |
| Codex       | `~/.codex/sessions`  | `DSH_CONTEXT_INSIGHT_CODEX_ROOT`  |

某个来源缺失或不可读不影响其余来源：顶部只把该源标为「不可用」，并给出原因（根目录不存在 / 不可读 / 适配器异常）。

## 安装

需要 DSH **0.2.1-rc.2 或更高**（插件按运行版 `app.asar` 内的行为对齐，见 [ADR 0002](./docs/adr/0002-asar-021-is-the-contract.md)）。

**第 0 步：先确认装进哪个 profile**

装错 profile 不会报错，只是**面板不会出现**。两者是不同的 profile，不是同一份配置：

| 你怎么启动                            | 实际 profile | 命令                |
| ------------------------------------- | ------------ | ------------------- |
| 双击 `DeepSeek Harness.app`（桌面端） | `desktop`    | `--profile desktop` |
| `dsh web`（命令行 / 远程）            | `web`        | `--profile web`     |

不确定时看进程参数或 `~/.dsh/profiles/` 下哪个目录在更新。

**第 1 步：把包装进 profile**

```sh
dsh plugin --profile desktop add @cyrus/dsh-context-insight   # 桌面端
dsh plugin --profile web     add @cyrus/dsh-context-insight   # dsh web
# 本地开发时换成目录或打包产物：
# dsh plugin --profile <name> add link:$PWD
# dsh plugin --profile <name> add /abs/path/cyrus-dsh-context-insight-0.1.0.tgz
```

**第 2 步：确认包名在 `dsh.profile.bundles` 里**

实测 `dsh plugin ... add` 会顺带把包名追加到 `~/.dsh/profiles/<name>/package.json` 的 `dsh.profile.bundles` 末尾。**没自动加上时**（`link:` 安装、手改过 package.json、或从旧版本升级）手工补齐——顺序有意义，后面的层覆盖前面的层：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "@cyrus/dsh-context-insight"]
    }
  }
}
```

**第 3 步：重启**

```sh
dsh web
```

侧边栏出现「上下文透视」一行即挂载成功。（市场里另有一个 dsh-context 插件叫「上下文洞察」，两者无关。）宿主侧自检（不带 `Origin` 头视为同源）：

```sh
curl -sS http://127.0.0.1:<port>/api/dsh-context-insight/health
# {"ok":true,"value":{"version":"0.0.1","sources":["claude","dsh","codex"]}}
# value.version 来自宿主侧常量 PLUGIN_VERSION，不读 package.json
```

> loader 行只在 boot 时组合，**改完必须重启**；浏览器热重载只覆盖「客户端 bundle 被重建」这一种情况。

## 权限与安全边界

- **只读**：三个源目录只做 `stat` 与读文件，从不写、不删、不改名。
- **不落盘**：不建索引、不写缓存文件；进程内 LRU 以 `source + id + mtime + size` 失效。
- **路径白名单**：所有路径参数先解析、再做 `realpath` 校验，必须仍落在三个白名单根目录之内——挡掉 `..` 与符号链接逃逸。
- **同源校验**：每条路由都是 `kind:'exact'`，先过 Origin/Host 门：`Sec-Fetch-Site: cross-site` 直接 403，`Origin` 与 `Host` 不一致 403；不带 `Origin` 的同源 GET 放行。
- **写路径只有交接**：查询面全是 GET（`health` / `sources` / `workdirs` / `sessions` / `session` / `search` / `cost`）；唯一的写动作是 `handoff/apply`，它只调官方 `session.create` + `session.prompt`——不写源目录，也不往活会话里塞事件。
- **读取上限**：单文件解码有字节上限，超限返回 `read-limit`，不会把宿主拖死。

## 已知限制

1. **搜索有 2.5 秒预算。** 全库搜索是流式的，达到 `SEARCH_DEADLINE_MS = 2500` 就停：响应里 `truncated: true`、`remaining` 是没轮到的会话数，界面显示「预算内未扫完，还剩 N 个会话」。语料特别大时请缩窄来源，或按工作目录逐层点开。
2. **Claude 会话没有 `prompt_snapshot` 时，面板会显示一大块「未知」。** 这类会话（本机语料 121 个文件里 56 个）看不到工具定义与系统提示的原文，那一份只能留在 `residual` 里显式画成「未知」切片，**不会**等比摊进其他类别。这是有意为之，见 [ADR 0005](./docs/adr/0005-honest-attribution-residual.md)。
3. **Codex 的思维链拿不到。** `response_item.reasoning.encrypted_content` 是密文，只能计数、无法测量，因此 Codex 轮次不显示「思考」分块。
4. **分块数字是估算，总量才是精确值。** 分块按 2.6 chars/token 折算，对指令体偏高约 23%；做过等比对账的轮次会显示 `reconciled.factor`（见 [ADR 0006](./docs/adr/0006-projection-not-differencing.md)）。不要拿分块数字做计费。
5. **DSH 正文必须解日志。** projcache 只有元数据、没有正文投影，看内容时仍要逐帧解压会话日志，几 MB 的会话首开有明显停顿。
6. **交接的 `delivered` 是投递瞬间的状态，不是可持续观察的状态。** 宿主接受 prompt 后约 30ms 内就会发出 `turn/start`，所以轮询能看到的稳定状态只有 `running` / `succeeded` / `failed`。成功判定以 `turn/end reason=completed` 为准，见 [ADR 0007](./docs/adr/0007-accepted-is-not-success.md)。
7. **成本是「多张价目表」并存的，不做汇率换算。** 共三张表，各自带 `version`/`asOf`/`source`：
   - `xogpu`（CNY）：中转站报价页，Claude 与 GPT 的**实付口径**；
   - `official`（USD）：DeepSeek 官方定价页，取 **peak 价**作为保守上界（cacheWrite 记 0——官方只按 cache hit/miss 计价）；
   - `openrouter`（USD）：公开参考价，从 `/api/v1/models` 抽取，只作「参考」列。

   主金额按模型回退：先 `xogpu`、再 `official`；两者都没有则该模型为 `null`（不估算）。同一会话里出现不同来源的模型时，合计按 `(表, 币种)` 分组并列，**绝不跨表或跨币种相加、也没有汇率换算**。价目里某通道未列价 ≠ 免费：该通道按 0 计入，金额前加 `≥` 并标 `partial`。这些数字用于理解用量结构，不要拿去对账。

## 目录结构

四层，依赖只能从上往下指：`client → shared`、`host → core → shared`，**core 不知道宿主的存在，ui 不知道 HTTP 的存在**。

```
src/
├── index.ts             宿主入口：装配三源 + 注册路由（唯一碰 cordis 的文件）
├── version.ts           版本常量（构建时从 package.json 注入）
├── shared/
│   └── protocol.ts      线上契约：路径、信封、wire 类型、type guard（宿主与浏览器共用）
├── core/                纯解析层：不碰网络、不碰宿主、可单测
│   ├── ir.ts            统一 IR（轮次为一等公民）
│   ├── attribution.ts   共享折算系数与字符计量
│   ├── claude/          Claude Code adapter
│   ├── codex/           Codex adapter（分段链、zst）
│   └── dsh/             DSH adapter（多帧 zstd、projcache）
├── host/                宿主半边
│   ├── http/            server（同源校验、信封）/ routes（路由表）/ cache（LRU）
│   ├── sources/         三源读取器 + 工作目录归并 + 快照索引 + 路径白名单
│   ├── views/           派生视图：search / cost / pricing / brief
│   └── handoff/         交接状态机（accepted≠成功）
└── client/              浏览器半边
    ├── index.tsx        入口：注册 sidebar/main 槽位与词典
    ├── api.ts           同源 fetch + 响应解码
    ├── format.ts        数字/时间/字节格式化
    ├── labels.ts        会话标签回落规则
    ├── locale.ts        zh/en 词典
    ├── styles.ts        全部 CSS（注入一次）
    ├── state/           纯状态逻辑：树展平、轮次行、堆叠条算术
    └── ui/              组件：面板、项目树、轮次表、工具明细、交接、搜索面板…
```

## 开发

```sh
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest
pnpm build       # tsc -p tsconfig.build.json && tsdown → lib/
pnpm pack        # prepack 会先构建，再按 package.json 的版本打包
pnpm release:patch   # 版本 +1，构建并打包（不改 git tag）
```

产物两个入口：

- `lib/index.js` — 宿主半边（ESM，在 Host 的 `node:vm` realm 里跑）
- `lib/client.js` — 浏览器半边，必须是 `window.__ModuleLoader__.load({ id, factory })` 包装，`react` 外置不打包

想验证挂载而不污染生产 profile，用隔离 `DSH_HOME`：

```sh
export DSH_HOME=/tmp/dsh-try
dsh try --from-default-profile web --dump-config   # 从内置模板建 profile，只打印组合树
dsh plugin --profile try add "$PWD"
# 再把包名追加进 profiles/try/package.json 的 dsh.profile.bundles
dsh try --dump-config | grep -A2 context-insight    # 确认 patch 行已插入
dsh try --host 127.0.0.1 --port 49744 --no-open     # 独立端口 boot
```

## 文档

- [docs/PLAN.md](./docs/PLAN.md) — 决策与里程碑
- [docs/IR.md](./docs/IR.md) — 三源统一的轮次 IR（adapter 契约）
- [docs/API.md](./docs/API.md) — 宿主路由契约
- [docs/HANDOFF.md](./docs/HANDOFF.md) — 交接链路契约
- [docs/adr](./docs/adr) — 架构决策记录
- [GLOSSARY.md](./GLOSSARY.md) — 词表

## 许可

[MIT](./LICENSE)
