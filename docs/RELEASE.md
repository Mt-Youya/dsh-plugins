English | [简体中文](./RELEASE.md)

# Publishing to npm

This repository publishes two packages and nothing else:

| Package                      | Directory                 | What it is                                                                         |
| ---------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| `@cyrus/dsh-context-insight` | `plugins/context-insight` | The Context Lens plugin itself (a member package)                                  |
| `@cyrus/dsh-plugins`         | repository root           | The collection bundle: only `cordis.patch.yml` and `locale/`, depending on members |

`packages/*` are inlined into the member's `lib/` at build time and are **not published**. They are not marked `private` today, so **never run `pnpm -r publish`**: it would publish them too.

## There is one order

**Publish the member first, then the collection.** The collection depends on `workspace:^`, which publishing rewrites to the member's current version (for example `^0.0.3`). If the member is not on the registry yet, installing the collection fails to resolve.

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

Run everything from the **repository root**. The example bumps the member from `0.0.2` to `0.0.3` and the collection from `0.0.1` to `0.0.2`.

### 1. Clean tree, on main

`pnpm publish` refuses by default when there are uncommitted changes or you are not on `main`.

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
npx tsc --noEmit && npx tsc --noEmit -p tsconfig.client.json && npx vitest run && npx tsdown && node scripts/check-bundle.mjs plugins/context-insight
```

### 3. Bump the versions

Bump the member when it changed; **when the member is bumped, bump the collection too** (see "Versioning rules" below).

```bash
pnpm --filter @cyrus/dsh-context-insight version patch --no-git-tag-version
```

```bash
pnpm version patch --no-git-tag-version
```

Use `minor` / `major` instead of `patch` for the other positions. The version the plugin's `/health` reports is injected from `package.json` at build time, so nothing else needs editing.

### 4. Commit and tag

```bash
git commit -am "release: dsh-context-insight 0.0.3, dsh-plugins 0.0.2"
```

```bash
git tag dsh-context-insight@0.0.3 && git tag dsh-plugins@0.0.2
```

### 5. Dry run

Pack without uploading and look at what the tarballs contain:

```bash
pnpm --filter @cyrus/dsh-context-insight publish --dry-run
```

```bash
pnpm publish --dry-run
```

The member's tarball should have `lib/index.js`, `lib/client.js`, `cordis.patch.yml`, `locale/` and `icon.svg`. The collection's should only have `cordis.patch.yml`, `locale/`, `package.json`, the READMEs and LICENSE, and its `dependencies` should read `^0.0.3`, not `workspace:^`.

### 6. Publish the member

`prepublishOnly` runs typecheck, tests and the build again, and `prepack` checks the loading contract; any failure stops the upload. Add `--otp=<6-digit code>` if 2FA is on.

```bash
pnpm --filter @cyrus/dsh-context-insight publish --registry=https://registry.npmjs.org/
```

### 7. Publish the collection

```bash
pnpm publish --registry=https://registry.npmjs.org/
```

### 8. Verify

```bash
npm view @cyrus/dsh-context-insight version --registry=https://registry.npmjs.org/
```

```bash
npm view @cyrus/dsh-plugins dependencies --registry=https://registry.npmjs.org/
```

### 9. Push

```bash
git push && git push --tags
```

### 10. Wait for the mirror, then install

npmmirror usually syncs within minutes. To sync right away, open <https://npmmirror.com/package/@cyrus/dsh-plugins> and press "Sync"; do the same for the member.

```bash
dsh plugin --profile desktop add @cyrus/dsh-plugins
```

Fully quit and reopen DeepSeek Harness. The plugin manager should list "Cyrus Plugins" and the sidebar should show "Context Lens".

## Versioning rules

- In `0.x`, `^` is narrow: `^0.0.3` matches only `0.0.3`, and `^0.1.3` matches `>=0.1.3 <0.2.0`. So while in `0.0.x`, **every member release needs a collection release too**, or installing the collection still pulls the old member.
- A version number can be published once; even after deletion it cannot be reused. If a release is wrong, bump the patch and publish again.
- Within 72 hours of publishing you can `npm unpublish <pkg>@<version>`; after that, only `npm deprecate <pkg>@<version> "<reason>"`.

## Pick one install method

The collection and the member each carry a `cordis.patch.yml`, and both insert the row `id: context-insight` into the loader tree:

- install the collection `@cyrus/dsh-plugins` to get every plugin at once;
- install the member `@cyrus/dsh-context-insight` to get just that one.

**If both are in `dsh.profile.bundles`, DSH fails at boot with `duplicate loader entry id: context-insight`.** Remove one before switching:

```bash
dsh plugin --profile desktop remove @cyrus/dsh-context-insight
```

## Adding a plugin to the collection

1. Create the package under `plugins/<new-plugin>/` with `dsh.bundle.patch`, `exports["./client"]` and `publishConfig.access: public` in its `package.json`, plus its own `cordis.patch.yml` (used for a standalone install).
2. Add `"<new package name>": "workspace:^"` to `dependencies` in the root `package.json`.
3. Add a `- id: <unique id>` / `name: "<new package name>"` row under `insert` in the root `cordis.patch.yml`, using the same id as the plugin's own patch.
4. Update the plugin table in both root READMEs.
5. Release with the steps above: the new plugin first, then bump and publish the collection.

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
| The plugin manager says the package declares no bundle | The installed package is not the one with `dsh.bundle`  | Install `@cyrus/dsh-plugins` or `@cyrus/dsh-context-insight`, not a git URL |
