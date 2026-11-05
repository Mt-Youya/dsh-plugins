# 07: 文档刷新

**What to build:** 让文档与代码一致：插件 README（中英）补设置页/余额/版本检查、默认值、出站域名与凭据来源；`docs/API.md` 补 `/settings`、`/balance`、`/version` 三条路由与 reason/source 枚举、超时与 TTL；README（中英）更新「安全边界」段（不再只有 GET、配置由宿主保存、会读 `DEEPSEEK_API_KEY`、会访问两个外网域名）与 Git 安装渠道说明；`docs/RELEASE.md`（中英）改为统一版本规则、成员包 pnpm pack 发布、健康检查版本语义；修正 README 里指向 `docs/RELEASE.en.md` 的过时文件名。

**Blocked by:** None

**Status:** done

- [x] 文档中的路由/默认值/超时/TTL/版本语义与代码逐项一致
- [x] 中英文档同步更新
