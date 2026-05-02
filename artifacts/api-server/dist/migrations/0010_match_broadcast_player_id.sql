-- Track which player is currently displayed by the player-stats lower-third
-- broadcast graphic. Soft pointer: ON DELETE SET NULL so removing a player
-- never cascades into deleting the match.
ALTER TABLE "matches"
  ADD COLUMN IF NOT EXISTS "broadcast_player_id" uuid REFERENCES "players"("id") ON DELETE SET NULL;
