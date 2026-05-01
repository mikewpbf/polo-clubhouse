import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { eq, inArray, isNull } from "drizzle-orm";
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
  possessionSegmentsTable,
} from "@workspace/db/schema";
import app from "../app";
import { generateToken } from "../lib/auth";

// End-to-end verification that full_control share tokens can exercise every
// write operation exposed by the Score Control page.
//
// Endpoints under test (all require full_control share or admin):
//   POST /matches/:matchId/goal             — score a goal
//   POST /matches/:matchId/chukker          — advance the chukker
//   POST /matches/:matchId/clock            — start / pause the clock
//   POST /matches/:matchId/possession       — set possession state
//   POST /matches/:matchId/undo-goal        — undo the last goal
//   POST /matches/:matchId/status           — change match status
//   POST /matches/:matchId/score            — directly set score
//   POST /matches/:matchId/event            — log a match event
//   DELETE /matches/:matchId/possession     — reset possession data
//
// Negative tests verify that:
//   - An unauthenticated request (no token at all) is rejected (401)
//   - A gfx share token is rejected on score/clock/chukker routes (403)
//   - A stats share token is rejected on score/clock/chukker routes (403)
//   - A full_control token for a different match is rejected (403)

describe("full_control share link — end-to-end score control", () => {
  const created: {
    userIds: string[];
    clubIds: string[];
    tournamentIds: string[];
    matchIds: string[];
    teamIds: string[];
    shareLinkIds: string[];
    possessionIds: string[];
  } = {
    userIds: [],
    clubIds: [],
    tournamentIds: [],
    matchIds: [],
    teamIds: [],
    shareLinkIds: [],
    possessionIds: [],
  };

  let clubId = "";
  let tournamentId = "";
  let matchId = "";
  let otherMatchId = "";
  let homeTeamId = "";
  let awayTeamId = "";

  let adminToken = "";
  let fullControlToken = "";
  let gfxToken = "";
  let statsToken = "";
  let otherMatchFullControlToken = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const passwordHash = await bcrypt.hash("x", 4);

    const [club] = await db.insert(clubsTable)
      .values({ name: `FC Test ${stamp}`, slug: `fc-${stamp}` }).returning();
    clubId = club.id;
    created.clubIds.push(clubId);

    const [admin] = await db.insert(usersTable).values({
      email: `admin-fc-${stamp}@test.local`,
      displayName: "Admin FC",
      role: "admin",
      passwordHash,
    }).returning();
    created.userIds.push(admin.id);

    await db.insert(adminClubMembershipsTable).values({ userId: admin.id, clubId, role: "owner" });

    const [tournament] = await db.insert(tournamentsTable)
      .values({ name: `Tournament FC ${stamp}`, clubId, status: "published" }).returning();
    tournamentId = tournament.id;
    created.tournamentIds.push(tournamentId);

    const [home] = await db.insert(teamsTable).values({ name: `Home FC ${stamp}`, clubId }).returning();
    const [away] = await db.insert(teamsTable).values({ name: `Away FC ${stamp}`, clubId }).returning();
    homeTeamId = home.id;
    awayTeamId = away.id;
    created.teamIds.push(homeTeamId, awayTeamId);

    const [match] = await db.insert(matchesTable).values({
      tournamentId,
      homeTeamId,
      awayTeamId,
      scheduledAt: new Date(Date.now() + 60 * 60_000),
      status: "live",
      homeScore: 0,
      awayScore: 0,
      currentChukker: 1,
      clockIsRunning: false,
      clockElapsedSeconds: 0,
    }).returning();
    matchId = match.id;
    created.matchIds.push(matchId);

    const [otherMatch] = await db.insert(matchesTable).values({
      tournamentId,
      homeTeamId,
      awayTeamId,
      scheduledAt: new Date(Date.now() + 2 * 60 * 60_000),
      status: "live",
      homeScore: 0,
      awayScore: 0,
      currentChukker: 1,
      clockIsRunning: false,
      clockElapsedSeconds: 0,
    }).returning();
    otherMatchId = otherMatch.id;
    created.matchIds.push(otherMatchId);

    const futureExpiry = new Date(Date.now() + 4 * 3600_000);

    const [fcLink] = await db.insert(matchShareLinksTable).values({
      matchId,
      pageType: "full_control",
      token: `fc-${stamp}`,
      expiresAt: futureExpiry,
    }).returning();
    fullControlToken = fcLink.token;
    created.shareLinkIds.push(fcLink.id);

    const [gfxLink] = await db.insert(matchShareLinksTable).values({
      matchId,
      pageType: "gfx",
      token: `gfx-${stamp}`,
      expiresAt: futureExpiry,
    }).returning();
    gfxToken = gfxLink.token;
    created.shareLinkIds.push(gfxLink.id);

    const [statsLink] = await db.insert(matchShareLinksTable).values({
      matchId,
      pageType: "stats",
      token: `stats-${stamp}`,
      expiresAt: futureExpiry,
    }).returning();
    statsToken = statsLink.token;
    created.shareLinkIds.push(statsLink.id);

    const [otherFcLink] = await db.insert(matchShareLinksTable).values({
      matchId: otherMatchId,
      pageType: "full_control",
      token: `fc-other-${stamp}`,
      expiresAt: futureExpiry,
    }).returning();
    otherMatchFullControlToken = otherFcLink.token;
    created.shareLinkIds.push(otherFcLink.id);

    adminToken = generateToken({
      id: admin.id,
      email: admin.email!,
      displayName: admin.displayName!,
      role: admin.role!,
    });
  });

  afterEach(async () => {
    if (created.possessionIds.length) {
      await db.delete(possessionSegmentsTable).where(inArray(possessionSegmentsTable.id, created.possessionIds));
      created.possessionIds.length = 0;
    }
    if (created.shareLinkIds.length) {
      await db.delete(matchShareLinksTable).where(inArray(matchShareLinksTable.id, created.shareLinkIds));
    }
    if (created.matchIds.length) {
      await db.delete(possessionSegmentsTable).where(inArray(possessionSegmentsTable.matchId, created.matchIds));
      await db.delete(matchEventsTable).where(inArray(matchEventsTable.matchId, created.matchIds));
      await db.delete(matchesTable).where(inArray(matchesTable.id, created.matchIds));
    }
    if (created.teamIds.length) {
      await db.delete(teamsTable).where(inArray(teamsTable.id, created.teamIds));
    }
    if (created.tournamentIds.length) {
      await db.delete(tournamentsTable).where(inArray(tournamentsTable.id, created.tournamentIds));
    }
    if (created.userIds.length) {
      await db.delete(adminClubMembershipsTable).where(inArray(adminClubMembershipsTable.userId, created.userIds));
      await db.delete(usersTable).where(inArray(usersTable.id, created.userIds));
    }
    if (created.clubIds.length) {
      await db.delete(clubsTable).where(inArray(clubsTable.id, created.clubIds));
    }
    Object.values(created).forEach((arr) => ((arr as string[]).length = 0));
  });

  afterAll(async () => {
    await pool.end();
  });

  // ─── Token resolution ────────────────────────────────────────────────────────
  describe("GET /api/share/:token", () => {
    it("resolves a full_control token and returns matchId + pageType", async () => {
      const res = await request(app).get(`/api/share/${fullControlToken}`);
      expect(res.status).toBe(200);
      expect(res.body.matchId).toBe(matchId);
      expect(res.body.pageType).toBe("full_control");
    });
  });

  // ─── Score a goal ───────────────────────────────────────────────────────────
  describe("POST /matches/:matchId/goal", () => {
    it("full_control token can score a home goal (200, score incremented)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/goal`)
        .set("x-share-token", fullControlToken)
        .send({ teamId: homeTeamId, type: "goal" });

      expect(res.status).toBe(200);

      const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(row.homeScore).toBe(1);
    });

    it("full_control token can score an away goal (200, away score incremented)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/goal`)
        .set("x-share-token", fullControlToken)
        .send({ teamId: awayTeamId, type: "goal" });

      expect(res.status).toBe(200);

      const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(row.awayScore).toBe(1);
    });

    it("gfx token is rejected on goal endpoint (403)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/goal`)
        .set("x-share-token", gfxToken)
        .send({ teamId: homeTeamId, type: "goal" });

      expect(res.status).toBe(403);
    });

    it("stats token is rejected on goal endpoint (403)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/goal`)
        .set("x-share-token", statsToken)
        .send({ teamId: homeTeamId, type: "goal" });

      expect(res.status).toBe(403);
    });

    it("unauthenticated request is rejected (401)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/goal`)
        .send({ teamId: homeTeamId, type: "goal" });

      expect(res.status).toBe(401);
    });

    it("full_control token for a different match is rejected (403)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/goal`)
        .set("x-share-token", otherMatchFullControlToken)
        .send({ teamId: homeTeamId, type: "goal" });

      expect(res.status).toBe(403);
    });
  });

  // ─── Undo a goal ────────────────────────────────────────────────────────────
  describe("POST /matches/:matchId/undo-goal", () => {
    it("full_control token can undo the last goal (200, score decremented)", async () => {
      await db.update(matchesTable).set({ homeScore: 2 }).where(eq(matchesTable.id, matchId));
      await db.insert(matchEventsTable).values({
        matchId,
        eventType: "goal",
        teamId: homeTeamId,
        chukker: 1,
        clockSeconds: 30,
        scoreSnapshot: { home: 2, away: 0 },
      });

      const res = await request(app)
        .post(`/api/matches/${matchId}/undo-goal`)
        .set("x-share-token", fullControlToken)
        .send({ teamId: homeTeamId });

      expect(res.status).toBe(200);

      const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(row.homeScore).toBe(1);
    });
  });

  // ─── Clock control ──────────────────────────────────────────────────────────
  describe("POST /matches/:matchId/clock", () => {
    it("full_control token can start the clock (200, clockIsRunning = true)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/clock`)
        .set("x-share-token", fullControlToken)
        .send({ action: "start" });

      expect(res.status).toBe(200);

      const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(row.clockIsRunning).toBe(true);
    });

    it("full_control token can pause the clock (200, clockIsRunning = false)", async () => {
      await db.update(matchesTable)
        .set({ clockIsRunning: true, clockStartedAt: new Date() })
        .where(eq(matchesTable.id, matchId));

      const res = await request(app)
        .post(`/api/matches/${matchId}/clock`)
        .set("x-share-token", fullControlToken)
        .send({ action: "pause" });

      expect(res.status).toBe(200);

      const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(row.clockIsRunning).toBe(false);
    });

    it("gfx token is rejected on clock endpoint (403)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/clock`)
        .set("x-share-token", gfxToken)
        .send({ action: "start" });

      expect(res.status).toBe(403);
    });

    it("unauthenticated request is rejected (401)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/clock`)
        .send({ action: "start" });

      expect(res.status).toBe(401);
    });
  });

  // ─── Chukker advance ────────────────────────────────────────────────────────
  describe("POST /matches/:matchId/chukker", () => {
    it("full_control token can advance the chukker (200, currentChukker increments)", async () => {
      const [before] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      const startChukker = before.currentChukker ?? 1;

      const res = await request(app)
        .post(`/api/matches/${matchId}/chukker`)
        .set("x-share-token", fullControlToken)
        .send({ action: "next" });

      expect(res.status).toBe(200);

      const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(row.currentChukker).toBe(startChukker + 1);
    });

    it("gfx token is rejected on chukker endpoint (403)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/chukker`)
        .set("x-share-token", gfxToken)
        .send({ action: "next" });

      expect(res.status).toBe(403);
    });

    it("stats token is rejected on chukker endpoint (403)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/chukker`)
        .set("x-share-token", statsToken)
        .send({ action: "next" });

      expect(res.status).toBe(403);
    });

    it("unauthenticated request is rejected (401)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/chukker`)
        .send({ action: "next" });

      expect(res.status).toBe(401);
    });
  });

  // ─── Possession tracking ─────────────────────────────────────────────────────
  describe("POST /matches/:matchId/possession", () => {
    it("full_control token can set home possession (200, currentState = home)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/possession`)
        .set("x-share-token", fullControlToken)
        .send({ state: "home" });

      expect(res.status).toBe(200);
      expect(res.body.currentState).toBe("home");

      const [seg] = await db.select().from(possessionSegmentsTable)
        .where(isNull(possessionSegmentsTable.endedAt))
        .orderBy(possessionSegmentsTable.startedAt);
      expect(seg?.possessionState).toBe("home");
    });

    it("full_control token can set away possession (200, currentState = away)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/possession`)
        .set("x-share-token", fullControlToken)
        .send({ state: "away" });

      expect(res.status).toBe(200);
      expect(res.body.currentState).toBe("away");
    });

    it("full_control token can set loose possession (200, currentState = null)", async () => {
      await request(app)
        .post(`/api/matches/${matchId}/possession`)
        .set("x-share-token", fullControlToken)
        .send({ state: "home" });

      const res = await request(app)
        .post(`/api/matches/${matchId}/possession`)
        .set("x-share-token", fullControlToken)
        .send({ state: "loose" });

      expect(res.status).toBe(200);
      expect(res.body.currentState).toBeNull();
    });

    it("stats token can also control possession (200)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/possession`)
        .set("x-share-token", statsToken)
        .send({ state: "away" });

      expect(res.status).toBe(200);
      expect(res.body.currentState).toBe("away");
    });

    it("gfx token is rejected on possession endpoint (403)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/possession`)
        .set("x-share-token", gfxToken)
        .send({ state: "home" });

      expect(res.status).toBe(403);
    });

    it("unauthenticated request with no token is rejected (403)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/possession`)
        .send({ state: "home" });

      expect(res.status).toBe(403);
    });

    it("full_control token for a different match is rejected (403)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/possession`)
        .set("x-share-token", otherMatchFullControlToken)
        .send({ state: "home" });

      expect(res.status).toBe(403);
    });
  });

  // ─── Reset possession ────────────────────────────────────────────────────────
  describe("DELETE /matches/:matchId/possession", () => {
    it("full_control token can reset all possession data (200)", async () => {
      await request(app)
        .post(`/api/matches/${matchId}/possession`)
        .set("x-share-token", fullControlToken)
        .send({ state: "home" });

      const res = await request(app)
        .delete(`/api/matches/${matchId}/possession`)
        .set("x-share-token", fullControlToken);

      expect(res.status).toBe(200);
    });
  });

  // ─── Match status ─────────────────────────────────────────────────────────
  describe("POST /matches/:matchId/status", () => {
    it("full_control token can change match status (200)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/status`)
        .set("x-share-token", fullControlToken)
        .send({ status: "halftime" });

      expect(res.status).toBe(200);

      const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(row.status).toBe("halftime");
    });

    it("gfx token is rejected on status endpoint (403)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/status`)
        .set("x-share-token", gfxToken)
        .send({ status: "halftime" });

      expect(res.status).toBe(403);
    });
  });

  // ─── Direct score update ──────────────────────────────────────────────────
  describe("POST /matches/:matchId/score", () => {
    it("full_control token can directly set the score (200)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/score`)
        .set("x-share-token", fullControlToken)
        .send({ homeScore: 3, awayScore: 2 });

      expect(res.status).toBe(200);

      const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(row.homeScore).toBe(3);
      expect(row.awayScore).toBe(2);
    });
  });

  // ─── Match event logging ─────────────────────────────────────────────────
  describe("POST /matches/:matchId/event", () => {
    it("full_control token can log a match event (200)", async () => {
      const res = await request(app)
        .post(`/api/matches/${matchId}/event`)
        .set("x-share-token", fullControlToken)
        .send({ eventType: "penalty", chukker: 1, clockSeconds: 120 });

      expect(res.status).toBe(200);
    });
  });
});
