English | [简体中文](./RELEASE.zh.md)

# Publishing to npm

This repository publishes two packages and nothing else:

| Package                      | Directory                 | What it is                                                                         |
| ---------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| `@cyrusdoyle/dsh-sessions-insight` | `plugins/sessions-insight` | The Sessions Insight plugin itself (a member package)                                  |
| `@cyrusdoyle/dsh-plugins`         | repository root           | The collection bundle: `cordis.patch.yml`, `locale/` and its own embedded `lib/` (ADR 0009) |

`packages/*` are inlined into the member's `lib/` at build time and are **not published**. They are not marked `private` today, so **never run `pnpm -r publish`**: it would publish them too.

## One version, one order

**The member and the collection always ship the same version number** (ADR 0010), and **the member goes first**. The collection's `dependencies` read `workspace:^`, which `pnpm pack` rewrites to `^<member version>`; if that version is not on the registry yet, installing the collection fails to resolve. Both packages carry the same plugin code, so publishing only one of them leaves the two install channels reporting different versions.

`/health` and the version check report the version of the **effective package** — the collection reports the collection's `package.json`, a standalone member install reports the member's. Because the two are bumped together, both numbers are the same.

The [`release` workflow](../.github/workflows/release.yml) runs all of this with npm Trusted Publishing (GitHub OIDC, no token, no 2FA prompt). The manual path is documented below for when the workflow is not available.

## One-time setup

1. An npm account that can publish the `@cyrus` scope. If the scope is not yours the first publish is a 403: either create that organization on npm, or rename both `package.json` `name`s to a scope you own.
2. Log in to the official registry. npmmirror is a read-only mirror and cannot be published to:

   ```bash
   npm login --registry=https://registry.npmjs.org/
   ```

3. Check who you are logged in as:

   ```bash
   npm whoami --registry=https://registry.npmjs.org/
   ```

## Every release

Run everything from the **repository root**. The example bumps both packages from `0.0.2` to `0.0.3` — the same target version for both (see "Versioning rules" below).

### 1. Clean tree, on main

Release from a clean tree on `main`. `pnpm publish` enforces this, but the `npm publish <tgz>` path used below does not check — this step is on you.

```bash
git status
git switch main
git pull
```

### 2. Install and run the gates

```bash
pnpm install
```

```bash
npx tsc --noEmit && npx tsc --noEmit -p tsconfig.client.json && npx vitest run && node scripts/build-css.mjs plugins/sessions-insight && npx tsdown && node scripts/check-bundle.mjs plugins/sessions-insight && node scripts/check-bundle.mjs .
```

The CSS build must come before `tsdown`: the collection embeds the compiled stylesheet into its own `lib/`, so building in the other order ships a stale one.

### 3. Bump both versions to the same number

ADR 0010: the member and the collection share one release version. Bump them together, with the explicit target version rather than a relative bump, so the two manifests cannot drift apart:

```bash
pnpm --filter @cyrusdoyle/dsh-sessions-insight version 0.0.3 --no-git-tag-version
```

```bash
pnpm version 0.0.3 --no-git-tag-version
```

The version the plugin's `/health` reports and the version the update check compares are inlined from the **effective package's** `package.json` at build time, so nothing else needs editing. Use `minor` / `major` in place of `patch` semantics by naming the target version directly.

### 4. Commit and tag

```bash
git commit -am "release: dsh-sessions-insight 0.0.3, dsh-plugins 0.0.3"
```

```bash
git tag dsh-sessions-insight@0.0.3 && git tag dsh-plugins@0.0.3
```

### 5. Dry run

Pack without uploading and look at what the tarballs contain. `pnpm pack` rewrites `workspace:` / `catalog:` protocols and runs the member's `prepack` (rebuild + bundle contract check):

```bash
mkdir -p /tmp/dsh-release/member
pnpm --filter @cyrusdoyle/dsh-sessions-insight pack --pack-destination /tmp/dsh-release/member
tar -tzf /tmp/dsh-release/member/*.tgz | head -40
```

The collection must be built before it is packed (`lib/` is gitignored):

```bash
node scripts/build-css.mjs plugins/sessions-insight
npx tsdown
mkdir -p /tmp/dsh-release/collection
pnpm pack --pack-destination /tmp/dsh-release/collection
tar -tzf /tmp/dsh-release/collection/*.tgz | head -40
```

The member's tarball should have `lib/index.js`, `lib/client.js`, `cordis.patch.yml`, `locale/` and `icon.svg`. The collection's should carry `cordis.patch.yml`, `locale/`, `package.json`, the READMEs and LICENSE **plus its own `lib/index.js` and `lib/client.js`** (ADR 0009: the collection embeds the plugin build), and its `dependencies` should read `^0.0.3`, not `workspace:^`.

### 6. Publish the member

`pnpm pack` runs the member's `prepack` (rebuild + bundle contract check); any failure stops the pack. `npm publish <tgz>` then uploads exactly those bytes. Add `--otp=<6-digit code>` if 2FA is on.

If you skipped the dry run, run the `pnpm pack` command from step 5 first; publish what it produced:

```bash
npm publish /tmp/dsh-release/member/*.tgz --registry=https://registry.npmjs.org/
```

### 7. Publish the collection

Build the collection first, then pack and publish that tarball:

```bash
node scripts/build-css.mjs plugins/sessions-insight && npx tsdown && pnpm pack --pack-destination /tmp/dsh-release/collection
```

```bash
npm publish /tmp/dsh-release/collection/*.tgz --registry=https://registry.npmjs.org/
```

The release workflow asserts that both manifests carry the same version before it publishes anything. Keep the same check in the manual path:

```bash
node -e "const v=['./package.json','./plugins/sessions-insight/package.json'].map((p)=>require(p).version); if (v[0]!==v[1]) { console.error('version mismatch', v); process.exit(1) } console.log('shared version', v[0])"
```

### 8. Verify

```bash
npm view @cyrusdoyle/dsh-sessions-insight version --registry=https://registry.npmjs.org/
```

```bash
npm view @cyrusdoyle/dsh-plugins dependencies --registry=https://registry.npmjs.org/
```

Both `version` values must be the same number, and the collection's `dependencies` must pin that number. After installing, the plugin's `/health` reports the version of the package that is actually in effect — the same number for both install methods.

### 9. Push

```bash
git push && git push --tags
```

### 10. Wait for the mirror, then install

npmmirror usually syncs within minutes. To sync right away, open <https://npmmirror.com/package/@cyrusdoyle/dsh-plugins> and press "Sync"; do the same for the member.

```bash
dsh plugin --profile desktop add @cyrusdoyle/dsh-plugins
```

Fully quit and reopen DeepSeek Harness. The plugin manager should list "Cyrus Plugins" and the sidebar should show "Sessions Insight".

## Versioning rules

- **One version for both packages** (ADR 0010): the member and the collection are bumped to the same number in the same release, and the member is published first. Do not publish a collection-only patch: the two install channels would report different versions through `/health` and the update check.
- The version is inlined at build time from the **effective** package's `package.json`; `/health` and the version check compare that same package on the registry. In `0.x`, `^` is narrow (`^0.0.3` matches only `0.0.3`), which is another reason both packages move together.
- A version number can be published once; even after deletion it cannot be reused. If a release is wrong, bump the patch and publish both packages again.
- Within 72 hours of publishing you can `npm unpublish <pkg>@<version>`; after that, only `npm deprecate <pkg>@<version> "<reason>"`.

## Pick one install method

The collection and the member each carry a `cordis.patch.yml`, and both insert the row `id: sessions-insight` into the loader tree:

- install the collection `@cyrusdoyle/dsh-plugins` to get every plugin at once;
- install the member `@cyrusdoyle/dsh-sessions-insight` to get just that one.

**If both are in `dsh.profile.bundles`, DSH fails at boot with `duplicate loader entry id: sessions-insight`.** Remove one before switching:

```bash
dsh plugin --profile desktop remove @cyrusdoyle/dsh-sessions-insight
```

## Adding a plugin to the collection

1. Create the package under `plugins/<new-plugin>/` with `dsh.bundle.patch`, `exports["./client"]` and `publishConfig.access: public` in its `package.json`, plus its own `cordis.patch.yml` (used for a standalone install).
2. Add `"<new package name>": "workspace:^"` to `dependencies` in the root `package.json`.
3. Add a `- id: <unique id>` / `name: "<new package name>"` row under `insert` in the root `cordis.patch.yml`, using the same id as the plugin's own patch.
4. Update the plugin table in both root READMEs.
5. Release with the steps above: bump every member and the collection to the same version, publish the members first, then the collection.

## Common errors

| Error                                                  | Cause                                                   | Fix                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `403 Forbidden` / `You do not have permission`         | The account does not own the `@cyrus` scope             | Create the organization, or switch to your own scope                        |
| `402 Payment Required`                                 | Scoped packages are private by default                  | Make sure `publishConfig.access` is `public`, or pass `--access public`     |
| `You cannot publish over the previously published…`    | That version was already published                      | Bump and publish again                                                      |
| `ERR_PNPM_GIT_UNCLEAN`                                 | Uncommitted changes                                     | Commit first; pass `--no-git-checks` only if you really mean it             |
| `ERR_PNPM_GIT_BRANCH`                                  | Not on `main`                                           | Switch to `main`, or pass `--publish-branch <branch>`                       |
| `Cannot resolve workspace protocol…`                   | `pnpm install` never ran at the root                    | Run `pnpm install` first                                                    |
| DSH boot fails with `duplicate loader entry id`        | Collection and member are both in `dsh.profile.bundles` | Remove one; see "Pick one install method" above                             |
| The plugin manager says the package declares no bundle | The installed package is not the one with `dsh.bundle`  | Install `@cyrusdoyle/dsh-plugins` or `@cyrusdoyle/dsh-sessions-insight`, not a git URL |
