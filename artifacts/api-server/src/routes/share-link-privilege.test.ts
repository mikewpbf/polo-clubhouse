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
  fieldsTable,
} from "@workspace/db/schema";
import app from "../app";
import { generateToken } from "../lib/auth";

// Regression suite: share-link field-level privilege allowlists.
// These tests assert both the happy path (token CAN do action) and the denied
// path (token CANNOT do action) for every relevant endpoint so that future
// route changes cannot silently widen what a public share link can write.
//
// Routes under test:
//   PUT  /matches/:matchId              requireMatchWrite("gfx")
//   PUT  /matches/:matchId/broadcast    requireMatchWrite("gfx")
//   DELETE /matches/:matchId/events/:id requireMatchWrite("stats")

describe("share-link privilege drift prevention", () => {
  const created: {
    userIds: string[];
    clubIds: string[];
    tournamentIds: string[];
    matchIds: string[];
    teamIds: string[];
    fieldIds: string[];
    shareLinkIds: string[];
  } = {
    userIds: [],
    clubIds: [],
    tournamentIds: [],
    matchIds: [],
    teamIds: [],
    fieldIds: [],
    shareLinkIds: [],
  };

  let clubId = "";
  let tournamentId = "";
  let matchId = "";
  let homeTeamId = "";
  let awayTeamId = "";
  let fieldId = "";

  let adminToken = "";
  let gfxToken = "";
  let statsToken = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const passwordHash = await bcrypt.hash("x", 4);

    const [club] = await db.insert(clubsTable)
      .values({ name: `Test Club ${stamp}`, slug: `tc-${stamp}` }).returning();
    clubId = club.id;
    created.clubIds.push(clubId);

    const [admin] = await db.insert(usersTable).values({
      email: `admin-${stamp}@test.local`,
      displayName: "Admin",
      role: "admin",
      passwordHash,
    }).returning();
    created.userIds.push(admin.id);

    await db.insert(adminClubMembershipsTable).values({ userId: admin.id, clubId, role: "owner" });

    const [field] = await db.insert(fieldsTable).values({ name: `Field ${stamp}`, clubId }).returning();
    fieldId = field.id;
    created.fieldIds.push(fieldId);

    const [tournament] = await db.insert(tournamentsTable)
      .values({ name: `Tourney ${stamp}`, clubId, status: "published" }).returning();
    tournamentId = tournament.id;
    created.tournamentIds.push(tournamentId);

    const [home] = await db.insert(teamsTable).values({ name: `Home ${stamp}`, clubId }).returning();
    const [away] = await db.insert(teamsTable).values({ name: `Away ${stamp}`, clubId }).returning();
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
    }).returning();
    matchId = match.id;
    created.matchIds.push(matchId);

    const futureExpiry = new Date(Date.now() + 4 * 3600_000);

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

    adminToken = generateToken({
      id: admin.id,
      email: admin.email!,
      displayName: admin.displayName!,
      role: admin.role!,
    });
  });

  afterEach(async () => {
    if (created.shareLinkIds.length) {
      await db.delete(matchShareLinksTable).where(inArray(matchShareLinksTable.id, created.shareLinkIds));
    }
    if (created.matchIds.length) {
      await db.delete(matchEventsTable).where(inArray(matchEventsTable.matchId, created.matchIds));
      await db.delete(matchesTable).where(inArray(matchesTable.id, created.matchIds));
    }
    if (created.teamIds.length) {
      await db.delete(teamsTable).where(inArray(teamsTable.id, created.teamIds));
    }
    if (created.fieldIds.length) {
      await db.delete(fieldsTable).where(inArray(fieldsTable.id, created.fieldIds));
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

  // ─── PUT /matches/:matchId ──────────────────────────────────────────────────
  describe("PUT /matches/:matchId", () => {
    it("GFX token can update stream URL (allowed gfx field)", async () => {
      const res = await request(app)
        .put(`/api/matches/${matchId}`)
        .set("x-share-token", gfxToken)
        .send({ streamUrl: "https://example.com/stream" });

      expect(res.status).toBe(200);

      const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(row.streamUrl).toBe("https://example.com/stream");
    });

    it("GFX token silently ignores homeTeamId (admin-only field, DB unchanged)", async () => {
      const [before] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      const originalHomeTeamId = before.homeTeamId;

      const [altTeam] = await db.insert(teamsTable)
        .values({ name: `Alt Team ${Date.now()}`, clubId }).returning();
      created.teamIds.push(altTeam.id);

      // Include a valid GFX field so the update is non-empty and goes through.
      const res = await request(app)
        .put(`/api/matches/${matchId}`)
        .set("x-share-token", gfxToken)
        .send({ homeTeamId: altTeam.id, streamUrl: "https://example.com/s" });

      expect(res.status).toBe(200);

      const [after] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(after.homeTeamId).toBe(originalHomeTeamId);
    });

    it("GFX token silently ignores awayTeamId (admin-only field, DB unchanged)", async () => {
      const [before] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      const originalAwayTeamId = before.awayTeamId;

      const [altTeam] = await db.insert(teamsTable)
        .values({ name: `Alt Away ${Date.now()}`, clubId }).returning();
      created.teamIds.push(altTeam.id);

      const res = await request(app)
        .put(`/api/matches/${matchId}`)
        .set("x-share-token", gfxToken)
        .send({ awayTeamId: altTeam.id, streamUrl: "https://example.com/s" });

      expect(res.status).toBe(200);

      const [after] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(after.awayTeamId).toBe(originalAwayTeamId);
    });

    it("GFX token silently ignores fieldId (admin-only field, DB unchanged)", async () => {
      const res = await request(app)
        .put(`/api/matches/${matchId}`)
        .set("x-share-token", gfxToken)
        .send({ fieldId, streamUrl: "https://example.com/s" });

      expect(res.status).toBe(200);

      const [after] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(after.fieldId).toBeNull();
    });

    it("GFX token silently ignores scheduledAt (admin-only field, DB unchanged)", async () => {
      const [before] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      const originalScheduledAt = before.scheduledAt?.toISOString();

      const newDate = new Date(Date.now() + 99 * 3600_000).toISOString();
      const res = await request(app)
        .put(`/api/matches/${matchId}`)
        .set("x-share-token", gfxToken)
        .send({ scheduledAt: newDate, streamUrl: "https://example.com/s" });

      expect(res.status).toBe(200);

      const [after] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(after.scheduledAt?.toISOString()).toBe(originalScheduledAt);
    });

    it("Stats token is rejected at the middleware (403) — not allowed on this route", async () => {
      const res = await request(app)
        .put(`/api/matches/${matchId}`)
        .set("x-share-token", statsToken)
        .send({ streamUrl: "https://example.com/stream" });

      expect(res.status).toBe(403);
    });

    it("Admin can update admin-only fields (homeTeamId, fieldId)", async () => {
      const [altTeam] = await db.insert(teamsTable)
        .values({ name: `Admin Alt ${Date.now()}`, clubId }).returning();
      created.teamIds.push(altTeam.id);

      const res = await request(app)
        .put(`/api/matches/${matchId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ homeTeamId: altTeam.id, fieldId });

      expect(res.status).toBe(200);

      const [after] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(after.homeTeamId).toBe(altTeam.id);
      expect(after.fieldId).toBe(fieldId);
    });
  });

  // ─── PUT /matches/:matchId/broadcast ────────────────────────────────────────
  describe("PUT /matches/:matchId/broadcast", () => {
    it("GFX token can update broadcastVisible (200, DB updated)", async () => {
      const res = await request(app)
        .put(`/api/matches/${matchId}/broadcast`)
        .set("x-share-token", gfxToken)
        .send({ broadcastVisible: true });

      expect(res.status).toBe(200);

      const [after] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(after.broadcastVisible).toBe(true);
    });

    it("GFX token can update broadcastStyle (200, DB updated)", async () => {
      const res = await request(app)
        .put(`/api/matches/${matchId}/broadcast`)
        .set("x-share-token", gfxToken)
        .send({ broadcastStyle: "stats_mini" });

      expect(res.status).toBe(200);

      const [after] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(after.broadcastStyle).toBe("stats_mini");
    });

    it("Stats token is rejected at the middleware (403) — not allowed on this route", async () => {
      const res = await request(app)
        .put(`/api/matches/${matchId}/broadcast`)
        .set("x-share-token", statsToken)
        .send({ broadcastVisible: true });

      expect(res.status).toBe(403);

      const [after] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(after.broadcastVisible).toBeFalsy();
    });

    it("Admin can update broadcast settings (200, DB updated)", async () => {
      const res = await request(app)
        .put(`/api/matches/${matchId}/broadcast`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ broadcastVisible: true, broadcastStyle: "option2" });

      expect(res.status).toBe(200);

      const [after] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(after.broadcastVisible).toBe(true);
      expect(after.broadcastStyle).toBe("option2");
    });
  });

  // ─── DELETE /matches/:matchId/events/:eventId ────────────────────────────────
  describe("DELETE /matches/:matchId/events/:eventId", () => {
    it("Stats token can delete a non-score event (200, event removed)", async () => {
      const [ev] = await db.insert(matchEventsTable).values({
        matchId,
        eventType: "penalty",
        chukker: 1,
        clockSeconds: 0,
        scoreSnapshot: { home: 0, away: 0 },
      }).returning();

      const res = await request(app)
        .delete(`/api/matches/${matchId}/events/${ev.id}`)
        .set("x-share-token", statsToken);

      expect(res.status).toBe(200);

      const rows = await db.select().from(matchEventsTable).where(eq(matchEventsTable.id, ev.id));
      expect(rows.length).toBe(0);
    });

    it("Stats token cannot delete a goal event (403, event still present, score unchanged)", async () => {
      await db.update(matchesTable).set({ homeScore: 1 }).where(eq(matchesTable.id, matchId));

      const [ev] = await db.insert(matchEventsTable).values({
        matchId,
        eventType: "goal",
        teamId: homeTeamId,
        chukker: 1,
        clockSeconds: 60,
        scoreSnapshot: { home: 1, away: 0 },
      }).returning();

      const res = await request(app)
        .delete(`/api/matches/${matchId}/events/${ev.id}`)
        .set("x-share-token", statsToken);

      expect(res.status).toBe(403);

      const rows = await db.select().from(matchEventsTable).where(eq(matchEventsTable.id, ev.id));
      expect(rows.length).toBe(1);

      const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(match.homeScore).toBe(1);
    });

    it("Stats token cannot delete a penalty_goal event (403, event still present)", async () => {
      const [ev] = await db.insert(matchEventsTable).values({
        matchId,
        eventType: "penalty_goal",
        teamId: awayTeamId,
        chukker: 2,
        clockSeconds: 90,
        scoreSnapshot: { home: 0, away: 1 },
      }).returning();

      const res = await request(app)
        .delete(`/api/matches/${matchId}/events/${ev.id}`)
        .set("x-share-token", statsToken);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/score-affecting/i);

      const rows = await db.select().from(matchEventsTable).where(eq(matchEventsTable.id, ev.id));
      expect(rows.length).toBe(1);
    });

    it("GFX token is rejected at the middleware (403) — not allowed on this route", async () => {
      const [ev] = await db.insert(matchEventsTable).values({
        matchId,
        eventType: "penalty",
        chukker: 1,
        clockSeconds: 0,
        scoreSnapshot: { home: 0, away: 0 },
      }).returning();

      const res = await request(app)
        .delete(`/api/matches/${matchId}/events/${ev.id}`)
        .set("x-share-token", gfxToken);

      expect(res.status).toBe(403);

      const rows = await db.select().from(matchEventsTable).where(eq(matchEventsTable.id, ev.id));
      expect(rows.length).toBe(1);
    });

    it("Admin can delete a goal event (200, score decremented)", async () => {
      await db.update(matchesTable).set({ homeScore: 2, awayScore: 0 }).where(eq(matchesTable.id, matchId));

      const [ev] = await db.insert(matchEventsTable).values({
        matchId,
        eventType: "goal",
        teamId: homeTeamId,
        chukker: 1,
        clockSeconds: 30,
        scoreSnapshot: { home: 2, away: 0 },
      }).returning();

      const res = await request(app)
        .delete(`/api/matches/${matchId}/events/${ev.id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const rows = await db.select().from(matchEventsTable).where(eq(matchEventsTable.id, ev.id));
      expect(rows.length).toBe(0);

      const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(match.homeScore).toBe(1);
    });
  });
});
