# Polo Clubhouse

## Overview

Full-stack polo tournament management platform built as a pnpm workspace monorepo. Three user surfaces: Spectator App (/), Admin Clubhouse Portal (/admin), and Team Manager Portal (/my-team). API-first design to serve both the React web app and a future native iOS app.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (19 tables)
- **Auth**: JWT (bcryptjs), Bearer token via Authorization header, sessionStorage persistence
- **Frontend**: React + Vite + Tailwind CSS + React Query
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (API server), Vite (frontend)

## Design System

- **Brand**: "Polo Clubhouse" — logo at /public/logo.png (crossed mallets on green)
- **Fonts**: Syne 700/800 (headings/scores), Instrument Sans 300/400/500 (body/buttons), JetBrains Mono 300/400/500 (clocks/times/stats)
- **Colors (bright greens)**: --bg:#f8faf6, --g900:#1B5E20, --g700:#2E7D32, --g500:#43A047, --g400:#4CAF50, --g300:#66BB6A, --g100:#C8E6C9, --g50:#E8F5E9, --live:#c0392b
- **Rules**: ZERO emojis, 8px border radius on buttons/inputs, 12px on cards, subtle card shadows, no gradient backgrounds
- **Style**: Lineup Polo inspired — clean white cards, subtle shadows, vibrant green accents, rounded corners

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   │   └── src/
│   │       ├── routes/     # auth, clubs, fields, teams, tournaments, matches, out-dates, play-dates, schedule, invites, ai-wizard, players, users (admin autocomplete)
│   │       └── lib/        # auth.ts (JWT middleware), scheduler.ts (round-robin schedule generator)
│   ├── polo-manager/       # React + Vite frontend (spectator, admin, team manager)
│   │   └── src/
│   │       ├── pages/      # spectator/{Home,MatchDetail (incl. admin video-sync strip)}, admin/Tournaments, admin/{MatchControl,ScoreControl,StatsControl,GFXControl}, admin/MatchGraphics, share/ShareControl, my-team/OutDates
│   │       ├── components/ # UI components, MatchClock, LoadingBar, MatchGraphicTemplates, layout components
│   │       └── hooks/      # use-auth (JWT auth context)
│   └── mockup-sandbox/     # Component preview server
├── lib/
│   ├── api-spec/           # OpenAPI 3.1 spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       ├── migrations/     # Versioned SQL migration files (drizzle-kit generate → migrate)
│       └── src/schema/     # 19 tables: clubs, fields, teams, players, horses, users, tournaments, tournament_teams, team_out_dates, play_dates, matches, match_events, admin_club_memberships, team_manager_assignments, spectator_follows, push_subscriptions, user_invites, possession_segments, field_weather_cache
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Database Schema (19 tables)

- **clubs** - Polo clubs with branding (logo, initials, country, region)
- **fields** - Playing fields per club (GPS coords, surface type)
- **teams** - Teams per club (handicap, colors, contact info)
- **users** - All users (email, passwordHash, role: spectator/team_manager/admin/super_admin)
- **tournaments** - Tournament config (format, dates, chukker settings, schedule config)
- **tournament_teams** - Teams enrolled in tournaments (seed, group, max games/day)
- **team_out_dates** - Dates teams can't play
- **play_dates** - Available play dates with field/time slots
- **matches** - Scheduled/live/final matches with real-time clock state + broadcast overlay config (visibility, style, resolution, 4K-only fine tune scale/offsets, last goal scorer) + stream_started_at (UTC anchor for jump-to-video), scoring_location (enum: studio/field), broadcast_offset_seconds (numeric 6,2 — delay for field-side scoring)
- **match_events** - Goal events, clock events, chukker transitions
- **admin_club_memberships** - Club admin roles (owner/manager)
- **team_manager_assignments** - Team manager invites and assignments
- **spectator_follows** - Club follow relationships
- **push_subscriptions** - Push notification subscriptions
- **user_invites** - Invite tokens for admin/team-manager onboarding
- **players** - Top-level player entity (name, handicap, headshot_url, date_of_birth, home_club_id, bio, managed_by_user_id, is_active). Per-season rosters live in team_players (legacy team_id/position columns dropped April 2026).
- **team_players** - Per-season roster join (team_id, player_id, season_year, position) with unique(team_id, player_id, season_year)
- **horses** - Horses per player (player_id FK, name, age, color, sex, owner, breeder)
- **possession_segments** - Possession tracking segments per match (state: home/away/loose, start/end timestamps, duration)
- **field_weather_cache** - Persistent Open-Meteo response cache per field (5 min TTL via `expires_at`); survives API restarts and is shared across instances

## API Routes (all under /api)

- `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET/POST /clubs`, `GET /clubs/:slug`, `PUT /clubs/:clubId/update`, `POST /clubs/:clubId/follow|unfollow`
- `GET/POST /clubs/:clubId/fields`, `PUT/DELETE /fields/:fieldId`
- `GET/POST /clubs/:clubId/teams`, `GET/PUT /teams/:teamId`
- `GET/POST /clubs/:clubId/tournaments`, `GET /tournaments`, `GET/PUT /tournaments/:tournamentId`
- `POST /tournaments/:tournamentId/publish`
- `GET/POST/PUT/DELETE /tournaments/:tournamentId/teams(/:teamId)`
- `GET /tournaments/:tournamentId/standings`
- `GET/POST/PUT/DELETE play-dates and out-dates`
- `POST /tournaments/:tournamentId/schedule/generate|save`
- `GET /matches/live`, `GET /matches/today`, `GET/PUT /matches/:matchId`
- `POST /matches/:matchId/score|clock|status|chukker`
- `GET /matches/:matchId/events`
- `GET /matches/:matchId/broadcast` (public, no auth — returns live overlay state including streamStartedAt, scoringLocation, broadcastOffsetSeconds)
- `PUT /matches/:matchId/broadcast` (admin — update visibility/style/resolution and 4K fine-tune scale & X/Y offsets)
- `PUT /matches/:matchId` accepts `streamStartedAt` (ISO timestamp or null), `scoringLocation` ("studio"|"field"), `broadcastOffsetSeconds` (number)
- `GET /matches/:matchId/possession` — current possession state + stats
- `POST /matches/:matchId/possession` — switch possession state (token auth or JWT)
- `DELETE /matches/:matchId/possession` — reset possession data (admin only)
- `POST /matches/:matchId/possession/token` — generate shareable possession tracker token (admin only)
- `GET /matches/:matchId/possession/verify-token` — verify token for helper access
- `POST /invites/team-manager|admin`, `GET /invites`, `GET /invites/:token`, `POST /invites/accept`, `POST /invites/:token/accept`
- `GET /players` (search), `POST /players` (super_admin), `GET /players/top?limit=N`, `POST /admin/players/cleanup?dryRun=true|false` (super_admin — merges duplicate-name records and deletes players with zero match events; transactional with dry-run preview)
- `GET /players/:playerId` (full profile: stats, teams, horses, recentMatches — last 10 matches with tournament + opponent + result for spectator deep-links), `PUT /players/:playerId` (full edit), `PATCH /players/:playerId/profile` (self-edit only — managed user or super_admin), `DELETE /players/:playerId`
- `POST /players/:playerId/horses`, `DELETE /players/:playerId/horses/:horseId`
- `GET /me/linked-player`

## Key Commands

- `pnpm run typecheck` — Root typecheck with project references
- `pnpm --filter @workspace/api-server run dev` — Start API server
- `pnpm --filter @workspace/polo-manager run dev` — Start frontend
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API hooks/schemas
- `pnpm --filter @workspace/db run generate` — Generate new migration file from schema changes
- `pnpm --filter @workspace/db run migrate` — Apply pending migrations via drizzle-kit (CI/manual)
- `pnpm --filter @workspace/db run push` — Push schema to database (dev shortcut, bypasses migration history)
- `LIVE_DEPLOYMENT_URL=https://poloclubhouse.app LIVE_MATCH_ID=<id> pnpm --filter @workspace/scripts run verify-link-previews` — Post-deploy smoke check that hits the deployed routing layer with bot + browser UAs and asserts `/match/:id` and `/share/:pageType/:token` return OG HTML to crawlers and the SPA shell to humans. Optional `LIVE_SHARE_TOKEN_{STATS,GFX,SCOREBOARD,FULL_CONTROL,REVOKED}` env vars enable share-link checks.

## Link Previews (iMessage / WhatsApp / Slack)

- Bot crawlers (`facebookexternalhit`, `Twitterbot`, `Slackbot`, `WhatsApp`, `Discordbot`, `TelegramBot`, etc.) hit `/match/:id` and `/share/:pageType/:token` and get server-rendered OG HTML with `og:image` pointing at the per-match preview PNG (rendered client-side from `MatchGraphicTemplates`, falls back to a server-side `@resvg/resvg-js` render via the 10-min backfill job). Humans get the SPA.
- Routing on production lives in two artifacts: `api-server` claims `paths = ["/api", "/match", "/share"]`, `polo-manager` claims `paths = ["/"]` and serves the SPA statically. The artifact router does longest-prefix matching, so leaving polo-manager at `/` while api-server owns the three preview routes is exactly the desired behavior — do not narrow polo-manager. **Never edit `artifact.toml` directly; use the `verifyAndReplaceArtifactToml` callback per the artifacts skill.**
- **iMessage cache caveat**: iMessage caches link previews per URL very aggressively (per-device, persisted across app restarts). After deploying a fix that changes how a preview renders, an existing message that already shows the old preview will keep showing it on that device. To force a refresh: delete and re-paste the message, or send a slightly different URL (append a harmless query string like `?v=2`). New links to other matches will pick up the new preview immediately. WhatsApp and Slack caches are shorter (minutes / hours) and usually self-heal. Don't waste time trying to defeat the iMessage cache server-side — it's not solvable from our end.
- The unit/integration tests under `artifacts/api-server/src/lib/og-meta.*.test.ts` mount Express directly with supertest and intentionally **do not** exercise the artifact router. To catch regressions in the deployment routing layer, run the post-deploy smoke script above against the live URL after every Publish.
