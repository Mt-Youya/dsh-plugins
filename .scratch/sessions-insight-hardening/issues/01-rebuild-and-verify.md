# 01: 重建产物并在重启后验证运行态

**What to build:** 用当前源码重建成员包与集合包的 `lib/`，完全退出并重开 DSH 后验证：`/health` 可达、Host Inspector 中 `@cyrusdoyle/dsh-plugins` 条目 Config 状态为 `schema`、设置页可写、余额/版本检查区块可见。

**Blocked by:** None

**Status:** ready-for-human

- [x] 成员包与根包在 14:58 以当时源码重建
- [x] 桌面端 15:18 重启后 Config 状态为 `schema`，6 个 volatile 字段可见
- [x] 本轮代码改完后重新构建两包并 `git diff --exit-code plugins/sessions-insight/lib` 通过
- [x] 用户已于 2026-11-05 10:04 重启；程序侧验证通过（Config 默认 false/false、插件页设置 slot 已注册且 active），UI 可写性待用户目视确认

## Comments

2026-11-04 18:00（lead）：两包已用当前源码重建。验证记录：

- `pnpm --filter @cyrusdoyle/dsh-sessions-insight build` → exit 0；`node scripts/build-css.mjs plugins/sessions-insight && npx tsdown` → exit 0
- 重建幂等：连续两次构建的 `lib/index.js`、`lib/client.js`、根 `lib/*`、`generated.css.ts` 哈希一致
- 产物含新代码：member/root `lib/index.js` 均含 `credential-error`、`non-loopback`、`reference-updated`
- `node scripts/check-bundle.mjs plugins/sessions-insight` / `.` → 均 `bundle check ok`（含 inlined version 校验）
- `npx tsc --noEmit`、`npx tsc --noEmit -p tsconfig.client.json` → exit 0；`npx vitest run` → 49 files / 453 passed + 1 skipped
- `pnpm install --frozen-lockfile` → 通过；`pnpm pack` 两个 tarball 的 manifest 均无 `catalog:`，engines 为 `>=0.2.1-rc.5`

剩余：需要用户**完全退出并重开 DSH** 后人工确认设置页可写、余额/版本检查默认关闭且可开启。

2026-11-05 10:20（lead，重启后复核）：

- 新 Host 进程启动于 10:04:45，晚于 17:59 的构建；`/health` 可达。
- Host Inspector：`include:cyrus-dsh-plugins` Config 状态 `schema`，`deepseekBalance` / `autoCheckVersion` 的 default 均为 `false`（与 SPEC 决策一致）。
- Client Inspector：`plugins.bundle.config` 的 occupants 新增 `@cyrusdoyle/dsh-plugins` 与 `@cyrusdoyle/dsh-sessions-insight` 两项，`active: true`，registrant 为本插件——说明新 client bundle 已加载、`configForms` 注入成功、`whileServed` 命中，插件页设置区块已注册。
- 待人工目视：面板设置页开关可写、两个辅助功能默认关闭、开启后余额/版本区块出现。
