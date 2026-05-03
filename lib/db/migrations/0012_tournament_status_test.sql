-- Add "test" to the tournament_status enum so tournaments can be marked
-- as admin-only test fixtures (hidden from spectators / public feeds).
-- Postgres requires ALTER TYPE ... ADD VALUE to be in its own statement
-- and outside a transaction; drizzle-kit's migrator runs each statement
-- separately so this is safe.
ALTER TYPE "public"."tournament_status" ADD VALUE IF NOT EXISTS 'test' BEFORE 'published';
