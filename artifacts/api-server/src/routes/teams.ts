import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { teamsTable, teamManagerAssignmentsTable, adminClubMembershipsTable, tournamentTeamsTable, matchesTable, matchEventsTable, teamOutDatesTable, userInvitesTable, playersTable, usersTable, horsesTable, HORSE_SEX_OPTIONS, HORSE_COLOR_OPTIONS } from "@workspace/db/schema";
import { eq, ilike, and, or } from "drizzle-orm";
import { requireAuth, isSuperAdmin, requireSuperAdmin } from "../lib/auth";

const router: IRouter = Router();

async function requireClubAdminForTeamWrite(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }
  const clubId = String(req.params.clubId);
  const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user.id));
  if (!memberships.some(m => m.clubId === clubId)) {
    res.status(403).json({ message: "Club admin access required to manage teams" }); return;
  }
  next();
}

async function requireTeamAdminOrManager(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }
  const teamId = String(req.params.teamId);
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) { res.status(404).json({ message: "Team not found" }); return; }
  const clubMemberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user.id));
  if (clubMemberships.some(m => m.clubId === team.clubId)) { next(); return; }
  const assignments = await db.select().from(teamManagerAssignmentsTable).where(
    and(eq(teamManagerAssignmentsTable.teamId, teamId), eq(teamManagerAssignmentsTable.userId, req.user.id), eq(teamManagerAssignmentsTable.status, "active"))
  );
  if (assignments.length > 0) { next(); return; }
  res.status(403).json({ message: "You must be a club admin or team manager to edit this team" });
}

router.get("/clubs/:clubId/teams", async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    const search = req.query.search as string | undefined;
    const conditions: any[] = [eq(teamsTable.clubId, clubId)];
    if (search) conditions.push(ilike(teamsTable.name, `%${search}%`));
    const teams = await db.select().from(teamsTable).where(and(...conditions));
    res.json(teams);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/clubs/:clubId/teams", requireAuth, requireClubAdminForTeamWrite, async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    const { name, shortName, primaryColor, handicap, contactName, contactPhone, notes, logoUrl, scoreboardName } = req.body;
    const [team] = await db.insert(teamsTable).values({
      clubId, name, shortName, primaryColor, handicap, contactName, contactPhone, notes, logoUrl, scoreboardName,
    }).returning();
    res.status(201).json(team);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/teams", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const conditions: any[] = [];
    if (search) conditions.push(ilike(teamsTable.name, `%${search}%`));
    const teams = conditions.length > 0
      ? await db.select().from(teamsTable).where(and(...conditions))
      : await db.select().from(teamsTable);
    res.json(teams);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/teams", requireAuth, async (req, res) => {
  try {
    const { name, shortName, primaryColor, handicap, contactName, contactPhone, notes, logoUrl, clubId, scoreboardName } = req.body;
    if (!name) { res.status(400).json({ message: "Team name is required" }); return; }
    if (clubId && !isSuperAdmin(req.user!)) {
      const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user!.id));
      if (!memberships.some(m => m.clubId === clubId)) {
        res.status(403).json({ message: "Club admin access required to create teams for this club" }); return;
      }
    }
    const [team] = await db.insert(teamsTable).values({
      clubId: clubId || null,
      name, shortName, primaryColor, handicap, contactName, contactPhone, notes, logoUrl, scoreboardName,
    }).returning();
    res.status(201).json(team);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/teams/:teamId", async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
    if (!team) { res.status(404).json({ message: "Team not found" }); return; }
    const assignments = await db.select().from(teamManagerAssignmentsTable)
      .where(and(eq(teamManagerAssignmentsTable.teamId, teamId), eq(teamManagerAssignmentsTable.status, "active")));
    res.json({ ...team, managerAssignment: assignments[0] || null });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.put("/teams/:teamId", requireAuth, requireTeamAdminOrManager, async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const { name, shortName, primaryColor, handicap, contactName, contactPhone, notes, logoUrl, scoreboardName } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (shortName !== undefined) updates.shortName = shortName;
    if (primaryColor !== undefined) updates.primaryColor = primaryColor;
    if (handicap !== undefined) updates.handicap = handicap;
    if (contactName !== undefined) updates.contactName = contactName;
    if (contactPhone !== undefined) updates.contactPhone = contactPhone;
    if (notes !== undefined) updates.notes = notes;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    if (scoreboardName !== undefined) updates.scoreboardName = scoreboardName || null;
    const [team] = await db.update(teamsTable).set(updates).where(eq(teamsTable.id, teamId)).returning();
    res.json(team);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/teams/:teamId", requireAuth, async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
    if (!team) { res.status(404).json({ message: "Team not found" }); return; }

    if (!isSuperAdmin(req.user!)) {
      const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user!.id));
      const isClubAdmin = memberships.some((m) => m.clubId === team.clubId);
      if (!isClubAdmin) { res.status(403).json({ message: "Forbidden" }); return; }
    }

    const teamMatches = await db.select({ id: matchesTable.id }).from(matchesTable).where(
      or(eq(matchesTable.homeTeamId, teamId), eq(matchesTable.awayTeamId, teamId))
    );
    for (const m of teamMatches) {
      await db.delete(matchEventsTable).where(eq(matchEventsTable.matchId, m.id));
    }
    await db.delete(matchesTable).where(
      or(eq(matchesTable.homeTeamId, teamId), eq(matchesTable.awayTeamId, teamId))
    );
    const teamPlayers = await db.select({ id: playersTable.id }).from(playersTable).where(eq(playersTable.teamId, teamId));
    for (const p of teamPlayers) {
      await db.delete(horsesTable).where(eq(horsesTable.playerId, p.id));
    }
    await db.delete(playersTable).where(eq(playersTable.teamId, teamId));
    await db.delete(teamOutDatesTable).where(eq(teamOutDatesTable.teamId, teamId));
    const assignments = await db.select({ id: teamManagerAssignmentsTable.id }).from(teamManagerAssignmentsTable).where(eq(teamManagerAssignmentsTable.teamId, teamId));
    for (const a of assignments) {
      await db.delete(userInvitesTable).where(eq(userInvitesTable.teamManagerAssignmentId, a.id));
    }
    await db.delete(teamManagerAssignmentsTable).where(eq(teamManagerAssignmentsTable.teamId, teamId));
    await db.delete(tournamentTeamsTable).where(eq(tournamentTeamsTable.teamId, teamId));
    await db.delete(teamsTable).where(eq(teamsTable.id, teamId));

    res.json({ message: "Team deleted" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/teams/:teamId/players", async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const players = await db.select().from(playersTable).where(eq(playersTable.teamId, teamId));
    res.json(players);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/teams/:teamId/players", requireAuth, requireTeamAdminOrManager, async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const { name, handicap, position } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ message: "Player name is required" });
      return;
    }
    const [player] = await db.insert(playersTable).values({
      teamId,
      name: name.trim(),
      handicap: handicap != null ? String(handicap) : null,
      position: position || null,
    }).returning();
    res.status(201).json(player);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.put("/teams/:teamId/players/:playerId", requireAuth, requireTeamAdminOrManager, async (req, res) => {
  try {
    const playerId = String(req.params.playerId);
    const { name, handicap, position, isActive } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (handicap !== undefined) updates.handicap = handicap != null ? String(handicap) : null;
    if (position !== undefined) updates.position = position;
    if (isActive !== undefined) updates.isActive = isActive;
    const [player] = await db.update(playersTable).set(updates).where(eq(playersTable.id, playerId)).returning();
    if (!player) { res.status(404).json({ message: "Player not found" }); return; }
    res.json(player);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/teams/:teamId/players/:playerId", requireAuth, requireTeamAdminOrManager, async (req, res) => {
  try {
    const playerId = String(req.params.playerId);
    await db.delete(horsesTable).where(eq(horsesTable.playerId, playerId));
    const [player] = await db.delete(playersTable).where(eq(playersTable.id, playerId)).returning();
    if (!player) { res.status(404).json({ message: "Player not found" }); return; }
    res.json({ message: "Player deleted" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/teams/:teamId/players/:playerId/horses", requireAuth, requireTeamAdminOrManager, async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const playerId = String(req.params.playerId);
    const [player] = await db.select().from(playersTable).where(and(eq(playersTable.id, playerId), eq(playersTable.teamId, teamId)));
    if (!player) { res.status(404).json({ message: "Player not found" }); return; }
    const horses = await db.select().from(horsesTable).where(eq(horsesTable.playerId, playerId));
    res.json(horses);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/teams/:teamId/players/:playerId/horses", requireAuth, requireTeamAdminOrManager, async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const playerId = String(req.params.playerId);
    const [player] = await db.select().from(playersTable).where(and(eq(playersTable.id, playerId), eq(playersTable.teamId, teamId)));
    if (!player) { res.status(404).json({ message: "Player not found" }); return; }

    const { horseName, owner, breeder, ownedAndBredBy, sire, dam, age, color, sex, typeOrBreed, notes } = req.body;
    if (!horseName || !horseName.trim()) {
      res.status(400).json({ message: "Horse name is required" }); return;
    }
    if (sex && !(HORSE_SEX_OPTIONS as readonly string[]).includes(sex)) {
      res.status(400).json({ message: `Invalid sex. Must be one of: ${HORSE_SEX_OPTIONS.join(", ")}` }); return;
    }
    if (color && !(HORSE_COLOR_OPTIONS as readonly string[]).includes(color)) {
      res.status(400).json({ message: `Invalid color. Must be one of: ${HORSE_COLOR_OPTIONS.join(", ")}` }); return;
    }
    if (age != null && (Number(age) < 0 || !Number.isFinite(Number(age)))) {
      res.status(400).json({ message: "Age must be a non-negative number" }); return;
    }

    const [horse] = await db.insert(horsesTable).values({
      playerId,
      horseName: horseName.trim(),
      owner: owner || null,
      breeder: breeder || null,
      ownedAndBredBy: ownedAndBredBy || null,
      sire: sire || null,
      dam: dam || null,
      age: age != null ? Number(age) : null,
      color: color || null,
      sex: sex || null,
      typeOrBreed: typeOrBreed || null,
      notes: notes || null,
    }).returning();
    res.status(201).json(horse);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.put("/teams/:teamId/players/:playerId/horses/:horseId", requireAuth, requireTeamAdminOrManager, async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const playerId = String(req.params.playerId);
    const horseId = String(req.params.horseId);

    const [player] = await db.select().from(playersTable).where(and(eq(playersTable.id, playerId), eq(playersTable.teamId, teamId)));
    if (!player) { res.status(404).json({ message: "Player not found" }); return; }

    const { horseName, owner, breeder, ownedAndBredBy, sire, dam, age, color, sex, typeOrBreed, notes } = req.body;

    if (horseName !== undefined && !horseName.trim()) {
      res.status(400).json({ message: "Horse name cannot be empty" }); return;
    }
    if (sex && !(HORSE_SEX_OPTIONS as readonly string[]).includes(sex)) {
      res.status(400).json({ message: `Invalid sex. Must be one of: ${HORSE_SEX_OPTIONS.join(", ")}` }); return;
    }
    if (color && !(HORSE_COLOR_OPTIONS as readonly string[]).includes(color)) {
      res.status(400).json({ message: `Invalid color. Must be one of: ${HORSE_COLOR_OPTIONS.join(", ")}` }); return;
    }
    if (age !== undefined && age != null && (Number(age) < 0 || !Number.isFinite(Number(age)))) {
      res.status(400).json({ message: "Age must be a non-negative number" }); return;
    }

    const updates: Record<string, any> = {};
    if (horseName !== undefined) updates.horseName = horseName.trim();
    if (owner !== undefined) updates.owner = owner || null;
    if (breeder !== undefined) updates.breeder = breeder || null;
    if (ownedAndBredBy !== undefined) updates.ownedAndBredBy = ownedAndBredBy || null;
    if (sire !== undefined) updates.sire = sire || null;
    if (dam !== undefined) updates.dam = dam || null;
    if (age !== undefined) updates.age = age != null ? Number(age) : null;
    if (color !== undefined) updates.color = color || null;
    if (sex !== undefined) updates.sex = sex || null;
    if (typeOrBreed !== undefined) updates.typeOrBreed = typeOrBreed || null;
    if (notes !== undefined) updates.notes = notes || null;

    const [horse] = await db.update(horsesTable).set(updates).where(and(eq(horsesTable.id, horseId), eq(horsesTable.playerId, playerId))).returning();
    if (!horse) { res.status(404).json({ message: "Horse not found" }); return; }
    res.json(horse);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/teams/:teamId/players/:playerId/horses/:horseId", requireAuth, requireTeamAdminOrManager, async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const playerId = String(req.params.playerId);
    const horseId = String(req.params.horseId);

    const [player] = await db.select().from(playersTable).where(and(eq(playersTable.id, playerId), eq(playersTable.teamId, teamId)));
    if (!player) { res.status(404).json({ message: "Player not found" }); return; }

    const [horse] = await db.delete(horsesTable).where(and(eq(horsesTable.id, horseId), eq(horsesTable.playerId, playerId))).returning();
    if (!horse) { res.status(404).json({ message: "Horse not found" }); return; }
    res.json({ message: "Horse deleted" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/teams/:teamId/managers", requireAuth, async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
    if (!team) { res.status(404).json({ message: "Team not found" }); return; }

    if (!isSuperAdmin(req.user!)) {
      const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user!.id));
      if (!memberships.some(m => m.clubId === team.clubId)) {
        res.status(403).json({ message: "Club admin access required" }); return;
      }
    }

    const assignments = await db.select().from(teamManagerAssignmentsTable).where(
      and(eq(teamManagerAssignmentsTable.teamId, teamId), eq(teamManagerAssignmentsTable.status, "active"))
    );
    const managers = await Promise.all(
      assignments.map(async (a) => {
        let user = null;
        if (a.userId) {
          const [u] = await db.select({
            id: usersTable.id,
            email: usersTable.email,
            displayName: usersTable.displayName,
            role: usersTable.role,
          }).from(usersTable).where(eq(usersTable.id, a.userId));
          user = u || null;
        }
        return { ...a, user };
      })
    );
    res.json(managers);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/teams/:teamId/managers", requireAuth, async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const { userId } = req.body;
    if (!userId) { res.status(400).json({ message: "userId is required" }); return; }

    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
    if (!team) { res.status(404).json({ message: "Team not found" }); return; }

    if (!isSuperAdmin(req.user!)) {
      const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user!.id));
      if (!memberships.some(m => m.clubId === team.clubId)) {
        res.status(403).json({ message: "Club admin access required" }); return;
      }
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ message: "User not found" }); return; }

    const existing = await db.select().from(teamManagerAssignmentsTable).where(
      and(eq(teamManagerAssignmentsTable.teamId, teamId), eq(teamManagerAssignmentsTable.userId, userId), eq(teamManagerAssignmentsTable.status, "active"))
    );
    if (existing.length > 0) {
      res.status(409).json({ message: "User is already a manager of this team" }); return;
    }

    const [assignment] = await db.insert(teamManagerAssignmentsTable).values({
      userId,
      teamId,
      assignedBy: req.user!.id,
      status: "active",
      acceptedAt: new Date(),
    }).returning();
    res.status(201).json(assignment);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/teams/:teamId/managers/:assignmentId", requireAuth, async (req, res) => {
  try {
    const teamId = String(req.params.teamId);
    const assignmentId = String(req.params.assignmentId);

    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
    if (!team) { res.status(404).json({ message: "Team not found" }); return; }

    if (!isSuperAdmin(req.user!)) {
      const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user!.id));
      if (!memberships.some(m => m.clubId === team.clubId)) {
        res.status(403).json({ message: "Club admin access required" }); return;
      }
    }

    await db.update(teamManagerAssignmentsTable).set({ status: "revoked" }).where(
      and(eq(teamManagerAssignmentsTable.id, assignmentId), eq(teamManagerAssignmentsTable.teamId, teamId))
    );
    res.json({ message: "Manager removed" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
