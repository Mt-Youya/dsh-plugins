# dsh-plugins

The plugin workspace for DSH (DeepSeek Harness). There is one plugin so far: **Context Lens** — it opens up what each turn actually fed the model.

![The Context Lens panel](plugins/context-insight/docs/images/01-merged-tree.png)

## What is in here

| Path                         | Contents                                                                  | Published                             |
| ---------------------------- | ------------------------------------------------------------------------- | ------------------------------------- |
| `plugins/context-insight`    | The Context Lens plugin: host half and browser half                       | **yes**, `@cyrus/dsh-context-insight` |
| `packages/session-contract`  | The unified IR, wire types and their guards                               | no                                    |
| `packages/session-readers`   | Claude Code / Codex / DSH readers                                         | no                                    |
| `packages/plugin-kit`        | Plugin-agnostic JSON envelope and URL spelling                            | no                                    |
| `packages/plugin-kit-host`   | Host-half plumbing: route table, same-origin gate, envelope, LRU          | no                                    |
| `packages/plugin-kit-client` | Browser-half plumbing: decoding fetch, style injection, slot registration | no                                    |
| `apps/preview`               | Local preview harness on `:5178`                                          | no                                    |
| `scripts`                    | CSS build, bundle-contract check, three session probes                    | no                                    |
| `tooling`                    | Package alias table, tsconfig base, tsdown config                         | no                                    |

Dependencies point one way only: `plugins/context-insight → packages/*`. The package-name-to-source mapping lives in `tooling/aliases.ts`, and `tsconfig.json`'s `paths` mirrors it, so tests, the preview app and the build never need the internal packages built first.

## Getting started

```sh
pnpm install
pnpm dev        # http://localhost:5178, reading your real local sessions
```

Before you commit, run these:

```sh
npx tsc --noEmit                          # types: the packages and the host half
npx tsc --noEmit -p tsconfig.client.json  # types: the browser half (types: [], no node types)
npx vitest run                            # unit tests
npx tsdown                                # build both entries
node scripts/check-bundle.mjs plugins/context-insight   # host loading contract
```

Pack the plugin (it builds first, then checks that `lib/` satisfies the loading contract):

```sh
pnpm --filter @cyrus/dsh-context-insight pack
```

## Using the plugin

Install steps, the permission boundary and the known limitations live in [`plugins/context-insight/README.md`](./plugins/context-insight/README.md).

## Documentation

- `docs/PLAN.md` — decisions and milestones
- `docs/IR.md` — the unified turn IR (adapter contract)
- `docs/API.md` — host route contract
- `docs/HANDOFF.md` — handoff contract
- `docs/adr/` — architecture decision records; 0009 covers this workspace split
- `GLOSSARY.md` — vocabulary

## License

[MIT](./LICENSE)
