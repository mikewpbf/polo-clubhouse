-- Extend share_page_type enum with 'scoreboard' and 'full_control'.
-- 'scoreboard' = read-only public scoreboard link.
-- 'full_control' = full score-entry access via share token (no login required).
-- ADD VALUE IF NOT EXISTS makes these idempotent on already-migrated databases.
ALTER TYPE "public"."share_page_type" ADD VALUE IF NOT EXISTS 'scoreboard';
--> statement-breakpoint
ALTER TYPE "public"."share_page_type" ADD VALUE IF NOT EXISTS 'full_control';
