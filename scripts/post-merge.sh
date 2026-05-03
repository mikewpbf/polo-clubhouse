#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run migrate

# Post-deploy smoke check for /match and /share routing (Task #105).
# Skips with a notice if LIVE_DEPLOYMENT_URL or LIVE_MATCH_ID isn't set
# so forks/test repls aren't blocked by missing infra.
#
# Failures are surfaced loudly in stdout/stderr but DO NOT fail the
# post-merge step. Production routing only takes effect after the user
# clicks Publish, which is a manual step decoupled from merges -- so
# gating post-merge on a successful live check would block every merge
# in between a code change landing and the user republishing.
if [ -n "$LIVE_DEPLOYMENT_URL" ] && [ -n "$LIVE_MATCH_ID" ]; then
  echo ""
  echo "=== Verifying live link-preview routing on $LIVE_DEPLOYMENT_URL ==="
  if pnpm --filter @workspace/scripts run verify-link-previews; then
    echo "[ok] link-preview routing verified on $LIVE_DEPLOYMENT_URL."
  else
    echo ""
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    echo "[WARN] verify-link-previews FAILED on $LIVE_DEPLOYMENT_URL."
    echo ""
    echo "  Most common cause: production hasn't been re-Published since"
    echo "  the last artifact-routing or OG-middleware change. Click"
    echo "  Publish in the Replit workspace to deploy the latest code,"
    echo "  then re-run:"
    echo "    pnpm --filter @workspace/scripts run verify-link-previews"
    echo ""
    echo "  Not blocking post-merge so future merges aren't gated on a"
    echo "  manual Publish step. The failure above is the signal -- act"
    echo "  on it before the next batch of share links goes out."
    echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  fi
else
  echo ""
  echo "[notice] LIVE_DEPLOYMENT_URL / LIVE_MATCH_ID not set — skipping post-merge link-preview verification."
fi
