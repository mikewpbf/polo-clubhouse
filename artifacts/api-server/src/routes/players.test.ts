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

  // Broadcast aux image is private — only the linked owner and admins may read
  // it. The field must be ABSENT (not just null) from public responses.
  describe("broadcastImageUrl visibility", () => {
    const BROADCAST = "https://cdn.example/broadcast-aux.jpg";

    beforeEach(async () => {
      await db.update(playersTable)
        .set({ broadcastImageUrl: BROADCAST, managedByUserId: targetUserId })
        .where(eq(playersTable.id, playerId));
    });

    it("anonymous GET /api/players/:id omits broadcastImageUrl entirely", async () => {
      const res = await request(app).get(`/api/players/${playerId}`);
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("broadcastImageUrl");
      expect(res.body).toHaveProperty("headshotUrl");
    });

    it("spectator viewer (authed but unrelated) also omits broadcastImageUrl", async () => {
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const passwordHash = await bcrypt.hash("test-pass", 4);
      const [stranger] = await db.insert(usersTable).values({
        email: `stranger-${stamp}@test.local`,
        displayName: "Stranger",
        role: "spectator",
        passwordHash,
      }).returning();
      created.userIds.push(stranger.id);
      const strangerToken = generateToken({
        id: stranger.id, email: stranger.email!, displayName: stranger.displayName!, role: stranger.role!,
      });

      const res = await request(app)
        .get(`/api/players/${playerId}`)
        .set("Authorization", `Bearer ${strangerToken}`);
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("broadcastImageUrl");
    });

    it("non-home-club admin (other club) does NOT see broadcastImageUrl", async () => {
      const res = await request(app)
        .get(`/api/players/${playerId}`)
        .set("Authorization", `Bearer ${otherAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("broadcastImageUrl");
    });

    it("home-club admin sees broadcastImageUrl", async () => {
      const res = await request(app)
        .get(`/api/players/${playerId}`)
        .set("Authorization", `Bearer ${homeAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.broadcastImageUrl).toBe(BROADCAST);
    });

    it("super_admin sees broadcastImageUrl", async () => {
      const res = await request(app)
        .get(`/api/players/${playerId}`)
        .set("Authorization", `Bearer ${superToken}`);
      expect(res.status).toBe(200);
      expect(res.body.broadcastImageUrl).toBe(BROADCAST);
    });

    it("linked managed user (owner) sees broadcastImageUrl on /api/players/:id", async () => {
      const ownerToken = generateToken({
        id: targetUserId, email: `target@test.local`, displayName: "Target", role: "spectator",
      });
      const res = await request(app)
        .get(`/api/players/${playerId}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.broadcastImageUrl).toBe(BROADCAST);
    });

    it("GET /api/players (list) never includes broadcastImageUrl on any item", async () => {
      const res = await request(app).get(`/api/players`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ours = (res.body as Array<{ id: string }>).find(p => p.id === playerId);
      expect(ours).toBeDefined();
      for (const p of res.body as Array<Record<string, unknown>>) {
        expect(p).not.toHaveProperty("broadcastImageUrl");
      }
    });

    it("GET /api/players/top never includes broadcastImageUrl", async () => {
      const res = await request(app).get(`/api/players/top?limit=50`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const p of res.body as Array<Record<string, unknown>>) {
        expect(p).not.toHaveProperty("broadcastImageUrl");
      }
    });
  });

  // The original-resolution source URLs that back the recroppable headshot and
  // broadcast aux image must follow the same private-visibility rules as the
  // cropped broadcastImageUrl: present for the linked owner / club admins /
  // super_admin, omitted for everyone else.
  describe("headshotSourceUrl / broadcastImageSourceUrl visibility", () => {
    const HEADSHOT_SRC = "https://cdn.example/headshot-original.jpg";
    const BROADCAST_SRC = "https://cdn.example/broadcast-original.jpg";

    beforeEach(async () => {
      await db.update(playersTable)
        .set({
          headshotSourceUrl: HEADSHOT_SRC,
          broadcastImageSourceUrl: BROADCAST_SRC,
          managedByUserId: targetUserId,
        })
        .where(eq(playersTable.id, playerId));
    });

    it("anonymous GET /api/players/:id omits both source URL fields", async () => {
      const res = await request(app).get(`/api/players/${playerId}`);
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("headshotSourceUrl");
      expect(res.body).not.toHaveProperty("broadcastImageSourceUrl");
    });

    it("non-home-club admin does NOT see source URL fields", async () => {
      const res = await request(app)
        .get(`/api/players/${playerId}`)
        .set("Authorization", `Bearer ${otherAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty("headshotSourceUrl");
      expect(res.body).not.toHaveProperty("broadcastImageSourceUrl");
    });

    it("home-club admin sees both source URL fields", async () => {
      const res = await request(app)
        .get(`/api/players/${playerId}`)
        .set("Authorization", `Bearer ${homeAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.headshotSourceUrl).toBe(HEADSHOT_SRC);
      expect(res.body.broadcastImageSourceUrl).toBe(BROADCAST_SRC);
    });

    it("super_admin sees both source URL fields", async () => {
      const res = await request(app)
        .get(`/api/players/${playerId}`)
        .set("Authorization", `Bearer ${superToken}`);
      expect(res.status).toBe(200);
      expect(res.body.headshotSourceUrl).toBe(HEADSHOT_SRC);
      expect(res.body.broadcastImageSourceUrl).toBe(BROADCAST_SRC);
    });

    it("linked managed user (owner) sees both source URL fields", async () => {
      const ownerToken = generateToken({
        id: targetUserId, email: `target@test.local`, displayName: "Target", role: "spectator",
      });
      const res = await request(app)
        .get(`/api/players/${playerId}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.headshotSourceUrl).toBe(HEADSHOT_SRC);
      expect(res.body.broadcastImageSourceUrl).toBe(BROADCAST_SRC);
    });

    it("home-club admin can persist source URLs via PUT /api/players/:id", async () => {
      const NEW_HS = "https://cdn.example/new-headshot.jpg";
      const NEW_BC = "https://cdn.example/new-broadcast.jpg";
      const res = await request(app)
        .put(`/api/players/${playerId}`)
        .set("Authorization", `Bearer ${homeAdminToken}`)
        .send({ headshotSourceUrl: NEW_HS, broadcastImageSourceUrl: NEW_BC });
      expect(res.status).toBe(200);

      const [row] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
      expect(row.headshotSourceUrl).toBe(NEW_HS);
      expect(row.broadcastImageSourceUrl).toBe(NEW_BC);
    });

    it("home-club admin can clear source URLs by sending null", async () => {
      const res = await request(app)
        .put(`/api/players/${playerId}`)
        .set("Authorization", `Bearer ${homeAdminToken}`)
        .send({ headshotSourceUrl: null, broadcastImageSourceUrl: null });
      expect(res.status).toBe(200);

      const [row] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
      expect(row.headshotSourceUrl).toBeNull();
      expect(row.broadcastImageSourceUrl).toBeNull();
    });

    it("linked owner can persist source URLs via PATCH /api/players/:id/profile", async () => {
      const ownerToken = generateToken({
        id: targetUserId, email: `target@test.local`, displayName: "Target", role: "spectator",
      });
      const NEW_HS = "https://cdn.example/owner-headshot.jpg";
      const NEW_BC = "https://cdn.example/owner-broadcast.jpg";
      const res = await request(app)
        .patch(`/api/players/${playerId}/profile`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ headshotSourceUrl: NEW_HS, broadcastImageSourceUrl: NEW_BC });
      expect(res.status).toBe(200);

      const [row] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
      expect(row.headshotSourceUrl).toBe(NEW_HS);
      expect(row.broadcastImageSourceUrl).toBe(NEW_BC);
    });
  });
});
