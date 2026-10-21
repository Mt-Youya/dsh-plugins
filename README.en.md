# Context Insight · dsh-context-insight

A read-only **context insight** panel for the DSH Web GUI. It parses session logs from **Claude Code, DSH and Codex** and shows what the model actually received on each turn — system prompt, tool definitions, memory & instructions, history, tool results, images — and marks every number as an exact usage figure or a character-based estimate.

![Merged three-source view: workdirs on the left, sessions and turns in the middle, one turn's composition on the right](docs/images/01-merged-tree.png)

> Read-only end to end: no writes to source data, no index, nothing persisted. The only cache is an in-process LRU.

> **Scope of v0.1.0**: read-only insight plus the summary handoff. The handoff delivers a generated brief into a new DSH session and **only calls the official `session.create` / `session.prompt`** — it never hand-writes session events and never rewrites the source session ([docs/HANDOFF.md](./docs/HANDOFF.md), [ADR 0003](./docs/adr/0003-never-handwrite-session-events.md), [ADR 0007](./docs/adr/0007-accepted-is-not-success.md)).

## What it answers

- Of this turn's 392K window, how much is tool schemas, and how much is history?
- Why does the window jump after turn 7 — where is the compaction point, and what were the sizes before and after?
- Is 29,018 a usage figure from the log or a chars/token estimate? Every value carries an `exact` / `estimate` badge plus its basis.
- Across all three sources, how many sessions and turns does a workdir hold, and when was it last touched?

![Turn composition and tool details](docs/images/02-dsh-session.png)

## Navigation

**The workdir is the only axis; the source is just a badge.**

`workdir → session → turn`

- The session list reads **file headers only**; a session is parsed when you open it, so the first open of a big file pays the decode cost.
- Turns paginate 40 at a time, with "load more turns" at the bottom.
- The "cumulative water level" chart plots each turn's total context; dashed vertical rules mark compaction points.
- The right-hand pane shows composition blocks, data-quality flags, tool calls (name / status / duration / input & output) and the subagent tree.
- `⌘K` (`Ctrl+K` on Windows/Linux) opens full-corpus search; a hit jumps straight to that turn.

![Full-corpus search](docs/images/03-search-palette.png)

## Sources and their roots

| Source      | Default root         | Override                          |
| ----------- | -------------------- | --------------------------------- |
| Claude Code | `~/.claude/projects` | `DSH_CONTEXT_INSIGHT_CLAUDE_ROOT` |
| DSH         | `~/.dsh/sessions`    | `DSH_CONTEXT_INSIGHT_DSH_ROOT`    |
| Codex       | `~/.codex/sessions`  | `DSH_CONTEXT_INSIGHT_CODEX_ROOT`  |

A missing or unreadable source never takes the others down: the strip at the top marks just that source "unavailable" and gives the reason (root missing / unreadable / adapter error).

## Install

Requires DSH **0.2.1-rc.2 or newer** (the plugin is aligned with the behaviour of the running `app.asar`; see [ADR 0002](./docs/adr/0002-asar-021-is-the-contract.md)).

**Step 1 — install into the profile**

```sh
dsh plugin --profile web add @cyrus/dsh-context-insight
# from a checkout, or from a packed tarball:
# dsh plugin --profile web add link:$PWD
# dsh plugin --profile web add /abs/path/cyrus-dsh-context-insight-0.1.0.tgz
```

**Step 2 — make sure the package is listed in `dsh.profile.bundles`**

In practice `dsh plugin ... add` also appends the package name to the end of `dsh.profile.bundles` in `~/.dsh/profiles/web/package.json`. If it did not (a `link:` install, a hand-edited manifest, or an upgrade from an older layout), add it yourself — order matters, later layers override earlier ones:

```json
{
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "@cyrus/dsh-context-insight"]
    }
  }
}
```

**Step 3 — restart**

```sh
dsh web
```

A "Context insight" row in the sidebar means it mounted. Host-side smoke test (a request without an `Origin` header counts as same-origin):

```sh
curl -sS http://127.0.0.1:<port>/api/dsh-context-insight/health
# {"ok":true,"value":{"version":"0.0.1","sources":["claude","dsh","codex"]}}
# value.version comes from the host-side PLUGIN_VERSION constant, not package.json
```

> Loader rows are composed at boot, so **a restart is required**. Browser hot-reload only covers a rebuilt client bundle.

## Permissions and security boundary

- **Read-only**: the three roots are only `stat`-ed and read; nothing is written, deleted or renamed.
- **Nothing persisted**: no index, no cache files; the in-process LRU keys on `source + id + mtime + size`.
- **Path allowlist**: every path argument is resolved and `realpath`-checked to stay inside the three allowed roots, which blocks `..` and symlink escapes.
- **Same-origin gate**: every route is `kind:'exact'` and passes an Origin/Host gate first — `Sec-Fetch-Site: cross-site` is a 403, a mismatched `Origin`/`Host` is a 403, a same-origin GET without `Origin` passes.
- **The only write path is the handoff**: the query surface is all GETs (`health` / `sources` / `workdirs` / `sessions` / `session` / `search` / `cost`); the single write action is `handoff/apply`, which only calls the official `session.create` + `session.prompt` — it writes no source data and injects no events into a live session.
- **Read limits**: single-file decoding is byte-capped and answers `read-limit` instead of starving the Host.

## Known limitations

1. **Search has a 2.5 s budget.** Full-corpus search streams and stops at `SEARCH_DEADLINE_MS = 2500`: the response carries `truncated: true` and `remaining` (sessions not reached), and the UI says "not finished within budget, N sessions left". On a very large corpus, narrow the sources or drill down by workdir instead.
2. **Claude sessions without `prompt_snapshot` show a large "unknown" slice.** Those sessions (56 of 121 files in this corpus) cannot see tool definitions or the system prompt, so that share stays in `residual` and is drawn as an explicit "unknown" slice — it is **never** smeared into the other categories on purpose. See [ADR 0005](./docs/adr/0005-honest-attribution-residual.md).
3. **Codex reasoning is unavailable.** `response_item.reasoning.encrypted_content` is ciphertext: countable, not measurable, so Codex turns show no "thinking" block.
4. **Blocks are estimates; totals are exact.** Blocks use 2.6 chars/token, which runs ~23% high on instruction bodies; turns that were equalised carry a `reconciled.factor` (see [ADR 0006](./docs/adr/0006-projection-not-differencing.md)). Do not bill from block numbers.
5. **DSH bodies require decoding the log.** The projcache holds metadata only, so opening a session still means frame-by-frame zstd decoding; multi-MB sessions pause noticeably on first open.

## Development

```sh
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest
pnpm build       # tsc -p tsconfig.build.json && tsdown → lib/
```

Two entries are produced:

- `lib/index.js` — host half (ESM, runs in the Host's `node:vm` realm)
- `lib/client.js` — browser half; must be wrapped in `window.__ModuleLoader__.load({ id, factory })` with `react` external

To try a mount without touching a production profile, use an isolated `DSH_HOME`:

```sh
export DSH_HOME=/tmp/dsh-try
dsh try --from-default-profile web --dump-config   # create the profile from the built-in template, print the composed tree
dsh plugin --profile try add "$PWD"
# then append the package name to dsh.profile.bundles in profiles/try/package.json
dsh try --dump-config | grep -A2 context-insight    # confirm the patch row landed
dsh try --host 127.0.0.1 --port 49744 --no-open     # boot on its own port
```

## Documentation

- [docs/PLAN.md](./docs/PLAN.md) — decisions and milestones
- [docs/IR.md](./docs/IR.md) — the unified turn IR (adapter contract)
- [docs/API.md](./docs/API.md) — host route contract
- [docs/HANDOFF.md](./docs/HANDOFF.md) — handoff contract
- [docs/adr](./docs/adr) — architecture decision records
- [GLOSSARY.md](./GLOSSARY.md) — vocabulary

## License

[MIT](./LICENSE)
