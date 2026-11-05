# 08: PR CI 与产物同步门禁

**What to build:** 新增 `.github/workflows/ci.yml`（push/PR）：安装依赖 → 两个 tsc → vitest → 构建成员包与集合包 → `git diff --exit-code plugins/sessions-insight/lib` → 两个 `check-bundle`。同时增强 `scripts/check-bundle.mjs`：校验 bundle 内联版本等于 `package.json` 版本，且 host bundle 导出表含 `Config`/`readSettings`/`BalanceReader`/`VersionChecker`/`createSettingsRoute`/`createUtilityRoutes`。

**Blocked by:** None

**Status:** done

- [x] 源码改动但未重建成员 lib 时 CI 失败
- [x] check-bundle 能测出产物版本漂移与关键导出缺失
