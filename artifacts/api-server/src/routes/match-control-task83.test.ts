import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  usersTable,
  adminClubMembershipsTable,
  tournamentsTable,
  matchesTable,
  matchEventsTable,
  matchShareLinksTable,
  teamsTable,
  playersTable,
  teamPlayersTable,
} from "@workspace/db/schema";
import express from "express";
import app from "../app";
import { generateToken } from "../lib/auth";
import { ogMetaMiddleware } from "../lib/og-meta";

// Five regression-test areas required by Task #83 review:
//   1. Stat sub-attributes (distance/severity validation)
//   2. Share-link expiry (resolveShareToken + GET /api/share/:token)
//   3. Cross-match guard (a share token cannot write to a different match)
//   4. Game-picker access filtering (admin only sees matches in their club)
//   5. OG middleware tags (bot UA + entity path returns OpenGraph HTML)

describe("Task #83 regressions", () => {
  const created: {
    userIds: string[];
    clubIds: string[];
    tournamentIds: string[];
    matchIds: string[];
    teamIds: string[];
    playerIds: string[];
    shareLinkIds: string[];
  } = { userIds: [], clubIds: [], tournamentIds: [], matchIds: [], teamIds: [], playerIds: [], shareLinkIds: [] };

  let clubId = "";
  let otherClubId = "";
  let tournamentId = "";
  let otherTournamentId = "";
  let matchId = "";
  let otherMatchId = "";
  let homeTeamId = "";
  let awayTeamId = "";
  let homePlayerId = "";

  let adminToken = "";
  let otherAdminToken = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const passwordHash = await bcrypt.hash("test-pass", 4);

    const [club] = await db.insert(clubsTable)
      .values({ name: `Club ${stamp}`, slug: `club-${stamp}` }).returning();
    const [other] = await db.insert(clubsTable)
      .values({ name: `Other Club ${stamp}`, slug: `other-club-${stamp}` }).returning();
    clubId = club.id; otherClubId = other.id;
    created.clubIds.push(clubId, otherClubId);

    const [admin] = await db.insert(usersTable).values({
      email: `admin-${stamp}@test.local`, displayName: "Admin", role: "admin", passwordHash,
    }).returning();
    const [otherAdmin] = await db.insert(usersTable).values({
      email: `other-admin-${stamp}@test.local`, displayName: "Other", role: "admin", passwordHash,
    }).returning();
    created.userIds.push(admin.id, otherAdmin.id);

    await db.insert(adminClubMembershipsTable).values([
      { userId: admin.id, clubId, role: "owner" },
      { userId: otherAdmin.id, clubId: otherClubId, role: "owner" },
    ]);

    const [tournament] = await db.insert(tournamentsTable)
      .values({ name: `Tournament ${stamp}`, clubId, status: "published" }).returning();
    const [otherTournament] = await db.insert(tournamentsTable)
      .values({ name: `Other Tournament ${stamp}`, clubId: otherClubId, status: "published" }).returning();
    tournamentId = tournament.id; otherTournamentId = otherTournament.id;
    created.tournamentIds.push(tournamentId, otherTournamentId);

    const [home] = await db.insert(teamsTable).values({ name: `Home ${stamp}`, clubId }).returning();
    const [away] = await db.insert(teamsTable).values({ name: `Away ${stamp}`, clubId }).returning();
    homeTeamId = home.id; awayTeamId = away.id;
    created.teamIds.push(homeTeamId, awayTeamId);

    const [player] = await db.insert(playersTable)
      .values({ name: `Player ${stamp}`, homeClubId: clubId }).returning();
    homePlayerId = player.id;
    created.playerIds.push(homePlayerId);

    await db.insert(teamPlayersTable).values({
      teamId: homeTeamId, playerId: homePlayerId, position: 1, seasonYear: new Date().getUTCFullYear(),
    });

    const futureStart = new Date(Date.now() + 30 * 60_000);
    const [match] = await db.insert(matchesTable).values({
      tournamentId, homeTeamId, awayTeamId,
      scheduledAt: futureStart, status: "live",
    }).returning();
    matchId = match.id;
    const [otherMatch] = await db.insert(matchesTable).values({
      tournamentId: otherTournamentId, scheduledAt: futureStart, status: "scheduled",
    }).returning();
    otherMatchId = otherMatch.id;
    created.matchIds.push(matchId, otherMatchId);

    adminToken = generateToken({ id: admin.id, email: admin.email!, displayName: admin.displayName!, role: admin.role! });
    otherAdminToken = generateToken({ id: otherAdmin.id, email: otherAdmin.email!, displayName: otherAdmin.displayName!, role: otherAdmin.role! });
  });

  afterEach(async () => {
    if (created.shareLinkIds.length) await db.delete(matchShareLinksTable).where(inArray(matchShareLinksTable.id, created.shareLinkIds));
    await db.delete(matchEventsTable).where(inArray(matchEventsTable.matchId, created.matchIds));
    if (created.matchIds.length) await db.delete(matchesTable).where(inArray(matchesTable.id, created.matchIds));
    if (created.teamIds.length) {
      await db.delete(teamPlayersTable).where(inArray(teamPlayersTable.teamId, created.teamIds));
      await db.delete(teamsTable).where(inArray(teamsTable.id, created.teamIds));
    }
    if (created.playerIds.length) await db.delete(playersTable).where(inArray(playersTable.id, created.playerIds));
    if (created.tournamentIds.length) await db.delete(tournamentsTable).where(inArray(tournamentsTable.id, created.tournamentIds));
    if (created.userIds.length) {
      await db.delete(adminClubMembershipsTable).where(inArray(adminClubMembershipsTable.userId, created.userIds));
      await db.delete(usersTable).where(inArray(usersTable.id, created.userIds));
    }
    if (created.clubIds.length) await db.delete(clubsTable).where(inArray(clubsTable.id, created.clubIds));
    Object.values(created).forEach(arr => (arr as string[]).length = 0);
  });

  afterAll(async () => { await pool.end(); });

  // 1. Stat sub-attributes
  describe("stat sub-attributes", () => {
    it("accepts penalty_in with distance=30", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/event`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ eventType: "penalty_in", teamId: homeTeamId, playerId: homePlayerId, distance: "30" });
      expect(res.status).toBe(200);
      const rows = await db.select().from(matchEventsTable).where(eq(matchEventsTable.matchId, matchId));
      const ev = rows.find(r => r.eventType === "penalty_in");
      expect(ev).toBeTruthy();
      expect(ev!.distance).toBe("30");
    });

    it("rejects penalty_in with invalid distance", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/event`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ eventType: "penalty_in", teamId: homeTeamId, playerId: homePlayerId, distance: "25" });
      expect(res.status).toBe(400);
    });

    it("rejects distance on non-penalty_in events", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/event`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ eventType: "throw_in_won", teamId: homeTeamId, playerId: homePlayerId, distance: "30" });
      expect(res.status).toBe(400);
    });

    it("accepts foul_committed with severity=5a", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/event`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ eventType: "foul_committed", teamId: homeTeamId, playerId: homePlayerId, severity: "5a" });
      expect(res.status).toBe(200);
      const rows = await db.select().from(matchEventsTable).where(eq(matchEventsTable.matchId, matchId));
      const ev = rows.find(r => r.eventType === "foul_committed");
      expect(ev).toBeTruthy();
      expect(ev!.severity).toBe("5a");
    });

    it("rejects foul_committed with invalid severity", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/event`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ eventType: "foul_committed", teamId: homeTeamId, playerId: homePlayerId, severity: "6" });
      expect(res.status).toBe(400);
    });
  });

  // 2. Share-link expiry
  describe("share-link expiry", () => {
    it("GET /api/share/:token returns 200 + matchId for active token", async () => {
      const futureExpiry = new Date(Date.now() + 4 * 3600_000);
      const [link] = await db.insert(matchShareLinksTable).values({
        matchId, pageType: "stats", token: `tkn-active-${Date.now()}`, expiresAt: futureExpiry,
      }).returning();
      created.shareLinkIds.push(link.id);

      const res = await request(app).get(`/api/share/${link.token}`);
      expect(res.status).toBe(200);
      expect(res.body.matchId).toBe(matchId);
      expect(res.body.pageType).toBe("stats");
    });

    it("GET /api/share/:token returns 410 + reason='expired' when past expiry", async () => {
      const past = new Date(Date.now() - 60_000);
      const [link] = await db.insert(matchShareLinksTable).values({
        matchId, pageType: "stats", token: `tkn-expired-${Date.now()}`, expiresAt: past,
      }).returning();
      created.shareLinkIds.push(link.id);

      const res = await request(app).get(`/api/share/${link.token}`);
      expect(res.status).toBe(410);
      expect(res.body.reason).toBe("expired");
    });

    it("GET /api/share/:token returns 410 + reason='revoked' when revoked", async () => {
      const [link] = await db.insert(matchShareLinksTable).values({
        matchId, pageType: "stats", token: `tkn-revoked-${Date.now()}`, revokedAt: new Date(),
      }).returning();
      created.shareLinkIds.push(link.id);

      const res = await request(app).get(`/api/share/${link.token}`);
      expect(res.status).toBe(410);
      expect(res.body.reason).toBe("revoked");
    });

    it("expired share token cannot perform writes", async () => {
      const past = new Date(Date.now() - 60_000);
      const [link] = await db.insert(matchShareLinksTable).values({
        matchId, pageType: "stats", token: `tkn-expw-${Date.now()}`, expiresAt: past,
      }).returning();
      created.shareLinkIds.push(link.id);

      const res = await request(app)
        .post(`/api/matches/${matchId}/event`)
        .set("x-share-token", link.token)
        .send({ eventType: "throw_in_won", teamId: homeTeamId, playerId: homePlayerId });
      expect(res.status).toBe(401);
    });
  });

  // 3. Cross-match guard
  describe("cross-match guard", () => {
    it("share token bound to match A cannot write to match B", async () => {
      const futureExpiry = new Date(Date.now() + 4 * 3600_000);
      const [link] = await db.insert(matchShareLinksTable).values({
        matchId, pageType: "stats", token: `tkn-cross-${Date.now()}`, expiresAt: futureExpiry,
      }).returning();
      created.shareLinkIds.push(link.id);

      const res = await request(app)
        .post(`/api/matches/${otherMatchId}/event`)
        .set("x-share-token", link.token)
        .send({ eventType: "throw_in_won", teamId: homeTeamId, playerId: homePlayerId });
      expect(res.status).toBe(403);
    });

    it("share token authorized for match A writes to match A", async () => {
      const futureExpiry = new Date(Date.now() + 4 * 3600_000);
      const [link] = await db.insert(matchShareLinksTable).values({
        matchId, pageType: "stats", token: `tkn-self-${Date.now()}`, expiresAt: futureExpiry,
      }).returning();
      created.shareLinkIds.push(link.id);

      const res = await request(app)
        .post(`/api/matches/${matchId}/event`)
        .set("x-share-token", link.token)
        .send({ eventType: "throw_in_won", teamId: homeTeamId, playerId: homePlayerId });
      expect(res.status).toBe(200);
    });
  });

  // 4. Game-picker access filtering — GamePicker UI calls /api/matches/manageable
  describe("game-picker access filtering", () => {
    it("admin sees their own club's match via /matches/manageable", async () => {
      const res = await request(app)
        .get(`/api/matches/manageable`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const ids: string[] = (res.body || []).map((m: any) => m.id);
      expect(ids).toContain(matchId);
    });

    it("other-club admin does not see this club's match via /matches/manageable", async () => {
      const res = await request(app)
        .get(`/api/matches/manageable`)
        .set("Authorization", `Bearer ${otherAdminToken}`);
      expect(res.status).toBe(200);
      const ids: string[] = (res.body || []).map((m: any) => m.id);
      expect(ids).not.toContain(matchId);
    });

    it("/matches/manageable requires authentication", async () => {
      const res = await request(app).get(`/api/matches/manageable`);
      expect(res.status).toBe(401);
    });
  });

  // 5. OG middleware tags
  describe("OG middleware", () => {
    // Mini app exercises ogMetaMiddleware in isolation (the real api-server
    // only mounts it in production, but the middleware itself is what we want
    // to verify here).
    function makeOgApp() {
      const a = express();
      a.use(ogMetaMiddleware);
      a.get("/*splat", (_req, res) => res.status(200).send("<html><body>spa</body></html>"));
      return a;
    }

    it("returns OpenGraph HTML for /match/:id when bot UA is present", async () => {
      const ogApp = makeOgApp();
      const res = await request(ogApp)
        .get(`/match/${matchId}`)
        .set("User-Agent", "facebookexternalhit/1.1");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/html/);
      expect(res.text).toMatch(/og:title/);
      expect(res.text).toMatch(/og:image/);
      expect(res.text).toMatch(/og:url/);
    });

    it("does not intercept normal browser UA", async () => {
      const ogApp = makeOgApp();
      const res = await request(ogApp)
        .get(`/match/${matchId}`)
        .set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/120");
      expect(res.text).not.toMatch(/og:title/);
    });

    it("returns OpenGraph HTML for /tournaments/:id when bot UA is present", async () => {
      const ogApp = makeOgApp();
      const res = await request(ogApp)
        .get(`/tournaments/${tournamentId}`)
        .set("User-Agent", "Twitterbot/1.0");
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/og:title/);
    });

    it("falls through (no OG) when entity not found", async () => {
      const ogApp = makeOgApp();
      const res = await request(ogApp)
        .get(`/match/00000000-0000-0000-0000-000000000000`)
        .set("User-Agent", "facebookexternalhit/1.1");
      expect(res.text).not.toMatch(/og:title/);
    });
  });
});
