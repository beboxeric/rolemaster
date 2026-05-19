#!/usr/bin/env bash
# Deploy to PRODUCTION (rolemaster.pages.dev).
#
# Refuses to run unless the working tree is clean and HEAD is on main.
# Pass --force to override (you'll be warned).
#
# Run from repo root:  bash scripts/deploy-prod.sh

set -u
cd "$(dirname "$0")/.."

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

if [ ! -f wrangler.toml ]; then
  echo "ERROR: wrangler.toml missing from repo root." >&2
  exit 1
fi
if ! grep -q '^name = "rolemaster"' wrangler.toml; then
  echo "ERROR: wrangler.toml is not the prod config (name != \"rolemaster\")." >&2
  echo "       A previous UAT deploy may have crashed mid-swap. Check wrangler.prod.toml.bak." >&2
  exit 1
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  if [ $FORCE -eq 0 ]; then
    echo "ERROR: working tree is dirty. Commit/stash first, or pass --force." >&2
    git status --short >&2
    exit 1
  else
    echo "WARNING: --force used, deploying dirty working tree."
  fi
fi
CUR_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ "$CUR_BRANCH" != "main" ] && [ $FORCE -eq 0 ]; then
  echo "ERROR: not on main (currently '$CUR_BRANCH'). Switch to main, or pass --force." >&2
  exit 1
fi

HEAD_SHA=$(git rev-parse HEAD)
HEAD_SHORT=$(git rev-parse --short HEAD)

echo ">>> Building SPA…"
(cd app && npm run build) || exit $?

echo ">>> Deploying $HEAD_SHORT to rolemaster (production)…"
npx wrangler pages deploy dist \
  --project-name=rolemaster \
  --branch=main \
  --commit-dirty=true
RC=$?

if [ $RC -eq 0 ]; then
  git tag -f prod-deployed "$HEAD_SHA" >/dev/null 2>&1 && \
    echo ">>> Moved prod-deployed tag to $HEAD_SHA"
fi

exit $RC
