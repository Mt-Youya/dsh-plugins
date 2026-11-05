Status: done — tickets 01–05 implemented, reviewed and verified

# Sessions Insight 第二轮加固：辅助功能凭据跟随、刷新语义、设置页状态保留与发布包收敛

## Problem Statement

首轮加固（`.scratch/sessions-insight-hardening/`，已完成）把设置页与辅助功能（DeepSeek 余额、版本检查）从「默认开启、失败即永久只读」修成了「默认关闭、失败可重试、只读有解释」。但用户视角仍有六类真实问题：

1. **余额认错了凭据**：插件只认默认引用 `DEEPSEEK_API_KEY`；用户按 DSH 惯例在 Models 页或配置里把官方适配器的 `apiKeyEnv` 改成别的引用名后，余额会一路掉到「账号模式/缺凭据」，功能名义上支持、实际不可用。
2. **「刷新」可能什么都没刷新**：自动检查在飞时点「刷新 / 检查」，拿回的是同一次非强制请求；用户无法确认看到的是缓存还是新结果。
3. **辅助功能的共享状态会永久冻结**：面板与插件页共用一个 UtilityStore，一旦被 dispose（HMR、fiber 重建、多消费者顺序不同），后续点击静默无反应、状态停在旧值。
4. **进设置等于丢掉会话现场**：从面板进入设置是整棵树替换，返回后会话页签、轮次滚动位置、搜索面板与交接弹窗全部重置。
5. **余额路由缺少最低限度的自律**：loopback 上任意本机程序都能无限触发 DeepSeek 调用；官方接口返回空 `balance_infos` 时被当成「响应无效」，而不是「没有余额」。
6. **发布包偏胖且带赘物**：成员包把整份 `src/` 与已内联进 client bundle 的 UI 依赖当作运行时依赖发布；集合包 bundle 未压缩（约为成员包两倍）；`files` 的 basename 语义让集合包 tarball 误带成员包的 `cordis.patch.yml`。

## Solution

在不改动 wire 协议与「默认关闭」策略的前提下，做一轮针对辅助功能与设置页的可用性加固：

- 余额的凭据引用改为**跟随宿主配置**（DeepSeek 官方适配器的 `apiKeyEnv`），解析失败回退默认引用、再回退账号。
- **强制刷新真正强制**：已有请求在飞时，强制调用等它结束后再发一次，并合并并发强制点击。
- **UtilityStore 生命周期可预期**：每个请求独立取消信号，dispose 后不再 publish，aborted 不落失败状态。
- **设置页改成覆盖层**：会话面板保持挂载，返回后页签/滚动/搜索/交接现场原样保留；打开设置不重新拉会话列表。
- **/balance 加最小限速**并接受空钱包为「余额为空」。
- **发布包收敛**：成员包去掉 `src`、已内联 UI 库降为 devDependencies；两个包统一压缩构建；修正 `files` 模式避免误带文件。

## User Stories

1. 作为在 Models 页把官方适配器凭据引用改成自定义名的用户，我希望余额检查使用我实际配置的 `apiKeyEnv`，这样余额面板不会假装我没有凭据。
2. 作为只使用默认 `DEEPSEEK_API_KEY` 的用户，我希望行为与现在完全一致，不需要重新配置任何东西。
3. 作为用账号登录使用 DSH、没配任何 API Key 的用户，我希望余额仍然回退到已登录账号读取。
4. 作为使用 pi-ai 或其它自定义 provider 的用户，我希望设置页明确说明余额只跟随 DeepSeek 官方适配器的凭据引用，而不是让我猜为什么读不到。
5. 作为在设置页修改了凭据引用的用户，我希望下一次余额请求立即使用新的引用，不需要重启 DSH。
6. 作为用户，我希望余额面板或版本提示能告诉我这次数据来自 `api-key` 还是 `account`，这样我知道该去哪里改配置。
7. 作为点了「刷新」的用户，我希望即使后台自动检查正在进行，这次点击也真的产生一次强制刷新，而不是拿回缓存。
8. 作为连续点了几次「刷新」的用户，我希望只发出一次强制请求，不要并发打满 provider。
9. 作为在失败后重试的用户，我希望失败结果不会粘住 30 秒 / 5 分钟，重试就是重试。
10. 作为切换页面或触发 HMR 的用户，我希望辅助功能的刷新按钮不会突然失去响应、停在旧数据。
11. 作为离开面板又回来的用户，我希望自动检查遵循 30 秒 / 1 小时节流，不要每次挂载都打网络。
12. 作为请求被取消的用户，我不希望界面显示「宿主不可用」这种假错误，而应保留上一次成功结果。
13. 作为余额为 0 或没有钱包的用户，我希望看到「余额为空」，而不是「响应无效」。
14. 作为账号已登出或凭据被删除的用户，我希望看到明确的「缺少凭据」，而不是笼统失败。
15. 作为在本机跑脚本的用户，我希望 `/balance` 对真正会打 provider 的请求有最低限度的频率限制，超出时返回可重试的 429，而不是无限放行。
16. 作为用户，我希望缓存命中、开关关闭、非法 query 不消耗限速额度。
17. 作为正在看某个会话详情的用户，我希望进设置再返回后，页签、轮次滚动位置、搜索词与交接弹窗都还在。
18. 作为用户，我希望打开设置时面板不要闪一下骨架屏，也不要重新拉会话列表。
19. 作为用 `?page=settings` 预览的用户，我希望直接落在设置覆盖层，且会话面板仍在下面挂载。
20. 作为维护者，我希望共享的 UtilityStore 在 dispose 后能被安全替换，而不是让新消费者继承一个冻结实例。
21. 作为维护者，我希望 `/balance` 的限速器可注入时钟、可单元测试，且不引入新的用户设置项。
22. 作为维护者，我希望成员包的 tarball 不再包含整份源码（sourcemap 的 sourcesContent 已能支撑调试），安装体积可预期。
23. 作为维护者，我希望已经内联进 client bundle 的 UI 依赖不再出现在运行时 `dependencies` 里。
24. 作为维护者，我希望集合包 bundle 与成员包一样压缩，两个安装渠道的体积与形态一致。
25. 作为维护者，我希望集合包 tarball 只含集合包自己的文件，不带成员包的 patch。
26. 作为未来的维护者，我希望这批决策与首轮的 ADR 0009/0010/0002 修订、GLOSSARY 术语保持一致，不出现第二套说法。

## Implementation Decisions

**凭据引用跟随宿主配置**

- Host 半新增一个凭据引用解析器：通过宿主的 `settings` 服务 `describe()` 读取当前配置，取 DeepSeek 官方适配器条目（patch id `llm-deepseek`，包 `@deepseek-ai/dsh-llm-deepseek-api-key`）的 `apiKeyEnv` 字段；该字段是 `role: "credential-ref"` 的 volatile 字符串，默认 `DEEPSEEK_API_KEY`。
- 解析顺序：配置里的 `apiKeyEnv`（非空字符串）→ 默认 `DEEPSEEK_API_KEY` → 账号模式。解析在每次余额读取时进行，不跨请求缓存（遵循 `credentials` 服务「每次操作重新 resolve」的语义）。
- `settings` 服务或条目缺失时静默回退默认引用；不得因此让余额路由失败。
- `BalanceDeps` 增加 `credentialRef(): string` 注入点；`apply` 接线里用 `settings` 服务实现，测试用假实现。文档与设置页 hint 同步说明「只跟随 DeepSeek 官方适配器的凭据引用」。

**强制刷新语义**

- 余额与版本检查的 in-flight 合并规则统一为：非强制调用遇到 in-flight 直接复用；强制调用等待当前 in-flight 结算后，再发起一次强制请求；等待期间的多次强制调用合并为一次。
- 每次请求带 generation 计数：晚到的旧结果不得覆盖后发起请求的结果。
- 缓存 TTL 与失败不缓存策略保持不变（余额 ready 30s；版本成功 1h / failed 5min）。

**UtilityStore 生命周期**

- 每个请求使用独立的 `AbortController`，不再共享一个终身 controller。
- `dispose()` 中止在飞请求、清空监听者、屏蔽后续 publish；aborted 的请求不发布失败状态（保留上一次成功值）。
- 面板与插件页仍共享同一实例；dispose 后不复活，由 `apply` 的新 fiber 创建新实例（保持现有接线方式）。
- 自动检查的客户端节流（30s / 1h）与当前一致。

**设置页覆盖层**

- 面板不再用早返回替换整棵会话 UI：设置作为覆盖层渲染在会话面板之上，会话树保持挂载；返回只关闭覆盖层。
- 覆盖层打开时，会话层标记 `aria-hidden`；设置区获得焦点；提供键盘关闭（Escape 与返回按钮等价）。
- `initialPage` 保留，用于预览页直接落在设置覆盖层。
- `plugins.bundle.config` slot 的 `{view}` 分派与内容区结构不变。

**/balance 限速与空钱包**

- 路由依赖里加入进程内最小滑动窗口限速器：每 60 秒最多 6 次**真正会触发 provider/账号请求**的调用；缓存命中、开关关闭、非法 query 不计数。超限返回 `429`，reason `rate-limited`，detail `balance-refresh-limited`。
- 限速器接受注入的时钟，便于测试；不新增用户设置项。
- `officialWallets` 接受空 `balance_infos`：返回 `ready`、`value: []`、`available` 取接口原值；前端已有的「余额为空」分支负责展示。若真实 API 用空数组表达异常，后续按实测调整（见 Further Notes）。

**发布包收敛**

- 成员包 `files` 移除 `src`（sourcemap 的 `sourcesContent` 已包含源码）；保留 `lib/`、`locale/`、`cordis.patch.yml`、README、LICENSE、icon、docs 截图。
- 成员包把 `@base-ui/react`、`@hugeicons/core-free-icons`、`@hugeicons/react`、`cn` 从 `dependencies` 移到 `devDependencies`（已在 client bundle 内联，运行时不需要）；`@deepseek-ai/schemastery` 仍是运行时依赖。
- 集合包与成员包的发布构建统一带压缩（`tsdown --minify`），根 `build` 脚本、release workflow、CI 保持一致；sourcemap 照旧输出。
- 根 `files` 中 `cordis.patch.yml` 改为根锚定写法（或显式排除嵌套同名文件），保证集合包 tarball 不再带成员包 patch；以实际 `pnpm pack` 结果验证。
- 新增包契约测试：读两个 `package.json` 断言运行时依赖不含已内联 UI 库、成员 `files` 不含 `src`、两包 `dsh.engines.dsh` 一致。

**不动的部分**

- 不改 wire 协议字段与枚举、不改「辅助功能默认关闭」、不改设置写入路径（宿主 `configForms`）、不改 `/version` 的 HEAD passive peek 语义与 reason/source 取值。

## Testing Decisions

好的测试只断言外部行为：HTTP 状态与 envelope、实际发出的请求次数、渲染出的文案与可交互元素、tarball / manifest 的内容；不测私有字段、不测实现细节、不为交互引入新的 DOM 测试框架。

复用现有 seams（不新增测试层次）：

- `createUtilityRoutes` + 假 reader/settings（prior art：`host-utility-routes.test.ts`）→ 限速窗口、429 响应、空钱包响应、缓存/关闭/非法 query 不计数。
- `BalanceReader.read` + 假 credentials/request（prior art：`host-utilities.test.ts`）→ `credentialRef` 注入后的解析顺序与回退。
- `apply` + 假 ctx（prior art：`host-apply.test.ts`）→ `settings` 服务接线、缺失时回退默认引用。
- `UtilityStore` + 假 Api（prior art：`client-utilities.test.ts`）→ 强制刷新合并、generation 防覆盖、abort 不落失败、每请求独立 controller。
- `renderToStaticMarkup`（prior art：`settings.test.ts`）→ 设置覆盖层与会话树同存、`initialPage` 直达、slot `view` 分派不回退。
- 包契约测试（新文件，读取 manifest；prior art：`host-utilities.test.ts` 读取 `package.json` 校验版本）。

不引入 jsdom / testing-library；设置页交互行为由 store 层测试与 SSR 结构断言覆盖，视觉效果在预览页人工验收。

## Out of Scope

- 发版动作：版本 bump、`pnpm pack` 发布、tag、提交。
- 修改 wire 协议字段、reason/source 枚举、辅助功能默认关闭策略、设置写入路径。
- `deepseekAccount.getBalance` 的 `AccountClientMetadata.version` 语义：Host 侧拿不到 DSH 构建版本（`profileContext` 不暴露），需上游确认，本轮不改（见 Further Notes）。
- pi-ai / 其它自定义 provider 的 `apiKeyEnv` 解析：本轮只跟随 DeepSeek 官方适配器。
- Electron IPC 路径与真实账号/网络下的余额联调。
- 视觉回归（覆盖层动画、尺寸、明暗主题）——只做结构断言与预览页人工检查。

## Further Notes

- 首轮加固的 spec 与 issue 在 `.scratch/sessions-insight-hardening/`；其中 09、10 两个 P2 条目已由本 spec 取代。
- ADR 0009（集合包内嵌插件产物）、ADR 0010（两包同一发布版本）、ADR 0002 修订（契约以 asar 运行版为准，最低 rc.5）与 GLOSSARY 里的「设置 / 辅助功能 / 集合包 / 成员包」术语，是本轮的前提，不得另立说法。
- `getBalance` 的 `version` 字段：DSH 官方账号界面传 DSH 客户端版本（写入 `x-client-version`），插件目前传自身版本；是否构成问题取决于 platform 如何使用该头，需上游确认后再决定不传、传可用标识或保持现状。
- 空 `balance_infos` 的真实语义尚未用真实 API Key 验证；实现按「空钱包 = ready」处理，实测发现异常语义再调。
- 集合包 tarball 误带成员 `cordis.patch.yml` 的根因需用 `pnpm pack` 实测确认（疑似 npm `files` 的 basename 匹配语义），修正后把 pack 结果纳入验收。
