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
  teamManagerAssignmentsTable,
  usersTable,
  adminClubMembershipsTable,
  horsesTable,
} from "@workspace/db/schema";
import app from "../app";
import { generateToken } from "../lib/auth";

describe("cross-team / cross-profile authorization regressions", () => {
  const created: {
    userIds: string[];
    clubIds: string[];
    playerIds: string[];
    teamIds: string[];
  } = { userIds: [], clubIds: [], playerIds: [], teamIds: [] };

  let clubAId = "";
  let clubBId = "";
  let teamAId = "";
  let teamBId = "";
  let playerOnTeamAId = "";
  let playerOnTeamBId = "";
  let linkedPlayerId = "";

  let clubAAdminToken = "";
  let teamAManagerToken = "";
  let linkedUserToken = "";
  let strangerToken = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const passwordHash = await bcrypt.hash("test-pass", 4);

    const [clubA] = await db.insert(clubsTable)
      .values({ name: `Club A ${stamp}`, slug: `club-a-${stamp}` }).returning();
    const [clubB] = await db.insert(clubsTable)
      .values({ name: `Club B ${stamp}`, slug: `club-b-${stamp}` }).returning();
    clubAId = clubA.id;
    clubBId = clubB.id;
    created.clubIds.push(clubAId, clubBId);

    const [clubAAdmin] = await db.insert(usersTable).values({
      email: `club-a-admin-${stamp}@test.local`,
      displayName: "Club A Admin",
      role: "admin",
      passwordHash,
    }).returning();
    const [teamAManager] = await db.insert(usersTable).values({
      email: `team-a-mgr-${stamp}@test.local`,
      displayName: "Team A Manager",
      role: "team_manager",
      passwordHash,
    }).returning();
    const [linkedUser] = await db.insert(usersTable).values({
      email: `linked-${stamp}@test.local`,
      displayName: "Linked User",
      role: "spectator",
      passwordHash,
    }).returning();
    const [stranger] = await db.insert(usersTable).values({
      email: `stranger-${stamp}@test.local`,
      displayName: "Stranger",
      role: "spectator",
      passwordHash,
    }).returning();
    created.userIds.push(clubAAdmin.id, teamAManager.id, linkedUser.id, stranger.id);

    await db.insert(adminClubMembershipsTable).values([
      { userId: clubAAdmin.id, clubId: clubAId, role: "owner" },
    ]);

    const [teamA] = await db.insert(teamsTable)
      .values({ clubId: clubAId, name: `Team A ${stamp}` }).returning();
    const [teamB] = await db.insert(teamsTable)
      .values({ clubId: clubBId, name: `Team B ${stamp}` }).returning();
    teamAId = teamA.id;
    teamBId = teamB.id;
    created.teamIds.push(teamAId, teamBId);

    const [pA] = await db.insert(playersTable)
      .values({ name: `Player on Team A ${stamp}`, homeClubId: clubAId }).returning();
    const [pB] = await db.insert(playersTable)
      .values({ name: `Player on Team B ${stamp}`, homeClubId: clubBId }).returning();
    const [pLinked] = await db.insert(playersTable).values({
      name: `Linked Player ${stamp}`,
      homeClubId: clubAId,
      managedByUserId: linkedUser.id,
    }).returning();
    playerOnTeamAId = pA.id;
    playerOnTeamBId = pB.id;
    linkedPlayerId = pLinked.id;
    created.playerIds.push(playerOnTeamAId, playerOnTeamBId, linkedPlayerId);

    const seasonYear = new Date().getUTCFullYear();
    await db.insert(teamPlayersTable).values([
      { teamId: teamAId, playerId: playerOnTeamAId, seasonYear },
      { teamId: teamBId, playerId: playerOnTeamBId, seasonYear },
    ]);

    await db.insert(teamManagerAssignmentsTable).values({
      userId: teamAManager.id,
      teamId: teamAId,
      status: "active",
    });

    clubAAdminToken = generateToken({
      id: clubAAdmin.id, email: clubAAdmin.email!,
      displayName: clubAAdmin.displayName!, role: clubAAdmin.role!,
    });
    teamAManagerToken = generateToken({
      id: teamAManager.id, email: teamAManager.email!,
      displayName: teamAManager.displayName!, role: teamAManager.role!,
    });
    linkedUserToken = generateToken({
      id: linkedUser.id, email: linkedUser.email!,
      displayName: linkedUser.displayName!, role: linkedUser.role!,
    });
    strangerToken = generateToken({
      id: stranger.id, email: stranger.email!,
      displayName: stranger.displayName!, role: stranger.role!,
    });
  });

  afterEach(async () => {
    if (created.userIds.length) {
      await db.delete(teamManagerAssignmentsTable)
        .where(inArray(teamManagerAssignmentsTable.userId, created.userIds));
    }
    if (created.teamIds.length) {
      await db.delete(teamPlayersTable)
        .where(inArray(teamPlayersTable.teamId, created.teamIds));
      await db.delete(teamsTable)
        .where(inArray(teamsTable.id, created.teamIds));
    }
    if (created.playerIds.length) {
      // Horses cascade on player delete, but clear explicitly so any leaked rows
      // (e.g. from a regressed authorization check) don't survive across tests.
      await db.delete(horsesTable)
        .where(inArray(horsesTable.playerId, created.playerIds));
      await db.delete(playersTable)
        .where(inArray(playersTable.id, created.playerIds));
    }
    if (created.userIds.length) {
      await db.delete(adminClubMembershipsTable)
        .where(inArray(adminClubMembershipsTable.userId, created.userIds));
      await db.delete(usersTable)
        .where(inArray(usersTable.id, created.userIds));
    }
    if (created.clubIds.length) {
      await db.delete(clubsTable)
        .where(inArray(clubsTable.id, created.clubIds));
    }
    created.userIds.length = 0;
    created.clubIds.length = 0;
    created.playerIds.length = 0;
    created.teamIds.length = 0;
  });

  afterAll(async () => {
    await pool.end();
  });

  // (1) PATCH /players/:id/profile must not let a club admin edit a player whose
  // managed_by_user_id does not match — it is strictly self-only.
  it("club admin cannot PATCH /players/:id/profile of a player they don't own (403)", async () => {
    const res = await request(app)
      .patch(`/api/players/${playerOnTeamAId}/profile`)
      .set("Authorization", `Bearer ${clubAAdminToken}`)
      .send({ bio: "hijacked bio" });
    expect(res.status).toBe(403);

    const [row] = await db.select().from(playersTable)
      .where(eq(playersTable.id, playerOnTeamAId));
    expect(row.bio ?? null).toBeNull();
  });

  it("an unrelated user cannot PATCH /players/:id/profile of a linked player (403)", async () => {
    const res = await request(app)
      .patch(`/api/players/${linkedPlayerId}/profile`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ bio: "hijacked bio" });
    expect(res.status).toBe(403);

    const [row] = await db.select().from(playersTable)
      .where(eq(playersTable.id, linkedPlayerId));
    expect(row.bio ?? null).toBeNull();
  });

  // (2) Cross-team IDOR: team-A manager attempting to mutate a player who lives
  // on team B must get a 404 "Player is not on this team", not a silent edit.
  it("team-A manager cannot PUT /teams/:teamA/players/:playerOnTeamB (404)", async () => {
    const res = await request(app)
      .put(`/api/teams/${teamAId}/players/${playerOnTeamBId}`)
      .set("Authorization", `Bearer ${teamAManagerToken}`)
      .send({ position: 4 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Player is not on this team");

    // The cross-team player's roster row on team B must remain unchanged.
    const [tp] = await db.select().from(teamPlayersTable)
      .where(eq(teamPlayersTable.playerId, playerOnTeamBId));
    expect(tp.position ?? null).toBeNull();
  });

  it("team-A manager cannot DELETE /teams/:teamA/players/:playerOnTeamB (404)", async () => {
    const res = await request(app)
      .delete(`/api/teams/${teamAId}/players/${playerOnTeamBId}`)
      .set("Authorization", `Bearer ${teamAManagerToken}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Player is not on this team");

    // The roster row on team B must still exist.
    const rows = await db.select().from(teamPlayersTable)
      .where(eq(teamPlayersTable.playerId, playerOnTeamBId));
    expect(rows.length).toBe(1);
    expect(rows[0].teamId).toBe(teamBId);
  });

  // (3) DELETE /players/:playerId — `requireSelfOrEditor(false)` must only allow
  // a club admin to delete players whose canonical homeClubId they administer,
  // and must never allow a team manager to delete a player just because that
  // player is on a roster they manage.
  it("club-A admin cannot DELETE /players/:playerOnClubB (403, player still exists)", async () => {
    const res = await request(app)
      .delete(`/api/players/${playerOnTeamBId}`)
      .set("Authorization", `Bearer ${clubAAdminToken}`);
    expect(res.status).toBe(403);

    const rows = await db.select().from(playersTable)
      .where(eq(playersTable.id, playerOnTeamBId));
    expect(rows.length).toBe(1);
    expect(rows[0].homeClubId).toBe(clubBId);
  });

  it("team-A manager cannot DELETE /players/:playerOnTeamA (403, player still exists)", async () => {
    const res = await request(app)
      .delete(`/api/players/${playerOnTeamAId}`)
      .set("Authorization", `Bearer ${teamAManagerToken}`);
    expect(res.status).toBe(403);

    const rows = await db.select().from(playersTable)
      .where(eq(playersTable.id, playerOnTeamAId));
    expect(rows.length).toBe(1);
    expect(rows[0].homeClubId).toBe(clubAId);
  });

  it("club-A admin CAN DELETE /players/:playerOnClubA (200, player gone)", async () => {
    const res = await request(app)
      .delete(`/api/players/${playerOnTeamAId}`)
      .set("Authorization", `Bearer ${clubAAdminToken}`);
    expect(res.status).toBe(200);

    const rows = await db.select().from(playersTable)
      .where(eq(playersTable.id, playerOnTeamAId));
    expect(rows.length).toBe(0);
  });

  // (4) Happy path: the linked managed user CAN PATCH their own profile.
  it("linked managed user can PATCH /players/:id/profile (200)", async () => {
    const res = await request(app)
      .patch(`/api/players/${linkedPlayerId}/profile`)
      .set("Authorization", `Bearer ${linkedUserToken}`)
      .send({ bio: "my own bio" });
    expect(res.status).toBe(200);
    expect(res.body.bio).toBe("my own bio");

    const [row] = await db.select().from(playersTable)
      .where(eq(playersTable.id, linkedPlayerId));
    expect(row.bio).toBe("my own bio");
  });

  // (5) POST /players/:playerId/horses and DELETE /players/:playerId/horses/:horseId
  // run through `requireSelfOrEditor(true)`: a club-A admin or a team manager must
  // not be able to mutate the horse list of a player whose canonical home club they
  // don't administer, AND the linked managed user is allowed to manage the horses
  // on their own player record (but not anyone else's).
  it("club-A admin cannot POST /players/:playerOnClubB/horses (403, no horse created)", async () => {
    const res = await request(app)
      .post(`/api/players/${playerOnTeamBId}/horses`)
      .set("Authorization", `Bearer ${clubAAdminToken}`)
      .send({ horseName: "Hijacked Horse" });
    expect(res.status).toBe(403);

    const rows = await db.select().from(horsesTable)
      .where(eq(horsesTable.playerId, playerOnTeamBId));
    expect(rows.length).toBe(0);
  });

  it("team-A manager cannot POST /players/:playerOnTeamA/horses (403, no horse created)", async () => {
    const res = await request(app)
      .post(`/api/players/${playerOnTeamAId}/horses`)
      .set("Authorization", `Bearer ${teamAManagerToken}`)
      .send({ horseName: "Hijacked Horse" });
    expect(res.status).toBe(403);

    const rows = await db.select().from(horsesTable)
      .where(eq(horsesTable.playerId, playerOnTeamAId));
    expect(rows.length).toBe(0);
  });

  it("club-A admin cannot DELETE /players/:playerOnClubB/horses/:horseId (403, horse still exists)", async () => {
    const [seed] = await db.insert(horsesTable).values({
      playerId: playerOnTeamBId,
      horseName: "Club B Horse",
    }).returning();

    const res = await request(app)
      .delete(`/api/players/${playerOnTeamBId}/horses/${seed.id}`)
      .set("Authorization", `Bearer ${clubAAdminToken}`);
    expect(res.status).toBe(403);

    const rows = await db.select().from(horsesTable)
      .where(eq(horsesTable.id, seed.id));
    expect(rows.length).toBe(1);
    expect(rows[0].playerId).toBe(playerOnTeamBId);
  });

  it("club-A admin CAN POST and DELETE horses on /players/:playerOnClubA (201/200, rows reflect it)", async () => {
    const postRes = await request(app)
      .post(`/api/players/${playerOnTeamAId}/horses`)
      .set("Authorization", `Bearer ${clubAAdminToken}`)
      .send({ horseName: "Club A Horse" });
    expect(postRes.status).toBe(201);
    const horseId: string = postRes.body.id;
    expect(horseId).toBeTruthy();

    const afterPost = await db.select().from(horsesTable)
      .where(eq(horsesTable.id, horseId));
    expect(afterPost.length).toBe(1);
    expect(afterPost[0].playerId).toBe(playerOnTeamAId);
    expect(afterPost[0].horseName).toBe("Club A Horse");

    const delRes = await request(app)
      .delete(`/api/players/${playerOnTeamAId}/horses/${horseId}`)
      .set("Authorization", `Bearer ${clubAAdminToken}`);
    expect(delRes.status).toBe(200);

    const afterDel = await db.select().from(horsesTable)
      .where(eq(horsesTable.id, horseId));
    expect(afterDel.length).toBe(0);
  });

  // (6) Self-edit happy path: the linked managed user CAN POST and DELETE horses
  // on their own player record. The horse endpoints went through
  // `requireSelfOrEditor(false)` historically, which excluded the managed user;
  // they now use `requireSelfOrEditor(true)` so a player who has claimed their
  // profile can manage their own string of horses without bothering an admin.
  it("linked managed user CAN POST and DELETE horses on their own player (201/200, rows reflect it)", async () => {
    const postRes = await request(app)
      .post(`/api/players/${linkedPlayerId}/horses`)
      .set("Authorization", `Bearer ${linkedUserToken}`)
      .send({ horseName: "My Own Horse" });
    expect(postRes.status).toBe(201);
    const horseId: string = postRes.body.id;
    expect(horseId).toBeTruthy();

    const afterPost = await db.select().from(horsesTable)
      .where(eq(horsesTable.id, horseId));
    expect(afterPost.length).toBe(1);
    expect(afterPost[0].playerId).toBe(linkedPlayerId);
    expect(afterPost[0].horseName).toBe("My Own Horse");

    const delRes = await request(app)
      .delete(`/api/players/${linkedPlayerId}/horses/${horseId}`)
      .set("Authorization", `Bearer ${linkedUserToken}`);
    expect(delRes.status).toBe(200);

    const afterDel = await db.select().from(horsesTable)
      .where(eq(horsesTable.id, horseId));
    expect(afterDel.length).toBe(0);
  });

  // Cross-player negative: a linked user attempting to add or delete horses on
  // a player they do not manage must still be rejected 403.
  it("linked managed user cannot POST horses on a player they don't manage (403, no horse created)", async () => {
    const res = await request(app)
      .post(`/api/players/${playerOnTeamBId}/horses`)
      .set("Authorization", `Bearer ${linkedUserToken}`)
      .send({ horseName: "Hijacked Horse" });
    expect(res.status).toBe(403);

    const rows = await db.select().from(horsesTable)
      .where(eq(horsesTable.playerId, playerOnTeamBId));
    expect(rows.length).toBe(0);
  });

  it("linked managed user cannot DELETE horses on a player they don't manage (403, horse still exists)", async () => {
    const [seed] = await db.insert(horsesTable).values({
      playerId: playerOnTeamBId,
      horseName: "Club B Horse",
    }).returning();

    const res = await request(app)
      .delete(`/api/players/${playerOnTeamBId}/horses/${seed.id}`)
      .set("Authorization", `Bearer ${linkedUserToken}`);
    expect(res.status).toBe(403);

    const rows = await db.select().from(horsesTable)
      .where(eq(horsesTable.id, seed.id));
    expect(rows.length).toBe(1);
    expect(rows[0].playerId).toBe(playerOnTeamBId);
  });
});
