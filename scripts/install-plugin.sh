#!/usr/bin/env bash
#
# Install the current working tree into a DSH profile, and prove it landed.
#
# pnpm caches a tarball by its file: path, so re-packing the same version under
# the same name is a no-op for `dsh plugin add` — the old bytes stay installed
# and the app keeps serving a stale bundle. This script packs, asks the CLI to
# install, then compares the built client hash with the installed one; when they
# differ it replaces the package directory and reinstalls.
#
# Usage: ./scripts/install-plugin.sh [profile]        (default: desktop)
set -euo pipefail

PROFILE="${1:-desktop}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="$ROOT/plugins/context-insight"
STAGE="$ROOT/dist"
TARGET="$HOME/.dsh/profiles/$PROFILE/node_modules/@cyrus/dsh-context-insight"

[ -d "$HOME/.dsh/profiles/$PROFILE" ] || { echo "no such profile: $PROFILE" >&2; exit 1; }
mkdir -p "$STAGE"

echo "==> packing"
rm -f "$STAGE"/*.tgz
(cd "$PKG" && pnpm pack --pack-destination "$STAGE" >/dev/null)
TGZ="$(ls "$STAGE"/*.tgz | head -1)"
echo "    $TGZ"

echo "==> dsh plugin --profile $PROFILE add"
dsh plugin --profile "$PROFILE" add "$TGZ" >/dev/null 2>&1 || true

built="$(shasum -a 256 "$PKG/lib/client.js" | cut -d' ' -f1)"
installed=""
[ -f "$TARGET/lib/client.js" ] && installed="$(shasum -a 256 "$TARGET/lib/client.js" | cut -d' ' -f1)"

if [ "$built" != "$installed" ]; then
  echo "==> installed copy is stale ($installed); replacing"
  rm -rf "$TARGET"
  mkdir -p "$TARGET"
  tar -xzf "$TGZ" -C "$TARGET" --strip-components=1
  (cd "$HOME/.dsh/profiles/$PROFILE" && pnpm install --force >/dev/null 2>&1) || true
fi

installed="$(shasum -a 256 "$TARGET/lib/client.js" | cut -d' ' -f1)"
version="$(node -p "require('$TARGET/package.json').version")"
if [ "$built" != "$installed" ]; then
  echo "FAILED: installed client.js still differs from the build" >&2
  echo "  built     $built" >&2
  echo "  installed $installed" >&2
  exit 1
fi
echo "ok: $version at $TARGET"
echo "    client.js $installed"
echo "now fully quit and reopen the app (the client bundle is loaded at boot)."
