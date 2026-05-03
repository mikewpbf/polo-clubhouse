import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { inArray, eq } from "drizzle-orm";
import type { Express } from "express";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  usersTable,
  adminClubMembershipsTable,
  tournamentsTable,
  matchesTable,
  teamsTable,
  matchShareLinksTable,
} from "@workspace/db/schema";

// End-to-end coverage of the link-preview pipeline. The peer-level tests
// already exercise the pieces in isolation:
//   - og-meta.test.ts             → buildOg() unit logic
//   - og-meta.middleware.test.ts  → middleware mounted on a stub express app
//   - match-previews.test.ts      → upload endpoint + auth
//
// What none of them catch is a regression in the *production wiring* of
// app.ts: the SSR middleware mount order, the conditional gate on
// NODE_ENV/static-dir, the cache-bust query on the stored preview URL, or
// the public-objects URL shape produced by the upload route ever drifting
// apart from what buildOg expects to render. This file stitches the whole
// pipeline together end-to-end:
//
//   1. Authenticated club admin POSTs a PNG to the upload endpoint.
//   2. The upload route writes the canonical /api/storage/public-objects/...
//      URL onto the match row.
//   3. A crawler (bot UA) GETs /match/:id; the production app must mount
//      ogMetaMiddleware *ahead of* express.static and the SPA catch-all so
//      the request returns OG HTML with og:image pointing at the just-
//      uploaded preview URL plus a cache-busting ?v=<timestamp>.
//   4. /share/:pageType/:token returns the same image for the active token,
//      and a generic non-leaky card for revoked / expired / mismatched
//      tokens (matches the privacy contract verified in the unit tests).

// Mock the R2-backed storage uploader. We only care here that the route
// produces the public-objects URL shape — the real upload is exercised by
// integration smoke tests in deploy.
vi.mock("../lib/objectStorage", async () => {
  const actual = await vi.importActual<typeof import("../lib/objectStorage")>("../lib/objectStorage");
  class MockObjectStorageService {
    async uploadPublicObject(filePath: string, body: Buffer, _contentType: string) {
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw new Error("uploadPublicObject called with empty body");
      }
      return { key: `public/${filePath}`, url: `/api/storage/public-objects/${filePath}` };
    }
  }
  return { ...actual, ObjectStorageService: MockObjectStorageService };
});

// ogMetaMiddleware is only mounted in app.ts when both:
//   (a) NODE_ENV === "production"
//   (b) a `public/` directory exists alongside the bundled app.ts
// To exercise the *real* mount path we satisfy both conditions before
// importing the module, then restore everything in afterAll so subsequent
// test files fall back to the regular test config.
const STATIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const INDEX_HTML = path.join(STATIC_DIR, "index.html");
const SPA_BODY_MARKER = "<!-- spa-stub-e2e -->";
const SPA_HTML = `<!DOCTYPE html><html><head><title>SPA</title></head><body>${SPA_BODY_MARKER}<div id="root"></div></body></html>`;

const BOT_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const HUMAN_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FAKE_PNG = Buffer.concat([PNG_HEADER, Buffer.alloc(64, 0x42)]);

let app: Express;
let createdStaticDir = false;
let createdIndexHtml = false;
let originalNodeEnv: string | undefined;
let originalJwtSecret: string | undefined;

beforeAll(async () => {
  originalNodeEnv = process.env.NODE_ENV;
  originalJwtSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = "production";
  // auth.ts throws if JWT_SECRET is unset under production. Provide a
  // deterministic value scoped to this test file.
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "og-e2e-test-secret";

  if (!existsSync(STATIC_DIR)) {
    mkdirSync(STATIC_DIR, { recursive: true });
    createdStaticDir = true;
  }
  if (!existsSync(INDEX_HTML)) {
    writeFileSync(INDEX_HTML, SPA_HTML);
    createdIndexHtml = true;
  }

  // Drop any cached module from earlier test files so app.ts re-evaluates
  // its NODE_ENV / staticDir conditional under our setup.
  vi.resetModules();
  ({ default: app } = await import("../app"));
});

afterAll(async () => {
  // Restore env first so anything imported afterwards (including pool
  // teardown logging) sees the original values.
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;

  if (createdIndexHtml && existsSync(INDEX_HTML)) rmSync(INDEX_HTML, { force: true });
  if (createdStaticDir && existsSync(STATIC_DIR)) rmSync(STATIC_DIR, { recursive: true, force: true });

  // Reset the module cache so subsequent test files don't accidentally
  // share this file's production-wired app instance.
  vi.resetModules();
  await pool.end();
});

describe("link preview pipeline — end-to-end (upload → SSR middleware → OG HTML)", () => {
  const created = {
    userIds: [] as string[],
    clubIds: [] as string[],
    tournamentIds: [] as string[],
    teamIds: [] as string[],
    matchIds: [] as string[],
    shareLinkIds: [] as string[],
  };

  let matchId = "";
  let scheduledMatchId = "";
  let adminToken = "";
  let homeName = "";
  let awayName = "";
  let tournamentName = "";
  let validToken = "";
  let revokedToken = "";
  let expiredToken = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const passwordHash = await bcrypt.hash("x", 4);

    const [club] = await db.insert(clubsTable)
      .values({ name: `E2E Club ${stamp}`, slug: `e2e-${stamp}`, logoUrl: "https://cdn.test/club.png" })
      .returning();
    created.clubIds.push(club.id);

    const [admin] = await db.insert(usersTable).values({
      email: `e2e-admin-${stamp}@test.local`,
      displayName: "E2E Admin",
      role: "admin",
      passwordHash,
    }).returning();
    created.userIds.push(admin.id);
    await db.insert(adminClubMembershipsTable)
      .values({ userId: admin.id, clubId: club.id, role: "owner" });

    const [tournament] = await db.insert(tournamentsTable)
      .values({ name: `E2E Open ${stamp}`, clubId: club.id, status: "published" })
      .returning();
    created.tournamentIds.push(tournament.id);
    tournamentName = tournament.name;

    const [home] = await db.insert(teamsTable)
      .values({ name: `Home E2E ${stamp}`, clubId: club.id, logoUrl: "https://cdn.test/home.png" })
      .returning();
    const [away] = await db.insert(teamsTable)
      .values({ name: `Away E2E ${stamp}`, clubId: club.id, logoUrl: "https://cdn.test/away.png" })
      .returning();
    created.teamIds.push(home.id, away.id);
    homeName = home.name;
    awayName = away.name;

    const [liveMatch] = await db.insert(matchesTable).values({
      tournamentId: tournament.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      scheduledAt: new Date(Date.now() - 30 * 60_000),
      status: "live",
      homeScore: 6,
      awayScore: 3,
    }).returning();
    matchId = liveMatch.id;
    created.matchIds.push(matchId);

    // Second match used to host the expired token so we don't collide on
    // the partial unique index (match_id, page_type) WHERE revoked_at IS NULL.
    const [scheduledMatch] = await db.insert(matchesTable).values({
      tournamentId: tournament.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      scheduledAt: new Date(Date.UTC(2099, 0, 1, 18, 0, 0)),
      status: "scheduled",
      homeScore: 0,
      awayScore: 0,
    }).returning();
    scheduledMatchId = scheduledMatch.id;
    created.matchIds.push(scheduledMatchId);

    const validExpiry = new Date(Date.now() + 60 * 60_000);
    const [validLink] = await db.insert(matchShareLinksTable).values({
      matchId,
      pageType: "stats",
      token: `e2e-stats-${stamp}`,
      expiresAt: validExpiry,
    }).returning();
    created.shareLinkIds.push(validLink.id);
    validToken = validLink.token;

    const [revokedLink] = await db.insert(matchShareLinksTable).values({
      matchId,
      pageType: "stats",
      token: `e2e-rev-${stamp}`,
      expiresAt: validExpiry,
      revokedAt: new Date(),
    }).returning();
    created.shareLinkIds.push(revokedLink.id);
    revokedToken = revokedLink.token;

    const [expiredLink] = await db.insert(matchShareLinksTable).values({
      matchId: scheduledMatchId,
      pageType: "stats",
      token: `e2e-exp-${stamp}`,
      expiresAt: new Date(Date.now() - 1000),
    }).returning();
    created.shareLinkIds.push(expiredLink.id);
    expiredToken = expiredLink.token;

    const { generateToken } = await import("./auth");
    adminToken = generateToken({
      id: admin.id, email: admin.email!, displayName: admin.displayName!, role: admin.role!,
    });
  });

  afterEach(async () => {
    if (created.shareLinkIds.length) await db.delete(matchShareLinksTable).where(inArray(matchShareLinksTable.id, created.shareLinkIds));
    if (created.matchIds.length) await db.delete(matchesTable).where(inArray(matchesTable.id, created.matchIds));
    if (created.teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, created.teamIds));
    if (created.tournamentIds.length) await db.delete(tournamentsTable).where(inArray(tournamentsTable.id, created.tournamentIds));
    if (created.userIds.length) {
      await db.delete(adminClubMembershipsTable).where(inArray(adminClubMembershipsTable.userId, created.userIds));
      await db.delete(usersTable).where(inArray(usersTable.id, created.userIds));
    }
    if (created.clubIds.length) await db.delete(clubsTable).where(inArray(clubsTable.id, created.clubIds));
    created.shareLinkIds = []; created.matchIds = []; created.teamIds = [];
    created.tournamentIds = []; created.userIds = []; created.clubIds = [];
  });

  it("upload → /match/:id (bot UA) renders OG HTML with the stored preview URL + cache-bust", async () => {
    // 1. Upload (admin-authenticated). Mirrors the client-side snap pipeline
    //    that POSTs the rasterized PNG up after MatchGraphicTemplates renders.
    const upload = await request(app)
      .post(`/api/matches/${matchId}/preview-image`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Content-Type", "image/png")
      .send(FAKE_PNG);
    expect(upload.status).toBe(200);
    expect(upload.body.previewImageUrl).toBe(`/api/storage/public-objects/match-previews/${matchId}.png`);
    expect(typeof upload.body.previewImageUpdatedAt).toBe("string");

    // 2. Verify the row was actually written. (If the route ever silently
    //    no-ops the UPDATE the OG fetch below would still find the row, but
    //    with a null preview URL — exactly the regression we want to fail.)
    const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    expect(row.previewImageUrl).toBe(`/api/storage/public-objects/match-previews/${matchId}.png`);
    expect(row.previewImageUpdatedAt).toBeTruthy();
    const expectedV = new Date(row.previewImageUpdatedAt!).getTime();

    // 3. Crawler GET hits the SSR middleware (mounted in production).
    const og = await request(app)
      .get(`/match/${matchId}`)
      .set("User-Agent", BOT_UA);
    expect(og.status).toBe(200);
    expect(og.headers["content-type"]).toMatch(/text\/html/);
    expect(og.text).toContain('property="og:title"');
    expect(og.text).toContain(homeName);
    expect(og.text).toContain(awayName);
    expect(og.text).toContain(tournamentName);
    expect(og.text).toContain("LIVE");

    // 4. Critical: og:image must be the stored URL with a cache-busting
    //    ?v=<timestamp> matching what the upload route persisted.
    const expectedImagePath = `/api/storage/public-objects/match-previews/${matchId}.png`;
    const imgRe = new RegExp(`og:image"\\s+content="[^"]*${expectedImagePath.replace(/[/.]/g, "\\$&")}\\?v=${expectedV}"`);
    expect(og.text).toMatch(imgRe);

    // 5. Crawler-friendly cache header so chat-app servers don't re-fetch.
    expect(og.headers["cache-control"]).toMatch(/max-age=\d+/);

    // 6. Live scores must NOT leak. Scope to og:title / og:description so
    //    the match's own UUID can't accidentally trip the assertion.
    expect(og.text).not.toMatch(/og:title[^>]*\b6\b/);
    expect(og.text).not.toMatch(/og:description[^>]*\b6\b/);
    expect(og.text).not.toMatch(/og:title[^>]*6\s*[-:–]\s*3/);
    expect(og.text).not.toMatch(/og:description[^>]*6\s*[-:–]\s*3/);
  });

  it("normal browser UA on /match/:id receives the SPA index.html with OG meta injected", async () => {
    // Apple's LinkPresentation (iMessage / Messages) uses a vanilla
    // Safari UA indistinguishable from a real user, so the bot regex
    // can't gate on UA. Real users still get the SPA shell — React
    // hydrates as normal — but the <head> now carries the same OG/
    // Twitter meta tags that scraper UAs receive. If this regresses,
    // iMessage falls back to the generic site card.
    const res = await request(app)
      .get(`/match/${matchId}`)
      .set("User-Agent", HUMAN_UA);
    expect(res.status).toBe(200);
    // SPA shell is preserved (React root + bundle still load).
    expect(res.text).toContain(SPA_BODY_MARKER);
    // OG/Twitter tags are injected for non-bot UAs.
    expect(res.text).toContain('property="og:title"');
    expect(res.text).toContain('property="og:image"');
    expect(res.text).toContain('name="twitter:card"');
  });

  it("upload → /share/:pageType/:token (bot UA) renders OG HTML with the stored preview URL", async () => {
    // Upload first so the share page picks up the same image as /match/:id.
    const upload = await request(app)
      .post(`/api/matches/${matchId}/preview-image`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Content-Type", "image/png")
      .send(FAKE_PNG);
    expect(upload.status).toBe(200);

    const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    const expectedV = new Date(row.previewImageUpdatedAt!).getTime();

    const og = await request(app)
      .get(`/share/stats/${validToken}`)
      .set("User-Agent", BOT_UA);
    expect(og.status).toBe(200);
    expect(og.headers["content-type"]).toMatch(/text\/html/);
    expect(og.text).toContain("Stats Control");
    expect(og.text).toContain(homeName);
    expect(og.text).toContain(awayName);
    expect(og.text).toContain(tournamentName);

    const expectedImagePath = `/api/storage/public-objects/match-previews/${matchId}.png`;
    const imgRe = new RegExp(`og:image"\\s+content="[^"]*${expectedImagePath.replace(/[/.]/g, "\\$&")}\\?v=${expectedV}"`);
    expect(og.text).toMatch(imgRe);
  });

  it("/share/:pageType/:token revoked token returns the generic non-leaky card", async () => {
    const og = await request(app)
      .get(`/share/stats/${revokedToken}`)
      .set("User-Agent", BOT_UA);
    expect(og.status).toBe(200);
    expect(og.headers["content-type"]).toMatch(/text\/html/);
    expect(og.text).toContain("no longer active");
    // Must NOT leak any match-identifying detail.
    expect(og.text).not.toContain(homeName);
    expect(og.text).not.toContain(awayName);
    expect(og.text).not.toContain(tournamentName);
    // Generic fallback image, not the per-match preview.
    expect(og.text).toContain("opengraph.jpg");
    expect(og.text).not.toMatch(/match-previews\/[^"]+\.png/);
  });

  it("/share/:pageType/:token expired token returns the generic non-leaky card", async () => {
    const og = await request(app)
      .get(`/share/stats/${expiredToken}`)
      .set("User-Agent", BOT_UA);
    expect(og.status).toBe(200);
    expect(og.text).toContain("no longer active");
    expect(og.text).not.toContain(homeName);
    expect(og.text).not.toContain(awayName);
    expect(og.text).not.toContain(tournamentName);
    expect(og.text).toContain("opengraph.jpg");
  });
});
