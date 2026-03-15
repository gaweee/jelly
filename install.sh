#!/usr/bin/env sh
set -eu

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

HA_SSH_TARGET="${HA_SSH_TARGET:-root@192.168.64.2}"
HA_WWW_PATH="${HA_WWW_PATH:-/config/www/jelly}"

npm run build >/dev/null

tar -czf - \
  dist \
  src \
  assets \
  README.md \
  INSTALL.md \
  JELLY_SPEC.md \
  package.json \
  hacs.json \
| ssh "$HA_SSH_TARGET" "mkdir -p '$HA_WWW_PATH' && tar -xzf - -C '$HA_WWW_PATH'"

echo "Deployed jelly to ${HA_SSH_TARGET}:${HA_WWW_PATH}"
