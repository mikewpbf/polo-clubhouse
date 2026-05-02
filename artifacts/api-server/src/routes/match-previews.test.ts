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
  fieldsTable,
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

  // ─── Invalidation on match-row edits ───────────────────────────────────────
  // PUT /api/matches/:matchId is the path admins (and gfx share-token holders
  // editing stream URLs) hit when reassigning a match's scheduled time, field,
  // or teams. Those values appear on the BoldDiagonal OG card, so the cached
  // preview must be dropped — otherwise iMessage / Slack / WhatsApp would keep
  // showing the stale card. These tests pin down which fields trigger
  // invalidation and which (e.g. stream URL, notes) do not.
  describe("PUT /api/matches/:matchId invalidates cached previews", () => {
    async function seedPreview(): Promise<void> {
      // Pre-populate previewImageUrl/updatedAt so we can assert that the next
      // PUT clears them. Bypasses the upload route to keep the test focused
      // on the invalidation hook rather than the snap pipeline.
      await db.update(matchesTable)
        .set({
          previewImageUrl: `/api/storage/public-objects/match-previews/${matchId}.png`,
          previewImageUpdatedAt: new Date(),
        })
        .where(eq(matchesTable.id, matchId));
    }

    it("clears previewImageUrl when scheduledAt changes", async () => {
      await seedPreview();
      const res = await request(app)
        .put(`/api/matches/${matchId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ scheduledAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString() });
      expect(res.status).toBe(200);

      const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(row.previewImageUrl).toBeNull();
      expect(row.previewImageUpdatedAt).toBeNull();
    });

    it("clears previewImageUrl when fieldId changes", async () => {
      await seedPreview();
      // Need a real field row since fieldId is a FK. Reuse the match's club.
      const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, match.tournamentId));
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const [field] = await db.insert(fieldsTable)
        .values({ name: `MP Field ${stamp}`, clubId: tournament.clubId! })
        .returning();

      try {
        const res = await request(app)
          .put(`/api/matches/${matchId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ fieldId: field.id });
        expect(res.status).toBe(200);

        const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
        expect(row.previewImageUrl).toBeNull();
        expect(row.previewImageUpdatedAt).toBeNull();
      } finally {
        await db.update(matchesTable).set({ fieldId: null }).where(eq(matchesTable.id, matchId));
        await db.delete(fieldsTable).where(eq(fieldsTable.id, field.id));
      }
    });

    it("clears previewImageUrl when homeTeamId or awayTeamId changes", async () => {
      await seedPreview();
      const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, match.tournamentId));
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const [altTeam] = await db.insert(teamsTable)
        .values({ name: `Alt Team ${stamp}`, clubId: tournament.clubId })
        .returning();
      created.teamIds.push(altTeam.id);

      const res = await request(app)
        .put(`/api/matches/${matchId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ homeTeamId: altTeam.id });
      expect(res.status).toBe(200);

      const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(row.previewImageUrl).toBeNull();
      expect(row.previewImageUpdatedAt).toBeNull();
    });

    it("does NOT clear previewImageUrl when only non-preview fields change (notes, streamUrl)", async () => {
      // notes and streamUrl don't appear on the BoldDiagonal card, so a write
      // to them must leave the cached preview intact — otherwise we'd burn an
      // unnecessary client snap on every notes edit.
      await seedPreview();
      const [before] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));

      const res = await request(app)
        .put(`/api/matches/${matchId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ notes: "ref note", streamUrl: "https://example.com/s" });
      expect(res.status).toBe(200);

      const [after] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      expect(after.previewImageUrl).toBe(before.previewImageUrl);
      expect(after.previewImageUpdatedAt?.getTime()).toBe(before.previewImageUpdatedAt?.getTime());
    });
  });
});
