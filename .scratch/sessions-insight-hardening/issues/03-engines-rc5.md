# 03: 把宿主版本下限抬到 0.2.1-rc.5

**What to build:** 两个 `package.json` 的 `dsh.engines.dsh` 从 `>=0.2.0-rc.2` / `>=0.2.1-rc.2` 统一为 `>=0.2.1-rc.5`；README（中英）与插件 README 的宿主要求同步；ADR 0002 已记录原因。

**Blocked by:** None

**Status:** done

- [x] 两份 manifest 的 engines 一致为 `>=0.2.1-rc.5`
- [x] README/README.zh/插件 README 里的版本要求一致
