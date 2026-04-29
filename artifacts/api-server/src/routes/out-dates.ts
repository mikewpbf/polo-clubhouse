import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { teamOutDatesTable, tournamentsTable, adminClubMembershipsTable, teamManagerAssignmentsTable, teamsTable } from "@workspace/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { requireAuth, isSuperAdmin } from "../lib/auth";

const router: IRouter = Router();

async function requireTeamOutDateAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }
  const teamId = String(req.params.teamId);

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) { res.status(404).json({ message: "Team not found" }); return; }

  const adminMemberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user.id));
  const isClubAdmin = team.clubId ? adminMemberships.some(m => m.clubId === team.clubId) : false;

  if (!isClubAdmin) {
    const teamAssignments = await db.select().from(teamManagerAssignmentsTable).where(
      and(
        eq(teamManagerAssignmentsTable.userId, req.user.id),
        eq(teamManagerAssignmentsTable.teamId, teamId)
      )
    );
    if (teamAssignments.length === 0) {
      res.status(403).json({ message: "Club admin or team manager access required" }); return;
    }
  }

  next();
}

async function requireOutDateDeleteAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }
  const outDateId = String(req.params.outDateId);
  const [outDate] = await db.select().from(teamOutDatesTable).where(eq(teamOutDatesTable.id, outDateId));
  if (!outDate) { res.status(404).json({ message: "Out date not found" }); return; }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, outDate.teamId));
  if (!team) { res.status(404).json({ message: "Team not found" }); return; }

  const adminMemberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user.id));
  const isClubAdmin = team.clubId ? adminMemberships.some(m => m.clubId === team.clubId) : false;

  if (!isClubAdmin) {
    const teamAssignments = await db.select().from(teamManagerAssignmentsTable).where(
      and(
        eq(teamManagerAssignmentsTable.userId, req.user.id),
        eq(teamManagerAssignmentsTable.teamId, outDate.teamId)
      )
    );
    if (teamAssignments.length === 0) {
      res.status(403).json({ message: "Club admin or team manager access required" }); return;
    }
  }

  next();
}

router.get("/teams/:teamId/out-dates", async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const outDates = await db.select().from(teamOutDatesTable).where(
      and(eq(teamOutDatesTable.teamId, teamId), isNull(teamOutDatesTable.tournamentId))
    );
    res.json(outDates);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/teams/:teamId/out-dates", requireAuth, requireTeamOutDateAccess, async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const { outDate, reason } = req.body;
    const [entry] = await db.insert(teamOutDatesTable).values({
      teamId,
      outDate,
      reason,
      createdByUserId: req.user!.id,
    }).returning();
    res.status(201).json(entry);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/tournaments/:tournamentId/out-dates", async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const outDates = await db.select().from(teamOutDatesTable).where(
      or(eq(teamOutDatesTable.tournamentId, tournamentId), isNull(teamOutDatesTable.tournamentId))
    );
    res.json(outDates);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/tournaments/:tournamentId/teams/:teamId/out-dates", async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const outDates = await db.select().from(teamOutDatesTable).where(
      and(
        eq(teamOutDatesTable.teamId, teamId),
        isNull(teamOutDatesTable.tournamentId)
      )
    );
    res.json(outDates);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tournaments/:tournamentId/teams/:teamId/out-dates", requireAuth, requireTeamOutDateAccess, async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const { outDate, reason } = req.body;
    const [entry] = await db.insert(teamOutDatesTable).values({
      teamId,
      outDate,
      reason,
      createdByUserId: req.user!.id,
    }).returning();
    res.status(201).json(entry);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/out-dates/:outDateId", requireAuth, requireOutDateDeleteAccess, async (req, res) => {
  try {
    const outDateId = String(req.params.outDateId);
    await db.delete(teamOutDatesTable).where(eq(teamOutDatesTable.id, outDateId));
    res.json({ message: "Out date deleted" });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

export default router;
