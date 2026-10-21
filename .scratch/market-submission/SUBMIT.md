# 收录投稿包：context-insight

## 结论

- 本项目唯一可收录插件：`@cyrus/dsh-context-insight@0.0.4`（`plugins/context-insight`，Context Lens）
- 根包 `@cyrus/dsh-plugins` 是**纯聚合包**（`cordis.patch.yml` 只是把依赖插件逐条 insert）→ 评审规则第 7 条明确不收录
- 上游已有同形态先例，命名照抄：`data/plugins/BitDG__dsh-plugins--plugins-music-player.yml`（`name: BitDG/dsh-plugins#music-player`）

## 已核对（证据）

| 项                 | 状态        | 证据                                                                             |
| ------------------ | ----------- | -------------------------------------------------------------------------------- |
| `dsh.bundle` 声明  | ✅          | `plugins/context-insight/package.json` → `dsh.bundle.patch = ./cordis.patch.yml` |
| `dsh.client`       | ✅          | `platform: web`，inject 三个官方 client 包                                       |
| 真实可跑代码       | ✅          | `plugins/context-insight` 有 src/lib/locale/docs，非空壳                         |
| 上游无重复条目     | ✅          | 树内 `Mt-Youya` / `dsh-plugins` / `context-insight` 均无本仓库条目               |
| `dsh-plugin` topic | ✅ 已加     | `gh api repos/Mt-Youya/dsh-plugins/topics` → `["dsh-plugin"]`                    |
| 描述属实           | ✅ 待你复核 | 六项上下文构成 + 精确/估算徽标 + 三来源，均出自 README 与代码                    |
| 条目数 ≤3          | ✅          | 本 PR 只有 1 条                                                                  |

## 待你确认的 3 项

1. **交付方式** — 我用 gh 直接 fork + 提 PR / 只给文件你自己提
2. **category** — 现填 `usage`；备选 `session` `memory` `tools`（选不准不会被打回，维护者直接改）
3. **是否顺带补** — ① `dsh-plugin` topic **已完成**（2026-10-21 写入并复核）② `plugins/context-insight/screenshots.json` 仍待定（内容已备好，需一次提交推送）

## 确认后的命令清单

```sh
# ① 硬门槛：加 topic（当前为空，PUT 会整体替换，安全）
gh api --method PUT repos/Mt-Youya/dsh-plugins/topics -f 'names[]=dsh-plugin'

# ② 可选：截图声明（把 screenshots.json 放到 plugins/context-insight/ 后）
git add plugins/context-insight/screenshots.json
git commit -m "chore(context-insight): declare storefront screenshots"
git push

# ③ 提 PR（等仓库年龄满 24h 后再做）
gh repo fork awesome-dsh-plugin/awesome-dsh-plugin --clone=true
cd awesome-dsh-plugin
git checkout -b add-mt-youya-dsh-plugins-context-insight
cp ../Mt-Youya__dsh-plugins--plugins-context-insight.yml data/plugins/
git add data/plugins/Mt-Youya__dsh-plugins--plugins-context-insight.yml
git commit -m "Add Mt-Youya/dsh-plugins#context-insight"
git push -u origin HEAD
gh pr create --repo awesome-dsh-plugin/awesome-dsh-plugin \
  --title "Add Mt-Youya/dsh-plugins#context-insight" \
  --body "Read-only context breakdown panel for DSH, Claude Code and Codex sessions."
```

CI 失败时在同一分支推修复即可，无需重开 PR。

## 一处曾发现、现已修复的文档不一致（不影响投稿）

README 曾写「需要 DSH **0.2.1-rc.2** 或更高」，而 `package.json` 是 `>=0.2.0-rc.2`。**该不一致已修复**：根 `package.json` 的 `dsh.engines.dsh` 已随本次改动改为 `>=0.2.1-rc.2`。

## 本地验证（已跑通，20 项全 PASS）

`.scratch/market-submission/_validate.py` 针对该条目固定 schema 的断言：

- 文件 6 行、无 tab、以换行结尾
- `url` / `name` / `category` 三行各只有一个 `: ` 分隔符（YAML 安全的关键）
- `en` / `zh` 均为单引号包裹 → 描述里的 `Harness: ` 不会破解析
- 两个描述分别以 `.` 和 `。` 结尾，且都不含单引号（免去转义）
- `screenshots.json`：3 条、相对路径不越界、三张图在盘上真实存在

复跑：`<bundled python> .scratch/market-submission/_validate.py`

> 注：仓库内没有 JS 的 YAML 解析依赖（`cordis.patch.yml` 由 DSH Host 读取），故用 schema 断言而非 YAML 库校验；引号规则已对照上游先例 `BitDG`、`0x7A7A6572` 两个条目的实际写法确认。

### Preflight 结果（2026-10-21 已完成）

| 项                          | 结果                                                                         |
| --------------------------- | ---------------------------------------------------------------------------- |
| 仓库可见性                  | `public`，`archived: false` ✅ GitHub API 实测                               |
| 插件自带 `cordis.patch.yml` | ✅ `plugins/context-insight/cordis.patch.yml` 存在，含 `id: context-insight` |
| `dsh-plugin` topic          | ✅ 已写入并复核：`TOPICS=[dsh-plugin]`                                       |
| 仓库年龄                    | ⏳ 12.06h / 24h，最早 `2026-10-22T02:31:49Z`（北京时间 2026-10-22 10:31）    |

> topic 写入踩坑记录：`gh api --input` 的 JSON body 不能带 BOM。Windows PowerShell 的
> `Set-Content -Encoding utf8` 会写 BOM，导致 GitHub 返回 `400 Problems parsing JSON`；
> 改为 `[System.IO.File]::WriteAllText(..., UTF8Encoding($false))` 即成功。
