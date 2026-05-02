import { db } from "@workspace/db";
import { matchesTable } from "@workspace/db/schema";
import { isNull } from "drizzle-orm";
import { logger } from "./logger";
import { generateAndStoreMatchPreview } from "./serverMatchPreview";

// Scheduled backfill job that fills in `previewImageUrl` for any match
// row where it's still NULL. Runs on api-server startup and then on a
// fixed interval — pairs with the server-side invalidation hooks in
// teams.ts / tournaments.ts / fields.ts which null the column whenever
// upstream metadata changes.
//
// Why it exists: prior to this, the only auto-backfill path was the
// admin-mount trigger in `polo-manager`'s AdminLayout, which relies on
// an admin actually opening any admin page. This job removes that
// dependency entirely — no admin clicks required for an existing or
// newly-created match to acquire a preview.
//
// Sized to be polite to R2: small batch per pass, sequential uploads,
// long sleep between passes. The high-fidelity client snap (run by
// AdminLayout / Match Graphics) will overwrite this fallback PNG at
// the same storage key whenever an admin browses, so quality
// degradation here is bounded by "until the next admin visit".

// Run every 10 minutes. Frequent enough to make new matches visible
// in unfurls quickly, infrequent enough that we never spam R2 even
// if the missing-list grows large.
const BACKFILL_INTERVAL_MS = 10 * 60 * 1000;

// Cap each pass to a small batch — keeps individual passes short and
// bounds storage write rate. The next interval will pick up whatever
// remains.
const BACKFILL_BATCH = 25;

// Module-level guard against overlapping runs if a single pass takes
// longer than the interval (e.g. R2 latency spike). The interval timer
// would otherwise queue up a second invocation while the first is
// still in flight, doubling concurrent renders.
let running = false;

export async function runMatchPreviewBackfillOnce(
  batchSize: number = BACKFILL_BATCH,
): Promise<{ scanned: number; succeeded: number; failed: number }> {
  if (running) return { scanned: 0, succeeded: 0, failed: 0 };
  running = true;
  try {
    const rows = await db.select({ id: matchesTable.id })
      .from(matchesTable)
      .where(isNull(matchesTable.previewImageUrl))
      .limit(batchSize);

    let succeeded = 0;
    let failed = 0;
    // Sequential — each render is fast (~50–150ms) but uploading in
    // parallel could hammer R2 / saturate egress. Keep simple.
    for (const row of rows) {
      const ok = await generateAndStoreMatchPreview(row.id);
      if (ok) succeeded++; else failed++;
    }
    return { scanned: rows.length, succeeded, failed };
  } finally {
    running = false;
  }
}

export function startMatchPreviewBackfill(): NodeJS.Timeout {
  const tick = () => {
    runMatchPreviewBackfillOnce()
      .then((result) => {
        if (result.scanned > 0) {
          logger.info(result, "Match preview backfill pass completed");
        }
      })
      .catch((err) => {
        logger.error({ err }, "Match preview backfill pass failed");
      });
  };

  // First pass on startup (idle-scheduled via setTimeout so it doesn't
  // contend with seed-admin / other startup work).
  setTimeout(tick, 5_000);
  const handle = setInterval(tick, BACKFILL_INTERVAL_MS);
  if (typeof handle.unref === "function") handle.unref();
  return handle;
}

// Test seam — vitest doesn't tear down module state between tests, so
// expose a reset for the in-flight guard. Not exported to JS callers
// outside tests by convention.
export function __resetBackfillRunningForTests(): void {
  running = false;
}
