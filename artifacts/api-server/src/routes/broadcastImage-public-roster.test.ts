import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
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

// Verifies that the private broadcast aux image URL never leaks through public
// roster surfaces outside players.ts: GET /api/teams/:teamId/players (no auth)
// and GET /api/matches/:matchId (spectator match detail).
describe("broadcastImageUrl never appears on public roster endpoints", () => {
  const BROADCAST = "https://cdn.example/broadcast-aux.jpg";
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
  let homePlayerId = "";
  let awayPlayerId = "";
  let tournamentId = "";
  let matchId = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const [club] = await db.insert(clubsTable)
      .values({ name: `Club ${stamp}`, slug: `club-${stamp}` }).returning();
    clubId = club.id;
    created.clubIds.push(clubId);

    const [tournament] = await db.insert(tournamentsTable)
      .values({ name: `Tournament ${stamp}`, clubId, status: "published" }).returning();
    tournamentId = tournament.id;
    created.tournamentIds.push(tournamentId);

    const [home] = await db.insert(teamsTable).values({ name: `Home ${stamp}`, clubId }).returning();
    const [away] = await db.insert(teamsTable).values({ name: `Away ${stamp}`, clubId }).returning();
    homeTeamId = home.id;
    awayTeamId = away.id;
    created.teamIds.push(homeTeamId, awayTeamId);

    const [hp] = await db.insert(playersTable).values({
      name: `Home Player ${stamp}`,
      homeClubId: clubId,
      isActive: true,
      broadcastImageUrl: BROADCAST,
    }).returning();
    const [ap] = await db.insert(playersTable).values({
      name: `Away Player ${stamp}`,
      homeClubId: clubId,
      isActive: true,
      broadcastImageUrl: BROADCAST,
    }).returning();
    homePlayerId = hp.id;
    awayPlayerId = ap.id;
    created.playerIds.push(homePlayerId, awayPlayerId);

    const seasonYear = new Date().getUTCFullYear();
    await db.insert(teamPlayersTable).values([
      { teamId: homeTeamId, playerId: homePlayerId, position: 1, seasonYear, isActive: true },
      { teamId: awayTeamId, playerId: awayPlayerId, position: 1, seasonYear, isActive: true },
    ]);

    const [match] = await db.insert(matchesTable).values({
      tournamentId, homeTeamId, awayTeamId,
      scheduledAt: new Date(Date.now() + 30 * 60_000),
      status: "live",
    }).returning();
    matchId = match.id;
    created.matchIds.push(matchId);
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
    created.clubIds.length = 0;
    created.teamIds.length = 0;
    created.playerIds.length = 0;
    created.tournamentIds.length = 0;
    created.matchIds.length = 0;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("anonymous GET /api/teams/:teamId/players never includes broadcastImageUrl", async () => {
    const res = await request(app).get(`/api/teams/${homeTeamId}/players`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const ours = (res.body as Array<{ id: string }>).find(p => p.id === homePlayerId);
    expect(ours).toBeDefined();
    for (const p of res.body as Array<Record<string, unknown>>) {
      expect(p).not.toHaveProperty("broadcastImageUrl");
    }
    // Sanity: the row was actually populated in the DB, so absence is real
    // privacy stripping rather than a no-op against a null column.
    const [raw] = await db.select().from(playersTable).where(eq(playersTable.id, homePlayerId));
    expect(raw.broadcastImageUrl).toBe(BROADCAST);
  });

  it("anonymous GET /api/matches/:matchId roster never includes broadcastImageUrl", async () => {
    const res = await request(app).get(`/api/matches/${matchId}`);
    expect(res.status).toBe(200);
    const homePlayers = (res.body?.homeTeam?.players ?? []) as Array<Record<string, unknown>>;
    const awayPlayers = (res.body?.awayTeam?.players ?? []) as Array<Record<string, unknown>>;
    expect(homePlayers.length + awayPlayers.length).toBeGreaterThan(0);
    for (const p of [...homePlayers, ...awayPlayers]) {
      expect(p).not.toHaveProperty("broadcastImageUrl");
    }
  });
});
