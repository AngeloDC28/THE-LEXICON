#!/usr/bin/env bash
# One-time hook installation: point git at the versioned .githooks/ dir
# so the pre-commit hook (and any future hooks) run for every commit
# without each contributor having to copy files into .git/hooks/.
#
# Run from repo root: `bash .githooks/install.sh`
# Idempotent — safe to re-run.

set -e

cd "$(dirname "$0")/.."

git config core.hooksPath .githooks
chmod +x .githooks/pre-commit 2>/dev/null || true

echo "[githooks] core.hooksPath -> .githooks"
echo "[githooks] pre-commit hook will now run \`npm run preflight\` on every commit"
echo "[githooks] to bypass for a single commit:  git commit --no-verify"
