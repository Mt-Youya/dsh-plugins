#!/usr/bin/env bash
#
# 只构建 + 校验，不改 profile。
#
# 插件由 DSH 的「添加插件」界面安装（输入仓库根目录即可）；安装后 profile 里的
# node_modules/@cyrus/dsh-plugins 指向本仓库，所以改完代码只需要重建产物，然后
# 在界面点「立即重启」（或完全退出重开）。
#
# 用法：./scripts/install-plugin.sh [profile]（默认 desktop）
set -euo pipefail

PROFILE="${1:-desktop}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE_DIR="$HOME/.dsh/profiles/$PROFILE"
NAME="@cyrus/dsh-plugins"

[ -d "$PROFILE_DIR" ] || { echo "没有这个 profile：$PROFILE" >&2; exit 1; }

echo "==> 构建集合包产物（lib/，client id = $NAME）"
(cd "$ROOT" && node scripts/build-css.mjs plugins/sessions-insight >/dev/null && npx tsdown >/dev/null && node scripts/check-bundle.mjs .)

if [ ! -e "$PROFILE_DIR/node_modules/$NAME" ]; then
  echo "尚未安装。请在 DSH 界面「添加插件」输入：$ROOT"
  exit 0
fi

resolved="$(cd "$PROFILE_DIR" && node -e "console.log(require.resolve('$NAME'))")"
expected="$(cd "$ROOT" && node -p "require('node:path').resolve('lib/index.js')")"
if [ "$resolved" != "$expected" ]; then
  echo "失败：profile 解析到的入口不是插件产物" >&2
  echo "  resolved $resolved" >&2
  echo "  expected $expected" >&2
  exit 1
fi

# 用 node 做摘要：shasum 在 Windows/MSYS 上不存在，sha256sum 在 macOS 上不存在。
sha256() { node -p "require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync(process.argv[1])).digest('hex')" "$1"; }
built="$(sha256 "$ROOT/lib/client.js")"
installed="$(sha256 "$PROFILE_DIR/node_modules/$NAME/lib/client.js")"
[ "$built" = "$installed" ] || { echo "失败：profile 里的 client.js 与构建产物不一致" >&2; exit 1; }

echo "ok: 产物已重建，profile 与之同步"
echo "    entry  $resolved"
echo "    client $installed"
echo "在 DSH 界面点「立即重启」，或完全退出重开。"
