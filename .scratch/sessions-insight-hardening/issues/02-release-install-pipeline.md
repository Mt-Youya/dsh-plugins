# 02: 修复发布与安装链路

**What to build:** 让两个包在 npm/Git 安装路径上都不会坏：`@deepseek-ai/schemastery` 依赖从 `"catalog:"` 改成可发布的精确版本并同步 lockfile；release workflow 的成员包改为 `pnpm pack` 出 tgz 后再 `npm publish <tgz>`；集合包发布前显式构建 CSS；发布前断言两包版本号一致。

**Blocked by:** None

**Status:** done

- [x] 两个 `package.json` 的 `@deepseek-ai/schemastery` 不再是 `catalog:`，且 `pnpm install --frozen-lockfile` 通过
- [x] `npm pack`/`pnpm pack` 出的 tarball 里 manifest 无 `catalog:` 残留
- [x] release workflow 成员包走 pnpm pack 产物发布；集合包 gate 里先跑 `node scripts/build-css.mjs plugins/sessions-insight`
- [x] 发布前校验成员包与集合包版本相同，不同则失败
