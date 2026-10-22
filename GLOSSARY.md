# dsh-sessions-insight

DSH（DeepSeek Harness）Web GUI 的「会话洞察」插件（英文 Sessions Insight；与市场里的 dsh-context 插件区分）：只读解析 Claude Code 与 DSH 自己的会话日志，把模型每轮实际收到的上下文拆开给人看，并支持把 Claude 会话接管到 DSH 继续。

## Language

**上下文**:
某个轮次上模型实际收到的整份 prompt 的构成——系统提示、工具定义、记忆与指令、引用文件、历史消息、工具结果与图片。
_Avoid_: prompt、输入、history、聊天记录

**上下文归因**:
把一份上下文的构成拆解到若干来源类别，并给出每类的 token 估算与其估算口径。
_Avoid_: 上下文分析、token 拆解

**轮次**:
一次用户输入，以及它引发的模型完整响应——包含期间全部工具调用与结果、期间新注入的上下文。
_Avoid_: message、round、回合、对话

**会话**:
一段可被单独打开的时间线，由若干轮次组成，属于某个来源与某个工作目录。
_Avoid_: 聊天、对话、transcript

**会话来源**:
产生该会话的宿主，取值为 claude、dsh 或 codex。
_Avoid_: 类型、平台、provider

**工作目录**:
会话所属的真实文件系统目录。它是跨来源导航的唯一主轴。
_Avoid_: 项目、workspace、文件夹

**压缩点**:
会话中上下文被摘要替换的那一瞬的边界事件；前后上下文构成会突变。
_Avoid_: 截断、compact 事件、溢出

**子代理会话**:
由某轮次中的代理调用所派生的独立会话，附属于发起它的那个轮次。
_Avoid_: 子任务、subagent、teammate

**接管**:
把一条 Claude 会话转化为可在 DSH 中继续工作的动作。
_Avoid_: 迁移、导入、接管会话

**交接简报**:
接管时生成的结构化摘要，作为 DSH 新会话的初始上下文。
_Avoid_: summary、handoff、摘要

**整段导入**:
接管时把原会话的消息历史整体写入新 DSH 会话的动作。
_Avoid_: 全量导入、同步

**估算口径**:
分块 token 的折算系数与其测量来源；必须随每个归因视图一起展示。
_Avoid_: 精度、误差、近似

**工具类（utility）**:
Tailwind 生成的原子类，只在 .ci-panel 作用域内生效（构建时用 @scope 包裹），可直接写在 TSX 的 className 里。版式、间距、字号与颜色默认都用它表达；类名必须字面出现在源码里，且不紧贴模板串插值书写。
_Avoid_: 样式类、css class

**组件类（component class）**:
手写的语义类，只放在 theme/components.css；只有被 3 处以上复用且需要伪元素或状态选择器时才允许新增。终局只剩六族：18 条 [data-part] 配色表（.ci-stack__seg 与 .ci-legend__swatch 共用一张身份表）、.ci-src、.ci-status、.ci-ask、.ci-pre 与 [data-tip] 气泡。
_Avoid_: 公共样式、全局类

**界面文件（surface file）**:
迁移期间按界面切分的临时 CSS 文件（shell/misc/detail/rail/palette/chart/states）——当时的唯一理由是满足每文件 ≤500 行。迁移已结束，这些文件全部删除：theme/ 终局只有 app.css、components.css 与构建产物 generated.css.ts，不得再新增。
_Avoid_: 样式模块、theme 文件

**本地预览（preview harness）**:
preview/ 与 vite.config.ts 组成的调试入口：dev server 里挂载宿主半边，页面读本机真实会话并热更新，不参与打包。
_Avoid_: mock 环境、演示页
