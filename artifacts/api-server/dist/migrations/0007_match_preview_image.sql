-- Add columns for the auto-snapped link-preview image attached to each match.
-- Used for Open Graph cards in iMessage / WhatsApp / Slack / Discord etc.
ALTER TABLE "matches"
  ADD COLUMN IF NOT EXISTS "preview_image_url" text,
  ADD COLUMN IF NOT EXISTS "preview_image_updated_at" timestamp with time zone;
