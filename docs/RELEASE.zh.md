[English](./RELEASE.en.md) | 简体中文

# 发布到 npm

本仓库对外发布两个包，其余都不发布：

| 包                           | 目录                      | 是什么                                                     |
| ---------------------------- | ------------------------- | ---------------------------------------------------------- |
| `@cyrus/dsh-sessions-insight` | `plugins/sessions-insight` | 会话洞察插件本体（成员包）                               |
| `@cyrus/dsh-plugins`         | 仓库根                    | 组合包：只有 `cordis.patch.yml` 和 `locale/`，依赖各成员包 |

`packages/*` 在构建时被内联进成员包的 `lib/`，**不要发布**。它们现在没有标 `private`，所以**永远不要用 `pnpm -r publish`**，那会把它们一并发上去。

## 顺序只有一条

**先发成员，再发组合包。** 组合包的依赖写的是 `workspace:^`，发布时会被改写成成员当前的版本号（例如 `^0.0.3`）。成员没先发上去，别人装组合包就会解析失败。

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

所有命令都在**仓库根**执行。下面以把成员从 `0.0.2` 升到 `0.0.3`、组合包从 `0.0.1` 升到 `0.0.2` 为例。

### 1. 工作区干净、在 main 上

`pnpm publish` 默认拒绝在有未提交改动、或不在 `main` 分支时发布。

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
npx tsc --noEmit && npx tsc --noEmit -p tsconfig.client.json && npx vitest run && npx tsdown && node scripts/check-bundle.mjs plugins/sessions-insight
```

### 3. 升版本号

成员改过就升成员；**成员升了，组合包也要升**（原因见下面的「版本规则」）。

```bash
pnpm --filter @cyrus/dsh-sessions-insight version patch --no-git-tag-version
```

```bash
pnpm version patch --no-git-tag-version
```

`patch` 换成 `minor` / `major` 即可升对应位。插件的 `/health` 返回的版本号是构建时从 `package.json` 注入的，不用另外改。

### 4. 提交并打 tag

```bash
git commit -am "release: dsh-sessions-insight 0.0.3, dsh-plugins 0.0.2"
```

```bash
git tag dsh-sessions-insight@0.0.3 && git tag dsh-plugins@0.0.2
```

### 5. 预演

只打包、不上传，看清楚 tarball 里有什么：

```bash
pnpm --filter @cyrus/dsh-sessions-insight publish --dry-run
```

```bash
pnpm publish --dry-run
```

成员的 tarball 应该有 `lib/index.js`、`lib/client.js`、`cordis.patch.yml`、`locale/`、`icon.svg`；组合包只有 `cordis.patch.yml`、`locale/`、`package.json`、README 和 LICENSE，并且 `dependencies` 里是 `^0.0.3`，不是 `workspace:^`。

### 6. 发布成员

`prepublishOnly` 会再跑一遍 typecheck、测试和构建，`prepack` 会校验加载契约，任何一步失败都不会上传。开了 2FA 就在末尾加 `--otp=<6 位码>`。

```bash
pnpm --filter @cyrus/dsh-sessions-insight publish --registry=https://registry.npmjs.org/
```

### 7. 发布组合包

```bash
pnpm publish --registry=https://registry.npmjs.org/
```

### 8. 核对

```bash
npm view @cyrus/dsh-sessions-insight version --registry=https://registry.npmjs.org/
```

```bash
npm view @cyrus/dsh-plugins dependencies --registry=https://registry.npmjs.org/
```

### 9. 推送

```bash
git push && git push --tags
```

### 10. 等镜像同步，再安装验证

npmmirror 通常几分钟内同步。想立刻同步，打开 <https://npmmirror.com/package/@cyrus/dsh-plugins> 点「同步」，成员包同理。

```bash
dsh plugin --profile desktop add @cyrus/dsh-plugins
```

完全退出再重新打开 DeepSeek Harness，插件管理器里应出现「Cyrus 插件集」，侧边栏出现「会话洞察」。

## 版本规则

- `0.x` 阶段 `^` 的含义比较窄：`^0.0.3` 只匹配 `0.0.3`，`^0.1.3` 匹配 `>=0.1.3 <0.2.0`。所以在 `0.0.x` 阶段，**成员每发一版，组合包都必须跟着发一版**，否则装组合包拿到的还是旧成员。
- 同一个版本号在 npm 上只能发布一次，删掉也不能复用。发错了就升一个补丁号重发。
- 发布后 72 小时内可以 `npm unpublish <包>@<版本>`，之后只能 `npm deprecate <包>@<版本> "<原因>"`。

## 两种安装方式只能选一种

组合包和成员包各自带一份 `cordis.patch.yml`，都往加载树里插 `id: sessions-insight` 这一行：

- 装组合包 `@cyrus/dsh-plugins`：一次装上全部插件；
- 单独装成员 `@cyrus/dsh-sessions-insight`：只要这一个插件。

**两个同时出现在 `dsh.profile.bundles` 里，DSH 启动时会报 `duplicate loader entry id: sessions-insight` 并退出。** 换安装方式前先把另一个移除：

```bash
dsh plugin --profile desktop remove @cyrus/dsh-sessions-insight
```

## 往组合包里加一个新插件

1. 在 `plugins/<新插件>/` 下建包，`package.json` 里写好 `dsh.bundle.patch`、`exports["./client"]`、`publishConfig.access: public`，并带一份它自己的 `cordis.patch.yml`（单独安装时用）。
2. 根 `package.json` 的 `dependencies` 加 `"<新插件包名>": "workspace:^"`。
3. 根 `cordis.patch.yml` 的 `insert` 下加一行 `- id: <唯一 id>` / `name: "<新插件包名>"`，id 和新插件自己那份 patch 保持一致。
4. 更新两份根 README 的插件表。
5. 按上面的流程发布：先发新插件，再升并发布组合包。

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
| 插件管理器提示「没有声明组合包」                    | 装的不是带 `dsh.bundle` 的那个包           | 装 `@cyrus/dsh-plugins` 或 `@cyrus/dsh-sessions-insight`，不要装 git 地址 |
