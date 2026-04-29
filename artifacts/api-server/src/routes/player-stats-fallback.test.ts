import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  playersTable,
  teamsTable,
  matchesTable,
  matchEventsTable,
  tournamentsTable,
} from "@workspace/db/schema";
import app from "../app";

// Regression coverage for the GET /players/:playerId stats fix. Players added
// directly to a tournament without ever being placed on a current-season team
// roster (no team_players row) used to always report 0 career wins, because
// the wins computation iterated team_players to know which side of each match
// the player was on. The fix derives the side from match_events.team_id when
// no roster link exists.
describe("GET /api/players/:playerId — wins fallback for legacy data", () => {
  const created: {
    clubIds: string[];
    playerIds: string[];
    teamIds: string[];
    tournamentIds: string[];
    matchIds: string[];
  } = { clubIds: [], playerIds: [], teamIds: [], tournamentIds: [], matchIds: [] };

  let legacyPlayerId = "";
  let homeTeamId = "";
  let awayTeamId = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const [club] = await db.insert(clubsTable).values({ name: `Club ${stamp}`, slug: `club-${stamp}` }).returning();
    created.clubIds.push(club.id);

    const [tournament] = await db.insert(tournamentsTable).values({
      name: `Tournament ${stamp}`,
      clubId: club.id,
      status: "completed",
    }).returning();
    created.tournamentIds.push(tournament.id);

    const [home] = await db.insert(teamsTable).values({ name: `Home ${stamp}`, clubId: club.id }).returning();
    const [away] = await db.insert(teamsTable).values({ name: `Away ${stamp}`, clubId: club.id }).returning();
    homeTeamId = home.id;
    awayTeamId = away.id;
    created.teamIds.push(home.id, away.id);

    // The legacy player has zero team_players rows.
    const [player] = await db.insert(playersTable).values({ name: `Legacy ${stamp}` }).returning();
    legacyPlayerId = player.id;
    created.playerIds.push(player.id);

    // Two finalized matches:
    //   - Match A: home wins 5-3, legacy player scored 3 goals on the home team → win.
    //   - Match B: away wins 6-2, legacy player scored 2 goals on the home team → loss.
    const [matchA] = await db.insert(matchesTable).values({
      tournamentId: tournament.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      status: "final",
      homeScore: 5,
      awayScore: 3,
      scheduledAt: new Date(),
    }).returning();
    const [matchB] = await db.insert(matchesTable).values({
      tournamentId: tournament.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      status: "final",
      homeScore: 2,
      awayScore: 6,
      scheduledAt: new Date(),
    }).returning();
    created.matchIds.push(matchA.id, matchB.id);

    await db.insert(matchEventsTable).values([
      ...Array(3).fill(0).map(() => ({ matchId: matchA.id, eventType: "goal" as const, teamId: home.id, playerId: player.id })),
      ...Array(2).fill(0).map(() => ({ matchId: matchB.id, eventType: "goal" as const, teamId: home.id, playerId: player.id })),
    ]);
  });

  afterEach(async () => {
    if (created.matchIds.length) {
      await db.delete(matchEventsTable).where(inArray(matchEventsTable.matchId, created.matchIds));
      await db.delete(matchesTable).where(inArray(matchesTable.id, created.matchIds));
    }
    if (created.tournamentIds.length) {
      await db.delete(tournamentsTable).where(inArray(tournamentsTable.id, created.tournamentIds));
    }
    if (created.teamIds.length) {
      await db.delete(teamsTable).where(inArray(teamsTable.id, created.teamIds));
    }
    if (created.playerIds.length) {
      await db.delete(playersTable).where(inArray(playersTable.id, created.playerIds));
    }
    if (created.clubIds.length) {
      await db.delete(clubsTable).where(inArray(clubsTable.id, created.clubIds));
    }
    Object.keys(created).forEach(k => { (created as any)[k].length = 0; });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("derives match side from match_events when team_players is empty", async () => {
    const res = await request(app).get(`/api/players/${legacyPlayerId}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.careerGoals).toBe(5);
    // 1 win (Match A), 0 wins from Match B (away won, player was on home side).
    expect(res.body.stats.careerWins).toBe(1);
    void homeTeamId; void awayTeamId;
  });
});
