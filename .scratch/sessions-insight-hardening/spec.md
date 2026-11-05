Status: done — P0/P1 已实现；P2 见 issues/09、10

# Sessions Insight 加固：发布链路、设置页与辅助功能

## Problem Statement

2026-11-04 的一次只读审计（HEAD `6354582` + 44 个未提交改动，DSH 0.2.1-rc.5）发现：插件源码、提交进 Git 的预构建产物、发布配置与运行态之间存在系统性漂移，且设置页/辅助功能缺少失败出口与门禁。

证据摘要（复现命令见各 issue）：

1. **运行态漂移**：桌面端 09:21 启动的 Host 加载的是 11:17 之前的旧 bundle，源码里 14:08 的新逻辑没有生效；Host Inspector 中该条目的 Config 状态为 `absent`，设置页不可能可写。（14:58 重建、15:18 重启后已恢复：Config 状态 `schema`，6 个 volatile 字段可见。）
2. **产物漂移**：`plugins/sessions-insight/lib/` 是唯一入库的预构建产物（供 Git 安装，见 `6322be7`），但 HEAD 里的内容停在 09:20 一代：无 `/settings`、`/balance`、`/version` 路由，无 `Config`/`BalanceReader`/`VersionChecker` 导出；`check-bundle` 全绿也查不出。根 `lib/` 被 gitignore，只能靠发版前构建。
3. **发布链路会断**：两个 `package.json` 把 `@deepseek-ai/schemastery` 写成 `"catalog:"`，而它是 Host bundle 的顶层外部 import；`.github/workflows/release.yml` 用 `npm publish` 发成员包，npm 不会改写 `catalog:`（实测 `npm pack` 原样保留），消费者安装会失败。
4. **契约声明错位**：两份 manifest 的 `dsh.engines.dsh` 仍写 `>=0.2.0-rc.2` / `>=0.2.1-rc.2`，但设置页依赖 rc.5 才有的 `configForms` 与 `plugins.bundle.config` slot；README 又写要求 0.2.1-rc.2+。
5. **安全默认与边界**：余额/版本检查默认开启（会发外网请求、读凭据），而 `/balance` 只靠同源 header tripwire 保护财务数据；设置页在 configForms 不可用时永久只读、无错误出口、无重试。

## Solution

按 grill-with-docs 已落定的决策（ADR 0009、ADR 0010、ADR 0002 修订、GLOSSARY 新词条）把「发布链路 / 运行时契约 / 设置页健壮性 / 安全默认值 / 文档与门禁」五块一起收口。不重做设置或辅助功能，不改对外会话 API、IR 与三个 adapter。

## User Stories

1. 作为首次安装的用户，我希望包 manifest 能被 npm/pnpm 正常解析，这样 `dsh plugin add` 不会因为 `catalog:` 或缺失依赖而失败。
2. 作为从 Git 安装成员包的用户，我希望预构建 `lib/` 与源码同步，这样我拿到的就是最新功能。
3. 作为维护者，我希望 CI 在产物与源码不同步时失败，这样同一个坑不会踩第二次。
4. 作为旧宿主用户，我希望安装时就被明确拒绝，而不是装上一个「设置页永远只读」的插件。
5. 作为普通用户，我希望余额与版本检查默认关闭，只有我主动开启后才发外网请求、读凭据。
6. 作为普通用户，我希望设置页在宿主不支持或读取失败时告诉我原因并允许重试，而不是永久转圈或永久只读。
7. 作为用户，我希望在插件页看到的设置区块布局正常（不重复标题、不嵌套全高滚动容器）。
8. 作为用户，我在 Models 页改完 API Key 后，余额状态应及时刷新，而不是继续显示旧的失败结果。
9. 作为维护者，我希望发布流程一步到位（统一版本、CSS 先构建、成员包用 pnpm pack 产物发布），这样 release 不会发出坏包。
10. 作为未来的维护者，我希望 README/API/RELEASE 与实际路由、默认值、安全边界一致，这样不用重新考古。

## Implementation Decisions

- **集合包自包含**（ADR 0009）：集合包构建自己的 `lib/`，`cordis.patch.yml` 只插入自己；两包二选一安装。
- **两包统一发布版本**（ADR 0010）：每次发布成员包与集合包 bump 到同一版本，先成员后集合；`/health` 报生效包版本。
- **宿主契约以 asar 运行版为准**（ADR 0002 修订）：最低 `dsh.engines.dsh >= 0.2.1-rc.5`，不做旧宿主降级路径。
- **设置入口双份**：面板内嵌设置页保留；`plugins.bundle.config` 注册只渲染内容区，按 `{view}` 分支，不再画 h1/说明/100% 高容器。
- **设置表单继续用 `configForms.get(entryId)` 自绘**（与官方 cot-translation / agent-loop 一致），不切换到 slot 的 `form` prop。
- **余额与版本检查默认关闭**；开启后才发请求。`/balance` 增加 loopback 校验（DSH webserver 无全站鉴权，绑非 loopback 时会暴露路由）。
- **设置页披露边界**：hint 文案写明会访问 `api.deepseek.com` / `registry.npmjs.org`、优先读取 `DEEPSEEK_API_KEY`；本轮只支持默认 credential ref，跟随 `apiKeyEnv` 进 P2 backlog。
- **失败结果不缓存**；监听 `credentials/reference-updated` 清余额缓存；版本 failed 的 TTL 降到 5 分钟；TTL 计算加时钟回拨保护。
- **`/balance` 不支持 HEAD**（405），避免 HEAD 探测触发 provider 请求；两条 utility 路由统一「guard → 参数校验 → 设置短路」顺序。
- **术语**：中文「工具类」= Tailwind 原子类，「辅助功能」= 余额/版本检查；代码标识符保留 `utilities`，靠 GLOSSARY 收口。
- **发布与门禁**：`catalog:` 改为可发布的精确版本；release workflow 成员包改 `pnpm pack` + `npm publish <tgz>`，集合包发布前先跑 CSS；新增 PR CI。

## Testing Decisions

- 门禁：`npx tsc --noEmit`、`npx tsc --noEmit -p tsconfig.client.json`、`npx vitest run`、两个 `node scripts/check-bundle.mjs`，以及构建后 `git diff --exit-code plugins/sessions-insight/lib`。
- 新增测试只断言外部行为：非 loopback 请求被拒、failed 不缓存、`credentials/reference-updated` 清缓存、默认值关闭、`/balance` HEAD 返回 405、设置页错误态渲染与重试、slot 渲染按 `view` 分支。

## Out of Scope

- P2 待办见 `issues/09-host-contract-nits.md` 与 `issues/10-client-experience-nits.md`：`getBalance` 的 version 语义、跟随 `apiKeyEnv`、删除 `process.env` 回退、设置页整树卸载、UtilityStore 生命周期、force 刷新降级等。
- 不修改会话 IR、三个 adapter、既有会话路由语义、样式系统。
