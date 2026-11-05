# 0009 · 集合包内嵌插件产物，而不是薄壳转发

- 状态：已接受
- 日期：2026-11-04

## 背景

仓库发布两个包：成员包 `@cyrusdoyle/dsh-sessions-insight`（可单装）与集合包 `@cyrusdoyle/dsh-plugins`（一次装全部插件）。DSH 的浏览器模块图按**拥有 `lib/` 的那个包名**注册与调度客户端 bundle：集合包若只做薄壳、把入口指向成员包的 `lib/`，它的 client bundle 会以成员包名注册，集合包的页面永远收不到这份 UI。

## 决定

1. 集合包在构建时把 `plugins/sessions-insight` 的 Host/Client 源码编进自己的 `lib/`，client bundle 以 `@cyrusdoyle/dsh-plugins` 注册。
2. 集合包的 `cordis.patch.yml` 只插入集合包自己（`id: cyrus-dsh-plugins`），不再插入成员包；两种安装方式二选一。
3. 成员包的独立安装保持原样：自己的 `lib/`、以自己的包名注册。

## 后果

- 同一份插件源码存在两份构建产物；发布必须成对进行（见 ADR 0010）。
- 根 `lib/` 不入库，发布前构建；成员 `lib/` 入库，用于 Git 安装（pnpm 默认不允许安装期执行构建脚本）。
- README 与 RELEASE.md 里“集合包只是薄壳、依赖成员包运行”的描述作废。

## 曾考虑的方案

- **薄壳集合包**：客户端 bundle 注册名与集合包不匹配，放弃。
- **只发成员包、取消集合包**：失去“一次装全部插件”的入口，且现有 profile 已按集合包接入，放弃。
