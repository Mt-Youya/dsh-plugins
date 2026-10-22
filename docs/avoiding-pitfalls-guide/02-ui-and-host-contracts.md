# UI 与宿主契约

以下记录来自完整会话审阅。`source` 使用原始 Claude Code JSONL 文件名和行号定位；时间均为 UTC。历史验证结果只适用于当时产物，不能替代当前版本的回归验证。

<a id="data-01"></a>
### DATA-01 · 根节点布局不要依赖包在自身 scope 内的工具类

`batch` 2026-10-22 · `severity` 中 · `status` 代码与产物检查通过，视觉未验收 · `source` Claude Code `803d1bd2-861f-4b07-8abf-13e6a9d5868d.jsonl`，原始 565–647 行，2026-10-21T08:36:05.094Z–08:44:10.612Z；后续反馈见原始 733 行，2026-10-21T09:26:06.746Z。

**1.现象**

面板高度、列表滚动和按钮裁剪出现异常。根 `.ci-panel` 已经写了 `h-full` 等工具类，源码看起来具备高度约束，实际布局仍没有按预期生效。

**2.诊断**

第一次修补把根布局规则加进 CSS，但构建器又把它包入 `@scope (.ci-panel)`。原始 622–623 行检查生成 CSS 的位置，确认根规则仍在包裹层内部。只检查 JSX 的类名或 CSS 源文件，看不出这个问题。

这次诊断只解释根布局。后续用户仍报告灰块和单色问题，不能把所有界面异常都归为同一个原因；另见 DATA-02、DATA-03。

**3.方案**

在 [panel.tsx](../../plugins/context-insight/src/client/ui/panel.tsx) 使用 `ROOT_STYLE` 明确设置根布局，移除无效的根 CSS 规则。内部滚动区继续由 CSS 管理，没有增加 JavaScript 高度测量。

**4.实现与验证**

原始 627–632 行落地修改；637–638 行记录 CSS 编译与 20 个客户端测试通过；646–647 行记录新增辅助函数测试 7 个通过，bundle 检查通过。当时浏览器操作被权限分类器拦截，没有完成实际窗口中的视觉验收。后续反馈也说明这次修复没有覆盖全部 UI 问题。

**预防**：根容器使用工具类前，先检查生成 CSS 的作用域位置；随后在本地预览确认根节点的 computed style、高度和滚动区域。编译成功不代表根选择器匹配成功。

短证据，原始 623 行，2026-10-21T08:41:17.529Z：

> `scope wrapper at 3943 root rule at 35054 inside wrapper`

<a id="data-02"></a>
### DATA-02 · 构建器统一包 scope 后，源码不能再套同名 scope

`batch` 2026-10-22 · `severity` 中 · `status` 结构检查与客户端测试通过，视觉未验收 · `source` Claude Code `803d1bd2-861f-4b07-8abf-13e6a9d5868d.jsonl`，原始 733–814 行，2026-10-21T09:26:06.746Z–09:31:34.980Z。

**1.现象**

用户提供 DOM 与 computed style 后，树行、按钮外观和对齐仍异常，并追问“这能看吗”“能不能做对齐”。先前代理把灰块归因于宿主样式覆盖，证据不足。

**2.诊断**

原始 743–744 行直接枚举生成 CSS 的层级：外层已有 `@scope (.ci-panel)`，组件和 base 源码又声明了同名 scope；生成的 `@property` 也落在外层 scope 内。这个结构问题与 DATA-01 的根节点布局相关，但修复位置不同，不能只改根容器后就停止排查。

**3.方案**

删除 [app.css](../../plugins/context-insight/src/client/theme/app.css) 与 [components.css](../../plugins/context-insight/src/client/theme/components.css) 中重复的同名 scope，由 [build-css.mjs](../../scripts/build-css.mjs) 统一管理包裹层。构建器增加重复 scope 检查，并把 `@property` 提到顶层，防止以后重新引入相同结构。

**4.实现与验证**

原始 749–759 行修改源码，775–776 行修改构建器；797–802 行记录 27 个客户端测试通过、两份构建完成、bundle 检查通过。结构输出中的 scope 数为 1，`@property inside scope` 为 `False`。807–811 行的浏览器操作仍被拦截，814 行明确没有亲眼验证最终效果。

**预防**：把 scope 的所有权固定在构建器；检查最终 CSS 中的层级和顶层规则，而非只搜索源码是否出现某个类。布局仍异常时，分别验证作用域、层叠顺序和节点匹配，避免直接归咎于宿主覆盖。

短证据，原始 802 行，2026-10-21T09:30:24.108Z：

> `nested scope: 1 | @property inside scope: False`

<a id="data-03"></a>
### DATA-03 · 有 data-part 不等于类别颜色选择器会命中

`batch` 2026-10-22 · `severity` 中 · `status` 代码与产物检查通过，颜色视觉未验收 · `source` Claude Code `803d1bd2-861f-4b07-8abf-13e6a9d5868d.jsonl`，原始 112 行，2026-10-21T07:51:00.870Z；733–814 行，2026-10-21T09:26:06.746Z–09:31:34.980Z。

**1.现象**

用户指出条形图“这块所有都是一个颜色”。所选 DOM 中，各类别有不同的 `data-part`，却都带着 `bg-[var(--color-part-thinking)]`。

**2.诊断**

旧颜色表使用 `.ci-stack__seg[data-part=...]`，实际 segment 缺少 `ci-stack__seg` 类，所以类别规则没有命中。节点上的 thinking 背景工具类又覆盖了类别差异。这个问题有独立的选择器证据，不能随着 scope 修复一并宣告解决。

**3.方案**

在 [stacked-bar.tsx](../../plugins/context-insight/src/client/ui/stacked-bar.tsx) 增加 `partColor`，按 `segment.part` 和 `slice.part` 返回 `var(--color-part-*)`，条形和图例都显式设置背景。移除已知类别的 thinking 兜底背景及失效颜色表；未知段继续使用原有纹理表达。

**4.实现与验证**

原始 769–776 行完成修改；797–802 行的 27 个客户端测试、构建和 bundle 检查通过。完整恢复的工具结果 `bq8hv0alo.txt` 也保留了旧颜色选择器和生成 CSS，可与 DOM 对照。历史记录没有随后成功打开浏览器验收颜色，不能声称图中类别已经逐项视觉核对。

**预防**：颜色异常时同时核对元素的类、属性和最终背景来源。修改后应对照条形与图例检查至少两个已知类别和一个未知段，确认数据语义与颜色一致。

短证据，原始 733 行，2026-10-21T09:26:06.746Z：

> `class="h-full flex-none bg-[var(--color-part-thinking)]"`

<a id="data-04"></a>
### DATA-04 · apply 中途注册失败时，要撤销已经注册的路由

`batch` 2026-10-22 · `severity` 高 · `status` 回归测试证实并修复，首次碰撞原因与宿主冷启动未闭合 · `source` Claude Code `117bc152-78c4-49a0-bd41-9762cc6a3110.jsonl`，原始 364–517 行，2026-10-22T03:21:39.196Z–03:27:10.317Z。

**1.现象**

宿主启用插件时报 `duplicate exact route`。代理最初沿用了另一会话的“旧宿主实例”解释；用户指出“我让你参考，不是让你拿他的结论直接给我”，代理在原始 368 行承认服务端归因尚未核实。

**2.诊断**

原始 441–442 行确认宿主 `register()` 写入路由表后返回手动 disposer；465–466 行确认 Cordis 只有拿到 `apply` 返回值后才收集清理函数。原实现用 `routes.map(register)`，如果第二条或更后的路由抛错，前面已注册的路由不会自动撤销，`apply` 也来不及返回 disposer。后续重试就可能撞上残留项。

这证明了“注册失败会残留”的缺陷。首次碰撞是否由热重载时的 create/remove 竞争触发，仍只是源码支持的候选解释；旧进程的存在也不能证明另一个进程内的路由表冲突。

**3.方案**

在 [插件入口](../../plugins/context-insight/src/index.ts) 逐项保存 disposer，注册过程用 `try/catch` 包住：任何一步失败都先释放本次已经注册的路由、清理预热 timer、失效缓存，再重新抛错；正常卸载复用同一清理函数。不要吞掉冲突，也不要删除其他实例预先占用的路由。

**4.实现与验证**

原始 495 行修改实现，503 行新增 [host-apply.test.ts](../../plugins/context-insight/test/host-apply.test.ts) 两个场景：正常卸载后可再注册，以及预占后一条路由时回滚本次前序注册。505–511 行先验证新实现 2 个测试通过，再临时还原旧实现得到 1 失败、1 通过，随后恢复修复。516–517 行记录构建、bundle 检查及安装路径/hash校验通过。

这些证据覆盖回滚缺陷与构建产物；历史未完成真实宿主重启后启用插件的验收，也未复现首次碰撞的完整触发链。

**预防**：外部注册 API 如果只返回手动清理函数，`apply` 必须自行保证失败时回滚。回归测试要让后续注册故意冲突，并断言仅保留原来已有的路由。

短证据，原始 511 行，2026-10-22T03:26:57.878Z；这是还原旧实现后的失败项：

> `× leaves nothing registered when a later route collides`
