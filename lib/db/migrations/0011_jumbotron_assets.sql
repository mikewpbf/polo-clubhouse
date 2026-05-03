-- Task #117: Jumbotron / TV scoreboard assets.
-- Tournaments get an optional event logo (rendered inside the center seal
-- circle on the jumbotron) and a configurable jumbotron center background
-- color used when no logo is uploaded (defaults to dark navy to match the
-- championship-seal aesthetic). Teams get an optional jersey image used by
-- the jumbotron's per-side stack (logo → jersey → score).
ALTER TABLE "tournaments"
  ADD COLUMN IF NOT EXISTS "logo_url" text,
  ADD COLUMN IF NOT EXISTS "jumbotron_bg_color" varchar(7);

ALTER TABLE "teams"
  ADD COLUMN IF NOT EXISTS "jersey_image_url" text;
