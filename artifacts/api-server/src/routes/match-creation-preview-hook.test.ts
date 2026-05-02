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

// Mock R2 — record uploads so we can verify the creation hook fires.
const uploadCalls: Array<{ filePath: string }> = [];
vi.mock("../lib/objectStorage", async () => {
  const actual = await vi.importActual<typeof import("../lib/objectStorage")>("../lib/objectStorage");
  class MockObjectStorageService {
    async uploadPublicObject(filePath: string, body: Buffer, _contentType: string) {
      if (!Buffer.isBuffer(body) || body.length === 0) throw new Error("empty body");
      uploadCalls.push({ filePath });
      return { key: `public/${filePath}`, url: `/api/storage/public-objects/${filePath}` };
    }
  }
  return { ...actual, ObjectStorageService: MockObjectStorageService };
});

const { default: app } = await import("../app");

const created = {
  userIds: [] as string[],
  clubIds: [] as string[],
  tournamentIds: [] as string[],
  teamIds: [] as string[],
  matchIds: [] as string[],
};

let clubId = "";
let tournamentId = "";
let homeId = "";
let awayId = "";
let adminToken = "";

beforeEach(async () => {
  uploadCalls.length = 0;
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const [club] = await db.insert(clubsTable).values({ name: `Hook Club ${stamp}`, slug: `hook-${stamp}` }).returning();
  clubId = club.id;
  created.clubIds.push(clubId);

  const passwordHash = await bcrypt.hash("x", 4);
  const [admin] = await db.insert(usersTable).values({
    email: `hook-admin-${stamp}@test.local`,
    displayName: "Hook Admin",
    role: "admin",
    passwordHash,
  }).returning();
  created.userIds.push(admin.id);
  await db.insert(adminClubMembershipsTable).values({ userId: admin.id, clubId, role: "owner" });
  adminToken = generateToken({ id: admin.id, email: admin.email, role: "admin" });

  const [tournament] = await db.insert(tournamentsTable)
    .values({ name: `Hook Tournament ${stamp}`, clubId, status: "published" }).returning();
  tournamentId = tournament.id;
  created.tournamentIds.push(tournamentId);

  const [home] = await db.insert(teamsTable).values({ name: `Hook Home ${stamp}`, clubId, primaryColor: "#1B5E20" }).returning();
  const [away] = await db.insert(teamsTable).values({ name: `Hook Away ${stamp}`, clubId, primaryColor: "#374151" }).returning();
  homeId = home.id; awayId = away.id;
  created.teamIds.push(homeId, awayId);
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
  created.matchIds = []; created.tournamentIds = []; created.teamIds = []; created.clubIds = []; created.userIds = [];
});

afterAll(async () => { await pool.end(); });

// Wait until the fire-and-forget hook has populated `previewImageUrl`,
// or fail after ~5s. Keeps the test deterministic without sleeping
// blindly for an arbitrary duration.
async function waitForPreview(matchId: string, timeoutMs = 5000): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [row] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (row?.previewImageUrl) return row.previewImageUrl;
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

describe("POST /api/tournaments/:id/matches creation hook", () => {
  it("auto-generates a preview image without the admin opening Match Graphics", async () => {
    const res = await request(app)
      .post(`/api/tournaments/${tournamentId}/matches`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        homeTeamId: homeId,
        awayTeamId: awayId,
        scheduledAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      });

    expect(res.status).toBe(201);
    const matchId = res.body?.id;
    expect(matchId).toBeTruthy();
    created.matchIds.push(matchId);

    const url = await waitForPreview(matchId);
    expect(url).toBe(`/api/storage/public-objects/match-previews/${matchId}.png`);
    expect(uploadCalls.some(c => c.filePath === `match-previews/${matchId}.png`)).toBe(true);
  });
});
