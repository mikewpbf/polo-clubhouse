import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  clubsTable,
  tournamentsTable,
  matchesTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app";
import { generateToken } from "../lib/auth";

describe("Stream anchor & broadcast offset — PUT /api/matches/:id", () => {
  const created: { userIds: string[]; clubIds: string[]; tournamentIds: string[]; matchIds: string[] } = {
    userIds: [],
    clubIds: [],
    tournamentIds: [],
    matchIds: [],
  };

  let matchId = "";
  let adminToken = "";
  let spectatorToken = "";

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const passwordHash = await bcrypt.hash("test-pass", 4);

    const [club] = await db.insert(clubsTable)
      .values({ name: `Stream Test Club ${stamp}`, slug: `stream-test-${stamp}` }).returning();
    created.clubIds.push(club.id);

    const [tournament] = await db.insert(tournamentsTable)
      .values({ name: `Stream Test Tourney ${stamp}`, clubId: club.id }).returning();
    created.tournamentIds.push(tournament.id);

    const [match] = await db.insert(matchesTable)
      .values({ tournamentId: tournament.id, status: "scheduled" }).returning();
    matchId = match.id;
    created.matchIds.push(matchId);

    const [admin] = await db.insert(usersTable).values({
      email: `admin-stream-${stamp}@test.local`,
      displayName: "Admin",
      role: "super_admin",
      passwordHash,
    }).returning();
    const [spectator] = await db.insert(usersTable).values({
      email: `spectator-stream-${stamp}@test.local`,
      displayName: "Spectator",
      role: "spectator",
      passwordHash,
    }).returning();
    created.userIds.push(admin.id, spectator.id);

    adminToken = generateToken({ id: admin.id, email: admin.email!, displayName: admin.displayName!, role: admin.role! });
    spectatorToken = generateToken({ id: spectator.id, email: spectator.email!, displayName: spectator.displayName!, role: spectator.role! });
  });

  afterEach(async () => {
    if (created.matchIds.length) {
      await db.delete(matchesTable).where(inArray(matchesTable.id, created.matchIds));
    }
    if (created.tournamentIds.length) {
      await db.delete(tournamentsTable).where(inArray(tournamentsTable.id, created.tournamentIds));
    }
    if (created.userIds.length) {
      await db.delete(usersTable).where(inArray(usersTable.id, created.userIds));
    }
    if (created.clubIds.length) {
      await db.delete(clubsTable).where(inArray(clubsTable.id, created.clubIds));
    }
    created.matchIds.length = 0;
    created.tournamentIds.length = 0;
    created.userIds.length = 0;
    created.clubIds.length = 0;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("GET returns streamStartedAt=null, scoringLocation='studio', broadcastOffsetSeconds='0.00' by default", async () => {
    const res = await request(app)
      .get(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.streamStartedAt).toBeNull();
    expect(res.body.scoringLocation).toBe("studio");
    expect(Number(res.body.broadcastOffsetSeconds)).toBe(0);
  });

  it("admin can set streamStartedAt", async () => {
    const ts = "2025-06-01T10:00:00.000Z";
    const res = await request(app)
      .put(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ streamStartedAt: ts });
    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(new Date(getRes.body.streamStartedAt).toISOString()).toBe(ts);
  });

  it("admin can clear streamStartedAt by setting null", async () => {
    await request(app)
      .put(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ streamStartedAt: "2025-06-01T10:00:00.000Z" });

    const res = await request(app)
      .put(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ streamStartedAt: null });
    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(getRes.body.streamStartedAt).toBeNull();
  });

  it("admin can set scoringLocation=field and broadcastOffsetSeconds", async () => {
    const res = await request(app)
      .put(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ scoringLocation: "field", broadcastOffsetSeconds: 30 });
    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(getRes.body.scoringLocation).toBe("field");
    expect(Number(getRes.body.broadcastOffsetSeconds)).toBe(30);
  });

  it("admin can switch back to studio and update offset to 0", async () => {
    await request(app)
      .put(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ scoringLocation: "field", broadcastOffsetSeconds: 45.5 });

    const res = await request(app)
      .put(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ scoringLocation: "studio", broadcastOffsetSeconds: 0 });
    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(getRes.body.scoringLocation).toBe("studio");
    expect(Number(getRes.body.broadcastOffsetSeconds)).toBe(0);
  });

  it("broadcast endpoint returns scoringLocation and broadcastOffsetSeconds", async () => {
    await request(app)
      .put(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ scoringLocation: "field", broadcastOffsetSeconds: 15.5 });

    const res = await request(app).get(`/api/matches/${matchId}/broadcast`);
    expect(res.status).toBe(200);
    expect(res.body.scoringLocation).toBe("field");
    expect(Number(res.body.broadcastOffsetSeconds)).toBeCloseTo(15.5, 1);
  });

  it("broadcast endpoint includes streamStartedAt when set", async () => {
    const ts = "2025-06-01T10:00:00.000Z";
    await request(app)
      .put(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ streamStartedAt: ts });

    const res = await request(app).get(`/api/matches/${matchId}/broadcast`);
    expect(res.status).toBe(200);
    expect(new Date(res.body.streamStartedAt).toISOString()).toBe(ts);
  });

  it("broadcast endpoint returns streamStartedAt=null when not set", async () => {
    const res = await request(app).get(`/api/matches/${matchId}/broadcast`);
    expect(res.status).toBe(200);
    expect(res.body.streamStartedAt).toBeNull();
  });

  it("unauthenticated PUT is rejected with 401", async () => {
    const res = await request(app)
      .put(`/api/matches/${matchId}`)
      .send({ streamStartedAt: "2025-06-01T10:00:00.000Z" });
    expect(res.status).toBe(401);
  });

  it("spectator PUT is rejected with 403", async () => {
    const res = await request(app)
      .put(`/api/matches/${matchId}`)
      .set("Authorization", `Bearer ${spectatorToken}`)
      .send({ streamStartedAt: "2025-06-01T10:00:00.000Z" });
    expect(res.status).toBe(403);
  });
});
