Status: ready-for-agent

# 样式系统迁移：从手写 class 到 Tailwind 工具类

## Problem Statement

面板的样式今天散在两处：约 1300 行手写 CSS（按界面切成 8 个文件，仅为了满足「每文件 ≤500 行」），以及 JSX 里对应的语义 class。改一个界面的观感要同时改两个文件，且改完必须打包、装插件、重启桌面端才能看到效果——一次验证要几分钟。关掉 preflight 后浏览器默认样式又回来了，样式正确性缺少可执行的守卫。主题只有一套暗色兜底，在宿主切到浅色时会出现白底贴深色块的割裂感。

## Solution

把样式逐步迁到 Tailwind 工具类，让主题跟随宿主的 token；终局是 theme/ 只剩 token 桥接与一个组件类文件，其余界面文件全部删除。开发期用本地预览页（dev server 挂载宿主半边，读本机真实会话，热更新）取代「打包—安装—重启」的验证回路。打包产物用可执行脚本校验加载契约，主题用 light-dark 兜底同时支持明暗。

## User Stories

1. As a 插件维护者, I want 改完样式能在浏览器里热更新看到结果, so that 我不用打包安装重启就能验证观感
2. As a 插件维护者, I want 预览页读的是本机真实会话, so that 我调的是真实排版而不是假数据
3. As a 插件维护者, I want 预览页能切 ?theme=light|dark|system, so that 我不用改系统设置就能验证两套主题
4. As a 插件维护者, I want 每个界面迁完后对应的 css 文件被删除, so that 样式只有一处来源
5. As a 插件维护者, I want 只有被 3 处以上复用且带伪元素/状态的模式才允许是组件类, so that 不会又滑回「顺手抽个类」
6. As a 插件维护者, I want 颜色全部来自宿主的 --dsw-alias-* token, so that 宿主换肤时面板自动跟随
7. As a 插件维护者, I want token 兜底值随明暗切换, so that 拿不到宿主 token 时也不会出现白底深色块
8. As a 插件维护者, I want 浅色下来源胶囊与状态胶囊仍有足够对比度, so that Claude/Codex/DSH 能被一眼区分
9. As a 插件维护者, I want 打包后自动校验 client bundle 的加载契约, so that 装到桌面端之前就知道它能不能被加载
10. As a 插件维护者, I want 校验失败时不出 tarball, so that 坏产物不会流到 profile
11. As a 插件维护者, I want 体积有硬上限（client 200 KB / CSS 40 KB）, so that 迁移动辄加类不会悄悄把产物撑大
12. As a 插件维护者, I want 每次迁移一个界面并单独提交, so that 出问题时能精确回滚
13. As a 插件维护者, I want 验收靠同视口前后截图加少量 computed style 抽查, so that 我不必逐条读规则映射
14. As a 插件使用者, I want 浅色主题下输入框、胶囊、图表都读得清, so that 我在浅色桌面环境下能用
15. As a 插件使用者, I want 面板外观与宿主一致（圆角、间距、字号节奏）, so that 它不像外挂
16. As a 插件使用者, I want 用户输入在轮次里是醒目的区块, so that 我能立刻定位"我问了什么"
17. As a 插件使用者, I want 工具调用带成功/失败/进行中的状态色与呼吸灯, so that 我能一眼看出哪步卡住
18. As a 插件使用者, I want 项目树里标题优先于元数据展示, so that 会话名不会被日期挤成一个字
19. As a 未来的维护者, I want ADR 记录「为什么不用 preflight、为什么用 @scope 而不是前缀」, so that 我不用重新论证一遍
20. As a 未来的维护者, I want 术语表区分 utility / component class / surface file / preview harness, so that 讨论时不会混用

## Implementation Decisions

- **Tailwind v4，关闭 preflight**：theme 与 utilities 分开 import；否则会重置宿主的按钮、标题、列表。代价是元素基础样式要自己补。
- **隔离用 @scope 而不是类名前缀**：构建时把 utilities 层包进 @scope (.ci-panel)。前缀方案在拆分 import 下不生效；scope 还能顺带隔离第三方插件。实测面板外 .flex 仍是 block。
- **token 桥接**：@theme 的颜色全部是 var(--dsw-alias-*, light-dark(亮, 暗))；.ci-panel 声明 color-scheme: light dark。
- **组件类边界**：只有被 3 处以上复用、且需要伪元素或状态选择器的模式允许新增组件类（来源胶囊、状态胶囊）；其余一律内联工具类。
- **元素基础样式**：在 @layer base 的 @scope 内补 button/a/input/select/textarea 的 border/background/color/font 继承，约 6 行。
- **迁移单位**：一个界面一次提交，迁完删除对应 surface file（shell/chart/misc/palette/detail/tools/handoff/rail）。
- **终局形态**：theme/ = app.css（token + import）+ components.css（上面那两类胶囊），其余全部删除。
- **预览 harness 入仓**：vite.config.ts 用 ssrLoadModule 加载宿主入口并把 createRoutes 的真实路由挂到 /api/dsh-sessions-insight/*，同一进程服务页面；pnpm dev 一条命令启动；?theme= 控制配色。
- **打包契约守卫**：scripts/check-bundle.mjs 对 lib/ 实物断言：注册 id 为包名、factory 存在、内联了 @scope 样式、没有裸 ESM react import、宿主导出 apply/handleHealth/createRoutes/createSources、factory 在桩环境里执行后返回可调用导出。挂进 prepack。
- **体积预算**：lib/client.js ≤ 200 KB、CSS 产物 ≤ 40 KB；超限先停下查因。
- **不改的东西**：对外 API、IR、三个 adapter、host 路由语义一律不动；本次只动样式与开发工具。

## Testing Decisions

- 好测试只断言外部行为：产物能否被加载、面板能否渲染出关键结构、迁移后关键 computed style 是否等价；不断言 class 名、不断言 CSS 规则条数。
- 复用的既有 seam（优先级从高到低）：
  1. **打包契约**（scripts/check-bundle.mjs）——已有，最高 seam，覆盖"desktop 能不能加载"。
  2. **单元测试**（vitest，182 例）——已有，覆盖 IR/归因/adapter/host 路由，样式迁移不应让它变红。
  3. **类型检查与构建**（tsc、tsdown 双入口）——已有。
- 建议新增一个 seam（仅一个）：**预览页冒烟脚本**。用无头 Chrome 打开 ?theme=light 与 ?theme=dark，断言面板挂载成功、项目树有行、以及三条样式不变量（行的 border-width 为 0、用户输入字号为 14.5px、胶囊文字颜色与该行文字颜色不同）。它把"截图人眼比对"里可自动化的部分固化下来，避免每次迁移都靠肉眼。
- 截图仍保留，但只作为人对"好看"的判断，不作为回归判据。

## Out of Scope

- 不改宿主边的任何解析逻辑、路由语义、成本口径。
- 不引入组件库（shadcn/Radix）、不引入 CSS-in-JS。
- 不做 fixture 假数据模式（空态/加载态/错误态的固定样本）。
- 不做像素级视觉回归（不引入 Percy/backstop 之类）。
- 真机桌面端的 token 名核对不在本 spec 内：那是迁移后的一次性核查，若名字不符再单开。

## Further Notes

- 迁移顺序：shell → chart/misc → palette → detail → tools → handoff → rail 收尾。shell 最大（308 行），收益也最大。
- 每步验收：预览页亮/暗两张截图 + ci- 类数下降 + 对应 css 文件消失 + check-bundle 通过 + 体积未超限。
- 已知坑：关掉 preflight 后每个 button 都要 border-0；颜色若写死十六进制会在浅色下失效。
