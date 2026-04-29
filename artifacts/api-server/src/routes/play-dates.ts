import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { playDatesTable, tournamentsTable, adminClubMembershipsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, isSuperAdmin } from "../lib/auth";

const router: IRouter = Router();

async function requireTournamentClubAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }
  const tournamentId = String(req.params.tournamentId);
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
  if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }
  const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user.id));
  if (!memberships.some(m => m.clubId === tournament.clubId)) {
    res.status(403).json({ message: "Club admin access required to modify play dates" }); return;
  }
  next();
}

async function requirePlayDateClubAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }
  const playDateId = String(req.params.playDateId);
  const [playDate] = await db.select().from(playDatesTable).where(eq(playDatesTable.id, playDateId));
  if (!playDate) { res.status(404).json({ message: "Play date not found" }); return; }
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, playDate.tournamentId));
  if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }
  const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user.id));
  if (!memberships.some(m => m.clubId === tournament.clubId)) {
    res.status(403).json({ message: "Club admin access required to modify play dates" }); return;
  }
  next();
}

router.get("/tournaments/:tournamentId/play-dates", async (req, res) => {
  try {
    const dates = await db.select().from(playDatesTable).where(eq(playDatesTable.tournamentId, String(req.params.tournamentId)));
    res.json(dates);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tournaments/:tournamentId/play-dates", requireAuth, requireTournamentClubAdmin, async (req, res) => {
  try {
    const { date, startTime, endTime, fieldIds, lunchStart, lunchEnd } = req.body;
    const [entry] = await db.insert(playDatesTable).values({
      tournamentId: String(req.params.tournamentId),
      date, startTime, endTime, fieldIds, lunchStart, lunchEnd,
    }).returning();
    res.status(201).json(entry);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.put("/play-dates/:playDateId", requireAuth, requirePlayDateClubAdmin, async (req, res) => {
  try {
    const { date, startTime, endTime, fieldIds, lunchStart, lunchEnd } = req.body;
    const updates: Record<string, any> = {};
    if (date !== undefined) updates.date = date;
    if (startTime !== undefined) updates.startTime = startTime;
    if (endTime !== undefined) updates.endTime = endTime;
    if (fieldIds !== undefined) updates.fieldIds = fieldIds;
    if (lunchStart !== undefined) updates.lunchStart = lunchStart;
    if (lunchEnd !== undefined) updates.lunchEnd = lunchEnd;
    const [entry] = await db.update(playDatesTable).set(updates).where(eq(playDatesTable.id, String(req.params.playDateId))).returning();
    res.json(entry);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/play-dates/:playDateId", requireAuth, requirePlayDateClubAdmin, async (req, res) => {
  try {
    await db.delete(playDatesTable).where(eq(playDatesTable.id, String(req.params.playDateId)));
    res.json({ message: "Play date deleted" });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

export default router;
