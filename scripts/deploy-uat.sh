#!/usr/bin/env bash
# Deploy to UAT (rolemaster-uat.pages.dev).
#
# Cloudflare Pages doesn't accept --config to point at a different wrangler.toml,
# so this script atomically swaps wrangler.toml <-> wrangler.uat.toml around the
# deploy and ALWAYS restores, even if the deploy fails.
#
# Run from repo root:  bash scripts/deploy-uat.sh

set -u
cd "$(dirname "$0")/.."

if [ ! -f wrangler.toml ] || [ ! -f wrangler.uat.toml ]; then
  echo "ERROR: need both wrangler.toml (prod) and wrangler.uat.toml in repo root." >&2
  exit 1
fi

if [ -f wrangler.prod.toml.bak ]; then
  echo "ERROR: wrangler.prod.toml.bak exists — previous deploy crashed mid-swap." >&2
  exit 1
fi

restore() {
  if [ -f wrangler.prod.toml.bak ]; then
    mv -f wrangler.toml wrangler.uat.toml 2>/dev/null || true
    mv -f wrangler.prod.toml.bak wrangler.toml
  fi
}
trap restore EXIT INT TERM

mv wrangler.toml wrangler.prod.toml.bak
cp wrangler.uat.toml wrangler.toml

echo ">>> Building SPA…"
(cd app && npm run build)
RC=$?
[ $RC -ne 0 ] && exit $RC

echo ">>> Deploying to rolemaster-uat…"
npx wrangler pages deploy dist \
  --project-name=rolemaster-uat \
  --branch=main \
  --commit-dirty=true
RC=$?

exit $RC
