# 0008 · 样式系统：Tailwind 关闭 preflight，工具类用 @scope 隔离

- 状态：已接受
- 日期：2026-10-20

## 背景

面板是一个塞进宿主页面的模块工厂，不是独立应用：CSS 必须内联进 client bundle，且不能碰到宿主的全局样式。历史上样式是 1650 行手写 class，改一处要翻三个文件。

## 决定

1. 用 Tailwind v4，但**不引入 preflight**（拆开 theme/utilities 两个 import）。preflight 会重置宿主的按钮、标题、列表；代价是我们自己补元素基础样式。
2. 工具类不做前缀，而是构建时把整个 utilities 层包进 **@scope (.ci-panel)**。实测：面板外 .flex 仍是 block，面板内是 flex。前缀方案在 v4 的拆分 import 下不生效，scope 更强且类名不必改。
3. **组件类**只保留真正被 3 处以上复用、且带伪元素或状态选择器的模式。迁移结束后的实际清单：18 条 [data-part] 配色表（上下文分块的同一张身份表，图表与图例两处消费）、来源胶囊 .ci-src、状态胶囊 .ci-status、用户输入块 .ci-ask、输出区 .ci-pre、[data-tip] 气泡。其余一律内联工具类。
4. 颜色全部走 @theme 映射到宿主的 --dsw-alias-*，换肤自动跟随；不引入第二套主题变量。
5. 体积预算：lib/client.js ≤ 200 KB，CSS 产物 ≤ 40 KB，超过即停下查因。

## 后果

- 关掉 preflight 后 UA 样式回来，因此在 @layer base 里补约 6 行元素基础样式（button/a/input 的边框、字体、颜色继承）。
- 迁移已结束：theme/ 终局是 app.css（@theme token 桥接 + 两条 tailwind import + @import components.css + @layer base）+ components.css（唯一组件层），外加构建产物 generated.css.ts。迁移期间按界面切分的临时文件（shell/misc/detail/rail/palette/chart/states）全部删除，不得再新增。
- 不带选择器的运动原语（@keyframes ci-breathe、ci-skel）也留在 components.css：它们不新增规则，动画本身由工具类或组件类引用。
