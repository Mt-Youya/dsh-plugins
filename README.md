# dsh-plugins

DSH（DeepSeek Harness）的插件工作区。目前只有一个插件：**上下文透视（Context Lens）**——把模型每一轮实际收到的上下文拆开给人看。

![上下文透视面板](plugins/context-insight/docs/images/01-merged-tree.png)

## 仓库里有什么

| 目录                         | 内容                                           | 发布                                 |
| ---------------------------- | ---------------------------------------------- | ------------------------------------ |
| `plugins/context-insight`    | 上下文透视插件：宿主半边 + 浏览器半边          | **是**，`@cyrus/dsh-context-insight` |
| `packages/session-contract`  | 统一 IR、线上类型与解码守卫                    | 否                                   |
| `packages/session-readers`   | Claude Code / Codex / DSH 三源适配             | 否                                   |
| `packages/plugin-kit`        | 插件无关的 JSON 信封与 URL 约定                | 否                                   |
| `packages/plugin-kit-host`   | 宿主半边管线：路由表、同源门、信封、LRU        | 否                                   |
| `packages/plugin-kit-client` | 浏览器半边管线：解码 fetch、样式注入、槽位注册 | 否                                   |
| `apps/preview`               | 本地预览 harness（`:5178`）                    | 否                                   |
| `scripts`                    | 构建 CSS、校验打包契约、三个会话探针           | 否                                   |
| `tooling`                    | 包名别名表、tsconfig base、tsdown 配置         | 否                                   |

依赖只有一个方向：`plugins/context-insight → packages/*`。包名到源码的映射集中在 `tooling/aliases.ts`，`tsconfig.json` 的 `paths` 与之对应；所以测试、预览、打包都不需要先构建内部包。

## 快速开始

```sh
pnpm install
pnpm dev        # http://localhost:5178，读本机真实会话
```

提交前把这几条跑一遍：

```sh
npx tsc --noEmit                          # 类型：各包与宿主半边
npx tsc --noEmit -p tsconfig.client.json  # 类型：浏览器半边（types: []，摘掉 node）
npx vitest run                            # 单测
npx tsdown                                # 构建两个产物
node scripts/check-bundle.mjs plugins/context-insight   # 宿主加载契约
```

打包插件（先构建，再校验 `lib/` 是否满足加载契约）：

```sh
pnpm --filter @cyrus/dsh-context-insight release:patch
dsh plugin --profile desktop remove @cyrus/dsh-context-insight
dsh plugin --profile desktop add ./plugins/context-insight/cyrus-dsh-context-insight-0.0.2.tgz
```

## 插件怎么用

安装、权限边界、已知限制都在 [`plugins/context-insight/README.md`](./plugins/context-insight/README.md)。

## 文档

- `docs/PLAN.md` — 决策与里程碑
- `docs/IR.md` — 三源统一的轮次 IR（adapter 契约）
- `docs/API.md` — 宿主路由契约
- `docs/HANDOFF.md` — 交接链路契约
- `docs/adr/` — 架构决策记录，其中 0009 讲这次工作区切分
- `GLOSSARY.md` — 词表

## 许可

[MIT](./LICENSE)
