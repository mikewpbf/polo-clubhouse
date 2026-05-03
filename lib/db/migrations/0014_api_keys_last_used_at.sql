-- Track when each native-app API key was last used so the admin UI can
-- show "last seen" for each client and operators can spot dormant keys
-- ripe for revocation. Nullable: existing keys haven't been seen yet.
ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "last_used_at" timestamp with time zone;
