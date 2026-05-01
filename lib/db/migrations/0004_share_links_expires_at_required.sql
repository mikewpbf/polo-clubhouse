-- Enforce the contract: every match_share_links row must have an expiry.
-- Backfill any pre-existing null expiry to "created_at + 6 hours" (the default
-- spec rule when neither scheduled_end nor scheduled_start is known).
UPDATE "match_share_links"
   SET "expires_at" = COALESCE("expires_at", "created_at" + INTERVAL '6 hours', now() + INTERVAL '6 hours')
 WHERE "expires_at" IS NULL;
--> statement-breakpoint

ALTER TABLE "match_share_links"
  ALTER COLUMN "expires_at" SET NOT NULL;
