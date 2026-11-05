# 05: 安全默认值、余额路由边界与披露

**What to build:** (a) `SETTINGS_DEFAULTS` 与 Config schema 的 `deepseekBalance`、`autoCheckVersion` 默认改为 `false`；(b) `/balance` 只接受 loopback 来源（`127.0.0.0/8`、`::1`、`::ffff:127.*`），否则 403；(c) 设置页 hint 披露会访问 `api.deepseek.com` / `registry.npmjs.org`，并说明优先读取 `DEEPSEEK_API_KEY`。

**Blocked by:** None

**Status:** done

- [x] 新装默认两个开关关闭；开启后才发请求
- [x] 非 loopback 来源请求 `/balance` 返回 403 且不发 provider 请求
- [x] 设置页文案披露出站域名与凭据来源
