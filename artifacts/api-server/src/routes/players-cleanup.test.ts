import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  playersTable,
  teamsTable,
  teamPlayersTable,
  matchesTable,
  matchEventsTable,
  tournamentsTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app";
import { generateToken } from "../lib/auth";

describe("POST /api/admin/players/cleanup", () => {
  const created: {
    userIds: string[];
    clubIds: string[];
    playerIds: string[];
    teamIds: string[];
    tournamentIds: string[];
    matchIds: string[];
  } = { userIds: [], clubIds: [], playerIds: [], teamIds: [], tournamentIds: [], matchIds: [] };

  let superToken = "";
  let regularToken = "";
  let stamp = "";

  // Player IDs we'll set up per-test
  let canonicalPlayerId = "";
  let dupPlayerHighGoalsId = "";
  let dupPlayerLowGoalsId = "";
  let lonelyPlayerId = "";
  let activePlayerId = "";

  beforeEach(async () => {
    stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const passwordHash = await bcrypt.hash("test-pass", 4);

    const [superUser] = await db.insert(usersTable).values({
      email: `super-${stamp}@test.local`,
      displayName: "Super",
      role: "super_admin",
      passwordHash,
    }).returning();
    const [regularUser] = await db.insert(usersTable).values({
      email: `regular-${stamp}@test.local`,
      displayName: "Regular",
      role: "spectator",
      passwordHash,
    }).returning();
    created.userIds.push(superUser.id, regularUser.id);
    superToken = generateToken({ id: superUser.id, email: superUser.email!, displayName: superUser.displayName!, role: superUser.role! });
    regularToken = generateToken({ id: regularUser.id, email: regularUser.email!, displayName: regularUser.displayName!, role: regularUser.role! });

    const [club] = await db.insert(clubsTable).values({ name: `Club ${stamp}`, slug: `club-${stamp}` }).returning();
    created.clubIds.push(club.id);

    const [tournament] = await db.insert(tournamentsTable).values({
      name: `Tournament ${stamp}`,
      clubId: club.id,
      status: "completed",
    }).returning();
    created.tournamentIds.push(tournament.id);

    const [teamHome] = await db.insert(teamsTable).values({ name: `Home ${stamp}`, clubId: club.id }).returning();
    const [teamAway] = await db.insert(teamsTable).values({ name: `Away ${stamp}`, clubId: club.id }).returning();
    created.teamIds.push(teamHome.id, teamAway.id);

    const [match] = await db.insert(matchesTable).values({
      tournamentId: tournament.id,
      homeTeamId: teamHome.id,
      awayTeamId: teamAway.id,
      status: "final",
      homeScore: 5,
      awayScore: 3,
      scheduledAt: new Date(),
    }).returning();
    created.matchIds.push(match.id);

    // Three "Cleanup Riley" records (duplicates) — one with 4 goals,
    // one with 1 goal, one with 0 goals — plus a non-dup "Cleanup Active" who
    // has scored, and a "Cleanup Lonely" who has never played.
    const dupName = `Cleanup Riley ${stamp}`;
    const [dupHigh] = await db.insert(playersTable).values({ name: dupName }).returning();
    const [dupLow] = await db.insert(playersTable).values({ name: `  ${dupName.toUpperCase()}  ` }).returning();
    const [dupZero] = await db.insert(playersTable).values({ name: dupName.toLowerCase() }).returning();
    const [active] = await db.insert(playersTable).values({ name: `Cleanup Active ${stamp}` }).returning();
    const [lonely] = await db.insert(playersTable).values({ name: `Cleanup Lonely ${stamp}` }).returning();
    created.playerIds.push(dupHigh.id, dupLow.id, dupZero.id, active.id, lonely.id);
    dupPlayerHighGoalsId = dupHigh.id;
    dupPlayerLowGoalsId = dupLow.id;
    canonicalPlayerId = dupHigh.id; // expected canonical (highest goals)
    activePlayerId = active.id;
    lonelyPlayerId = lonely.id;

    // Goal events: 4 for high-dup, 1 for low-dup, 0 for zero-dup, 2 for active.
    const goalRows = [
      ...Array(4).fill(0).map(() => ({ matchId: match.id, eventType: "goal" as const, teamId: teamHome.id, playerId: dupHigh.id, playerName: dupName })),
      ...Array(1).fill(0).map(() => ({ matchId: match.id, eventType: "goal" as const, teamId: teamHome.id, playerId: dupLow.id, playerName: dupName })),
      ...Array(2).fill(0).map(() => ({ matchId: match.id, eventType: "goal" as const, teamId: teamAway.id, playerId: active.id, playerName: `Cleanup Active ${stamp}` })),
    ];
    await db.insert(matchEventsTable).values(goalRows);

    // Roster links: low-dup is on the home team for season 2026, zero-dup is on
    // the away team for season 2026. After merge canonical should hold both.
    await db.insert(teamPlayersTable).values([
      { teamId: teamHome.id, playerId: dupLow.id, seasonYear: 2026, position: 1 },
      { teamId: teamAway.id, playerId: dupZero.id, seasonYear: 2026, position: 2 },
      { teamId: teamHome.id, playerId: active.id, seasonYear: 2026, position: 3 },
    ]);

    // Note: lonelyPlayerId is on no team and has no events — should be deleted.
    void dupPlayerLowGoalsId;
    void lonelyPlayerId;
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
    if (created.userIds.length) {
      await db.delete(usersTable).where(inArray(usersTable.id, created.userIds));
    }
    Object.keys(created).forEach(k => { (created as any)[k].length = 0; });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("requires super admin", async () => {
    const res = await request(app)
      .post("/api/admin/players/cleanup")
      .set("Authorization", `Bearer ${regularToken}`);
    expect(res.status).toBe(403);
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/admin/players/cleanup");
    expect(res.status).toBe(401);
  });

  it("dry run reports what WOULD change but does not commit", async () => {
    const res = await request(app)
      .post("/api/admin/players/cleanup?dryRun=true")
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.executed).toBe(false);

    // Find our specific dup group in the report (others may exist if dev DB has data).
    const ourGroup = res.body.mergedGroups.find((g: any) => g.canonicalId === canonicalPlayerId);
    expect(ourGroup).toBeDefined();
    expect(ourGroup.mergedDuplicateIds).toHaveLength(2);
    expect(res.body.noEventPlayerNames).toContain(`Cleanup Lonely ${stamp}`);

    // Confirm DB unchanged.
    const stillThere = await db.select().from(playersTable).where(inArray(playersTable.id, created.playerIds));
    expect(stillThere.length).toBe(5);
  });

  it("execute merges duplicate-name players into canonical and removes no-event players", async () => {
    const res = await request(app)
      .post("/api/admin/players/cleanup?dryRun=false")
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.executed).toBe(true);

    // Canonical (highest goals) survives; both duplicates are gone.
    const survivors = await db.select().from(playersTable).where(inArray(playersTable.id, [
      canonicalPlayerId, dupPlayerLowGoalsId, lonelyPlayerId, activePlayerId,
    ]));
    const survivingIds = survivors.map(p => p.id).sort();
    expect(survivingIds).toEqual([canonicalPlayerId, activePlayerId].sort());

    // All 5 goal events for the merged Riley records now point at canonical.
    const events = await db.select().from(matchEventsTable).where(eq(matchEventsTable.playerId, canonicalPlayerId));
    expect(events.length).toBe(5);

    // Roster links got reassigned to canonical (both team rows that didn't conflict).
    const links = await db.select().from(teamPlayersTable).where(eq(teamPlayersTable.playerId, canonicalPlayerId));
    expect(links.length).toBe(2);
    const teamIds = links.map(l => l.teamId).sort();
    expect(teamIds).toEqual([...created.teamIds].sort());
  });

  it("handles team_players unique constraint by dropping conflicting dup links", async () => {
    // Add a roster link for the canonical (high-dup) on the home team / 2026 —
    // this collides with low-dup's existing link on the same (team, season).
    await db.insert(teamPlayersTable).values({
      teamId: created.teamIds[0], playerId: canonicalPlayerId, seasonYear: 2026, position: 5,
    });

    const res = await request(app)
      .post("/api/admin/players/cleanup?dryRun=false")
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);

    // Canonical now has its original link plus the away-team link from zero-dup;
    // the home-team link from low-dup was dropped as a conflict (not duplicated).
    const links = await db.select().from(teamPlayersTable).where(eq(teamPlayersTable.playerId, canonicalPlayerId));
    expect(links.length).toBe(2);
    expect(res.body.teamLinksDroppedAsConflict).toBeGreaterThanOrEqual(1);
  });
});
