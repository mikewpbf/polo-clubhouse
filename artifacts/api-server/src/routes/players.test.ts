import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  playersTable,
  usersTable,
  adminClubMembershipsTable,
} from "@workspace/db/schema";
import app from "../app";
import { generateToken } from "../lib/auth";

describe("PUT /api/players/:playerId — managedByUserId authorization", () => {
  const created: { userIds: string[]; clubIds: string[]; playerIds: string[] } = {
    userIds: [],
    clubIds: [],
    playerIds: [],
  };

  let homeClubId = "";
  let otherClubId = "";
  let playerId = "";
  let targetUserId = "";

  let superToken = "";
  let homeAdminToken = "";
  let otherAdminToken = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const passwordHash = await bcrypt.hash("test-pass", 4);

    const [homeClub] = await db.insert(clubsTable)
      .values({ name: `Home Club ${stamp}`, slug: `home-club-${stamp}` }).returning();
    const [otherClub] = await db.insert(clubsTable)
      .values({ name: `Other Club ${stamp}`, slug: `other-club-${stamp}` }).returning();
    homeClubId = homeClub.id;
    otherClubId = otherClub.id;
    created.clubIds.push(homeClubId, otherClubId);

    const [superUser] = await db.insert(usersTable).values({
      email: `super-${stamp}@test.local`,
      displayName: "Super",
      role: "super_admin",
      passwordHash,
    }).returning();
    const [homeAdmin] = await db.insert(usersTable).values({
      email: `home-admin-${stamp}@test.local`,
      displayName: "Home Admin",
      role: "admin",
      passwordHash,
    }).returning();
    const [otherAdmin] = await db.insert(usersTable).values({
      email: `other-admin-${stamp}@test.local`,
      displayName: "Other Admin",
      role: "admin",
      passwordHash,
    }).returning();
    const [target] = await db.insert(usersTable).values({
      email: `target-${stamp}@test.local`,
      displayName: "Target",
      role: "spectator",
      passwordHash,
    }).returning();
    targetUserId = target.id;
    created.userIds.push(superUser.id, homeAdmin.id, otherAdmin.id, target.id);

    await db.insert(adminClubMembershipsTable).values([
      { userId: homeAdmin.id, clubId: homeClubId, role: "owner" },
      { userId: otherAdmin.id, clubId: otherClubId, role: "owner" },
    ]);

    const [player] = await db.insert(playersTable)
      .values({ name: `Player ${stamp}`, homeClubId }).returning();
    playerId = player.id;
    created.playerIds.push(playerId);

    superToken = generateToken({ id: superUser.id, email: superUser.email!, displayName: superUser.displayName!, role: superUser.role! });
    homeAdminToken = generateToken({ id: homeAdmin.id, email: homeAdmin.email!, displayName: homeAdmin.displayName!, role: homeAdmin.role! });
    otherAdminToken = generateToken({ id: otherAdmin.id, email: otherAdmin.email!, displayName: otherAdmin.displayName!, role: otherAdmin.role! });
  });

  afterEach(async () => {
    if (created.playerIds.length) {
      await db.delete(playersTable).where(inArray(playersTable.id, created.playerIds));
    }
    if (created.userIds.length) {
      await db.delete(adminClubMembershipsTable).where(inArray(adminClubMembershipsTable.userId, created.userIds));
      await db.delete(usersTable).where(inArray(usersTable.id, created.userIds));
    }
    if (created.clubIds.length) {
      await db.delete(clubsTable).where(inArray(clubsTable.id, created.clubIds));
    }
    created.userIds.length = 0;
    created.clubIds.length = 0;
    created.playerIds.length = 0;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("super_admin can set managedByUserId", async () => {
    const res = await request(app)
      .put(`/api/players/${playerId}`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ managedByUserId: targetUserId });
    expect(res.status).toBe(200);
    expect(res.body.managedByUserId).toBe(targetUserId);
  });

  it("home-club admin can set managedByUserId", async () => {
    const res = await request(app)
      .put(`/api/players/${playerId}`)
      .set("Authorization", `Bearer ${homeAdminToken}`)
      .send({ managedByUserId: targetUserId });
    expect(res.status).toBe(200);
    expect(res.body.managedByUserId).toBe(targetUserId);
  });

  it("non-home-club admin gets 403 when trying to set managedByUserId", async () => {
    const res = await request(app)
      .put(`/api/players/${playerId}`)
      .set("Authorization", `Bearer ${otherAdminToken}`)
      .send({ managedByUserId: targetUserId });
    expect(res.status).toBe(403);

    const [row] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
    expect(row.managedByUserId).toBeNull();
  });

  it("unauthenticated request gets 401", async () => {
    const res = await request(app)
      .put(`/api/players/${playerId}`)
      .send({ managedByUserId: targetUserId });
    expect(res.status).toBe(401);
  });

  it("home-club admin can clear an existing link (set to null)", async () => {
    await db.update(playersTable).set({ managedByUserId: targetUserId }).where(eq(playersTable.id, playerId));

    const res = await request(app)
      .put(`/api/players/${playerId}`)
      .set("Authorization", `Bearer ${homeAdminToken}`)
      .send({ managedByUserId: null });
    expect(res.status).toBe(200);
    expect(res.body.managedByUserId).toBeNull();
  });

  it("public profile exposes hasLinkedUser flag", async () => {
    await db.update(playersTable).set({ managedByUserId: targetUserId }).where(eq(playersTable.id, playerId));

    const linked = await request(app).get(`/api/players/${playerId}`);
    expect(linked.status).toBe(200);
    expect(linked.body.hasLinkedUser).toBe(true);

    await db.update(playersTable).set({ managedByUserId: null }).where(eq(playersTable.id, playerId));
    const unlinked = await request(app).get(`/api/players/${playerId}`);
    expect(unlinked.body.hasLinkedUser).toBe(false);
  });
});
