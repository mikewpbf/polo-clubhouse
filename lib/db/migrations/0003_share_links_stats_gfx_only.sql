-- Tighten match_share_links: stats/gfx only (drop "score"), enforce a single
-- active link per (match_id, page_type) via a partial unique index on
-- non-revoked rows. We keep the columns "label" and "active" for UI convenience
-- but treat (revoked_at IS NULL) as the canonical "active" predicate.

-- Soft-revoke any pre-existing "score" links so the enum narrowing is safe.
UPDATE "match_share_links"
   SET "active" = false, "revoked_at" = COALESCE("revoked_at", now())
 WHERE "page_type"::text = 'score';
--> statement-breakpoint

-- Recreate the enum without "score". Postgres cannot drop a value in place,
-- so we rename, create the narrower enum, and swap the column type.
DO $$ BEGIN
  PERFORM 1 FROM pg_type WHERE typname = 'share_page_type';
  IF FOUND THEN
    ALTER TYPE "public"."share_page_type" RENAME TO "share_page_type_old";
  END IF;
EXCEPTION WHEN others THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."share_page_type" AS ENUM ('stats', 'gfx');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Convert the column to the new enum. Any pre-existing 'score' rows are
-- already soft-revoked above; re-map them to 'stats' so the cast succeeds,
-- then preserve their revoked status.
DO $$ BEGIN
  ALTER TABLE "match_share_links"
    ALTER COLUMN "page_type" TYPE "public"."share_page_type"
    USING (
      CASE "page_type"::text
        WHEN 'score' THEN 'stats'::"public"."share_page_type"
        ELSE "page_type"::text::"public"."share_page_type"
      END
    );
EXCEPTION WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint

DROP TYPE IF EXISTS "public"."share_page_type_old";
--> statement-breakpoint

-- Dedupe any pre-existing duplicate active links per (match, page_type)
-- before adding the unique partial index — keep newest, soft-revoke the rest.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "match_id", "page_type" ORDER BY "created_at" DESC
  ) AS rn
  FROM "match_share_links"
  WHERE "revoked_at" IS NULL
)
UPDATE "match_share_links" m
   SET "active" = false, "revoked_at" = now()
  FROM ranked r
 WHERE m."id" = r."id" AND r.rn > 1;
--> statement-breakpoint

-- One active link per (match, page_type). Revoked rows are excluded from the
-- uniqueness constraint so old links remain on file for audit.
CREATE UNIQUE INDEX IF NOT EXISTS "match_share_links_active_match_page_uidx"
  ON "match_share_links" ("match_id", "page_type")
  WHERE "revoked_at" IS NULL;
