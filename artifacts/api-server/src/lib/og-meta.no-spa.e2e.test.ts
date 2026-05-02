import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, renameSync, rmSync } from "node:fs";
import { inArray } from "drizzle-orm";
import type { Express } from "express";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  tournamentsTable,
  matchesTable,
  teamsTable,
  matchShareLinksTable,
} from "@workspace/db/schema";

// Regression coverage for the partial-deploy state where the api-server
// bundle ships *without* the polo-manager SPA copied alongside it.
//
// Before Task #106 the OG SSR middleware was mounted inside the same
// `if (existsSync(staticDir))` branch as `express.static` and the SPA
// `/*splat` catch-all. That meant any build hiccup leaving `dist/public`
// missing would also silently strip every chat-app link preview — bots
// hitting `/match/:id` and `/share/:pageType/:token` would 404 with no
// OG card at all instead of a graceful preview.
//
// This file pins the decoupled wiring: in production the OG middleware
// must respond to bot crawlers regardless of whether the SPA dir exists,
// while non-bot requests on the same routes get a clean 404 (Express
// default) since there is no SPA fallback to serve.

const STATIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
// If the static dir already exists when this file runs (e.g. a developer
// has a build artifact lying around, or some future fixture lands there),
// we move it aside instead of deleting it and restore it in afterAll.
// This keeps the test non-destructive even if `src/public` ever becomes
// a tracked path.
const STATIC_DIR_BACKUP = `${STATIC_DIR}.no-spa-e2e-backup-${process.pid}`;

const BOT_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const HUMAN_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

let app: Express;
let originalNodeEnv: string | undefined;
let originalJwtSecret: string | undefined;
let movedStaticDirAside = false;

beforeAll(async () => {
  originalNodeEnv = process.env.NODE_ENV;
  originalJwtSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = "production";
  // auth.ts throws if JWT_SECRET is unset under production. Provide a
  // deterministic value scoped to this test file.
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "og-no-spa-e2e-test-secret";

  // Ensure the static dir is *not* present — that is the whole point of
  // this test. Other test files (notably og-meta.e2e.test.ts) create and
  // clean it up themselves; we move anything left over aside so the
  // conditional in app.ts takes the API-only branch, then restore it in
  // afterAll so we don't accidentally clobber a pre-existing fixture.
  if (existsSync(STATIC_DIR)) {
    if (existsSync(STATIC_DIR_BACKUP)) {
      // Stale backup from a previously crashed run — safe to remove since
      // it's owned by this test file's naming scheme.
      rmSync(STATIC_DIR_BACKUP, { recursive: true, force: true });
    }
    renameSync(STATIC_DIR, STATIC_DIR_BACKUP);
    movedStaticDirAside = true;
  }

  // Drop any cached module from earlier test files so app.ts re-evaluates
  // its NODE_ENV / staticDir conditional under our setup.
  vi.resetModules();
  ({ default: app } = await import("../app"));
});

afterAll(async () => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;

  // Restore any pre-existing static dir we moved aside in beforeAll.
  if (movedStaticDirAside && existsSync(STATIC_DIR_BACKUP)) {
    if (existsSync(STATIC_DIR)) {
      // A later step in this run created a fresh static dir. Drop it
      // before restoring the original so renameSync doesn't clash.
      rmSync(STATIC_DIR, { recursive: true, force: true });
    }
    renameSync(STATIC_DIR_BACKUP, STATIC_DIR);
  }

  // Reset the module cache so subsequent test files don't accidentally
  // share this file's production-wired, SPA-less app instance.
  vi.resetModules();
  await pool.end();
});

describe("link preview SSR — survives a partial deploy with the SPA bundle missing", () => {
  const created = {
    clubIds: [] as string[],
    tournamentIds: [] as string[],
    teamIds: [] as string[],
    matchIds: [] as string[],
    shareLinkIds: [] as string[],
  };

  let matchId = "";
  let homeName = "";
  let awayName = "";
  let tournamentName = "";
  let validToken = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const [club] = await db.insert(clubsTable)
      .values({ name: `NoSPA Club ${stamp}`, slug: `nospa-${stamp}`, logoUrl: "https://cdn.test/club.png" })
      .returning();
    created.clubIds.push(club.id);

    const [tournament] = await db.insert(tournamentsTable)
      .values({ name: `NoSPA Open ${stamp}`, clubId: club.id, status: "published" })
      .returning();
    created.tournamentIds.push(tournament.id);
    tournamentName = tournament.name;

    const [home] = await db.insert(teamsTable)
      .values({ name: `Home NoSPA ${stamp}`, clubId: club.id, logoUrl: "https://cdn.test/home.png" })
      .returning();
    const [away] = await db.insert(teamsTable)
      .values({ name: `Away NoSPA ${stamp}`, clubId: club.id, logoUrl: "https://cdn.test/away.png" })
      .returning();
    created.teamIds.push(home.id, away.id);
    homeName = home.name;
    awayName = away.name;

    const [match] = await db.insert(matchesTable).values({
      tournamentId: tournament.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      scheduledAt: new Date(Date.now() - 30 * 60_000),
      status: "live",
      homeScore: 2,
      awayScore: 1,
    }).returning();
    matchId = match.id;
    created.matchIds.push(matchId);

    const [link] = await db.insert(matchShareLinksTable).values({
      matchId,
      pageType: "stats",
      token: `nospa-stats-${stamp}`,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    }).returning();
    created.shareLinkIds.push(link.id);
    validToken = link.token;
  });

  afterEach(async () => {
    if (created.shareLinkIds.length) await db.delete(matchShareLinksTable).where(inArray(matchShareLinksTable.id, created.shareLinkIds));
    if (created.matchIds.length) await db.delete(matchesTable).where(inArray(matchesTable.id, created.matchIds));
    if (created.teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, created.teamIds));
    if (created.tournamentIds.length) await db.delete(tournamentsTable).where(inArray(tournamentsTable.id, created.tournamentIds));
    if (created.clubIds.length) await db.delete(clubsTable).where(inArray(clubsTable.id, created.clubIds));
    created.shareLinkIds = []; created.matchIds = []; created.teamIds = [];
    created.tournamentIds = []; created.clubIds = [];
  });

  it("sanity: the static SPA dir is not present for this run", () => {
    expect(existsSync(STATIC_DIR)).toBe(false);
  });

  it("/match/:id with bot UA still returns OG HTML even though the SPA bundle is missing", async () => {
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
    // Crawler-friendly cache header so chat-app servers don't re-fetch.
    expect(og.headers["cache-control"]).toMatch(/max-age=\d+/);
  });

  it("/share/:pageType/:token with bot UA still returns OG HTML when the SPA bundle is missing", async () => {
    const og = await request(app)
      .get(`/share/stats/${validToken}`)
      .set("User-Agent", BOT_UA);
    expect(og.status).toBe(200);
    expect(og.headers["content-type"]).toMatch(/text\/html/);
    expect(og.text).toContain("Stats Control");
    expect(og.text).toContain(homeName);
    expect(og.text).toContain(awayName);
  });

  it("normal browser UA on /match/:id gets a graceful 404 (no SPA fallback present)", async () => {
    // With the SPA bundle missing there is nothing to serve to humans.
    // The important contract is "fail loudly with a 404", not "hang" or
    // "leak the API surface". Express's default finalhandler returns 404
    // when no route matches, which is exactly what we want.
    const res = await request(app)
      .get(`/match/${matchId}`)
      .set("User-Agent", HUMAN_UA);
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('property="og:title"');
  });

  it("/api/* is never intercepted by the OG middleware, even with a bot UA", async () => {
    // The OG middleware must never swallow /api/* — that's the API
    // surface. We hit an unknown /api path and confirm the response is
    // *not* the OG HTML stub (which would mean the middleware grabbed
    // it before the router/finalhandler ran).
    const botRes = await request(app)
      .get("/api/__definitely-not-a-real-route")
      .set("User-Agent", BOT_UA);
    expect(botRes.text || "").not.toContain('property="og:title"');
    expect(botRes.text || "").not.toContain("og:description");

    const humanRes = await request(app)
      .get("/api/__definitely-not-a-real-route")
      .set("User-Agent", HUMAN_UA);
    expect(humanRes.text || "").not.toContain('property="og:title"');
  });
});
