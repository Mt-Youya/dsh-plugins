# 05: 发布包收敛与包契约测试

**What to build:** 两个安装渠道的产物都变得精简可预期：成员包不再发布整份源码与已内联的 UI 依赖；集合包与成员包一样压缩；集合包 tarball 不再误带成员包文件；包契约由测试守护。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 成员包 `files` 移除 `src`；`@base-ui/react`、`@hugeicons/*`、`cn` 移入 devDependencies；`@deepseek-ai/schemastery` 仍是运行时依赖
- [x] 两包发布构建统一 `tsdown --minify`（根 build 脚本、release workflow、CI 一致），sourcemap 保留
- [x] 集合包 tarball 不再误带成员 `cordis.patch.yml`；以实际 `pnpm pack` 结果验证
- [x] 新增包契约测试（读取 manifest：运行时依赖不含已内联 UI 库、成员 files 不含 `src`、两包 `dsh.engines.dsh` 一致）
- [x] 两个 tarball 的 manifest / 文件列表 / 体积经检查符合预期；`check-bundle` 与 CI 保持绿
- [x] 产物重建与提交由整合步骤统一执行
