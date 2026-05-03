// Task #121 (step 2): session / refresh-token endpoints. Adds:
//   POST /auth/refresh         — exchange a refresh token for a new access token
//   GET  /auth/sessions        — list this user's active sessions
//   DELETE /auth/sessions/:id  — revoke (log out) one device
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateAccessToken, requireAuth } from "../lib/auth";
import {
  createSession,
  findActiveSessionByToken,
  listActiveSessionsForUser,
  revokeSession,
  touchSession,
} from "../lib/sessions";
import type { ClientKind } from "../lib/config";

const router: IRouter = Router();

router.post("/auth/refresh", async (req, res) => {
  try {
    const refreshToken = (req.body?.refreshToken || req.header("x-refresh-token") || "").toString().trim();
    if (!refreshToken) {
      res.status(400).json({ message: "refreshToken required" });
      return;
    }
    const session = await findActiveSessionByToken(refreshToken);
    if (!session) {
      res.status(401).json({ message: "Invalid or expired refresh token" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }
    await touchSession(session.id);
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email!,
      displayName: user.displayName!,
      role: user.role!,
    });
    res.json({ accessToken, sessionId: session.id });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/auth/sessions", requireAuth, async (req, res) => {
  try {
    const rows = await listActiveSessionsForUser(req.user!.id);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.delete("/auth/sessions/:id", requireAuth, async (req, res) => {
  try {
    const ok = await revokeSession(String(req.params.id), req.user!.id);
    if (!ok) {
      res.status(404).json({ message: "Session not found" });
      return;
    }
    res.json({ message: "Session revoked" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// Normalize an `x-forwarded-for` value (string | string[] | undefined) into
// a single concrete string or null, so callers don't have to deal with the
// node http typing quirks.
function normalizeIp(req: import("express").Request): string | null {
  const direct = typeof req.ip === "string" && req.ip.length > 0 ? req.ip : null;
  if (direct) return direct;
  const fwd = req.headers["x-forwarded-for"];
  if (Array.isArray(fwd)) return fwd[0] ?? null;
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return null;
}

// Helper for routes that mint sessions (login/signup) elsewhere.
export async function issueSessionForRequest(req: import("express").Request, userId: string) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const platform = (body.platform as string | undefined) ?? req.header("x-client-platform") ?? null;
  const clientKindRaw = (body.clientKind as string | undefined) ?? req.header("x-client-kind") ?? null;
  const deviceId = (body.deviceId as string | undefined) ?? req.header("x-device-id") ?? null;
  const deviceLabel = (body.deviceLabel as string | undefined) ?? null;
  return createSession({
    userId,
    platform: platform ?? null,
    clientKind: (clientKindRaw as ClientKind | null) ?? null,
    deviceId: deviceId ?? null,
    deviceLabel: deviceLabel ?? null,
    userAgent: req.header("user-agent") ?? null,
    ip: normalizeIp(req),
  });
}

export default router;
