# 计划：@cyrus/dsh-context-insight

DSH Web GUI 的「上下文透视」插件（Context Lens）。只读解析三个来源的会话，统一成以轮次为一等公民的 IR，把模型每轮实际收到的 prompt 构成拆开给人看；并把旧会话摘要交接进 DSH 继续。

## 已敲定的决策（四轮盘问）

| 决策    | 结论                                                                                       |
| ------- | ------------------------------------------------------------------------------------------ |
| 上下文  | 轮次上模型实际收到的 prompt 构成（非会话文本）                                             |
| IR 粒度 | 轮次为一等公民；消息与内容块附属；子代理会话是发起它的轮次的附属子树                       |
| 宿主    | DSH Web GUI 内嵌面板（client-UI 插件）                                                     |
| 来源    | 三源：claude / dsh / codex，全部只读                                                       |
| 导航    | 工作目录是唯一主轴，来源只作徽标                                                           |
| 精度    | 总量精确 + 分块按字符估算，每个数值带 `exact`/`estimate` 标记                              |
| 索引    | 不建索引层：按需解析 + LRU + mtime 失效；搜索全量流式，P95 < 3s 为门槛                     |
| 安全    | 只读源数据、Origin/Host 同源、路径白名单、读取上限；状态只写 `~/.dsh/dsh-context-insight/` |
| 成本    | 自维护价格表（版本号 + 数据截至），可覆盖，未覆盖显示 `—`                                  |
| 接管    | v1 只做摘要交接（官方 `session.create` + `prompt`）；整段导入进 v1.1                       |
| 简报    | 默认规则抽取（离线零成本可重现），可一键用模型润色                                         |
| 语言    | 中文默认，内置中英双语                                                                     |
| 发布    | 一开始就按可发布 npm 插件做；scope `@cyrus`                                                |

## 里程碑（Codex 优先于 DSH）

| #   | 内容                       | 验收证据                                                                                                                    |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| M1  | 骨架可挂载                 | 空面板出现在 Web GUI；`/plugins/<id>/client.js` 200；`window.__DSH_BOOT__.entries` 有条目                                   |
| M2  | Claude adapter + IR + 归因 | 3 个已知样本归因合计与 usage 总量偏差 < 5%，有单测                                                                          |
| M3  | Codex adapter              | 21 明文 + 237 zst 全部可解析；12 个逻辑会话（`history_base` 拼接）而非 21；usage 只取 `token_usage_record`，`cached` 不相加 |
| M4  | DSH adapter                | 多帧解码行数与 `zstd -dc` 一致；projcache 优先、按 row.seq 验鲜、落后回退日志                                               |
| M5  | 面板五视图                 | 会话树（工作目录主轴）、上下文构成 + 瀑布、工具明细、压缩点、子代理树                                                       |
| M6  | 搜索 + 成本                | 全库搜索 P95 < 3s；成本带价格表版本与数据截至                                                                               |
| M7  | 摘要交接                   | 规则简报 → `session.create` → `prompt` → DSH 续跑出第一轮                                                                   |
| M8  | 发布就绪                   | i18n 中英、README、engines、测试、LICENSE、`npm pack` 通过                                                                  |

## 各来源的归一化红线

**Claude**：`uuid` 去重（重复率 33%）；usage 以 `message.id` 归一（否则 token ×3.3）；`cache_creation.ephemeral_*` 76% 为 0 不可用，只用标量；`thinking_tokens` 只有 16 条非 0 且全 997，思考量改用 thinking 文本长度；跳过 base64 与 `prompt_snapshot` 正文（省 88% 字节）；压缩点直读 `compactMetadata.preTokens/postTokens`；`prompt_snapshot` 只在变更时落盘（0.08 比例），无法摊到每轮。

**Codex**：`_<uuid2>` 是同一会话的分段（`history_base` 链），不是分叉；子代理也是同样的文件名形态，靠 `parent_thread_id` / `agent_thread_id` 区分；usage 只从 `token_usage_record` 取，`turn_token_usage`/`thread_token_usage` 是累计值（×287）；`cached_input_tokens ⊂ input_tokens`（96.9%）不可相加；`token_count.info.last_token_usage` 与前者逐字重复，两边都读 ×2；压缩是**历史替换**（`replacement_history`），`message` 恒空；reasoning 是密文，思维链不可得。

**DSH**：多帧 zstd 必须逐帧切分，单调用静默只解第一帧；projcache 与日志 1:1（131/131），每行投影自带 `seq`，`max(rows.*.seq)` 与日志末 seq 比较即可验鲜（127/133 同步或领先）；但 projcache **没有正文投影**，看内容仍须解日志。
\n\n## 状态（M1–M8 完成）\n\n| # | 结果 | 关键证据 |\n|---|---|---|\n| M1 | 骨架可挂载 | 隔离 boot + 无头 Chromium 面板渲染，截图 |\n| M2 | Claude adapter + 归因 | 121 文件/467MB 2.1s、0 失败； 归一（朴素求和 2.0×）； 380/380 |\n| M3 | Codex adapter | 260 文件（含 237 个 zst）→ **108 逻辑会话**（ 链）；四种错读倍数实测（cached 相加 1.96×、thread 累计 403×）；Codex 专用 caliper 3.27 |\n| M4 | DSH adapter | 136 会话/40,511 帧/0 坏帧；解压产物 sha256 与 一致；投影 95.3% 精确 + 4.7% 回落 |\n| M5 | 面板五视图 | 真实 Claude 数据截图；「未知 20.3%」斜纹切片；49.6MB 会话首屏冷 227ms / 热 1.6ms |\n| M6 | 三源接线 + 搜索 | 一个节点合并三源 126 个会话；深搜 P95 2512ms 且如实 truncated |\n| M7 | 交接 + 成本 + 搜索两档 | 隔离环境端到端到 ；三源成本（claude 5.10 / dsh .19 / codex null）；快搜 0–2ms 全覆盖 |\n| M8 | 发布就绪 | npm pack 72 文件、零 node_modules/test 泄漏；按 README 三步用 tarball 真装真跑 |\n\n**已知未闭**：真实 分支未在真实模型下跑通（隔离环境无 API Key）；Codex 成本为 （价格表未覆盖 ）；「用模型润色」按钮 disabled。\n\n\n## 真实交接闭环（2026-10-20，隔离实例 + 生产凭据）\n\n- **成功分支已验证**： → ，。\n- **发现并修复一个真 bug**：状态观察窗口原本用「apply 返回后的墙上时间」，而 比它早 **25ms**，长轮次因此永久停在 。改为 （prompt 前取样）后，实测 。回归测试 +5（共 159）。\n- 取证期间生产 始终 136 个会话未变；凭据文件未被修改（Oct 9 / 600 / 内容一致）；六个历史隔离 home 里残留的 副本已清除。\n\n\n## 成本口径（三轮迭代后定稿）\n\n两张价目表并存，不做汇率换算：（USD，DeepSeek 官方 peak 价）/ （USD，公开参考）。主金额只取 official（Claude/GPT 无主价），参考列固定 openrouter；合计按 分组。未列价通道按 0 计入并标 + 。\n\n实测：Claude 会话 （无主价）/ 参考 （完整）；Codex （无主价）/ 参考 ；DSH （official，无参考列）。\n
