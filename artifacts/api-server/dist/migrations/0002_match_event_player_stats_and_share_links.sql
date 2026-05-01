-- Add new event types
ALTER TYPE "public"."match_event_type" ADD VALUE IF NOT EXISTS 'penalty_in';--> statement-breakpoint
ALTER TYPE "public"."match_event_type" ADD VALUE IF NOT EXISTS 'penalty_out';--> statement-breakpoint
ALTER TYPE "public"."match_event_type" ADD VALUE IF NOT EXISTS 'throw_in_won';--> statement-breakpoint
ALTER TYPE "public"."match_event_type" ADD VALUE IF NOT EXISTS 'foul_committed';--> statement-breakpoint
ALTER TYPE "public"."match_event_type" ADD VALUE IF NOT EXISTS 'fouls_won';--> statement-breakpoint

-- Add per-player stat sub-attributes
ALTER TABLE "match_events"
  ADD COLUMN IF NOT EXISTS "distance" varchar(32),
  ADD COLUMN IF NOT EXISTS "severity" varchar(32);
--> statement-breakpoint

-- Share-page type enum
DO $$ BEGIN
  CREATE TYPE "public"."share_page_type" AS ENUM('score', 'stats', 'gfx');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- match_share_links table
CREATE TABLE IF NOT EXISTS "match_share_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL,
  "page_type" "share_page_type" NOT NULL,
  "token" varchar(64) NOT NULL,
  "label" varchar(120),
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "active" boolean DEFAULT true NOT NULL,
  CONSTRAINT "match_share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "match_share_links" ADD CONSTRAINT "match_share_links_match_id_matches_id_fk"
    FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "match_share_links" ADD CONSTRAINT "match_share_links_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "match_share_links_match_id_idx" ON "match_share_links" ("match_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_share_links_token_idx" ON "match_share_links" ("token");
