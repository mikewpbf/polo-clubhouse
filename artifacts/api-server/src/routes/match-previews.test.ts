import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  usersTable,
  adminClubMembershipsTable,
  tournamentsTable,
  matchesTable,
  teamsTable,
} from "@workspace/db/schema";
import { generateToken } from "../lib/auth";

// R2 isn't available in tests, so mock the storage uploader. The real
// PutObjectCommand is exercised by integration / smoke tests in deploy.
vi.mock("../lib/objectStorage", async () => {
  const actual = await vi.importActual<typeof import("../lib/objectStorage")>("../lib/objectStorage");
  class MockObjectStorageService {
    async uploadPublicObject(filePath: string, body: Buffer, _contentType: string) {
      // Sanity check: route should hand us a real PNG buffer.
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw new Error("uploadPublicObject called with empty body");
      }
      return { key: `public/${filePath}`, url: `/api/storage/public-objects/${filePath}` };
    }
  }
  return { ...actual, ObjectStorageService: MockObjectStorageService };
});

// Import the app AFTER vi.mock so the route picks up the mocked storage.
const { default: app } = await import("../app");

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FAKE_PNG = Buffer.concat([PNG_HEADER, Buffer.alloc(64, 0x42)]);

describe("POST /api/matches/:matchId/preview-image", () => {
  const created = {
    userIds: [] as string[],
    clubIds: [] as string[],
    tournamentIds: [] as string[],
    teamIds: [] as string[],
    matchIds: [] as string[],
  };

  let matchId = "";
  let otherClubMatchId = "";
  let adminToken = "";
  let otherClubAdminToken = "";
  let regularUserToken = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const passwordHash = await bcrypt.hash("x", 4);

    const [club] = await db.insert(clubsTable)
      .values({ name: `MP Club ${stamp}`, slug: `mp-${stamp}` })
      .returning();
    created.clubIds.push(club.id);

    const [otherClub] = await db.insert(clubsTable)
      .values({ name: `Other MP Club ${stamp}`, slug: `mp-other-${stamp}` })
      .returning();
    created.clubIds.push(otherClub.id);

    const [admin] = await db.insert(usersTable).values({
      email: `mp-admin-${stamp}@test.local`,
      displayName: "MP Admin",
      role: "admin",
      passwordHash,
    }).returning();
    created.userIds.push(admin.id);
    await db.insert(adminClubMembershipsTable).values({ userId: admin.id, clubId: club.id, role: "owner" });

    const [otherAdmin] = await db.insert(usersTable).values({
      email: `mp-other-${stamp}@test.local`,
      displayName: "MP Other Admin",
      role: "admin",
      passwordHash,
    }).returning();
    created.userIds.push(otherAdmin.id);
    await db.insert(adminClubMembershipsTable).values({ userId: otherAdmin.id, clubId: otherClub.id, role: "owner" });

    const [regular] = await db.insert(usersTable).values({
      email: `mp-user-${stamp}@test.local`,
      displayName: "MP User",
      role: "spectator",
      passwordHash,
    }).returning();
    created.userIds.push(regular.id);

    const [tournament] = await db.insert(tournamentsTable)
      .values({ name: `MP Tournament ${stamp}`, clubId: club.id, status: "published" })
      .returning();
    created.tournamentIds.push(tournament.id);

    const [otherTournament] = await db.insert(tournamentsTable)
      .values({ name: `MP Tournament Other ${stamp}`, clubId: otherClub.id, status: "published" })
      .returning();
    created.tournamentIds.push(otherTournament.id);

    const [home] = await db.insert(teamsTable).values({ name: `Home MP ${stamp}`, clubId: club.id }).returning();
    const [away] = await db.insert(teamsTable).values({ name: `Away MP ${stamp}`, clubId: club.id }).returning();
    created.teamIds.push(home.id, away.id);

    const [match] = await db.insert(matchesTable).values({
      tournamentId: tournament.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      scheduledAt: new Date(Date.now() + 60 * 60_000),
      status: "scheduled",
    }).returning();
    matchId = match.id;
    created.matchIds.push(matchId);

    const [otherMatch] = await db.insert(matchesTable).values({
      tournamentId: otherTournament.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      scheduledAt: new Date(Date.now() + 60 * 60_000),
      status: "scheduled",
    }).returning();
    otherClubMatchId = otherMatch.id;
    created.matchIds.push(otherClubMatchId);

    adminToken = generateToken({ id: admin.id, email: admin.email!, displayName: admin.displayName!, role: admin.role! });
    otherClubAdminToken = generateToken({ id: otherAdmin.id, email: otherAdmin.email!, displayName: otherAdmin.displayName!, role: otherAdmin.role! });
    regularUserToken = generateToken({ id: regular.id, email: regular.email!, displayName: regular.displayName!, role: regular.role! });
  });

  afterEach(async () => {
    if (created.matchIds.length) await db.delete(matchesTable).where(inArray(matchesTable.id, created.matchIds));
    if (created.tournamentIds.length) await db.delete(tournamentsTable).where(inArray(tournamentsTable.id, created.tournamentIds));
    if (created.teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, created.teamIds));
    if (created.userIds.length) {
      await db.delete(adminClubMembershipsTable).where(inArray(adminClubMembershipsTable.userId, created.userIds));
      await db.delete(usersTable).where(inArray(usersTable.id, created.userIds));
    }
    if (created.clubIds.length) await db.delete(clubsTable).where(inArray(clubsTable.id, created.clubIds));
    created.matchIds = []; created.tournamentIds = []; created.teamIds = [];
    created.userIds = []; created.clubIds = [];
  });

  afterAll(async () => { await pool.end(); });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app)
      .post(`/api/matches/${matchId}/preview-image`)
      .set("Content-Type", "image/png")
      .send(FAKE_PNG);
    expect(res.status).toBe(401);
  });

  it("rejects users without club admin membership", async () => {
    const res = await request(app)
      .post(`/api/matches/${matchId}/preview-image`)
      .set("Authorization", `Bearer ${regularUserToken}`)
      .set("Content-Type", "image/png")
      .send(FAKE_PNG);
    expect(res.status).toBe(403);
  });

  it("rejects admins from other clubs (cross-club isolation)", async () => {
    const res = await request(app)
      .post(`/api/matches/${matchId}/preview-image`)
      .set("Authorization", `Bearer ${otherClubAdminToken}`)
      .set("Content-Type", "image/png")
      .send(FAKE_PNG);
    expect(res.status).toBe(403);
  });

  it("rejects bodies that aren't valid PNGs", async () => {
    const res = await request(app)
      .post(`/api/matches/${matchId}/preview-image`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Content-Type", "image/png")
      .send(Buffer.from("not a png at all, just text"));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/PNG/);
  });

  it("accepts a valid PNG and persists URL + timestamp on the match row", async () => {
    const before = Date.now();
    const res = await request(app)
      .post(`/api/matches/${matchId}/preview-image`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Content-Type", "image/png")
      .send(FAKE_PNG);

    expect(res.status).toBe(200);
    expect(res.body.previewImageUrl).toBe(`/api/storage/public-objects/match-previews/${matchId}.png`);
    expect(typeof res.body.previewImageUpdatedAt).toBe("string");

    const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    expect(row.previewImageUrl).toBe(`/api/storage/public-objects/match-previews/${matchId}.png`);
    expect(row.previewImageUpdatedAt).toBeTruthy();
    expect(new Date(row.previewImageUpdatedAt!).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("is idempotent — second upload overwrites at the same key and bumps timestamp", async () => {
    const first = await request(app)
      .post(`/api/matches/${matchId}/preview-image`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Content-Type", "image/png")
      .send(FAKE_PNG);
    expect(first.status).toBe(200);
    const firstRow = (await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)))[0];
    const firstAt = new Date(firstRow.previewImageUpdatedAt!).getTime();

    await new Promise(r => setTimeout(r, 50));

    const second = await request(app)
      .post(`/api/matches/${matchId}/preview-image`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Content-Type", "image/png")
      .send(FAKE_PNG);
    expect(second.status).toBe(200);

    const secondRow = (await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)))[0];
    expect(secondRow.previewImageUrl).toBe(firstRow.previewImageUrl);
    expect(new Date(secondRow.previewImageUpdatedAt!).getTime()).toBeGreaterThan(firstAt);
  });

  it("returns 404 for unknown matches", async () => {
    const res = await request(app)
      .post(`/api/matches/00000000-0000-0000-0000-000000000000/preview-image`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Content-Type", "image/png")
      .send(FAKE_PNG);
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown matches — even for super-admin (no silent no-op)", async () => {
    // Super-admin previously bypassed match existence check, which made the
    // upload 200 with no row written. Verifies the unknown-id path is
    // consistent across roles.
    const passwordHash = await bcrypt.hash("x", 4);
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const [superUser] = await db.insert(usersTable).values({
      email: `mp-super-${stamp}@test.local`,
      displayName: "MP Super",
      role: "super_admin",
      passwordHash,
    }).returning();
    created.userIds.push(superUser.id);
    const superToken = generateToken({
      id: superUser.id, email: superUser.email!, displayName: superUser.displayName!, role: superUser.role!,
    });

    const res = await request(app)
      .post(`/api/matches/00000000-0000-0000-0000-000000000000/preview-image`)
      .set("Authorization", `Bearer ${superToken}`)
      .set("Content-Type", "image/png")
      .send(FAKE_PNG);
    expect(res.status).toBe(404);
  });
});
