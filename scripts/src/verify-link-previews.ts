#!/usr/bin/env tsx
/**
 * Post-deploy smoke check for link-preview routing.
 *
 * Exercises the *deployed* routing layer (not Express in isolation) to catch
 * the exact regression Task #104 fixed: `/match/:id` and `/share/:pageType/:token`
 * silently being served by the SPA artifact instead of api-server, so bot
 * crawlers never hit the OG SSR middleware.
 *
 * The unit tests under api-server/src/lib/og-meta.*.test.ts mount Express
 * directly with supertest and would still pass if the artifact router never
 * forwards `/match` and `/share` to api-server. This script is the missing
 * outer ring: it speaks HTTP to the live deployment.
 *
 * Required env:
 *   LIVE_DEPLOYMENT_URL    e.g. https://poloclubhouse.app  (no trailing slash)
 *   LIVE_MATCH_ID          a known, published match id whose preview was generated
 *
 * Optional env (each enables one extra check):
 *   LIVE_SHARE_TOKEN_STATS         active stats   share token (no leading /share/)
 *   LIVE_SHARE_TOKEN_GFX           active gfx     share token
 *   LIVE_SHARE_TOKEN_SCOREBOARD    active scoreboard share token
 *   LIVE_SHARE_TOKEN_FULL_CONTROL  active full_control share token
 *   LIVE_SHARE_TOKEN_REVOKED       a revoked or expired token (any pageType)
 *
 * Usage:
 *   LIVE_DEPLOYMENT_URL=https://poloclubhouse.app \
 *   LIVE_MATCH_ID=24f201fb-6e61-48ba-9728-9e3cbb8d65fa \
 *     pnpm --filter @workspace/scripts run verify-link-previews
 *
 * Exits non-zero if any required check fails.
 */

const BOT_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const HUMAN_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function record(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name}${detail ? `  — ${detail}` : ""}`);
}

async function fetchText(url: string, ua: string): Promise<{ status: number; body: string; headers: Headers }> {
  const res = await fetch(url, { headers: { "User-Agent": ua, Accept: "text/html,*/*" } });
  const body = await res.text();
  return { status: res.status, body, headers: res.headers };
}

function expectOg(name: string, body: string, status: number): void {
  if (status !== 200) {
    record(name, false, `status=${status}`);
    return;
  }
  const hasOgImage = /property=["']og:image["']/.test(body);
  const hasOgTitle = /property=["']og:title["']/.test(body);
  if (!hasOgImage || !hasOgTitle) {
    record(name, false, `og:image=${hasOgImage} og:title=${hasOgTitle} bytes=${body.length}`);
    return;
  }
  record(name, true, `og:image + og:title present, ${body.length}B`);
}

function expectSpa(name: string, body: string, status: number): void {
  if (status !== 200) {
    record(name, false, `status=${status}`);
    return;
  }
  const looksLikeOgStub = /property=["']og:image["']/.test(body) && body.length < 4000;
  if (looksLikeOgStub) {
    record(name, false, `body looks like OG stub (${body.length}B) — bot middleware is firing for human UA`);
    return;
  }
  record(name, true, `${body.length}B HTML, no OG stub`);
}

async function main(): Promise<void> {
  const base = process.env.LIVE_DEPLOYMENT_URL?.replace(/\/+$/, "");
  const matchId = process.env.LIVE_MATCH_ID;
  if (!base || !matchId) {
    console.error(
      "Missing required env: LIVE_DEPLOYMENT_URL and LIVE_MATCH_ID must be set.\n" +
        "Example:\n" +
        "  LIVE_DEPLOYMENT_URL=https://poloclubhouse.app \\\n" +
        "  LIVE_MATCH_ID=24f201fb-6e61-48ba-9728-9e3cbb8d65fa \\\n" +
        "    pnpm --filter @workspace/scripts run verify-link-previews",
    );
    process.exit(2);
  }

  console.log(`Verifying link-preview routing on ${base}`);
  console.log(`Match: ${matchId}\n`);

  // /match/:id — bot UA must get OG HTML.
  {
    const url = `${base}/match/${matchId}`;
    const r = await fetchText(url, BOT_UA);
    expectOg(`bot GET /match/${matchId}`, r.body, r.status);
  }
  // /match/:id — human UA must get the SPA shell, not the OG stub.
  {
    const url = `${base}/match/${matchId}`;
    const r = await fetchText(url, HUMAN_UA);
    expectSpa(`human GET /match/${matchId}`, r.body, r.status);
  }

  // Share-link checks (each independently optional).
  const shareTokens: Array<{ pageType: string; envVar: string }> = [
    { pageType: "stats", envVar: "LIVE_SHARE_TOKEN_STATS" },
    { pageType: "gfx", envVar: "LIVE_SHARE_TOKEN_GFX" },
    { pageType: "scoreboard", envVar: "LIVE_SHARE_TOKEN_SCOREBOARD" },
    { pageType: "full_control", envVar: "LIVE_SHARE_TOKEN_FULL_CONTROL" },
  ];
  for (const { pageType, envVar } of shareTokens) {
    const token = process.env[envVar];
    if (!token) {
      console.log(`[SKIP] ${envVar} not set — skipping /share/${pageType}/:token check`);
      continue;
    }
    const url = `${base}/share/${pageType}/${token}`;
    const r = await fetchText(url, BOT_UA);
    expectOg(`bot GET /share/${pageType}/<token>`, r.body, r.status);
    const h = await fetchText(url, HUMAN_UA);
    expectSpa(`human GET /share/${pageType}/<token>`, h.body, h.status);
  }

  // Revoked / expired token: must still return OG HTML, but the generic
  // non-leaky card. We assert og:title is present and body contains the
  // "no longer active" fallback string from buildOg.
  const revoked = process.env.LIVE_SHARE_TOKEN_REVOKED;
  if (revoked) {
    const url = `${base}/share/stats/${revoked}`;
    const r = await fetchText(url, BOT_UA);
    if (r.status !== 200) {
      record("bot GET /share/stats/<revoked>", false, `status=${r.status}`);
    } else if (!/no longer active/i.test(r.body)) {
      record(
        "bot GET /share/stats/<revoked>",
        false,
        `expected non-leaky 'no longer active' card, got ${r.body.length}B body`,
      );
    } else {
      record("bot GET /share/stats/<revoked>", true, "non-leaky generic card returned");
    }
  } else {
    console.log("[SKIP] LIVE_SHARE_TOKEN_REVOKED not set — skipping revoked-token fallback check");
  }

  console.log("");
  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed:`);
    for (const f of failures) console.error(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log(`All ${results.length} check(s) passed.`);
}

main().catch((err) => {
  console.error("verify-link-previews crashed:", err);
  process.exit(1);
});
