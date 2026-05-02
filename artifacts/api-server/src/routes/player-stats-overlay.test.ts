import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  teamsTable,
  teamPlayersTable,
  playersTable,
  tournamentsTable,
  matchesTable,
  matchEventsTable,
} from "@workspace/db/schema";
import app from "../app";

// Integration tests for GET /api/matches/:matchId/player-stats/:playerId
// (Task #114). Covers: per-match stats, per-tournament aggregation including
// avg-per-match math, conversion percent with zero-shots guard, and the
// not-on-roster 404 path.
describe("GET /api/matches/:matchId/player-stats/:playerId", () => {
  const created: {
    clubIds: string[];
    teamIds: string[];
    playerIds: string[];
    tournamentIds: string[];
    matchIds: string[];
  } = { clubIds: [], teamIds: [], playerIds: [], tournamentIds: [], matchIds: [] };

  let clubId = "";
  let homeTeamId = "";
  let awayTeamId = "";
  let tournamentId = "";
  let matchId = "";
  let secondMatchId = "";
  let homePlayerId = "";
  let outsiderPlayerId = "";
  const seasonYear = new Date().getUTCFullYear();

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const [club] = await db.insert(clubsTable)
      .values({ name: `PS Club ${stamp}`, slug: `ps-club-${stamp}` }).returning();
    clubId = club.id;
    created.clubIds.push(clubId);

    const [tournament] = await db.insert(tournamentsTable)
      .values({ name: `PS Tournament ${stamp}`, clubId, status: "published" }).returning();
    tournamentId = tournament.id;
    created.tournamentIds.push(tournamentId);

    const [home] = await db.insert(teamsTable).values({ name: `Home ${stamp}`, clubId }).returning();
    const [away] = await db.insert(teamsTable).values({ name: `Away ${stamp}`, clubId }).returning();
    homeTeamId = home.id;
    awayTeamId = away.id;
    created.teamIds.push(homeTeamId, awayTeamId);

    const [hp] = await db.insert(playersTable)
      .values({ name: `Home Player ${stamp}`, homeClubId: clubId, isActive: true, handicap: "5" }).returning();
    homePlayerId = hp.id;
    const [op] = await db.insert(playersTable)
      .values({ name: `Outsider ${stamp}`, homeClubId: clubId, isActive: true, handicap: "2" }).returning();
    outsiderPlayerId = op.id;
    created.playerIds.push(homePlayerId, outsiderPlayerId);

    await db.insert(teamPlayersTable).values([
      { teamId: homeTeamId, playerId: homePlayerId, position: 1, seasonYear, isActive: true },
    ]);

    const [m1] = await db.insert(matchesTable).values({
      tournamentId, homeTeamId, awayTeamId,
      scheduledAt: new Date(Date.now() + 30 * 60_000), status: "live",
    }).returning();
    matchId = m1.id;
    created.matchIds.push(matchId);

    const [m2] = await db.insert(matchesTable).values({
      tournamentId, homeTeamId, awayTeamId,
      scheduledAt: new Date(Date.now() + 60 * 60_000), status: "scheduled",
    }).returning();
    secondMatchId = m2.id;
    created.matchIds.push(secondMatchId);
  });

  afterEach(async () => {
    if (created.matchIds.length) {
      await db.delete(matchEventsTable).where(inArray(matchEventsTable.matchId, created.matchIds));
      await db.delete(matchesTable).where(inArray(matchesTable.id, created.matchIds));
    }
    if (created.teamIds.length) {
      await db.delete(teamPlayersTable).where(inArray(teamPlayersTable.teamId, created.teamIds));
      await db.delete(teamsTable).where(inArray(teamsTable.id, created.teamIds));
    }
    if (created.playerIds.length) {
      await db.delete(playersTable).where(inArray(playersTable.id, created.playerIds));
    }
    if (created.tournamentIds.length) {
      await db.delete(tournamentsTable).where(inArray(tournamentsTable.id, created.tournamentIds));
    }
    if (created.clubIds.length) {
      await db.delete(clubsTable).where(inArray(clubsTable.id, created.clubIds));
    }
    Object.values(created).forEach(arr => (arr as string[]).length = 0);
  });

  afterAll(async () => { await pool.end(); });

  it("returns per-match stats with shotsOnGoal including goals and penalty goals", async () => {
    // 2 goals + 1 penalty_goal + 3 raw shot_on_goal + 2 throw_in_won in this match.
    // Per the team-stats convention, displayed shotsOnGoal = raw + goals + pen
    // = 3 + 2 + 1 = 6.
    await db.insert(matchEventsTable).values([
      ...Array.from({ length: 2 }, () => ({ matchId, eventType: "goal" as const, teamId: homeTeamId, playerId: homePlayerId })),
      { matchId, eventType: "penalty_goal" as const, teamId: homeTeamId, playerId: homePlayerId },
      ...Array.from({ length: 3 }, () => ({ matchId, eventType: "shot_on_goal" as const, teamId: homeTeamId, playerId: homePlayerId })),
      ...Array.from({ length: 2 }, () => ({ matchId, eventType: "throw_in_won" as const, teamId: homeTeamId, playerId: homePlayerId })),
    ]);

    const res = await request(app).get(`/api/matches/${matchId}/player-stats/${homePlayerId}`);
    expect(res.status).toBe(200);
    expect(res.body.player).toMatchObject({ id: homePlayerId, teamSide: "home" });
    expect(res.body.match).toEqual({
      goals: 2,
      shotsOnGoal: 6,
      penaltyGoals: 1,
      throwInsWon: 2,
    });
  });

  it("aggregates tournament stats across multiple matches and computes avg-per-match", async () => {
    // Match 1: 3 goals, 1 shot_on_goal. Match 2: 2 goals, 0 shots.
    // Total goals = 5 across 2 matches appeared -> avgPerMatch = 2.5.
    // shotsOnGoal = raw(1) + goals(5) + pen(0) = 6, conversion = 5/6 = 83%.
    await db.insert(matchEventsTable).values([
      ...Array.from({ length: 3 }, () => ({ matchId, eventType: "goal" as const, teamId: homeTeamId, playerId: homePlayerId })),
      { matchId, eventType: "shot_on_goal" as const, teamId: homeTeamId, playerId: homePlayerId },
      ...Array.from({ length: 2 }, () => ({ matchId: secondMatchId, eventType: "goal" as const, teamId: homeTeamId, playerId: homePlayerId })),
    ]);

    const res = await request(app).get(`/api/matches/${matchId}/player-stats/${homePlayerId}`);
    expect(res.status).toBe(200);
    expect(res.body.tournament.goals).toBe(5);
    expect(res.body.tournament.avgPerMatch).toBe(2.5);
    expect(res.body.tournament.shotsOnGoal).toBe(6);
    expect(res.body.tournament.conversion).toBe(83);
  });

  it("returns conversion=0 and avgPerMatch=0 when there are no shots and no appearances", async () => {
    const res = await request(app).get(`/api/matches/${matchId}/player-stats/${homePlayerId}`);
    expect(res.status).toBe(200);
    expect(res.body.match.goals).toBe(0);
    expect(res.body.match.shotsOnGoal).toBe(0);
    expect(res.body.tournament.conversion).toBe(0);
    expect(res.body.tournament.avgPerMatch).toBe(0);
  });

  it("returns 404 when the player is not on either team's current-season roster", async () => {
    const res = await request(app).get(`/api/matches/${matchId}/player-stats/${outsiderPlayerId}`);
    expect(res.status).toBe(404);
  });
});
