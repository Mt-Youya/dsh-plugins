/**
 * Browser-half copy of the sessions-insight panel.
 *
 * The dictionaries are the source of truth for the namespace this plugin owns;
 * the sidebar label is a thunk over {@link t} so the shell re-resolves it on
 * every language change, and the module-level translate keeps plain callers
 * (outside React) following the same setting.
 *
 * Wording follows GLOSSARY.md: 轮次 / 压缩点 / 子代理会话 / 估算口径.
 *
 * @module @cyrus/dsh-sessions-insight/client/locale
 */

/** Locale namespace this plugin owns. */
export const LOCALE_NS = "sessions-insight"

/** Chinese dictionary; the default language. */
export const zh = {
  "entry.label": "会话洞察",
  "toolbar.sidebar": "显示/隐藏项目栏",
  "search.trigger": "搜索会话与轮次…",
  "tree.filter": "筛选项目",
  "tree.noMatch": "没有路径包含「{query}」的项目。",
  "sessions.pick": "从左侧选一个会话",
  "sessions.pickHint": "展开项目，点开任一会话，就能看到它每一轮实际喂给模型的上下文。",
  "stats.current": "当前上下文",
  "stats.noWindow": "日志未记录窗口大小",
  "stats.windowShare": "占窗口 {share} · {size}",
  "stats.peak": "峰值",
  "stats.peakAt": "出现在第 {index} 轮",
  "stats.turns": "轮次",
  "stats.compactionsLine": "{count} 个压缩点 · {tools} 次工具调用",
  "stats.loaded": "已加载 {count} 轮",
  "stats.cost": "花费",
  "stats.costPending": "价格计算中或未覆盖",
  "stats.costPriced": "按价格表逐轮计价",
  "stats.reconciledTurns": "{count} 轮按系数缩放过",
  "detail.composition": "上下文构成",
  "turns.noInput": "（本轮无用户输入）",
  "waterfall.hint": "点任一点跳到该轮",
  "list.refreshing": "刷新中…",
  "tree.title": "项目",
  "tree.loadingIndex": "正在读取三源会话索引…",
  "tree.emptyAll": "三个来源都还没有可读的会话。检查 DSH / Claude / Codex 目录是否存在，或点右上角「刷新」。",
  "tree.showAll": "显示全部 {count} 条",
  "sessions.untitled": "未命名会话",
  "handoff.button": "交接给 DSH",
  "handoff.title": "交接给 DSH",
  "handoff.preparing": "正在生成简报…",
  "handoff.cwd": "新会话的工作目录",
  "handoff.cwdHint": "必须显式指定：省略会让 DSH 继承自己的启动目录，把会话建到错误的桶里。",
  "handoff.brief": "简报（6 段，可在投递前编辑）",
  "handoff.files": "{count} 个文件",
  "handoff.decisions": "{count} 条决策",
  "handoff.open": "{count} 条未决",
  "handoff.commands": "{count} 条验证命令",
  "handoff.chars": "{count} 字",
  "handoff.apply": "投递到 DSH",
  "handoff.applying": "正在投递…",
  "handoff.polish": "用模型润色",
  "handoff.polishUnavailable": "本次交接使用规则抽取；模型润色尚未接通",
  "handoff.applyFailed": "投递失败：{detail}",
  "handoff.state.delivered": "已投递，等待模型响应",
  "handoff.state.running": "模型正在运行",
  "handoff.state.succeeded": "交接成功（已观察到 turn/end）",
  "handoff.state.failed": "交接失败",
  "handoff.polling": "每 600ms 轮询该会话日志，直到出现 turn/end 才判定结果",
  "handoff.reason": "失败原因：{reason}",
  "handoff.evidence": "证据：turn/end seq={seq}",
  "handoff.close": "关闭",
  "cost.total": "合计 {usd}",
  "cost.unpriced": "{count} 轮未覆盖价格",
  "cost.null": "—",
  "cost.tip": "价格表 {version} · 数据截至 {asOf} · {currency}；未覆盖模型显示 —",
  "cost.turnTip": "第 {index} 轮 · {model} · cache 命中 {rate}",
  "cost.provisional": "预览价",
  "cost.reference": "参考 {amount}",
  "cost.partialPrefix": "≥",
  "cost.noConvert": "两张表不做汇率换算，也不相加",
  "cost.tableLine": "{id}：{source} · 数据截至 {asOf}",
  "cost.unlistedTip": "未列价通道：{channels}",
  "cost.provisionalTip":
    "该模型的部分费率是推导值（cached 输入价由折扣规则推算、cacheWrite 按 1.25×input），不是官方单列价格；来源为 GPT-5.6 预览价汇总。",
  "search.tier.fast": "快搜（元数据）",
  "search.tier.deep": "深搜（正文）",
  "search.enterDeep": "Enter 深搜",
  "search.continue": "继续扫描剩余 {count} 个",
  "search.deepMeta": "深搜：扫过 {scanned} · 剩余 {remaining}",
  "search.fastMeta": "快搜：已扫全部 {scanned} 个会话",

  "session.untitled": "未命名会话",
  "session.firstInput": "首条输入",
  "sessions.headerHint": "列表仅读文件头，点开才解析",
  "compactions.count": "{count} 个压缩点",
  "compactions.range": "{before} → {after}",
  "compactions.list": "逐个展开前后对比",
  "search.title": "搜索会话",
  "search.placeholder": "搜索轮次正文…（Esc 关闭）",
  "search.empty": "没有命中。",
  "search.hint": "输入后即搜；↑↓ 选择，Enter 跳转到该轮",
  "search.scanning": "正在扫描…",
  "search.meta": "扫过 {scanned} 个会话，用时 {elapsed} ms",
  "search.truncated": "预算内未扫完，还剩 {remaining} 个会话",
  "search.complete": "已扫完 {scanned} 个会话",
  "search.open": "搜索（⌘K）",
  "search.failures": "{count} 个来源失败",
  "search.result": "{workdir} · 第 {turn} 轮",
  "search.jump": "跳转到该轮",
  "panel.refresh": "刷新",
  "panel.loading": "正在读取宿主数据…",
  "panel.retry": "重试",
  "panel.updated": "更新于 {time}",

  "sources.title": "来源",
  "sources.available": "可读",
  "sources.unavailable": "不可用",
  "sources.sessions": "{count} 个会话",
  "sources.reason.adapter-pending": "适配器尚未就绪",
  "sources.reason.root-missing": "根目录不存在",
  "sources.reason.root-unreadable": "根目录不可读",
  "sources.reason.adapter-error": "适配器异常",

  "workdirs.title": "工作目录",
  "workdirs.empty": "未发现任何 Claude 会话。",
  "workdirs.unknown": "（未知工作目录）",
  "workdirs.undecoded": "路径由目录名反解",

  "sessions.title": "会话",
  "sessions.empty": "该工作目录下没有会话。",
  "sessions.unparsed": "未解析",
  "sessions.turns": "{count} 轮",

  "session.loading": "正在解析会话…",
  "session.error": "读取失败：{detail}",
  "session.paging": "第 {from}–{to} 轮，共 {total} 轮",
  "session.loadMore": "加载更多轮次",
  "session.loadingMore": "正在加载…",
  "session.noTurns": "这个会话没有可解析的轮次。",
  "session.noTurnsHint": "文件存在但没有任何用户输入与 usage 记录，因此无法画出上下文构成。",
  "session.quality": "数据质量",
  "session.turnCount": "{count} 轮",

  "turns.title": "轮次上下文构成",
  "turns.hint": "每轮一行；点开可看分区数字与工具调用。",
  "turns.unknown": "未知",
  "turns.unknownNote": "无法归因的缺口，未摊入任何已知类别",
  "turns.overCounted": "估算合计超过精确总量 {tokens}",
  "turns.normalizedByParts": "该轮没有 usage：条形按分区估算归一",
  "turns.total": "总量",
  "turns.window": "窗口 {size}",
  "turns.reconciled": "已按系数 {factor} 缩放",
  "turns.notReconciled": "未缩放，缺口单列",
  "turns.compaction": "压缩点",
  "turns.compactionTransition": "{before} → {after}",
  "turns.compactionReplaced": "历史被替换",
  "turns.compactionContinued": "历史由摘要接续",
  "turns.tools": "工具调用",
  "turns.subagents": "子代理会话",
  "turns.noTools": "本轮没有工具调用。",
  "turns.noSubagents": "本轮没有记录到子代理会话。",
  "turns.selected": "第 {index} 轮",

  "waterfall.title": "累计水位",
  "waterfall.caption": "每轮的总上下文；竖虚线是压缩点",
  "waterfall.peak": "峰值 {tokens}",

  "precision.exact": "精确",
  "precision.estimate": "估算",
  "basis.usage": "日志 usage",
  "basis.chars-per-token": "字符折算",
  "basis.harness-projection": "宿投影",
  "basis.byte-length": "字节长度",
  "basis.unattributed": "不可归因缺口",
  "basis.tip.chars-per-token": "系数：文本 {text} 字/token，CJK {cjk}，schema {schema}",
  "basis.tip.usage": "直接读自日志的 usage，不是估算",
  "basis.tip.harness-projection": "图片按 {px} 像素/token 投影",
  "basis.tip.byte-length": "按字节长度折算",
  "basis.tip.unattributed": "总量减分区之和；不摊给任何类别",

  "part.system-prompt": "系统提示",
  "part.tool-definitions": "工具定义",
  "part.memory-instructions": "记忆与指令",
  "part.referenced-files": "引用文件",
  "part.history": "历史",
  "part.tool-results": "工具结果",
  "part.images": "图片",
  "part.user-input": "用户输入",
  "part.assistant-output": "助手输出",
  "part.thinking": "思考",

  "tools.status.ok": "成功",
  "tools.status.running": "进行中",
  "tools.status.error": "报错",
  "tools.status.unknown": "未回包",
  "detail.userInput": "用户输入",
  "tools.showAll": "显示全部 {count} 个",
  "tools.showLess": "收起",
  "tools.path": "路径",
  "tools.command": "命令",
  "tools.diff": "改动",
  "tools.output": "输出",
  "tools.input": "输入",
  "tools.truncated": "内容过长，已折叠",

  "subagents.title": "子代理会话",
  "subagents.files": "{count} 个附属文件",
  "subagents.none": "该会话没有记录到子代理文件。",
  "subagents.main": "主文件",

  "empty.noSources": "宿主没有可读的来源。",
  "empty.noData": "没有可解析的数据。",
  "error.network": "无法连接宿主路由",
} satisfies Record<string, string>

/** Every message key this namespace defines. */
export type ContextInsightKey = keyof typeof zh

/** English dictionary; same keys, so a missing translation is a type error. */
export const en: Record<ContextInsightKey, string> = {
  "entry.label": "Sessions Insight",
  "toolbar.sidebar": "Show/hide projects",
  "search.trigger": "Search sessions and turns…",
  "tree.filter": "Filter projects",
  "tree.noMatch": "No project path contains “{query}”.",
  "sessions.pick": "Pick a session on the left",
  "sessions.pickHint": "Open a project and click any session to see what each turn actually fed the model.",
  "stats.current": "Current context",
  "stats.noWindow": "window size not logged",
  "stats.windowShare": "{share} of {size} window",
  "stats.peak": "Peak",
  "stats.peakAt": "at turn {index}",
  "stats.turns": "Turns",
  "stats.compactionsLine": "{count} compactions · {tools} tool calls",
  "stats.loaded": "{count} loaded",
  "stats.cost": "Cost",
  "stats.costPending": "pricing pending or uncovered",
  "stats.costPriced": "priced per turn from the table",
  "stats.reconciledTurns": "{count} turns were scaled",
  "detail.composition": "Context composition",
  "turns.noInput": "(no user input this turn)",
  "waterfall.hint": "click a point to open that turn",
  "list.refreshing": "refreshing…",
  "tree.title": "Projects",
  "tree.loadingIndex": "Reading the three session indexes\u2026",
  "tree.emptyAll":
    "No readable sessions in any source yet. Check the DSH / Claude / Codex directories, or press Refresh.",
  "tree.showAll": "Show all {count}",
  "sessions.untitled": "Untitled session",
  "handoff.button": "Hand off to DSH",
  "handoff.title": "Hand off to DSH",
  "handoff.preparing": "Building the brief\u2026",
  "handoff.cwd": "Workdir of the new session",
  "handoff.cwdHint":
    "Must be explicit: omitting it makes DSH inherit its own launch directory and file the session under the wrong bucket.",
  "handoff.brief": "Brief (six sections; editable before delivery)",
  "handoff.files": "{count} files",
  "handoff.decisions": "{count} decisions",
  "handoff.open": "{count} open items",
  "handoff.commands": "{count} verification commands",
  "handoff.chars": "{count} chars",
  "handoff.apply": "Deliver to DSH",
  "handoff.applying": "Delivering\u2026",
  "handoff.polish": "Polish with a model",
  "handoff.polishUnavailable": "This handoff is rule-extracted; model polishing is not wired yet",
  "handoff.applyFailed": "Delivery failed: {detail}",
  "handoff.state.delivered": "Delivered \u2014 waiting for the model",
  "handoff.state.running": "The model is running",
  "handoff.state.succeeded": "Handoff succeeded (turn/end observed)",
  "handoff.state.failed": "Handoff failed",
  "handoff.polling": "Polling the target log every 600 ms until a turn/end appears",
  "handoff.reason": "Reason: {reason}",
  "handoff.evidence": "Evidence: turn/end seq={seq}",
  "handoff.close": "Close",
  "cost.total": "Total {usd}",
  "cost.unpriced": "{count} unpriced turns",
  "cost.null": "\u2014",
  "cost.tip": "Price table {version} \u00b7 as of {asOf} \u00b7 {currency}; uncovered models show \u2014",
  "cost.turnTip": "Turn {index} \u00b7 {model} \u00b7 cache hit {rate}",
  "cost.provisional": "Preview price",
  "cost.reference": "ref {amount}",
  "cost.partialPrefix": "≥",
  "cost.noConvert": "The two tables are never converted or added together",
  "cost.tableLine": "{id}: {source} \u00b7 as of {asOf}",
  "cost.unlistedTip": "Unlisted channels: {channels}",
  "cost.provisionalTip":
    "Part of this model\u2019s rates is derived (cached input from a discount rule, cacheWrite as 1.25\u00d7 input), not an officially listed number; source is a GPT-5.6 preview price round-up.",
  "search.tier.fast": "Fast (metadata)",
  "search.tier.deep": "Deep (bodies)",
  "search.enterDeep": "Enter = deep search",
  "search.continue": "Continue scanning {count} more",
  "search.deepMeta": "Deep: {scanned} scanned \u00b7 {remaining} remaining",
  "search.fastMeta": "Fast: all {scanned} sessions scanned",

  "session.untitled": "Untitled session",
  "session.firstInput": "first input",
  "sessions.headerHint": "The list reads file headers only; open a row to parse it",
  "compactions.count": "{count} compactions",
  "compactions.range": "{before} → {after}",
  "compactions.list": "Expand every boundary",
  "search.title": "Search sessions",
  "search.placeholder": "Search turn text\u2026 (Esc to close)",
  "search.empty": "No matches.",
  "search.hint": "Type to search; \u2191\u2193 to select, Enter to open the turn",
  "search.scanning": "Scanning\u2026",
  "search.meta": "{scanned} sessions scanned in {elapsed} ms",
  "search.truncated": "Budget ran out; {remaining} sessions were not scanned",
  "search.complete": "All {scanned} sessions scanned",
  "search.open": "Search (\u2318K)",
  "search.failures": "{count} sources failed",
  "search.result": "{workdir} \u00b7 turn {turn}",
  "search.jump": "Open this turn",
  "panel.refresh": "Refresh",
  "panel.loading": "Reading Host data…",
  "panel.retry": "Retry",
  "panel.updated": "Updated {time}",

  "sources.title": "Sources",
  "sources.available": "readable",
  "sources.unavailable": "unavailable",
  "sources.sessions": "{count} sessions",
  "sources.reason.adapter-pending": "adapter not ready",
  "sources.reason.root-missing": "root missing",
  "sources.reason.root-unreadable": "root unreadable",
  "sources.reason.adapter-error": "adapter error",

  "workdirs.title": "Workdirs",
  "workdirs.empty": "No Claude sessions found.",
  "workdirs.unknown": "(unknown workdir)",
  "workdirs.undecoded": "path decoded from the directory name",

  "sessions.title": "Sessions",
  "sessions.empty": "No sessions in this workdir.",
  "sessions.unparsed": "not parsed",
  "sessions.turns": "{count} turns",

  "session.loading": "Parsing session…",
  "session.error": "Read failed: {detail}",
  "session.paging": "Turns {from}–{to} of {total}",
  "session.loadMore": "Load more turns",
  "session.loadingMore": "Loading…",
  "session.noTurns": "This session has no parseable turns.",
  "session.noTurnsHint": "The file exists but records no human input or usage, so no composition can be drawn.",
  "session.quality": "Data quality",
  "session.turnCount": "{count} turns",

  "turns.title": "Per-turn context",
  "turns.hint": "One row per turn; open one for part numbers and tool calls.",
  "turns.unknown": "Unknown",
  "turns.unknownNote": "The unattributed gap, never spread over the known parts",
  "turns.overCounted": "Estimates exceed the exact total by {tokens}",
  "turns.normalizedByParts": "No usage on this turn: the bar is normalized by parts",
  "turns.total": "Total",
  "turns.window": "window {size}",
  "turns.reconciled": "scaled by {factor}",
  "turns.notReconciled": "not scaled; the gap stands alone",
  "turns.compaction": "Compaction",
  "turns.compactionTransition": "{before} → {after}",
  "turns.compactionReplaced": "history replaced",
  "turns.compactionContinued": "history continues from a summary",
  "turns.tools": "Tool calls",
  "turns.subagents": "Subagent sessions",
  "turns.noTools": "No tool calls in this turn.",
  "turns.noSubagents": "No subagent sessions recorded for this turn.",
  "turns.selected": "Turn {index}",

  "waterfall.title": "Cumulative level",
  "waterfall.caption": "Total context per turn; dashed lines are compactions",
  "waterfall.peak": "peak {tokens}",

  "precision.exact": "exact",
  "precision.estimate": "estimate",
  "basis.usage": "logged usage",
  "basis.chars-per-token": "chars per token",
  "basis.harness-projection": "harness projection",
  "basis.byte-length": "byte length",
  "basis.unattributed": "unattributed gap",
  "basis.tip.chars-per-token": "calipers: text {text} chars/token, CJK {cjk}, schema {schema}",
  "basis.tip.usage": "read from the logged usage, not estimated",
  "basis.tip.harness-projection": "images projected at {px} pixels/token",
  "basis.tip.byte-length": "converted from byte length",
  "basis.tip.unattributed": "total minus the parts; never spread over a category",

  "part.system-prompt": "System prompt",
  "part.tool-definitions": "Tool definitions",
  "part.memory-instructions": "Memory & instructions",
  "part.referenced-files": "Referenced files",
  "part.history": "History",
  "part.tool-results": "Tool results",
  "part.images": "Images",
  "part.user-input": "User input",
  "part.assistant-output": "Assistant output",
  "part.thinking": "Thinking",

  "tools.status.ok": "ok",
  "tools.status.running": "running",
  "tools.status.error": "error",
  "tools.status.unknown": "no result",
  "detail.userInput": "User message",
  "tools.showAll": "Show all {count}",
  "tools.showLess": "Show less",
  "tools.path": "path",
  "tools.command": "command",
  "tools.diff": "diff",
  "tools.output": "output",
  "tools.input": "input",
  "tools.truncated": "long content folded",

  "subagents.title": "Subagent sessions",
  "subagents.files": "{count} attached files",
  "subagents.none": "No subagent files recorded for this session.",
  "subagents.main": "main file",

  "empty.noSources": "The Host serves no readable source.",
  "empty.noData": "No parseable data.",
  "error.network": "Cannot reach the Host route",
}

/** Translate function bound to this namespace by the locale service. */
let runtimeTranslate: ((key: string, params?: Record<string, unknown>) => string) | undefined

/**
 * Point {@link t} at the live locale service so every later read follows the
 * active language. Called once from `apply`, before any label thunk can run.
 * @param translate - namespace-bound translate from `ctx.locale.bind`.
 */
export function setRuntimeTranslate(translate: (key: string, params?: Record<string, unknown>) => string): void {
  runtimeTranslate = translate
}

/**
 * Fill `{name}` placeholders.
 * @param template - message text.
 * @param params - values by placeholder name.
 * @returns the filled text; an unknown placeholder is left visible on purpose.
 */
export function fillParams(template: string, params?: Record<string, unknown>): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (whole: string, name: string) => {
    const value = params[name]
    return value === undefined ? whole : String(value)
  })
}

/**
 * Translate one key of this namespace.
 * @param key - a key of {@link zh}.
 * @param params - interpolation values for the message.
 * @returns the active-language text, or the English text when the locale
 * service is absent, or the key itself when neither has it.
 */
export function t(key: ContextInsightKey, params?: Record<string, unknown>): string {
  const translated = runtimeTranslate?.(key, params)
  if (translated !== undefined && translated !== "") return translated
  return fillParams(en[key], params)
}
