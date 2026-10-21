# AGENTS.md

Guidance for agents working in this repository.

## Agent skills

### Issue tracker

Issues and specs live as markdown under `.scratch/` (no remote, no hosted tracker). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Working agreements

- 每个文件 ≤500 行；拆分按职责，不按行数硬切。
- 门禁用 `npx tsc --noEmit`、`npx vitest run`、`npx tsdown`，不要用 `pnpm build`（会触发 pnpm 的依赖校验）。
- 样式改动在本地预览页验证：`pnpm dev` → http://localhost:5178（`?theme=light|dark`），不要靠打包安装重启。
- 打包契约由 `node scripts/check-bundle.mjs .` 守护，`pnpm pack` 会自动跑。
