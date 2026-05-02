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

// Integration tests for GET /api/matches/:matchId/lineup/:teamSide (Task #110).
// Covers: position ordering, tournamentGoals counting, avgGoalsPerMatch math
// (rounded 1dp + divide-by-zero guard), empty roster -> 200 with players:[],
// invalid teamSide -> 400.
describe("GET /api/matches/:matchId/lineup/:teamSide", () => {
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
  let thirdMatchId = "";
  let homePlayerIds: string[] = [];
  const seasonYear = new Date().getUTCFullYear();

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const [club] = await db.insert(clubsTable)
      .values({ name: `Lineup Club ${stamp}`, slug: `lineup-club-${stamp}` }).returning();
    clubId = club.id;
    created.clubIds.push(clubId);

    const [tournament] = await db.insert(tournamentsTable)
      .values({ name: `Lineup Tournament ${stamp}`, clubId, status: "published" }).returning();
    tournamentId = tournament.id;
    created.tournamentIds.push(tournamentId);

    const [home] = await db.insert(teamsTable).values({ name: `Home ${stamp}`, clubId }).returning();
    const [away] = await db.insert(teamsTable).values({ name: `Away ${stamp}`, clubId }).returning();
    homeTeamId = home.id;
    awayTeamId = away.id;
    created.teamIds.push(homeTeamId, awayTeamId);

    // Insert 5 home players — we'll attach 4 to the lineup and verify the 5th
    // (a "sub" with position 5) is not surfaced. We give them out-of-order
    // positions to verify the endpoint sorts 1→4 deterministically.
    const inserted = await db.insert(playersTable).values([
      { name: `H1 ${stamp}`, homeClubId: clubId, isActive: true, handicap: "5" },
      { name: `H2 ${stamp}`, homeClubId: clubId, isActive: true, handicap: "3" },
      { name: `H3 ${stamp}`, homeClubId: clubId, isActive: true, handicap: "4" },
      { name: `H4 ${stamp}`, homeClubId: clubId, isActive: true, handicap: "2" },
      { name: `H5 ${stamp}`, homeClubId: clubId, isActive: true, handicap: "1" },
    ]).returning();
    homePlayerIds = inserted.map(p => p.id);
    created.playerIds.push(...homePlayerIds);

    // Attach players in deliberately scrambled position order (4, 2, 1, 3, 5)
    // so a non-sorting implementation would return them out of order.
    await db.insert(teamPlayersTable).values([
      { teamId: homeTeamId, playerId: homePlayerIds[0], position: 4, seasonYear, isActive: true },
      { teamId: homeTeamId, playerId: homePlayerIds[1], position: 2, seasonYear, isActive: true },
      { teamId: homeTeamId, playerId: homePlayerIds[2], position: 1, seasonYear, isActive: true },
      { teamId: homeTeamId, playerId: homePlayerIds[3], position: 3, seasonYear, isActive: true },
      // Sub at position 5 — must not appear in the returned lineup.
      { teamId: homeTeamId, playerId: homePlayerIds[4], position: 5, seasonYear, isActive: true },
    ]);

    const futureStart = new Date(Date.now() + 30 * 60_000);
    const [match] = await db.insert(matchesTable).values({
      tournamentId, homeTeamId, awayTeamId,
      scheduledAt: futureStart, status: "live",
    }).returning();
    matchId = match.id;
    created.matchIds.push(matchId);

    // Two extra matches in the same tournament so we can exercise the avg-per-
    // match math (player appears in 2 of 3 matches with 5 goals -> 2.5 avg).
    const [second] = await db.insert(matchesTable).values({
      tournamentId, homeTeamId, awayTeamId,
      scheduledAt: new Date(Date.now() + 60 * 60_000), status: "scheduled",
    }).returning();
    secondMatchId = second.id;
    created.matchIds.push(secondMatchId);
    const [third] = await db.insert(matchesTable).values({
      tournamentId, homeTeamId, awayTeamId,
      scheduledAt: new Date(Date.now() + 90 * 60_000), status: "scheduled",
    }).returning();
    thirdMatchId = third.id;
    created.matchIds.push(thirdMatchId);
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

  it("returns players ordered by position 1→4 even when DB rows are scrambled", async () => {
    const res = await request(app).get(`/api/matches/${matchId}/lineup/home`);
    expect(res.status).toBe(200);
    const players = res.body.players as Array<{ id: string; position: number; name: string }>;
    expect(players).toHaveLength(4);
    expect(players.map(p => p.position)).toEqual([1, 2, 3, 4]);
    // The sub at position 5 (homePlayerIds[4]) must not appear.
    expect(players.map(p => p.id)).not.toContain(homePlayerIds[4]);
    // Spot check: position 1 was assigned to homePlayerIds[2].
    expect(players[0].id).toBe(homePlayerIds[2]);
  });

  it("includes broadcastImageUrl, tournament, team identity, and totalHandicap", async () => {
    // Set an aux image on one player so we can verify it is exposed.
    await db.update(playersTable).set({ broadcastImageUrl: "https://cdn.example/aux.jpg" })
      .where(inArray(playersTable.id, [homePlayerIds[2]]));

    const res = await request(app).get(`/api/matches/${matchId}/lineup/home`);
    expect(res.status).toBe(200);
    expect(res.body.tournament).toMatchObject({ id: tournamentId });
    expect(res.body.team).toMatchObject({ id: homeTeamId, totalHandicap: 14 });
    const pos1 = (res.body.players as Array<any>).find(p => p.position === 1);
    expect(pos1).toBeTruthy();
    expect(pos1.broadcastImageUrl).toBe("https://cdn.example/aux.jpg");
    // Player surface fields the overlay needs.
    expect(pos1).toHaveProperty("homeClubName");
    expect(pos1).toHaveProperty("dateOfBirth");
    expect(pos1).toHaveProperty("handicap");
  });

  it("counts tournamentGoals across all tournament matches and computes avgGoalsPerMatch", async () => {
    const player = homePlayerIds[2]; // position 1
    // 3 goals in match 1 + 2 goals in match 2; player did NOT appear in match 3.
    // Expect tournamentGoals = 5, matches appeared = 2, avgGoalsPerMatch = 2.5.
    const goalEvents = [
      ...Array.from({ length: 3 }, () => ({ matchId, eventType: "goal" as const, teamId: homeTeamId, playerId: player, playerName: "H1" })),
      ...Array.from({ length: 2 }, () => ({ matchId: secondMatchId, eventType: "goal" as const, teamId: homeTeamId, playerId: player, playerName: "H1" })),
    ];
    await db.insert(matchEventsTable).values(goalEvents);

    const res = await request(app).get(`/api/matches/${matchId}/lineup/home`);
    expect(res.status).toBe(200);
    const pos1 = (res.body.players as Array<any>).find((p: any) => p.id === player);
    expect(pos1.tournamentGoals).toBe(5);
    expect(pos1.avgGoalsPerMatch).toBe(2.5);

    // Sanity: a player with no events still reports 0 / 0 (no NaN, no divide-by-zero).
    const emptyPlayer = (res.body.players as Array<any>).find((p: any) => p.id === homePlayerIds[1]);
    expect(emptyPlayer.tournamentGoals).toBe(0);
    expect(emptyPlayer.avgGoalsPerMatch).toBe(0);
  });

  it("rounds avgGoalsPerMatch to one decimal place", async () => {
    const player = homePlayerIds[2];
    // 1 goal across 3 matches -> 0.333… -> rounds to 0.3.
    await db.insert(matchEventsTable).values([
      { matchId, eventType: "goal" as const, teamId: homeTeamId, playerId: player, playerName: "H1" },
      // Non-goal events in the other two matches still mark the player as having appeared.
      { matchId: secondMatchId, eventType: "foul" as const, teamId: homeTeamId, playerId: player, playerName: "H1" },
      { matchId: thirdMatchId, eventType: "foul" as const, teamId: homeTeamId, playerId: player, playerName: "H1" },
    ]);

    const res = await request(app).get(`/api/matches/${matchId}/lineup/home`);
    expect(res.status).toBe(200);
    const pos1 = (res.body.players as Array<any>).find((p: any) => p.id === player);
    expect(pos1.tournamentGoals).toBe(1);
    expect(pos1.avgGoalsPerMatch).toBe(0.3);
  });

  it("returns 200 with empty players[] when the side has no rostered players", async () => {
    // Away team has no team_players rows at all.
    const res = await request(app).get(`/api/matches/${matchId}/lineup/away`);
    expect(res.status).toBe(200);
    expect(res.body.team).toMatchObject({ id: awayTeamId });
    expect(res.body.players).toEqual([]);
  });

  it("excludes position 5 even when low positions are missing from the roster", async () => {
    // Replace the home roster: only positions 3, 4, and 5 are filled.
    // The position-5 player must NOT leak into the lineup just because slots
    // 1 and 2 happen to be empty.
    await db.delete(teamPlayersTable).where(inArray(teamPlayersTable.teamId, [homeTeamId]));
    await db.insert(teamPlayersTable).values([
      { teamId: homeTeamId, playerId: homePlayerIds[0], position: 3, seasonYear, isActive: true },
      { teamId: homeTeamId, playerId: homePlayerIds[1], position: 4, seasonYear, isActive: true },
      { teamId: homeTeamId, playerId: homePlayerIds[2], position: 5, seasonYear, isActive: true },
    ]);

    const res = await request(app).get(`/api/matches/${matchId}/lineup/home`);
    expect(res.status).toBe(200);
    const players = res.body.players as Array<{ id: string; position: number }>;
    expect(players).toHaveLength(2);
    expect(players.map(p => p.position)).toEqual([3, 4]);
    expect(players.map(p => p.id)).not.toContain(homePlayerIds[2]);
  });

  it("returns 400 for an invalid teamSide", async () => {
    const res = await request(app).get(`/api/matches/${matchId}/lineup/middle`);
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown match", async () => {
    const res = await request(app).get(`/api/matches/00000000-0000-0000-0000-000000000000/lineup/home`);
    expect(res.status).toBe(404);
  });
});
