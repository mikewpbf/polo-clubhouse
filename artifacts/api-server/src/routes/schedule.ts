import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { requireAuth, isSuperAdmin } from "../lib/auth";
import { generateSchedule, saveSchedule } from "../lib/scheduler";
import { db } from "@workspace/db";
import { tournamentsTable, adminClubMembershipsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

async function requireTournamentAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }
  const tournamentId = String(req.params.tournamentId);
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
  if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }
  const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user.id));
  if (!memberships.some(m => m.clubId === tournament.clubId)) {
    res.status(403).json({ message: "Club admin access required to modify this tournament's schedule" }); return;
  }
  next();
}

router.post("/tournaments/:tournamentId/schedule/generate", requireAuth, requireTournamentAdmin, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const result = await generateSchedule(tournamentId);
    res.json({ matches: result.matches, warnings: result.warnings, count: result.matches.length });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/tournaments/:tournamentId/schedule/save", requireAuth, requireTournamentAdmin, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const { matches } = req.body;
    if (!matches || !Array.isArray(matches)) {
      const result = await generateSchedule(tournamentId);
      const saved = await saveSchedule(tournamentId, result.matches);
      res.json({ matches: saved, warnings: result.warnings });
    } else {
      const saved = await saveSchedule(tournamentId, matches);
      res.json({ matches: saved, warnings: [] });
    }
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

export default router;
