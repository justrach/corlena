#!/usr/bin/env bash
set -euo pipefail

# Corlena release helper
# Publishes @corlena/wasm first, then corlena.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
PKG_WASM_DIR="$ROOT_DIR/packages/wasm"
PKG_CORLENA_DIR="$ROOT_DIR/packages/corlena"

DRY=""
if [[ ${1:-} == "--dry-run" ]]; then
  DRY="--dry-run"
  echo "[release] Dry-run mode: no packages will actually be published."
fi

echo "[release] Checking npm auth..."
if ! npm whoami >/dev/null 2>&1; then
  echo "[release] You are not logged in to npm. Run 'npm login' and retry." >&2
  exit 1
fi

echo "[release] Reading package versions..."
WASM_NAME=$(node -p "require('$PKG_WASM_DIR/package.json').name")
WASM_VERSION=$(node -p "require('$PKG_WASM_DIR/package.json').version")
CORE_NAME=$(node -p "require('$PKG_CORLENA_DIR/package.json').name")
CORE_VERSION=$(node -p "require('$PKG_CORLENA_DIR/package.json').version")
CORE_DEP_REQ=$(node -p "require('$PKG_CORLENA_DIR/package.json').dependencies['@corlena/wasm'] || ''")

echo "[release] $WASM_NAME@$WASM_VERSION"
echo "[release] $CORE_NAME@$CORE_VERSION (depends on @corlena/wasm: $CORE_DEP_REQ)"

if [[ -z "$CORE_DEP_REQ" || "$CORE_DEP_REQ" == file:* ]]; then
  echo "[release] ERROR: corlena depends on @corlena/wasm via a local file path. Set a semver range (e.g. ^$WASM_VERSION) before publishing." >&2
  exit 1
fi

echo "[release] Building wasm package..."
pushd "$PKG_WASM_DIR" >/dev/null
wasm-pack build --target web --release -d ./pkg
# Remove pkg/.gitignore so npm doesn't accidentally exclude the built files
rm -f ./pkg/.gitignore || true
popd >/dev/null

echo "[release] Verifying built files for $WASM_NAME@$WASM_VERSION ..."
pushd "$PKG_WASM_DIR" >/dev/null
if [[ ! -f pkg/corlena_wasm_bg.wasm || ! -f pkg/corlena_wasm.js ]]; then
  echo "[release] ERROR: Built files missing in pkg/. Ensure wasm-pack build succeeded." >&2
  exit 1
fi
echo "[release] Built files present: pkg/corlena_wasm_bg.wasm and pkg/corlena_wasm.js"
echo "[release] Publishing $WASM_NAME@$WASM_VERSION ..."
npm publish --access public $DRY || {
  RC=$?
  echo "[release] Publish failed for $WASM_NAME (exit $RC). If error is 'Scope not found', ensure the @corlena org exists and you have access, or rename to an unscoped package (e.g. 'corlena-wasm')." >&2
  exit $RC
}
popd >/dev/null

echo "[release] Publishing $CORE_NAME@$CORE_VERSION ..."
pushd "$PKG_CORLENA_DIR" >/dev/null
npm publish --access public $DRY
popd >/dev/null

echo "[release] Done. Validate by installing in a fresh project:"
echo "  npm i corlena @corlena/wasm"
