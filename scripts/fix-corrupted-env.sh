#!/usr/bin/env bash
# Repair Vercel prod env vars that were written with literal trailing \n.
# Usage: bash scripts/fix-corrupted-env.sh
set -euo pipefail

ENV_FILE="${1:-/tmp/dfx2.env}"

# Names with literal \n suffix, excluding Vercel-system vars.
mapfile -t NAMES < <(grep -E '\\n"$' "$ENV_FILE" | awk -F= '{print $1}' | grep -vE '^VERCEL_(ENV|TARGET_ENV)$')

echo "Repairing ${#NAMES[@]} vars..."
for name in "${NAMES[@]}"; do
  # Extract quoted value, strip surrounding quotes, strip trailing \n.
  raw=$(grep -E "^${name}=" "$ENV_FILE" | head -1 | sed -E "s/^${name}=//")
  # raw is like: "value\n"
  # strip leading/trailing quote
  stripped="${raw#\"}"
  stripped="${stripped%\"}"
  # strip trailing literal \n
  clean="${stripped%\\n}"

  if [[ "$clean" == "$stripped" ]]; then
    echo "  [$name] no \\n found, skip"
    continue
  fi

  echo "  [$name] fixing (len $(echo -n "$stripped" | wc -c) -> $(echo -n "$clean" | wc -c))"
  npx vercel env rm "$name" production -y >/dev/null 2>&1
  printf "%s" "$clean" | npx vercel env add "$name" production >/dev/null 2>&1
done

echo "Done. Run: vercel env pull /tmp/dfx3.env --environment production --yes"
