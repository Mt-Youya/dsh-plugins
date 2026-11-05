# 归档：awesome-dsh-plugin 投稿材料（2026-11-05）

原路径 `.scratch/market-submission/`，四个文件原样搬入、内容未改。

归档原因：

- `SUBMIT.md` 的结论建立在「根包只是纯聚合、按评审规则第 7 条不收录」之上；ADR 0009 已把集合包改为内嵌插件产物（不再插入成员包），该前提不成立。
- 版本写的是 `@cyrusdoyle/dsh-sessions-insight@0.0.4`，而当前成员包 `0.0.6`、集合包 `0.0.5`；ADR 0010 之后两者必须同号发布，单独引用任一版本号已经不可靠。
- 条目文件名仍是旧插件名 `plugins-context-insight`，仓库里的插件目录早已是 `plugins/sessions-insight`。
- 投稿实际从未提交（当时卡在「仓库满 24h」门槛），`gh` 命令与 preflight 结论都已过期。

重新投稿时按当前 README、`docs/API.md` 与 ADR 0009/0010 重写条目，不要直接复用这里的文件。
