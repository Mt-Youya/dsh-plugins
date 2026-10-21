# 插件契约以 app.asar 内运行版行为为准

DSH 在本机运行的是打包在 `app.asar` 里的 0.2.1-rc.2，而 `~/.dsh/profiles/node_modules/@deepseek-ai/*` 是过期的 0.1.0-rc.6（其中 `dsh-base` 还是指向 npx 缓存的外来 symlink）。0.1 的 layout 既没有 `main` slot 也没有 `selectPanel`，照它写出来的插件会静默不挂载。官方 0.2.1 客户端包**不发 .d.ts**，因此我们手写最小接口声明，并以 asar 内产物行为作为唯一契约来源。

**Consequences**: 升级 DSH 时必须重新核对 asar 内的 slot 表与 `dsh.client` 校验规则；类型声明是我们自己的，不跟随上游。
