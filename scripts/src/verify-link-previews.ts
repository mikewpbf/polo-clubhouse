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
 *   LIVE_STRICT=1                  treat the five share-token env vars above
 *                                  as REQUIRED. Use in release / post-deploy
 *                                  CI so partial coverage can't silently pass.
 *
 * Usage:
 *   LIVE_DEPLOYMENT_URL=https://poloclubhouse.app \
 *   LIVE_MATCH_ID=24f201fb-6e61-48ba-9728-9e3cbb8d65fa \
 *     pnpm --filter @workspace/scripts run verify-link-previews
 *
 * Coverage:
 *   - /match/:id (bot UA → OG HTML, human UA → SPA shell)
 *   - /share/<pageType>/<token> for all four pageType values when their env
 *     var is provided (bot UA → OG HTML, human UA → SPA shell)
 *   - /share/stats/<revoked|expired token> (bot UA → non-leaky 'no longer
 *     active' card)
 *   - /share/stats/<random unknown token> (bot UA → same non-leaky card —
 *     ALWAYS RUNS, no env var needed; the random UUID has no DB row)
 *   - /share/<wrong-pageType>/<known-token> (bot UA → non-leaky card;
 *     synthesized by re-using one of the four pageType env vars under a
 *     different pageType slug — runs when at least one is provided)
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
  // Positive SPA markers — both must be present. The polo-manager Vite build
  // always emits a <div id="root"></div> mount node and an /assets/index-*.js
  // (or /assets/index-*.css) bundle reference in index.html. If either is
  // missing on a human-UA response, something other than the SPA shell came
  // back (likely the OG SSR stub or an error page).
  const hasRootDiv = /<div\s+id=["']root["']/i.test(body);
  const hasAssetBundle = /\/assets\/index-[A-Za-z0-9_-]+\.(?:js|css)/.test(body);
  // Negative assertion — the SPA shell must NOT carry OG meta tags. If it
  // does, the bot middleware is leaking past its UA gate.
  const hasOgMeta = /property=["']og:(?:title|image|description|url|type)["']/.test(body);

  const problems: string[] = [];
  if (!hasRootDiv) problems.push('missing <div id="root">');
  if (!hasAssetBundle) problems.push("missing /assets/index-*.{js,css} bundle");
  if (hasOgMeta) problems.push("OG meta tags present (bot middleware leaked past UA gate)");

  if (problems.length > 0) {
    record(name, false, `${problems.join("; ")} (body=${body.length}B)`);
    return;
  }
  record(name, true, `${body.length}B SPA shell with #root + asset bundle, no OG tags`);
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

  const strict = process.env.LIVE_STRICT === "1" || process.env.LIVE_STRICT === "true";

  // Share-link checks (each independently optional unless LIVE_STRICT=1).
  const shareTokens: Array<{ pageType: string; envVar: string }> = [
    { pageType: "stats", envVar: "LIVE_SHARE_TOKEN_STATS" },
    { pageType: "gfx", envVar: "LIVE_SHARE_TOKEN_GFX" },
    { pageType: "scoreboard", envVar: "LIVE_SHARE_TOKEN_SCOREBOARD" },
    { pageType: "full_control", envVar: "LIVE_SHARE_TOKEN_FULL_CONTROL" },
  ];
  const presentShareTokens: Array<{ pageType: string; token: string }> = [];
  for (const { pageType, envVar } of shareTokens) {
    const token = process.env[envVar];
    if (!token) {
      if (strict) {
        record(`bot GET /share/${pageType}/<token>`, false, `LIVE_STRICT=1 but ${envVar} not set`);
        record(`human GET /share/${pageType}/<token>`, false, `LIVE_STRICT=1 but ${envVar} not set`);
      } else {
        console.log(`[SKIP] ${envVar} not set — skipping /share/${pageType}/:token check`);
      }
      continue;
    }
    presentShareTokens.push({ pageType, token });
    const url = `${base}/share/${pageType}/${token}`;
    const r = await fetchText(url, BOT_UA);
    expectOg(`bot GET /share/${pageType}/<token>`, r.body, r.status);
    const h = await fetchText(url, HUMAN_UA);
    expectSpa(`human GET /share/${pageType}/<token>`, h.body, h.status);
  }

  // Helper: assert the response is the non-leaky 'no longer active' card.
  // Used by the revoked, unknown-token, and pageType-mismatch checks below.
  function expectNonLeakyCard(name: string, body: string, status: number): void {
    if (status !== 200) {
      record(name, false, `status=${status}`);
      return;
    }
    if (!/no longer active/i.test(body)) {
      record(name, false, `expected non-leaky 'no longer active' card, got ${body.length}B body`);
      return;
    }
    // Sanity: must not look like the SPA shell either (would mean the route
    // never reached the OG middleware and silently fell through to /*splat).
    if (/<div\s+id=["']root["']/i.test(body) && /\/assets\/index-/.test(body)) {
      record(name, false, "got SPA shell instead of OG fallback card (routing regression)");
      return;
    }
    record(name, true, "non-leaky generic card returned");
  }

  // Revoked / expired token: known-bad token from env. Must still return the
  // generic 'no longer active' OG card.
  const revoked = process.env.LIVE_SHARE_TOKEN_REVOKED;
  if (revoked) {
    const url = `${base}/share/stats/${revoked}`;
    const r = await fetchText(url, BOT_UA);
    expectNonLeakyCard("bot GET /share/stats/<revoked>", r.body, r.status);
  } else if (strict) {
    record("bot GET /share/stats/<revoked>", false, "LIVE_STRICT=1 but LIVE_SHARE_TOKEN_REVOKED not set");
  } else {
    console.log("[SKIP] LIVE_SHARE_TOKEN_REVOKED not set — skipping revoked-token fallback check");
  }

  // Unknown-token check — ALWAYS runs. A randomly generated token UUID won't
  // exist in the DB, so buildOg must return the generic non-leaky card. This
  // covers the "no row found" branch of the share-link OG handler with no
  // operational setup required.
  {
    const randomToken = `verify-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const url = `${base}/share/stats/${randomToken}`;
    const r = await fetchText(url, BOT_UA);
    expectNonLeakyCard("bot GET /share/stats/<unknown>", r.body, r.status);
  }

  // pageType mismatch check — synthesized from any active share token by
  // hitting it under a *different* pageType slug. og-meta.ts treats this
  // exactly like an unknown token (non-leaky card) so a sender can't craft
  // /share/full_control/<stats-token> and mislabel the link's capability.
  if (presentShareTokens.length > 0) {
    const { pageType: realPageType, token } = presentShareTokens[0];
    const allPageTypes = ["stats", "gfx", "scoreboard", "full_control"];
    const wrongPageType = allPageTypes.find((p) => p !== realPageType)!;
    const url = `${base}/share/${wrongPageType}/${token}`;
    const r = await fetchText(url, BOT_UA);
    expectNonLeakyCard(
      `bot GET /share/${wrongPageType}/<${realPageType}-token> (mismatch)`,
      r.body,
      r.status,
    );
  } else if (strict) {
    record(
      "bot GET /share/<wrong-pageType>/<token> (mismatch)",
      false,
      "LIVE_STRICT=1 but no share tokens provided to synthesize mismatch check",
    );
  } else {
    console.log("[SKIP] no share tokens provided — skipping pageType-mismatch fallback check");
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
