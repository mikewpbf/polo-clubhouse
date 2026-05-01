import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  usersTable,
  adminClubMembershipsTable,
  tournamentsTable,
  matchesTable,
  matchEventsTable,
  teamsTable,
  playersTable,
  teamPlayersTable,
} from "@workspace/db/schema";
import app from "../app";
import { generateToken } from "../lib/auth";

describe("Task #84 – score arithmetic on undo/delete", () => {
  const created: {
    userIds: string[];
    clubIds: string[];
    tournamentIds: string[];
    matchIds: string[];
    teamIds: string[];
    playerIds: string[];
  } = { userIds: [], clubIds: [], tournamentIds: [], matchIds: [], teamIds: [], playerIds: [] };

  let matchId = "";
  let homeTeamId = "";
  let awayTeamId = "";
  let homePlayerId = "";
  let adminToken = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const passwordHash = await bcrypt.hash("test", 4);

    const [club] = await db.insert(clubsTable)
      .values({ name: `Club ${stamp}`, slug: `club-${stamp}` }).returning();
    created.clubIds.push(club.id);

    const [admin] = await db.insert(usersTable).values({
      email: `admin-${stamp}@test.local`, displayName: "Admin", role: "admin", passwordHash,
    }).returning();
    created.userIds.push(admin.id);

    await db.insert(adminClubMembershipsTable).values({ userId: admin.id, clubId: club.id, role: "owner" });

    const [tournament] = await db.insert(tournamentsTable)
      .values({ name: `T ${stamp}`, clubId: club.id, status: "published" }).returning();
    created.tournamentIds.push(tournament.id);

    // Use names where home team sorts BEFORE away team alphabetically so that
    // enrichMatch's shouldSwap logic does NOT swap scores in responses.
    // "Alpha-home" < "Zeta-away" → shouldSwap = false → response shows DB values.
    const [home] = await db.insert(teamsTable).values({ name: `Alpha-home-${stamp}`, clubId: club.id }).returning();
    const [away] = await db.insert(teamsTable).values({ name: `Zeta-away-${stamp}`, clubId: club.id }).returning();
    homeTeamId = home.id;
    awayTeamId = away.id;
    created.teamIds.push(homeTeamId, awayTeamId);

    const [player] = await db.insert(playersTable)
      .values({ name: `Player ${stamp}`, homeClubId: club.id }).returning();
    homePlayerId = player.id;
    created.playerIds.push(homePlayerId);

    await db.insert(teamPlayersTable).values({
      teamId: homeTeamId,
      playerId: homePlayerId,
      position: 1,
      seasonYear: new Date().getUTCFullYear(),
    });

    const [match] = await db.insert(matchesTable).values({
      tournamentId: tournament.id,
      homeTeamId,
      awayTeamId,
      scheduledAt: new Date(Date.now() + 60_000),
      status: "live",
      homeScore: 3,
      awayScore: 5,
    }).returning();
    matchId = match.id;
    created.matchIds.push(matchId);

    adminToken = generateToken({
      id: admin.id,
      email: admin.email!,
      displayName: admin.displayName!,
      role: admin.role!,
    });
  });

  afterEach(async () => {
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

  it("POST goal increments score by exactly 1", async () => {
    const res = await request(app)
      .post(`/api/matches/${matchId}/goal`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ teamId: homeTeamId });

    expect(res.status).toBe(200);
    expect(res.body.homeScore).toBe(4);
    expect(res.body.awayScore).toBe(5);
  });

  it("POST goal then DELETE event restores score to original (round-trip via event delete)", async () => {
    // Step 1: add a goal (3 → 4)
    const goalRes = await request(app)
      .post(`/api/matches/${matchId}/goal`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ teamId: homeTeamId, playerId: homePlayerId });

    expect(goalRes.status).toBe(200);
    expect(goalRes.body.homeScore).toBe(4);

    // Retrieve the created goal event id from the events list
    const matchRes = await request(app)
      .get(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(matchRes.status).toBe(200);
    const goalEvent = (matchRes.body.events as any[]).find((e: any) => e.eventType === "goal");
    expect(goalEvent).toBeTruthy();

    // Step 2: delete the goal event (4 → should be 3, not 2)
    const delRes = await request(app)
      .delete(`/api/matches/${matchId}/events/${goalEvent.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.homeScore).toBe(3);
    expect(delRes.body.awayScore).toBe(5);
  });

  it("POST goal then POST undo-goal restores score to original (round-trip via undo)", async () => {
    // Step 1: add a goal (3 → 4)
    const goalRes = await request(app)
      .post(`/api/matches/${matchId}/goal`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ teamId: homeTeamId });

    expect(goalRes.status).toBe(200);
    expect(goalRes.body.homeScore).toBe(4);

    // Step 2: undo the goal (4 → should be 3, not 2)
    const undoRes = await request(app)
      .post(`/api/matches/${matchId}/undo-goal`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ teamId: homeTeamId });

    expect(undoRes.status).toBe(200);
    expect(undoRes.body.homeScore).toBe(3);
    expect(undoRes.body.awayScore).toBe(5);
  });

  it("multiple goals increment correctly and undo-goal decrements one at a time", async () => {
    // Score two goals
    await request(app)
      .post(`/api/matches/${matchId}/goal`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ teamId: homeTeamId });

    const secondGoalRes = await request(app)
      .post(`/api/matches/${matchId}/goal`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ teamId: homeTeamId });

    expect(secondGoalRes.status).toBe(200);
    expect(secondGoalRes.body.homeScore).toBe(5);

    // Undo one
    const undoRes = await request(app)
      .post(`/api/matches/${matchId}/undo-goal`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ teamId: homeTeamId });

    expect(undoRes.status).toBe(200);
    expect(undoRes.body.homeScore).toBe(4);
  });

  it("away team goal and undo-goal do not affect home score", async () => {
    const goalRes = await request(app)
      .post(`/api/matches/${matchId}/goal`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ teamId: awayTeamId });

    expect(goalRes.status).toBe(200);
    expect(goalRes.body.homeScore).toBe(3);
    expect(goalRes.body.awayScore).toBe(6);

    const undoRes = await request(app)
      .post(`/api/matches/${matchId}/undo-goal`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ teamId: awayTeamId });

    expect(undoRes.status).toBe(200);
    expect(undoRes.body.homeScore).toBe(3);
    expect(undoRes.body.awayScore).toBe(5);
  });

  it("DELETE goal event does not affect the other team's score", async () => {
    // Post a home goal
    await request(app)
      .post(`/api/matches/${matchId}/goal`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ teamId: homeTeamId });

    const matchRes = await request(app)
      .get(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    const goalEvent = (matchRes.body.events as any[]).find((e: any) => e.eventType === "goal");

    const delRes = await request(app)
      .delete(`/api/matches/${matchId}/events/${goalEvent.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.homeScore).toBe(3);
    expect(delRes.body.awayScore).toBe(5);
  });

  it("undo-goal with no existing goal events returns 409 and does not change score", async () => {
    // No goals have been scored — undo-goal should not silently decrement the score
    const res = await request(app)
      .post(`/api/matches/${matchId}/undo-goal`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ teamId: homeTeamId });

    // Should be rejected (no goal to undo) — score must stay at 3
    expect(res.status).toBe(409);

    // Confirm score is unchanged in DB
    const matchRes = await request(app)
      .get(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(matchRes.body.homeScore).toBe(3);
    expect(matchRes.body.awayScore).toBe(5);
  });

  it("undo-goal after goal+delete returns 409 and does not double-decrement", async () => {
    // Add a goal then delete the event; now there are no goal events left.
    // A subsequent undo-goal must NOT decrement again (3 → 4 → 3 → 2 bug).
    await request(app)
      .post(`/api/matches/${matchId}/goal`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ teamId: homeTeamId });

    const matchRes1 = await request(app)
      .get(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    const goalEvent = (matchRes1.body.events as any[]).find((e: any) => e.eventType === "goal");

    await request(app)
      .delete(`/api/matches/${matchId}/events/${goalEvent.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Score is now 3 again and the goal event is gone.
    // undo-goal must not silently decrement to 2.
    const undoRes = await request(app)
      .post(`/api/matches/${matchId}/undo-goal`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ teamId: homeTeamId });

    expect(undoRes.status).toBe(409);

    const matchRes2 = await request(app)
      .get(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(matchRes2.body.homeScore).toBe(3);
  });
});
