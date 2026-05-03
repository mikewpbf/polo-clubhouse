# Mobile & TV Notes

This document tracks every place in the codebase where we make a web-only
assumption, so future iOS, Android, and Apple TV teams can adapt or replace
those bits without spelunking through Git history.

**Convention:** any PR that introduces a new web-only path adds a bullet
here. Removing or generalizing one of the bullets is also fair game.

## API surface

- The web app calls `/api/...`. New clients (mobile, tvOS) should call
  `/api/v1/...` — both prefixes return identical responses; the un-versioned
  prefix is kept indefinitely so existing OBS / share-link consumers don't
  break. See `artifacts/api-server/src/app.ts`.
- `OPENAPI` spec is at `/api/openapi.yaml` (raw) and `/api/docs` (Redoc HTML).
  Mobile/TV codegen should target the raw spec.
- Real-time events flow over SSE (`text/event-stream`) on
  `/matches/{matchId}/events`. See `x-events` in the OpenAPI spec for the
  documented event names. Apple TV / mobile must use a polyfill or native
  EventSource implementation. WebSockets were considered (Step 4) but every
  current producer flow is server→client only, so SSE remains canonical.
- Authentication uses bearer JWT in `Authorization: Bearer <token>`. Two
  modes coexist:
    - Legacy: a single 7-day JWT (still issued for backward compatibility).
    - New: short-lived (~1h) access token + long-lived refresh token.
      `POST /auth/refresh` mints a fresh access token; `GET /auth/sessions`
      lists devices; `DELETE /auth/sessions/:id` logs out one device.
  Native clients should use the refresh-token flow. The web app is
  grandfathered into the legacy single-token flow until it opts in.
- Optional `x-api-key` identifies the calling client app (web / ios / tvos /
  android / obs). The web app is allow-listed without a key.
- Optional `x-client-platform`, `x-client-kind`, `x-device-id` headers (or
  matching body fields) on login/signup label the resulting session row so
  `/auth/sessions` can show "iPhone — last used 2m ago".

## Authentication / persistence

- Web app stores its JWT in `localStorage` under `polo-manager`'s App.tsx
  conventions. Native clients should use the platform secure store
  (Keychain / Keystore) and persist the refresh token there.
- Password reset emails build URLs from `req.headers.host`, which is the web
  origin. Native flows must implement universal links or pass through the
  web reset page.

## Image pipeline

- `/api/image-proxy?url=...` accepts `?w=`, `?h=`, `?fit=`, `?fmt=` for
  on-the-fly resizing (Step 5). Phones request `?w=512`, TVs `?w=2048`,
  OBS keeps the original. Cache-busting is the resize args themselves.
- Existing R2 URLs continue to resolve unchanged (no migration). Old uploads
  may not benefit from the resize pipeline until re-uploaded.
- Browser file-picker uploads go through presigned R2 PUT URLs from
  `POST /storage/uploads/request-url`. Native clients can call the same
  endpoint and PUT directly with `URLSession` / `OkHttp`.

## Scoreboard / broadcast

- Canonical contract: `GET /matches/:id/broadcast?variant=jumbotron|scorebug|tv`.
  `/matches/:id/jumbotron` is a thin alias kept for OBS compatibility — same
  payload shape with `variant: "jumbotron"`.
- Channel-routed scoreboards: `GET /clubs/:clubId/broadcast/channel/ch1|ch2`
  returns the same broadcast payload for whichever match is currently
  assigned to the channel. Apple TV would consume this directly.

## Devices / push

- `device_tokens` is a SQL view alias over `push_subscriptions`. Native
  clients call `POST /devices/register` with `{ token, platform, deviceId,
  appVersion }` on launch, and `DELETE /devices/:id` on logout.
- No pushes are sent yet; the schema is in place so the backend can adopt
  APNs / FCM without further migrations.

## SPA / browser-only assumptions

- `BASE_URL`-relative routing in `polo-manager`'s Vite build. Native clients
  use deep links instead.
- OG meta middleware (`artifacts/api-server/src/lib/og-meta.ts`) does
  server-side `<meta property="og:*">` injection for chat link previews.
  Native deep-link previews use platform metadata (Universal Links plist /
  App Links JSON) rather than this path.
- Match link-preview snapshots are produced **in the browser** via
  `html-to-image` (see `match-previews.ts` for the rationale). Native
  builds don't participate; they consume the already-rendered PNG via
  `previewImageUrl` on the match payload.
- Favicon is served as `image/svg+xml`. Apple TV requires PNG.
- OBS-specific scoreboard CSS lives inside the polo-manager SPA; the JSON
  contract from `/matches/:id/broadcast` is what mobile/TV should bind to.

## Configuration

- Server config lives in env vars and is now mirrored in
  `artifacts/api-server/src/lib/config.ts` as a typed module. New code
  should import from there; legacy `process.env.*` reads still work.
- `polo-manager` Vite build exposes `CLIENT_KIND` and `API_BASE` so future
  native builds can follow the same pattern (set `CLIENT_KIND=ios` /
  `API_BASE=https://poloclubhouse.app/api/v1`).

## Rate limiting

- 60 req/min per IP for unauthenticated traffic, 600 req/min per
  authenticated user, 6000 req/min per `x-api-key`. The web app is
  effectively under the per-user bucket once logged in.
