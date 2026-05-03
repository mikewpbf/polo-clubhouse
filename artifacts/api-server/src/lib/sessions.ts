// Task #121 (step 2): refresh tokens + per-device sessions. Issuing a session
// returns the raw refresh token to the client exactly once; the database only
// ever stores its SHA-256 hash so a leak of the sessions table cannot be used
// to log in.
import crypto from "node:crypto";
import { db } from "@workspace/db";
import { userSessionsTable } from "@workspace/db/schema";
import { and, eq, isNull, gt } from "drizzle-orm";
import { config, type ClientKind } from "./config";

export function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export interface CreateSessionInput {
  userId: string;
  deviceLabel?: string | null;
  deviceId?: string | null;
  platform?: string | null;
  clientKind?: ClientKind | null;
  userAgent?: string | null;
  ip?: string | null;
}

export async function createSession(input: CreateSessionInput): Promise<{ id: string; refreshToken: string; expiresAt: Date }> {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + config.refreshTokenTtlSeconds * 1000);
  const [row] = await db.insert(userSessionsTable).values({
    userId: input.userId,
    refreshTokenHash,
    deviceLabel: input.deviceLabel ?? null,
    deviceId: input.deviceId ?? null,
    platform: input.platform ?? null,
    clientKind: input.clientKind ?? null,
    userAgent: input.userAgent ?? null,
    ip: input.ip ?? null,
    expiresAt,
  }).returning();
  return { id: row.id, refreshToken, expiresAt };
}

export async function findActiveSessionByToken(rawToken: string) {
  const hash = hashRefreshToken(rawToken);
  const [row] = await db.select().from(userSessionsTable).where(
    and(
      eq(userSessionsTable.refreshTokenHash, hash),
      isNull(userSessionsTable.revokedAt),
      gt(userSessionsTable.expiresAt, new Date()),
    ),
  );
  return row || null;
}

export async function touchSession(id: string): Promise<void> {
  await db.update(userSessionsTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(userSessionsTable.id, id));
}

export async function revokeSession(id: string, userId: string): Promise<boolean> {
  const result = await db.update(userSessionsTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessionsTable.id, id), eq(userSessionsTable.userId, userId), isNull(userSessionsTable.revokedAt)))
    .returning({ id: userSessionsTable.id });
  return result.length > 0;
}

export async function listActiveSessionsForUser(userId: string) {
  const rows = await db.select().from(userSessionsTable)
    .where(and(
      eq(userSessionsTable.userId, userId),
      isNull(userSessionsTable.revokedAt),
      gt(userSessionsTable.expiresAt, new Date()),
    ));
  return rows.map(r => ({
    id: r.id,
    deviceLabel: r.deviceLabel,
    deviceId: r.deviceId,
    platform: r.platform,
    clientKind: r.clientKind,
    userAgent: r.userAgent,
    ip: r.ip,
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt,
    expiresAt: r.expiresAt,
  }));
}
