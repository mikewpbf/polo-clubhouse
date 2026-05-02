#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Post-deploy smoke check for /match and /share routing (Task #105).
# Skips with a notice if LIVE_DEPLOYMENT_URL or LIVE_MATCH_ID isn't set
# so forks/test repls aren't blocked by missing infra.
if [ -n "$LIVE_DEPLOYMENT_URL" ] && [ -n "$LIVE_MATCH_ID" ]; then
  echo ""
  echo "=== Verifying live link-preview routing on $LIVE_DEPLOYMENT_URL ==="
  pnpm --filter @workspace/scripts run verify-link-previews
else
  echo ""
  echo "[notice] LIVE_DEPLOYMENT_URL / LIVE_MATCH_ID not set — skipping post-merge link-preview verification."
fi
