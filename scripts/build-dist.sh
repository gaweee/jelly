#!/usr/bin/env sh
set -eu

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

node ./scripts/generate-inline-assets.mjs

mkdir -p dist
if [ -f assets/jelly-icon.png ]; then
  cp assets/jelly-icon.png icon.png
fi
npx esbuild src/jelly.js \
  --bundle \
  --format=esm \
  --target=es2020 \
  --minify \
  --outfile=jelly.js

cp jelly.js dist/jelly.js

echo "Built jelly.js and dist/jelly.js"
