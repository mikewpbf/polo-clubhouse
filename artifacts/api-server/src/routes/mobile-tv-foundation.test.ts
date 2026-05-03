// Task #121 regression suite: covers the new mobile/TV foundation surface
// and the non-breaking guardrails for every step.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { usersTable, userSessionsTable, apiKeysTable, pushSubscriptionsTable } from "@workspace/db/schema";
import app from "../app";

const TEST_PREFIX = "mtv-test-";

let userId: string;
let userToken: string;
let superId: string;
let superToken: string;

beforeAll(async () => {
  const passwordHash = await bcrypt.hash("password123", 10);
  const [u] = await db.insert(usersTable).values({
    email: `${TEST_PREFIX}user@example.com`,
    displayName: "MTV User",
    passwordHash,
    role: "spectator",
  }).returning();
  userId = u.id;
  const [s] = await db.insert(usersTable).values({
    email: `${TEST_PREFIX}super@example.com`,
    displayName: "MTV Super",
    passwordHash,
    role: "super_admin",
  }).returning();
  superId = s.id;
});

afterAll(async () => {
  await db.delete(userSessionsTable).where(inArray(userSessionsTable.userId, [userId, superId]));
  await db.delete(pushSubscriptionsTable).where(inArray(pushSubscriptionsTable.userId, [userId, superId]));
  await db.delete(apiKeysTable).where(eq(apiKeysTable.createdBy, superId));
  await db.delete(usersTable).where(inArray(usersTable.id, [userId, superId]));
  await pool.end();
});

describe("Step 1 — versioned API alias", () => {
  it("/api and /api/v1 both serve healthz with identical bodies", async () => {
    const a = await request(app).get("/api/healthz");
    const b = await request(app).get("/api/v1/healthz");
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.body).toEqual(a.body);
  });
});

describe("Step 2 — refresh tokens + sessions", () => {
  it("login returns refreshToken alongside legacy token", async () => {
    const r = await request(app).post("/api/auth/login")
      .send({ email: `${TEST_PREFIX}user@example.com`, password: "password123" });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
    expect(r.body.accessToken).toBeTruthy();
    expect(r.body.refreshToken).toBeTruthy();
    expect(r.body.sessionId).toBeTruthy();
    userToken = r.body.token;

    // Refresh round-trip
    const ref = await request(app).post("/api/auth/refresh")
      .send({ refreshToken: r.body.refreshToken });
    expect(ref.status).toBe(200);
    expect(ref.body.accessToken).toBeTruthy();

    // List sessions
    const list = await request(app).get("/api/auth/sessions")
      .set("Authorization", `Bearer ${userToken}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.find((s: any) => s.id === r.body.sessionId)).toBeTruthy();

    // Revoke just that session
    const del = await request(app).delete(`/api/auth/sessions/${r.body.sessionId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(del.status).toBe(200);

    // Refresh now fails
    const ref2 = await request(app).post("/api/auth/refresh")
      .send({ refreshToken: r.body.refreshToken });
    expect(ref2.status).toBe(401);
  });
});

describe("Step 3 — OpenAPI spec + docs", () => {
  it("serves openapi.yaml", async () => {
    const r = await request(app).get("/api/openapi.yaml");
    expect(r.status).toBe(200);
    expect(r.text).toContain("openapi:");
  });
  it("serves docs HTML", async () => {
    const r = await request(app).get("/api/docs");
    expect(r.status).toBe(200);
    expect(r.text).toContain("redoc");
  });
});

describe("Step 6 — broadcast variant", () => {
  it("rejects unknown match with 404", async () => {
    const r = await request(app).get("/api/matches/00000000-0000-0000-0000-000000000000/broadcast");
    expect(r.status).toBe(404);
  });
});

describe("Step 7 — device tokens", () => {
  it("registers and unregisters a device", async () => {
    const login = await request(app).post("/api/auth/login")
      .send({ email: `${TEST_PREFIX}user@example.com`, password: "password123" });
    const tok = login.body.token;
    const reg = await request(app).post("/api/devices/register")
      .set("Authorization", `Bearer ${tok}`)
      .send({ token: "fake-fcm-abc123", platform: "ios", deviceId: "dev-1", appVersion: "1.0.0" });
    expect(reg.status).toBe(201);
    const id = reg.body.id;

    // Idempotent re-register
    const reg2 = await request(app).post("/api/devices/register")
      .set("Authorization", `Bearer ${tok}`)
      .send({ token: "fake-fcm-abc123", platform: "ios", appVersion: "1.0.1" });
    expect([200, 201]).toContain(reg2.status);

    const del = await request(app).delete(`/api/devices/${id}`)
      .set("Authorization", `Bearer ${tok}`);
    expect(del.status).toBe(200);
  });
  it("rejects bad platform", async () => {
    const login = await request(app).post("/api/auth/login")
      .send({ email: `${TEST_PREFIX}user@example.com`, password: "password123" });
    const r = await request(app).post("/api/devices/register")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ token: "x", platform: "bogus" });
    expect(r.status).toBe(400);
  });
});

describe("Step 8 — API keys (super-admin only)", () => {
  it("rejects non-super-admin", async () => {
    const login = await request(app).post("/api/auth/login")
      .send({ email: `${TEST_PREFIX}user@example.com`, password: "password123" });
    const r = await request(app).post("/api/admin/api-keys")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ clientName: "Test iOS", clientKind: "ios" });
    expect(r.status).toBe(403);
  });
  it("creates and revokes a key for super-admin", async () => {
    const login = await request(app).post("/api/auth/login")
      .send({ email: `${TEST_PREFIX}super@example.com`, password: "password123" });
    superToken = login.body.token;
    const created = await request(app).post("/api/admin/api-keys")
      .set("Authorization", `Bearer ${superToken}`)
      .send({ clientName: "Test iOS", clientKind: "ios" });
    expect(created.status).toBe(201);
    expect(created.body.key).toMatch(/^pk_/);
    const id = created.body.id;
    const list = await request(app).get("/api/admin/api-keys")
      .set("Authorization", `Bearer ${superToken}`);
    expect(list.status).toBe(200);
    const del = await request(app).delete(`/api/admin/api-keys/${id}`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(del.status).toBe(200);
  });
});
