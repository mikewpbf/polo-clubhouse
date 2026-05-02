DO $$ BEGIN
  CREATE TYPE "public"."scoring_location" AS ENUM('studio', 'field');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "matches"
  ADD COLUMN IF NOT EXISTS "stream_started_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "scoring_location" "scoring_location" NOT NULL DEFAULT 'studio',
  ADD COLUMN IF NOT EXISTS "broadcast_offset_seconds" numeric(6, 2) NOT NULL DEFAULT 0;
