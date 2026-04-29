import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  playersTable,
  teamsTable,
  teamPlayersTable,
  tournamentsTable,
  matchesTable,
} from "@workspace/db/schema";
import app from "../app";

describe("roster API surfaces position from team_players join", () => {
  const created: {
    clubIds: string[];
    playerIds: string[];
    teamIds: string[];
    tournamentIds: string[];
    matchIds: string[];
  } = { clubIds: [], playerIds: [], teamIds: [], tournamentIds: [], matchIds: [] };

  let clubId = "";
  let teamAId = "";
  let teamBId = "";
  let tournamentId = "";
  let matchId = "";

  let teamAPlayerIds: string[] = [];
  let teamBPlayerIds: string[] = [];
  let unlinkedPlayerId = "";

  const seasonYear = new Date().getUTCFullYear();

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const [club] = await db.insert(clubsTable)
      .values({ name: `Roster Club ${stamp}`, slug: `roster-club-${stamp}` }).returning();
    clubId = club.id;
    created.clubIds.push(clubId);

    const [teamA] = await db.insert(teamsTable)
      .values({ clubId, name: `A Team ${stamp}` }).returning();
    const [teamB] = await db.insert(teamsTable)
      .values({ clubId, name: `B Team ${stamp}` }).returning();
    teamAId = teamA.id;
    teamBId = teamB.id;
    created.teamIds.push(teamAId, teamBId);

    const teamAPlayers = await db.insert(playersTable).values([
      { name: `A1 ${stamp}`, homeClubId: clubId },
      { name: `A2 ${stamp}`, homeClubId: clubId },
      { name: `A3 ${stamp}`, homeClubId: clubId },
      { name: `A4 ${stamp}`, homeClubId: clubId },
    ]).returning();
    const teamBPlayers = await db.insert(playersTable).values([
      { name: `B1 ${stamp}`, homeClubId: clubId },
      { name: `B2 ${stamp}`, homeClubId: clubId },
      { name: `B3 ${stamp}`, homeClubId: clubId },
      { name: `B4 ${stamp}`, homeClubId: clubId },
    ]).returning();
    const [unlinked] = await db.insert(playersTable)
      .values({ name: `Unlinked ${stamp}`, homeClubId: clubId }).returning();

    teamAPlayerIds = teamAPlayers.map(p => p.id);
    teamBPlayerIds = teamBPlayers.map(p => p.id);
    unlinkedPlayerId = unlinked.id;
    created.playerIds.push(...teamAPlayerIds, ...teamBPlayerIds, unlinkedPlayerId);

    await db.insert(teamPlayersTable).values([
      { teamId: teamAId, playerId: teamAPlayerIds[0], seasonYear, position: 1 },
      { teamId: teamAId, playerId: teamAPlayerIds[1], seasonYear, position: 2 },
      { teamId: teamAId, playerId: teamAPlayerIds[2], seasonYear, position: 3 },
      { teamId: teamAId, playerId: teamAPlayerIds[3], seasonYear, position: 4 },
      { teamId: teamBId, playerId: teamBPlayerIds[0], seasonYear, position: 1 },
      { teamId: teamBId, playerId: teamBPlayerIds[1], seasonYear, position: 2 },
      { teamId: teamBId, playerId: teamBPlayerIds[2], seasonYear, position: 3 },
      { teamId: teamBId, playerId: teamBPlayerIds[3], seasonYear, position: 4 },
    ]);

    const [tournament] = await db.insert(tournamentsTable).values({
      clubId,
      name: `Roster Tourney ${stamp}`,
      status: "in_progress",
    }).returning();
    tournamentId = tournament.id;
    created.tournamentIds.push(tournamentId);

    const [match] = await db.insert(matchesTable).values({
      tournamentId,
      homeTeamId: teamAId,
      awayTeamId: teamBId,
      status: "scheduled",
    }).returning();
    matchId = match.id;
    created.matchIds.push(matchId);
  });

  afterEach(async () => {
    if (created.matchIds.length) {
      await db.delete(matchesTable).where(inArray(matchesTable.id, created.matchIds));
    }
    if (created.tournamentIds.length) {
      await db.delete(tournamentsTable).where(inArray(tournamentsTable.id, created.tournamentIds));
    }
    if (created.teamIds.length) {
      await db.delete(teamPlayersTable).where(inArray(teamPlayersTable.teamId, created.teamIds));
      await db.delete(teamsTable).where(inArray(teamsTable.id, created.teamIds));
    }
    if (created.playerIds.length) {
      await db.delete(playersTable).where(inArray(playersTable.id, created.playerIds));
    }
    if (created.clubIds.length) {
      await db.delete(clubsTable).where(inArray(clubsTable.id, created.clubIds));
    }
    created.matchIds.length = 0;
    created.tournamentIds.length = 0;
    created.teamIds.length = 0;
    created.playerIds.length = 0;
    created.clubIds.length = 0;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("GET /api/teams/:teamId/players returns each player with position from team_players", async () => {
    const res = await request(app).get(`/api/teams/${teamAId}/players`);
    expect(res.status).toBe(200);
    const players: Array<{ id: string; position: number | null }> = res.body;
    expect(players.length).toBe(4);

    const expected = new Map<string, number>([
      [teamAPlayerIds[0], 1],
      [teamAPlayerIds[1], 2],
      [teamAPlayerIds[2], 3],
      [teamAPlayerIds[3], 4],
    ]);
    for (const p of players) {
      expect(expected.has(p.id)).toBe(true);
      expect(p.position).toBe(expected.get(p.id));
    }

    expect(players.some(p => p.id === unlinkedPlayerId)).toBe(false);
    expect(players.some(p => teamBPlayerIds.includes(p.id))).toBe(false);
  });

  it("GET /api/matches/:matchId returns homeTeam.players and awayTeam.players with positions from team_players", async () => {
    const res = await request(app).get(`/api/matches/${matchId}`);
    expect(res.status).toBe(200);

    const homeTeam = res.body.homeTeam;
    const awayTeam = res.body.awayTeam;
    expect(homeTeam).toBeTruthy();
    expect(awayTeam).toBeTruthy();

    // enrichMatch may swap home/away alphabetically, so resolve by team id.
    const teamABody = homeTeam.id === teamAId ? homeTeam : awayTeam;
    const teamBBody = homeTeam.id === teamBId ? homeTeam : awayTeam;
    expect(teamABody.id).toBe(teamAId);
    expect(teamBBody.id).toBe(teamBId);

    const teamAPlayers: Array<{ id: string; position: number | null }> = teamABody.players;
    const teamBPlayers: Array<{ id: string; position: number | null }> = teamBBody.players;
    expect(teamAPlayers.length).toBe(4);
    expect(teamBPlayers.length).toBe(4);

    const expectedA = new Map<string, number>([
      [teamAPlayerIds[0], 1],
      [teamAPlayerIds[1], 2],
      [teamAPlayerIds[2], 3],
      [teamAPlayerIds[3], 4],
    ]);
    const expectedB = new Map<string, number>([
      [teamBPlayerIds[0], 1],
      [teamBPlayerIds[1], 2],
      [teamBPlayerIds[2], 3],
      [teamBPlayerIds[3], 4],
    ]);
    for (const p of teamAPlayers) {
      expect(expectedA.has(p.id)).toBe(true);
      expect(p.position).toBe(expectedA.get(p.id));
    }
    for (const p of teamBPlayers) {
      expect(expectedB.has(p.id)).toBe(true);
      expect(p.position).toBe(expectedB.get(p.id));
    }

    expect(teamAPlayers.some(p => p.id === unlinkedPlayerId)).toBe(false);
    expect(teamBPlayers.some(p => p.id === unlinkedPlayerId)).toBe(false);
    expect(teamAPlayers.some(p => teamBPlayerIds.includes(p.id))).toBe(false);
    expect(teamBPlayers.some(p => teamAPlayerIds.includes(p.id))).toBe(false);
  });
});
