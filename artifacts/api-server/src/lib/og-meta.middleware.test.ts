import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  tournamentsTable,
  matchesTable,
  matchShareLinksTable,
  teamsTable,
} from "@workspace/db/schema";
import { ogMetaMiddleware } from "./og-meta";

// Route-level coverage of `ogMetaMiddleware`: verifies the bot-UA gate, the
// per-route HTML payload, and that non-bot requests fall through to the SPA
// passthrough handler instead of being intercepted. The middleware is only
// mounted in production in app.ts, so we mount it here against a stub
// express app to exercise the full request lifecycle without flipping
// NODE_ENV.

const BOT_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const HUMAN_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

function buildApp(): Express {
  const app = express();
  app.use(ogMetaMiddleware);
  // Stand-in for the SPA static + catch-all in production app.ts. If the
  // middleware passes through (next()), this handler runs and returns a
  // distinguishable body so tests can tell the SPA path was taken.
  app.use((_req, res) => {
    res.status(200).type("text/html").send("<!-- spa-passthrough -->");
  });
  return app;
}

describe("ogMetaMiddleware — route-level (bot-UA gate, OG payload, SPA passthrough)", () => {
  const app = buildApp();
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
  let revokedToken = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const [club] = await db.insert(clubsTable)
      .values({ name: `OG MW Club ${stamp}`, slug: `ogmw-${stamp}`, logoUrl: "https://cdn.test/club.png" })
      .returning();
    created.clubIds.push(club.id);

    const [tournament] = await db.insert(tournamentsTable)
      .values({ name: `OG MW Open ${stamp}`, clubId: club.id, status: "published" })
      .returning();
    created.tournamentIds.push(tournament.id);
    tournamentName = tournament.name;

    const [home] = await db.insert(teamsTable)
      .values({ name: `Home MW ${stamp}`, clubId: club.id, logoUrl: "https://cdn.test/home.png" })
      .returning();
    const [away] = await db.insert(teamsTable)
      .values({ name: `Away MW ${stamp}`, clubId: club.id, logoUrl: "https://cdn.test/away.png" })
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
      homeScore: 9,
      awayScore: 4,
      previewImageUrl: "/api/storage/public-objects/match-previews/test.png",
      previewImageUpdatedAt: new Date(1746300000000),
    }).returning();
    matchId = match.id;
    created.matchIds.push(matchId);

    const expiry = new Date(Date.now() + 60 * 60_000);
    const [link] = await db.insert(matchShareLinksTable).values({
      matchId,
      pageType: "stats",
      token: `mw-stats-${stamp}`,
      expiresAt: expiry,
    }).returning();
    created.shareLinkIds.push(link.id);
    validToken = link.token;

    const [revoked] = await db.insert(matchShareLinksTable).values({
      matchId,
      pageType: "stats",
      token: `mw-rev-${stamp}`,
      expiresAt: expiry,
      revokedAt: new Date(),
    }).returning();
    created.shareLinkIds.push(revoked.id);
    revokedToken = revoked.token;
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

  afterAll(async () => { await pool.end(); });

  it("normal browser User-Agent passes through to the SPA (no OG injection)", async () => {
    const res = await request(app).get(`/match/${matchId}`).set("User-Agent", HUMAN_UA);
    expect(res.status).toBe(200);
    expect(res.text).toContain("spa-passthrough");
    expect(res.text).not.toContain("og:title");
  });

  it("/api/* requests are never intercepted, even with a bot UA", async () => {
    const res = await request(app).get("/api/matches/anything").set("User-Agent", BOT_UA);
    expect(res.status).toBe(200);
    expect(res.text).toContain("spa-passthrough");
  });

  it("static-asset paths pass through even with a bot UA", async () => {
    const res = await request(app).get("/assets/index-abcd.js").set("User-Agent", BOT_UA);
    expect(res.text).toContain("spa-passthrough");
  });

  it("non-GET requests pass through even with a bot UA", async () => {
    const res = await request(app).post(`/match/${matchId}`).set("User-Agent", BOT_UA);
    expect(res.text).toContain("spa-passthrough");
  });

  it("/match/:id with bot UA returns OG HTML — scores absent, preview image present", async () => {
    const res = await request(app).get(`/match/${matchId}`).set("User-Agent", BOT_UA);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain('property="og:title"');
    expect(res.text).toContain(homeName);
    expect(res.text).toContain(awayName);
    expect(res.text).toContain(tournamentName);
    expect(res.text).toContain("LIVE");
    // Critical: live scores (9-4) must NOT leak into the OG title or
    // description. (The match's UUID can incidentally contain "9-4" — e.g.
    // `db59-40e1` — so we scope these assertions to the title/description
    // attributes rather than the whole response body.)
    expect(res.text).not.toMatch(/og:title[^>]*\b9\b/);
    expect(res.text).not.toMatch(/og:description[^>]*\b9\b/);
    expect(res.text).not.toMatch(/og:title[^>]*9\s*[-:–]\s*4/);
    expect(res.text).not.toMatch(/og:description[^>]*9\s*[-:–]\s*4/);
    expect(res.text).toMatch(/og:image[^>]*match-previews\/test\.png\?v=\d+/);
    // Cache header so chat-app crawlers don't re-fetch on every send.
    expect(res.headers["cache-control"]).toMatch(/max-age=\d+/);
  });

  it("/share/:pageType/:token with bot UA returns labelled OG HTML", async () => {
    const res = await request(app).get(`/share/stats/${validToken}`).set("User-Agent", BOT_UA);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Stats Control");
    expect(res.text).toContain(homeName);
    expect(res.text).toContain(awayName);
    expect(res.text).toMatch(/og:image[^>]*match-previews\/test\.png/);
  });

  it("/share/:pageType/:token revoked token returns generic non-leaky card", async () => {
    const res = await request(app).get(`/share/stats/${revokedToken}`).set("User-Agent", BOT_UA);
    expect(res.status).toBe(200);
    expect(res.text).toContain("no longer active");
    // Must NOT leak match details.
    expect(res.text).not.toContain(homeName);
    expect(res.text).not.toContain(tournamentName);
    expect(res.text).toContain("opengraph.jpg");
  });

  it("/share/:pageType/:token unknown token returns generic non-leaky card", async () => {
    const res = await request(app).get("/share/stats/totally-bogus-token").set("User-Agent", BOT_UA);
    expect(res.status).toBe(200);
    expect(res.text).toContain("no longer active");
    expect(res.text).not.toContain(homeName);
  });

  it("/share/:pageType/:token unknown pageType passes through to SPA", async () => {
    const res = await request(app).get(`/share/bogus/${validToken}`).set("User-Agent", BOT_UA);
    expect(res.text).toContain("spa-passthrough");
  });

  it("/match/:id with unknown id passes through to SPA (no fake OG)", async () => {
    const res = await request(app).get("/match/00000000-0000-0000-0000-000000000000").set("User-Agent", BOT_UA);
    expect(res.text).toContain("spa-passthrough");
  });
});
