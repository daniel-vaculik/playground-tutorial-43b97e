#!/usr/bin/env bash
#
# setup.sh — prepare a fresh checkout of this tutorial for development.
#
#   1. installs npm dependencies (if missing)
#   2. fetches the @parity/product-sdk skills into .claude/skills/ so AI
#      coding assistants (Claude Code, Cursor, Windsurf, Copilot, Gemini)
#      have Polkadot Product SDK guidance on hand while you build.
#
# The fetched @parity/product-sdk skills are DIRECTORIES under .claude/skills/ and
# are NOT committed (gitignored, fetched fresh so they never go stale). The
# tutorial's own hand-written guides — `00-overview.md` and `level-N-*.md` — live
# separately in docs/levels/ and ARE committed, so this script never touches them.
# It only ever creates/replaces the fetched subdirectories. Safe to re-run.
# Pass --refresh to re-pull the skills even if they're already present.
#
#   ./setup.sh            # install deps + fetch skills if missing
#   ./setup.sh --refresh  # also re-pull the latest skills
#
# Overridable via env: PRODUCT_SDK_REPO, PRODUCT_SDK_REF (default: main).

set -euo pipefail
cd "$(dirname "$0")"

SKILLS_REPO="${PRODUCT_SDK_REPO:-https://github.com/paritytech/product-sdk.git}"
SKILLS_REF="${PRODUCT_SDK_REF:-main}"
SKILLS_SUBDIR="product-sdk/skills"
SKILLS_DEST=".claude/skills"

# --- 1. dependencies ---------------------------------------------------------
if [ ! -d node_modules ]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "    npm not found — install Node.js (>= 20) and re-run." >&2
    exit 1
  fi
  echo "==> Installing npm dependencies..."
  npm install --no-audit --no-fund
else
  echo "==> node_modules present; skipping npm install (delete it to reinstall)."
fi

# --- 2. @parity/product-sdk skills ------------------------------------------
# "Already populated" = at least one fetched skill DIRECTORY is present.
if [ -n "$(find "$SKILLS_DEST" -mindepth 1 -maxdepth 1 -type d 2>/dev/null || true)" ] \
   && [ "${1:-}" != "--refresh" ]; then
  echo "==> product-sdk skills already present in ${SKILLS_DEST}/; pass --refresh to re-pull."
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  echo "    git not found — skipping SDK skills fetch (the tutorial's own level guides in docs/levels/ are unaffected)." >&2
  exit 0
fi

echo "==> Fetching @parity/product-sdk skills into ${SKILLS_DEST}/ ..."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if ! git clone --quiet --depth 1 --branch "$SKILLS_REF" \
      --filter=blob:none --sparse "$SKILLS_REPO" "$tmp" 2>/dev/null; then
  echo "    Could not clone ${SKILLS_REPO}@${SKILLS_REF} (offline?) — skipping." >&2
  exit 0
fi
git -C "$tmp" sparse-checkout set "$SKILLS_SUBDIR" >/dev/null 2>&1

if [ ! -d "$tmp/$SKILLS_SUBDIR" ]; then
  echo "    No ${SKILLS_SUBDIR} found in the repo — skipping." >&2
  exit 0
fi

mkdir -p "$SKILLS_DEST"
# Replace ONLY the fetched skill subdirectories (everything in here is fetched;
# the tutorial's own level guides live in docs/levels/, not here).
find "$SKILLS_DEST" -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
cp -R "$tmp/$SKILLS_SUBDIR/." "$SKILLS_DEST/"

echo "==> Done. Fetched product-sdk skills now in ${SKILLS_DEST}/:"
find "$SKILLS_DEST" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort | sed 's/^/      - /'
echo "    (the tutorial's own level guides live in docs/levels/, separate from these)"
