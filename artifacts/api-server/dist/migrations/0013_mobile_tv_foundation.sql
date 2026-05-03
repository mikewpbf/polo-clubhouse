-- Task #121: Mobile & TV-Ready Backend Foundation.
-- Adds tables and columns required so future iOS / Android / Apple TV clients
-- can plug into the existing API without further refactor work. All changes
-- are strictly additive — no existing column or table is renamed or removed.

-- 1. user_sessions: backs refresh tokens and "log out one device" UI.
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "refresh_token_hash" varchar(128) NOT NULL UNIQUE,
  "device_label" varchar(255),
  "device_id" varchar(255),
  "platform" varchar(32),
  "client_kind" varchar(32),
  "user_agent" text,
  "ip" varchar(64),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_used_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "user_sessions_user_idx" ON "user_sessions" ("user_id");

-- 2. push_subscriptions: extend with platform/device metadata required by
--    the future native push pipeline. We keep the existing table name; a view
--    alias `device_tokens` is exposed below for the mobile/TV contract.
ALTER TABLE "push_subscriptions"
  ADD COLUMN IF NOT EXISTS "token" varchar(500),
  ADD COLUMN IF NOT EXISTS "platform" varchar(16),
  ADD COLUMN IF NOT EXISTS "device_id" varchar(255),
  ADD COLUMN IF NOT EXISTS "app_version" varchar(64),
  ADD COLUMN IF NOT EXISTS "last_seen_at" timestamptz NOT NULL DEFAULT now();

-- Backfill new `token` from legacy `fcm_token` so existing rows aren't lost.
UPDATE "push_subscriptions" SET "token" = "fcm_token" WHERE "token" IS NULL AND "fcm_token" IS NOT NULL;

-- Unique on (user_id, token) — but only when token is set, so legacy NULL rows
-- (no token captured) don't conflict.
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_user_token_uniq"
  ON "push_subscriptions" ("user_id", "token") WHERE "token" IS NOT NULL;

-- View alias for the mobile/TV contract — read-only convenience so client
-- teams can query `device_tokens` without leaking the legacy name.
DROP VIEW IF EXISTS "device_tokens";
CREATE VIEW "device_tokens" AS
  SELECT "id", "user_id", "token", "platform", "device_id",
         "app_version", "last_seen_at", "created_at"
  FROM "push_subscriptions";

-- 3. api_keys: per-client-app authentication for future native builds.
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_name" varchar(255) NOT NULL,
  "client_kind" varchar(32) NOT NULL,
  "key_hash" varchar(128) NOT NULL UNIQUE,
  "key_prefix" varchar(16) NOT NULL,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "revoked_at" timestamptz
);
