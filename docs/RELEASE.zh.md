[English](./RELEASE.md) | 简体中文

# 发布到 npm

本仓库对外发布两个包，其余都不发布：

| 包                           | 目录                      | 是什么                                                     |
| ---------------------------- | ------------------------- | ---------------------------------------------------------- |
| `@cyrusdoyle/dsh-sessions-insight` | `plugins/sessions-insight` | 会话洞察插件本体（成员包）                               |
| `@cyrusdoyle/dsh-plugins`         | 仓库根                    | 组合包：`cordis.patch.yml`、`locale/`，以及它自己内嵌的 `lib/`（ADR 0009） |

`packages/*` 在构建时被内联进成员包的 `lib/`，**不要发布**。它们现在没有标 `private`，所以**永远不要用 `pnpm -r publish`**，那会把它们一并发上去。

## 一个版本，一条顺序

**成员包与组合包永远发同一个版本号**（ADR 0010），并且**先发成员包**。组合包的依赖写的是 `workspace:^`，`pnpm pack` 会把它改写成 `^<成员版本>`；这个版本还没上 registry 时，装组合包会解析失败。两个包承载同一份插件代码，只发其中一个会让两种安装渠道报出不同版本。

`/health` 和版本检查报的是**生效包**的版本——装组合包报组合包的 `package.json`，单装成员包报成员包的。因为两个包一起 bump，这两个数字始终相同。

[`release` workflow](../.github/workflows/release.yml) 用 npm Trusted Publishing（GitHub OIDC，仓库不存 token、不需要 2FA）把这些步骤跑完；workflow 不可用时按下面的手工流程操作。

## 一次性准备

1. 有一个能发布 `@cyrus` scope 的 npm 账号。scope 不归你时，第一次发布会 403，要么在 npm 上建这个 organization，要么把两个 `package.json` 的 `name` 换成你自己的 scope。
2. 登录官方源。npmmirror 是只读镜像，不能往上发：

   ```bash
   npm login --registry=https://registry.npmjs.org/
   ```

3. 确认登录的是谁：

   ```bash
   npm whoami --registry=https://registry.npmjs.org/
   ```

## 每次发布

所有命令都在**仓库根**执行。下面以两个包一起从 `0.0.2` 升到 `0.0.3` 为例——目标版本号相同（原因见下面的「版本规则」）。

### 1. 工作区干净、在 main 上

发布要在干净的 `main` 上进行。`pnpm publish` 会强制检查这一点，但下面用的 `npm publish <tgz>` 不检查，得自己把关。

```bash
git status
git switch main
git pull
```

### 2. 安装并跑门禁

```bash
pnpm install
```

```bash
npx tsc --noEmit && npx tsc --noEmit -p tsconfig.client.json && npx vitest run && node scripts/build-css.mjs plugins/sessions-insight && npx tsdown && node scripts/check-bundle.mjs plugins/sessions-insight && node scripts/check-bundle.mjs .
```

CSS 构建必须排在 `tsdown` 之前：组合包把编译好的样式内联进自己的 `lib/`，顺序反过来会发出旧样式。

### 3. 两个包升到同一个版本

ADR 0010：成员包和组合包共用一个发布版本。用**显式目标版本号**一起升，别用相对 bump，避免两个 manifest 漂移：

```bash
pnpm --filter @cyrusdoyle/dsh-sessions-insight version 0.0.3 --no-git-tag-version
```

```bash
pnpm version 0.0.3 --no-git-tag-version
```

插件的 `/health` 返回的版本号、版本检查比较的版本号，都是构建时从**生效包**的 `package.json` 注入的，不用另外改。要升 minor / major 就直接写目标版本号。

### 4. 提交并打 tag

```bash
git commit -am "release: dsh-sessions-insight 0.0.3, dsh-plugins 0.0.3"
```

```bash
git tag dsh-sessions-insight@0.0.3 && git tag dsh-plugins@0.0.3
```

### 5. 预演

只打包、不上传，看清楚 tarball 里有什么。`pnpm pack` 会改写 `workspace:` / `catalog:` 协议，并执行成员包的 `prepack`（重建 + 加载契约校验）：

```bash
mkdir -p /tmp/dsh-release/member
pnpm --filter @cyrusdoyle/dsh-sessions-insight pack --pack-destination /tmp/dsh-release/member
tar -tzf /tmp/dsh-release/member/*.tgz | head -40
```

组合包必须先构建再打包（`lib/` 在 .gitignore 里）：

```bash
node scripts/build-css.mjs plugins/sessions-insight
npx tsdown
mkdir -p /tmp/dsh-release/collection
pnpm pack --pack-destination /tmp/dsh-release/collection
tar -tzf /tmp/dsh-release/collection/*.tgz | head -40
```

成员的 tarball 应该有 `lib/index.js`、`lib/client.js`、`cordis.patch.yml`、`locale/`、`icon.svg`；组合包应该有 `cordis.patch.yml`、`locale/`、`package.json`、README 和 LICENSE，**以及它自己的 `lib/index.js` 与 `lib/client.js`**（ADR 0009：组合包内嵌插件产物），并且 `dependencies` 里是 `^0.0.3`，不是 `workspace:^`。

### 6. 发布成员

`pnpm pack` 会执行成员包的 `prepack`（重建 + 加载契约校验），任何一步失败都不会产出 tarball；`npm publish <tgz>` 上传的就是这份字节。开了 2FA 就加 `--otp=<6 位码>`。

跳过了预演就先执行第 5 步里的 `pnpm pack`，再发布它产出的 tarball：

```bash
npm publish /tmp/dsh-release/member/*.tgz --registry=https://registry.npmjs.org/
```

### 7. 发布组合包

先构建组合包，再打包并发布这份 tarball：

```bash
node scripts/build-css.mjs plugins/sessions-insight && npx tsdown && pnpm pack --pack-destination /tmp/dsh-release/collection
```

```bash
npm publish /tmp/dsh-release/collection/*.tgz --registry=https://registry.npmjs.org/
```

release workflow 会在发布前断言两个 manifest 版本相同；手工路径也保留同样的检查：

```bash
node -e "const v=['./package.json','./plugins/sessions-insight/package.json'].map((p)=>require(p).version); if (v[0]!==v[1]) { console.error('version mismatch', v); process.exit(1) } console.log('shared version', v[0])"
```

### 8. 核对

```bash
npm view @cyrusdoyle/dsh-sessions-insight version --registry=https://registry.npmjs.org/
```

```bash
npm view @cyrusdoyle/dsh-plugins dependencies --registry=https://registry.npmjs.org/
```

两个 `version` 必须是同一个数字，组合包的 `dependencies` 必须钉住这个数字。装好之后，插件的 `/health` 报的是实际生效包的版本——两种安装方式报同一个数字。

### 9. 推送

```bash
git push && git push --tags
```

### 10. 等镜像同步，再安装验证

npmmirror 通常几分钟内同步。想立刻同步，打开 <https://npmmirror.com/package/@cyrusdoyle/dsh-plugins> 点「同步」，成员包同理。

```bash
dsh plugin --profile desktop add @cyrusdoyle/dsh-plugins
```

完全退出再重新打开 DeepSeek Harness，插件管理器里应出现「Cyrus 插件集」，侧边栏出现「会话洞察」。

## 版本规则

- **两个包共用一个版本号**（ADR 0010）：成员包和组合包在同一次发布里升到同一个数字，先发成员包、再发组合包。不要单独给组合包发补丁版——那会让两种安装渠道通过 `/health` 和版本检查报出不同版本。
- 版本号是构建时从**生效包**的 `package.json` 注入的；`/health` 和版本检查比较的都是这个生效包在 registry 上的同包版本。`0.x` 阶段 `^` 的含义比较窄（`^0.0.3` 只匹配 `0.0.3`），这也是两个包必须一起动的另一个原因。
- 同一个版本号在 npm 上只能发布一次，删掉也不能复用。发错了就把两个包的补丁号一起升上去重发。
- 发布后 72 小时内可以 `npm unpublish <包>@<版本>`，之后只能 `npm deprecate <包>@<版本> "<原因>"`。

## 两种安装方式只能选一种

组合包和成员包各自带一份 `cordis.patch.yml`，都往加载树里插 `id: sessions-insight` 这一行：

- 装组合包 `@cyrusdoyle/dsh-plugins`：一次装上全部插件；
- 单独装成员 `@cyrusdoyle/dsh-sessions-insight`：只要这一个插件。

**两个同时出现在 `dsh.profile.bundles` 里，DSH 启动时会报 `duplicate loader entry id: sessions-insight` 并退出。** 换安装方式前先把另一个移除：

```bash
dsh plugin --profile desktop remove @cyrusdoyle/dsh-sessions-insight
```

## 往组合包里加一个新插件

1. 在 `plugins/<新插件>/` 下建包，`package.json` 里写好 `dsh.bundle.patch`、`exports["./client"]`、`publishConfig.access: public`，并带一份它自己的 `cordis.patch.yml`（单独安装时用）。
2. 根 `package.json` 的 `dependencies` 加 `"<新插件包名>": "workspace:^"`。
3. 根 `cordis.patch.yml` 的 `insert` 下加一行 `- id: <唯一 id>` / `name: "<新插件包名>"`，id 和新插件自己那份 patch 保持一致。
4. 更新两份根 README 的插件表。
5. 按上面的流程发布：把所有成员包和组合包升到同一个版本，先发成员包，再发组合包。

## 常见报错

| 报错                                                | 原因                                       | 处理                                                                     |
| --------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `403 Forbidden` / `You do not have permission`      | 账号不拥有 `@cyrus` scope                  | 建 organization，或换成自己的 scope                                      |
| `402 Payment Required`                              | scope 包默认私有                           | 确认 `publishConfig.access` 是 `public`，或加 `--access public`          |
| `You cannot publish over the previously published…` | 版本号已发过                               | 升版本号重发                                                             |
| `ERR_PNPM_GIT_UNCLEAN`                              | 有未提交改动                               | 先提交；确实要发就加 `--no-git-checks`                                   |
| `ERR_PNPM_GIT_BRANCH`                               | 不在 `main` 上                             | 切回 `main`；或加 `--publish-branch <分支>`                              |
| `Cannot resolve workspace protocol…`                | 在仓库根没 `pnpm install` 过               | 先 `pnpm install`                                                        |
| DSH 启动报 `duplicate loader entry id`              | 组合包和成员包同时在 `dsh.profile.bundles` | 移除其中一个，见上面「两种安装方式只能选一种」                           |
| 插件管理器提示「没有声明组合包」                    | 装的不是带 `dsh.bundle` 的那个包           | 装 `@cyrusdoyle/dsh-plugins` 或 `@cyrusdoyle/dsh-sessions-insight`，不要装 git 地址 |
