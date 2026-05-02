-- Change broadcast_resolution column default from '1080p' to '4k'.
-- Existing rows are not modified — only new matches will get the new default.
ALTER TABLE "matches" ALTER COLUMN "broadcast_resolution" SET DEFAULT '4k';
