-- Add a nullable broadcast aux image column to players. Used only by
-- broadcast graphics overlays — never returned on public spectator endpoints.
ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "broadcast_image_url" text;
