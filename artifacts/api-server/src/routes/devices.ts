// Task #121 (step 7): device-token registration. No pushes are sent yet —
// this is just the schema + registration / unregistration endpoints so the
// future native apps can call them on launch and on logout.
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

const ALLOWED_PLATFORMS = new Set(["ios", "android", "web", "tvos"]);

router.post("/devices/register", requireAuth, async (req, res) => {
  try {
    const { token, platform, deviceId, appVersion } = req.body || {};
    if (!token || typeof token !== "string") {
      res.status(400).json({ message: "token is required" });
      return;
    }
    if (!platform || !ALLOWED_PLATFORMS.has(String(platform))) {
      res.status(400).json({ message: "platform must be one of: ios, android, web, tvos" });
      return;
    }
    const userId = req.user!.id;
    // Upsert on (user_id, token) so repeated launches don't create duplicates.
    const [existing] = await db.select().from(pushSubscriptionsTable).where(and(
      eq(pushSubscriptionsTable.userId, userId),
      eq(pushSubscriptionsTable.token, token),
    ));
    if (existing) {
      const [row] = await db.update(pushSubscriptionsTable)
        .set({
          platform,
          deviceId: deviceId ?? existing.deviceId,
          appVersion: appVersion ?? existing.appVersion,
          lastSeenAt: new Date(),
        })
        .where(eq(pushSubscriptionsTable.id, existing.id))
        .returning();
      res.json({ id: row.id });
      return;
    }
    const [row] = await db.insert(pushSubscriptionsTable).values({
      userId,
      token,
      fcmToken: token, // keep legacy column populated for backward compatibility
      platform,
      deviceId: deviceId ?? null,
      appVersion: appVersion ?? null,
      lastSeenAt: new Date(),
    }).returning();
    res.status(201).json({ id: row.id });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.delete("/devices/:id", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const result = await db.delete(pushSubscriptionsTable).where(and(
      eq(pushSubscriptionsTable.id, id),
      eq(pushSubscriptionsTable.userId, req.user!.id),
    )).returning({ id: pushSubscriptionsTable.id });
    if (result.length === 0) { res.status(404).json({ message: "Device not found" }); return; }
    res.json({ message: "Device unregistered" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
