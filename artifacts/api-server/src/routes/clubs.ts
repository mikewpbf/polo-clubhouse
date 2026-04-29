import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clubsTable, fieldsTable, tournamentsTable, spectatorFollowsTable, adminClubMembershipsTable, teamsTable, tournamentTeamsTable, matchesTable, matchEventsTable, playDatesTable, teamOutDatesTable, teamManagerAssignmentsTable, userInvitesTable, playersTable, usersTable } from "@workspace/db/schema";
import { eq, ilike, and, count, or, inArray, desc, asc } from "drizzle-orm";
import { optionalAuth, requireAuth, requireClubAdmin, requireSuperAdmin, isSuperAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/clubs", optionalAuth, async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const country = req.query.country as string | undefined;
    const region = req.query.region as string | undefined;
    const conditions: any[] = [];
    if (search) conditions.push(ilike(clubsTable.name, `%${search}%`));
    if (country) conditions.push(eq(clubsTable.country, country));
    if (region) conditions.push(eq(clubsTable.region, region));
    const query = conditions.length > 0
      ? db.select().from(clubsTable).where(and(...conditions))
      : db.select().from(clubsTable);
    const clubs = await query.orderBy(desc(clubsTable.sponsored), desc(clubsTable.sponsoredRank), asc(clubsTable.name));
    res.json(clubs);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/clubs", requireAuth, async (req, res) => {
  try {
    const { name, slug, description, website, country, region, logoUrl } = req.body;
    const logoInitials = name.substring(0, 2).toUpperCase();
    const [club] = await db.insert(clubsTable).values({
      name, slug, description, website, country, region, logoInitials, logoUrl,
    }).returning();
    await db.insert(adminClubMembershipsTable).values({
      userId: req.user!.id,
      clubId: club.id,
      role: "owner",
    });
    res.status(201).json(club);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/clubs/:slug", optionalAuth, async (req, res) => {
  try {
    const slug = String(req.params.slug);
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.slug, slug));
    if (!club) { res.status(404).json({ message: "Club not found" }); return; }
    const fields = await db.select().from(fieldsTable).where(eq(fieldsTable.clubId, club.id));
    const tournaments = await db.select().from(tournamentsTable).where(eq(tournamentsTable.clubId, club.id));
    const [followerResult] = await db.select({ count: count() }).from(spectatorFollowsTable).where(eq(spectatorFollowsTable.clubId, club.id));
    let isFollowing = false;
    if (req.user) {
      const [follow] = await db.select().from(spectatorFollowsTable).where(
        and(eq(spectatorFollowsTable.userId, req.user.id), eq(spectatorFollowsTable.clubId, club.id))
      );
      isFollowing = !!follow;
    }
    res.json({ ...club, fields, tournaments, followerCount: followerResult?.count || 0, isFollowing });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.put("/clubs/:clubId/update", requireAuth, requireClubAdmin, async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    const { name, slug, description, website, country, region, logoUrl, logo96Url, logo40Url, sponsored, sponsoredRank } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) { updates.name = name; updates.logoInitials = name.substring(0, 2).toUpperCase(); }
    if (slug !== undefined) updates.slug = slug;
    if (description !== undefined) updates.description = description;
    if (website !== undefined) updates.website = website;
    if (country !== undefined) updates.country = country;
    if (region !== undefined) updates.region = region;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl;
    if (logo96Url !== undefined) updates.logo96Url = logo96Url;
    if (logo40Url !== undefined) updates.logo40Url = logo40Url;
    if (isSuperAdmin(req.user!) && sponsored !== undefined) updates.sponsored = sponsored;
    if (isSuperAdmin(req.user!) && sponsoredRank !== undefined) updates.sponsoredRank = sponsoredRank;
    const [club] = await db.update(clubsTable).set(updates).where(eq(clubsTable.id, clubId)).returning();
    res.json(club);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/clubs/:clubId", requireAuth, async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId));
    if (!club) { res.status(404).json({ message: "Club not found" }); return; }

    if (!isSuperAdmin(req.user!)) {
      const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user!.id));
      const isClubAdmin = memberships.some((m) => m.clubId === clubId);
      if (!isClubAdmin) { res.status(403).json({ message: "Forbidden" }); return; }
    }

    const clubTournaments = await db.select({ id: tournamentsTable.id }).from(tournamentsTable).where(eq(tournamentsTable.clubId, clubId));
    for (const t of clubTournaments) {
      const tMatches = await db.select({ id: matchesTable.id }).from(matchesTable).where(eq(matchesTable.tournamentId, t.id));
      for (const m of tMatches) {
        await db.delete(matchEventsTable).where(eq(matchEventsTable.matchId, m.id));
      }
      await db.delete(matchesTable).where(eq(matchesTable.tournamentId, t.id));
      await db.delete(teamOutDatesTable).where(eq(teamOutDatesTable.tournamentId, t.id));
      await db.delete(playDatesTable).where(eq(playDatesTable.tournamentId, t.id));
      const assignments = await db.select({ id: teamManagerAssignmentsTable.id }).from(teamManagerAssignmentsTable).where(eq(teamManagerAssignmentsTable.tournamentId, t.id));
      for (const a of assignments) {
        await db.delete(userInvitesTable).where(eq(userInvitesTable.teamManagerAssignmentId, a.id));
      }
      await db.delete(teamManagerAssignmentsTable).where(eq(teamManagerAssignmentsTable.tournamentId, t.id));
      await db.delete(tournamentTeamsTable).where(eq(tournamentTeamsTable.tournamentId, t.id));
    }
    await db.delete(tournamentsTable).where(eq(tournamentsTable.clubId, clubId));

    const clubTeams = await db.select({ id: teamsTable.id }).from(teamsTable).where(eq(teamsTable.clubId, clubId));
    if (clubTeams.length > 0) {
      const teamIds = clubTeams.map((t) => t.id);
      for (const teamId of teamIds) {
        await db.delete(playersTable).where(eq(playersTable.teamId, teamId));
        await db.delete(tournamentTeamsTable).where(eq(tournamentTeamsTable.teamId, teamId));
        await db.delete(teamOutDatesTable).where(eq(teamOutDatesTable.teamId, teamId));
        const tmaRows = await db.select({ id: teamManagerAssignmentsTable.id }).from(teamManagerAssignmentsTable).where(eq(teamManagerAssignmentsTable.teamId, teamId));
        for (const tma of tmaRows) {
          await db.delete(userInvitesTable).where(eq(userInvitesTable.teamManagerAssignmentId, tma.id));
        }
        await db.delete(teamManagerAssignmentsTable).where(eq(teamManagerAssignmentsTable.teamId, teamId));
        const teamMatches = await db.select({ id: matchesTable.id }).from(matchesTable).where(or(eq(matchesTable.homeTeamId, teamId), eq(matchesTable.awayTeamId, teamId)));
        for (const m of teamMatches) {
          await db.delete(matchEventsTable).where(eq(matchEventsTable.matchId, m.id));
        }
        await db.delete(matchesTable).where(or(eq(matchesTable.homeTeamId, teamId), eq(matchesTable.awayTeamId, teamId)));
      }
      await db.delete(teamsTable).where(eq(teamsTable.clubId, clubId));
    }

    await db.delete(fieldsTable).where(eq(fieldsTable.clubId, clubId));
    await db.delete(spectatorFollowsTable).where(eq(spectatorFollowsTable.clubId, clubId));
    await db.delete(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.clubId, clubId));
    await db.delete(clubsTable).where(eq(clubsTable.id, clubId));

    res.json({ message: "Club deleted" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/clubs/:clubId/follow", requireAuth, async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    await db.insert(spectatorFollowsTable).values({
      userId: req.user!.id,
      clubId,
    }).onConflictDoNothing();
    res.json({ message: "Following" });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/clubs/:clubId/unfollow", requireAuth, async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    await db.delete(spectatorFollowsTable).where(
      and(eq(spectatorFollowsTable.userId, req.user!.id), eq(spectatorFollowsTable.clubId, clubId))
    );
    res.json({ message: "Unfollowed" });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/clubs/:clubId/managers", requireAuth, requireClubAdmin, async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.clubId, clubId));
    const managers = await Promise.all(
      memberships.map(async (m) => {
        const [user] = await db.select({
          id: usersTable.id,
          email: usersTable.email,
          displayName: usersTable.displayName,
          role: usersTable.role,
        }).from(usersTable).where(eq(usersTable.id, m.userId));
        return { ...m, user: user || null };
      })
    );
    res.json(managers);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/clubs/:clubId/managers", requireAuth, requireClubAdmin, async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    const { userId, role } = req.body;
    if (!userId) { res.status(400).json({ message: "userId is required" }); return; }
    const validRoles = ["owner", "manager"] as const;
    const assignRole = validRoles.includes(role) ? role : "manager";
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    const [membership] = await db.insert(adminClubMembershipsTable).values({
      userId,
      clubId,
      role: assignRole,
      assignedBy: req.user!.id,
    }).onConflictDoNothing().returning();
    if (!membership) {
      res.status(409).json({ message: "User is already a manager of this club" });
      return;
    }
    res.status(201).json(membership);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/clubs/:clubId/managers/:userId", requireAuth, requireClubAdmin, async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    const userId = String(req.params.userId);
    if (userId === req.user!.id) {
      res.status(400).json({ message: "You cannot remove yourself as a manager" });
      return;
    }
    await db.delete(adminClubMembershipsTable).where(
      and(eq(adminClubMembershipsTable.userId, userId), eq(adminClubMembershipsTable.clubId, clubId))
    );
    res.json({ message: "Manager removed" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/clubs/:clubId/users/search", requireAuth, requireClubAdmin, async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    if (!search || search.length < 2) { res.json([]); return; }
    const users = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      displayName: usersTable.displayName,
      role: usersTable.role,
    }).from(usersTable).where(
      or(
        ilike(usersTable.email, `%${search}%`),
        ilike(usersTable.displayName, `%${search}%`)
      )
    );
    res.json(users.slice(0, 20));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
