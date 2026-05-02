-- Preserve the original uploaded image alongside the cropped JPEG so owners
-- and admins can re-crop without re-uploading the source photo. Both columns
-- are nullable for backwards compatibility with players who only have the
-- legacy cropped URL.
ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "headshot_source_url" text;

ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "broadcast_image_source_url" text;
