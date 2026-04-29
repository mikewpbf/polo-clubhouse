import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  playersTable,
  teamPlayersTable,
  teamsTable,
  clubsTable,
  horsesTable,
  matchesTable,
  matchEventsTable,
  tournamentsTable,
  adminClubMembershipsTable,
  teamManagerAssignmentsTable,
  usersTable,
  HORSE_SEX_OPTIONS,
  HORSE_COLOR_OPTIONS,
} from "@workspace/db/schema";
import { eq, ilike, and, or, inArray, desc, sql, isNotNull } from "drizzle-orm";
import { requireAuth, optionalAuth, isSuperAdmin } from "../lib/auth";

const router: IRouter = Router();

function currentSeasonYear(): number {
  return new Date().getUTCFullYear();
}

function calcAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age >= 0 ? age : null;
}

async function userCanEditPlayerFull(userId: string, userRole: string, playerId: string): Promise<boolean> {
  if (userRole === "super_admin") return true;
  // Club admins may only edit players whose canonical home club they administer.
  // Editing players based on transient roster membership (team→club) is intentionally
  // disallowed — it would let a visiting-club admin mutate another club's canonical
  // player records simply because that player happens to be on a guest roster.
  const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, userId));
  if (memberships.length > 0) {
    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
    if (player?.homeClubId && memberships.some(m => m.clubId === player.homeClubId)) return true;
  }
  // Team managers are intentionally read-only for player records.
  return false;
}

function requireSelfOrEditor(allowSelfEdit: boolean) {
  return async function (req: Request, res: Response, next: NextFunction) {
    if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
    const playerId = String(req.params.playerId);
    if (allowSelfEdit) {
      const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (player?.managedByUserId === req.user.id) { next(); return; }
    }
    const ok = await userCanEditPlayerFull(req.user.id, req.user.role, playerId);
    if (ok) { next(); return; }
    res.status(403).json({ message: "You don't have permission to edit this player" });
  };
}

// Strict self-edit: only the linked managed user OR a super admin may patch the public profile.
// Club admins / team managers must use the full PUT endpoint instead.
async function requireSelfOnly(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }
  const playerId = String(req.params.playerId);
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  if (player?.managedByUserId === req.user.id) { next(); return; }
  res.status(403).json({ message: "You can only edit your own linked profile" });
}

router.get("/players", optionalAuth, async (req, res) => {
  try {
    const search = (req.query.search as string | undefined)?.trim();
    const clubId = req.query.clubId as string | undefined;
    const teamIdFilter = req.query.teamId as string | undefined;

    const includeInactiveParam = String(req.query.includeInactive ?? "").toLowerCase() === "true";
    // Only super_admins or club admins are permitted to list inactive/archived players;
    // anonymous and ordinary users always get the active-only directory.
    const viewerIsAdmin = !!req.user && (
      req.user.role === "super_admin" || req.user.role === "admin"
    );
    const includeInactive = includeInactiveParam && viewerIsAdmin;

    const conditions: any[] = [];
    if (!includeInactive) conditions.push(eq(playersTable.isActive, true));
    if (search) conditions.push(ilike(playersTable.name, `%${search}%`));
    if (clubId) conditions.push(eq(playersTable.homeClubId, clubId));

    // Role-based directory scoping: super_admin sees all; club admins see players
    // tied to their managed clubs (via homeClub OR any team→club they administer);
    // team managers (without admin role) see only players currently on teams they
    // manage; spectators / unauthenticated callers see the public active directory.
    if (req.user && req.user.role !== "super_admin") {
      if (req.user.role === "admin") {
        // Club-admin directory scope: only players whose canonical home club is one
        // of the clubs this user administers. Players merely visiting on a guest
        // roster of an admin's team are intentionally excluded — they appear in the
        // team's roster view but not in this club's player directory.
        const memberships = await db.select({ clubId: adminClubMembershipsTable.clubId })
          .from(adminClubMembershipsTable)
          .where(eq(adminClubMembershipsTable.userId, req.user.id));
        const adminClubIds = memberships.map(m => m.clubId).filter((x): x is string => !!x);
        if (adminClubIds.length === 0) { res.json([]); return; }
        conditions.push(inArray(playersTable.homeClubId, adminClubIds));
      } else if (req.user.role === "team_manager") {
        const assignments = await db.select({ teamId: teamManagerAssignmentsTable.teamId })
          .from(teamManagerAssignmentsTable)
          .where(and(
            eq(teamManagerAssignmentsTable.userId, req.user.id),
            eq(teamManagerAssignmentsTable.status, "active"),
          ));
        const managedTeamIds = assignments.map(a => a.teamId).filter((x): x is string => !!x);
        if (managedTeamIds.length === 0) { res.json([]); return; }
        // Spec: team-manager directory view is restricted to the CURRENT-SEASON roster only.
        const tpRows = await db.select({ playerId: teamPlayersTable.playerId })
          .from(teamPlayersTable)
          .where(and(
            inArray(teamPlayersTable.teamId, managedTeamIds),
            eq(teamPlayersTable.seasonYear, currentSeasonYear()),
          ));
        const allowedIds = Array.from(new Set(tpRows.map(t => t.playerId)));
        if (allowedIds.length === 0) { res.json([]); return; }
        conditions.push(inArray(playersTable.id, allowedIds));
      }
    }

    let playerIds: string[] | null = null;
    if (teamIdFilter) {
      const tps = await db.select({ playerId: teamPlayersTable.playerId })
        .from(teamPlayersTable)
        .where(and(eq(teamPlayersTable.teamId, teamIdFilter), eq(teamPlayersTable.seasonYear, currentSeasonYear())));
      playerIds = tps.map(t => t.playerId);
      if (playerIds.length === 0) { res.json([]); return; }
      conditions.push(inArray(playersTable.id, playerIds));
    }

    const rows = conditions.length > 0
      ? await db.select().from(playersTable).where(and(...conditions))
      : await db.select().from(playersTable);

    // batch home club lookups
    const clubIds = Array.from(new Set(rows.map(r => r.homeClubId).filter((x): x is string => !!x)));
    const clubsRows = clubIds.length > 0 ? await db.select().from(clubsTable).where(inArray(clubsTable.id, clubIds)) : [];
    const clubMap = new Map(clubsRows.map(c => [c.id, c]));

    // last match date per player (most recent match they appeared in)
    const playerIdList = rows.map(r => r.id);
    let lastMatchMap = new Map<string, string>();
    if (playerIdList.length > 0) {
      // From match_events, find most recent match for each player
      const evRows = await db.select({
        playerId: matchEventsTable.playerId,
        matchId: matchEventsTable.matchId,
      }).from(matchEventsTable).where(inArray(matchEventsTable.playerId, playerIdList));
      const matchIds = Array.from(new Set(evRows.map(e => e.matchId).filter((x): x is string => !!x)));
      if (matchIds.length > 0) {
        const matchRows = await db.select({ id: matchesTable.id, scheduledAt: matchesTable.scheduledAt })
          .from(matchesTable).where(inArray(matchesTable.id, matchIds));
        const matchMap = new Map(matchRows.map(m => [m.id, m.scheduledAt]));
        for (const ev of evRows) {
          if (!ev.playerId || !ev.matchId) continue;
          const sched = matchMap.get(ev.matchId);
          if (!sched) continue;
          const iso = (sched instanceof Date ? sched : new Date(sched as any)).toISOString().slice(0, 10);
          const prev = lastMatchMap.get(ev.playerId);
          if (!prev || iso > prev) lastMatchMap.set(ev.playerId, iso);
        }
      }
    }

    const out = rows.map(p => {
      const club = p.homeClubId ? clubMap.get(p.homeClubId) : undefined;
      return {
        id: p.id,
        name: p.name,
        handicap: p.handicap,
        headshotUrl: p.headshotUrl,
        homeClubId: p.homeClubId,
        homeClubName: club?.name ?? null,
        homeClubSlug: club?.slug ?? null,
        lastMatchDate: lastMatchMap.get(p.id) ?? null,
      };
    });
    // Sort by name asc
    out.sort((a, b) => a.name.localeCompare(b.name));
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/players/top", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 8)));
    const rows = await db.select().from(playersTable)
      .where(and(eq(playersTable.isActive, true), isNotNull(playersTable.handicap)))
      .orderBy(desc(playersTable.handicap))
      .limit(limit);
    const clubIds = Array.from(new Set(rows.map(r => r.homeClubId).filter((x): x is string => !!x)));
    const clubsRows = clubIds.length > 0 ? await db.select().from(clubsTable).where(inArray(clubsTable.id, clubIds)) : [];
    const clubMap = new Map(clubsRows.map(c => [c.id, c]));
    res.json(rows.map(p => {
      const club = p.homeClubId ? clubMap.get(p.homeClubId) : undefined;
      return {
        id: p.id,
        name: p.name,
        handicap: p.handicap,
        headshotUrl: p.headshotUrl,
        homeClubId: p.homeClubId,
        homeClubName: club?.name ?? null,
        homeClubSlug: club?.slug ?? null,
        lastMatchDate: null,
      };
    }));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/players", requireAuth, async (req, res) => {
  try {
    const { name, handicap, homeClubId, headshotUrl, dateOfBirth, bio, managedByUserId } = req.body;
    if (!name || !String(name).trim()) { res.status(400).json({ message: "Name is required" }); return; }

    // Permission: super_admin OR club admin of homeClubId (if provided)
    if (!isSuperAdmin(req.user!)) {
      if (!homeClubId) {
        res.status(403).json({ message: "Only super admins can create players without a home club" }); return;
      }
      const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user!.id));
      if (!memberships.some(m => m.clubId === homeClubId)) {
        res.status(403).json({ message: "Club admin access required to create players for this club" }); return;
      }
    }

    const [player] = await db.insert(playersTable).values({
      name: String(name).trim(),
      handicap: handicap != null ? String(handicap) : null,
      homeClubId: homeClubId || null,
      headshotUrl: headshotUrl || null,
      dateOfBirth: dateOfBirth || null,
      bio: bio || null,
      managedByUserId: managedByUserId || null,
    }).returning();
    res.status(201).json(player);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/players/:playerId", optionalAuth, async (req, res) => {
  try {
    const playerId = String(req.params.playerId);
    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
    if (!player) { res.status(404).json({ message: "Player not found" }); return; }

    let club: any = null;
    if (player.homeClubId) {
      const [c] = await db.select().from(clubsTable).where(eq(clubsTable.id, player.homeClubId));
      club = c || null;
    }

    // teams history (current + past via team_players); current season highlighted on the client
    const tps = await db.select().from(teamPlayersTable).where(eq(teamPlayersTable.playerId, playerId));
    const teamIds = Array.from(new Set(tps.map(t => t.teamId)));
    const teamRows = teamIds.length > 0 ? await db.select().from(teamsTable).where(inArray(teamsTable.id, teamIds)) : [];
    const teamMap = new Map(teamRows.map(t => [t.id, t]));
    const teams = tps.map(tp => {
      const t = teamMap.get(tp.teamId);
      return {
        teamId: tp.teamId,
        teamName: t?.name ?? "",
        teamLogoUrl: t?.logoUrl ?? null,
        seasonYear: tp.seasonYear,
      };
    }).sort((a, b) => b.seasonYear - a.seasonYear);

    // horses
    const horses = await db.select().from(horsesTable).where(eq(horsesTable.playerId, playerId));

    // stats: career goals from match_events (type='goal'), career wins from matches
    const allEvents = await db.select().from(matchEventsTable).where(eq(matchEventsTable.playerId, playerId));
    const careerGoals = allEvents.filter(e => e.eventType === "goal").length;

    // wins: find matches where this player appeared and his side won
    const matchIds = Array.from(new Set(allEvents.map(e => e.matchId).filter((x): x is string => !!x)));
    let careerWins = 0;
    let seasonWins = 0;
    let seasonGoals = 0;
    const yr = currentSeasonYear();
    if (matchIds.length > 0) {
      const matchRows = await db.select().from(matchesTable).where(inArray(matchesTable.id, matchIds));
      const matchById = new Map(matchRows.map(m => [m.id, m]));
      // map player -> set of teams the player has been on
      const playerTeams = new Set(tps.map(t => t.teamId));
      for (const m of matchRows) {
        const homeWin = (m.homeScore ?? 0) > (m.awayScore ?? 0);
        const awayWin = (m.awayScore ?? 0) > (m.homeScore ?? 0);
        if (!homeWin && !awayWin) continue;
        const playerSideHome = m.homeTeamId && playerTeams.has(m.homeTeamId);
        const playerSideAway = m.awayTeamId && playerTeams.has(m.awayTeamId);
        const won = (homeWin && playerSideHome) || (awayWin && playerSideAway);
        if (won) careerWins++;
        const matchYr = m.scheduledAt ? new Date(m.scheduledAt as any).getUTCFullYear() : null;
        if (won && matchYr === yr) seasonWins++;
      }
      for (const ev of allEvents) {
        if (ev.eventType !== "goal" || !ev.matchId) continue;
        const m = matchById.get(ev.matchId);
        if (!m) continue;
        const matchYr = m.scheduledAt ? new Date(m.scheduledAt as any).getUTCFullYear() : null;
        if (matchYr === yr) seasonGoals++;
      }
    }

    // MVP/BPP: tournament scalar fields
    const mvpRows = await db.select({ id: tournamentsTable.id }).from(tournamentsTable).where(eq(tournamentsTable.mvpPlayerId, playerId));
    const mvpAwards = mvpRows.length;

    // BPP: BPP horse belongs to this player
    const playerHorseIds = horses.map(h => h.id);
    let bppAwards = 0;
    if (playerHorseIds.length > 0) {
      const bppRows = await db.select({ id: tournamentsTable.id }).from(tournamentsTable).where(inArray(tournamentsTable.bppHorseId, playerHorseIds));
      bppAwards = bppRows.length;
    }

    // Linked user (only included when caller is super_admin or self)
    let managedByUser: any = null;
    if (player.managedByUserId && req.user && (isSuperAdmin(req.user) || req.user.id === player.managedByUserId)) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, player.managedByUserId));
      if (u) managedByUser = { id: u.id, email: u.email, displayName: u.displayName };
    }

    res.json({
      id: player.id,
      name: player.name,
      handicap: player.handicap,
      headshotUrl: player.headshotUrl,
      dateOfBirth: player.dateOfBirth,
      bio: player.bio,
      homeClubId: player.homeClubId,
      homeClubName: club?.name ?? null,
      homeClubSlug: club?.slug ?? null,
      managedByUserId: player.managedByUserId,
      managedByUser,
      hasLinkedUser: !!player.managedByUserId,
      age: calcAge(player.dateOfBirth as any),
      stats: { seasonGoals, seasonWins, careerGoals, careerWins, mvpAwards, bppAwards },
      teams,
      horses,
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.put("/players/:playerId", requireAuth, requireSelfOrEditor(false), async (req, res) => {
  try {
    const playerId = String(req.params.playerId);
    const { name, handicap, homeClubId, headshotUrl, dateOfBirth, bio, managedByUserId, isActive } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = String(name).trim();
    if (handicap !== undefined) updates.handicap = handicap != null ? String(handicap) : null;
    if (homeClubId !== undefined) updates.homeClubId = homeClubId || null;
    if (headshotUrl !== undefined) updates.headshotUrl = headshotUrl || null;
    if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth || null;
    if (bio !== undefined) updates.bio = bio || null;
    if (managedByUserId !== undefined) updates.managedByUserId = managedByUserId || null;
    if (isActive !== undefined) updates.isActive = !!isActive;
    const [player] = await db.update(playersTable).set(updates).where(eq(playersTable.id, playerId)).returning();
    if (!player) { res.status(404).json({ message: "Player not found" }); return; }
    res.json(player);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

const SELF_PROFILE_ALLOWED_FIELDS = new Set(["name", "headshotUrl", "dateOfBirth", "homeClubId", "bio"]);

router.patch("/players/:playerId/profile", requireAuth, requireSelfOnly, async (req, res) => {
  try {
    const playerId = String(req.params.playerId);
    const body = (req.body && typeof req.body === "object") ? req.body as Record<string, unknown> : {};
    const incoming = Object.keys(body);
    const forbidden = incoming.filter(k => !SELF_PROFILE_ALLOWED_FIELDS.has(k));
    if (forbidden.length > 0) {
      res.status(403).json({
        message: `These fields are not editable from your own profile: ${forbidden.join(", ")}`,
        forbiddenFields: forbidden,
        allowedFields: Array.from(SELF_PROFILE_ALLOWED_FIELDS),
      });
      return;
    }
    const { name, headshotUrl, dateOfBirth, homeClubId, bio } = body as Record<string, any>;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = String(name).trim();
    if (headshotUrl !== undefined) updates.headshotUrl = headshotUrl || null;
    if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth || null;
    if (homeClubId !== undefined) updates.homeClubId = homeClubId || null;
    if (bio !== undefined) updates.bio = bio || null;
    const [player] = await db.update(playersTable).set(updates).where(eq(playersTable.id, playerId)).returning();
    if (!player) { res.status(404).json({ message: "Player not found" }); return; }
    res.json(player);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/players/:playerId", requireAuth, requireSelfOrEditor(false), async (req, res) => {
  try {
    const playerId = String(req.params.playerId);
    // Cascade-clean dependents
    await db.delete(horsesTable).where(eq(horsesTable.playerId, playerId));
    await db.delete(teamPlayersTable).where(eq(teamPlayersTable.playerId, playerId));
    // Null out match_events.player_id (preserve history rather than delete events)
    await db.update(matchEventsTable).set({ playerId: null }).where(eq(matchEventsTable.playerId, playerId));
    const [player] = await db.delete(playersTable).where(eq(playersTable.id, playerId)).returning();
    if (!player) { res.status(404).json({ message: "Player not found" }); return; }
    res.json({ message: "Player deleted" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/players/:playerId/horses", requireAuth, requireSelfOrEditor(true), async (req, res) => {
  try {
    const playerId = String(req.params.playerId);
    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
    if (!player) { res.status(404).json({ message: "Player not found" }); return; }

    const { horseName, owner, breeder, ownedAndBredBy, sire, dam, age, color, sex, typeOrBreed, notes } = req.body;
    if (!horseName || !String(horseName).trim()) { res.status(400).json({ message: "Horse name is required" }); return; }
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
      horseName: String(horseName).trim(),
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

router.delete("/players/:playerId/horses/:horseId", requireAuth, requireSelfOrEditor(true), async (req, res) => {
  try {
    const playerId = String(req.params.playerId);
    const horseId = String(req.params.horseId);
    const [horse] = await db.delete(horsesTable).where(and(eq(horsesTable.id, horseId), eq(horsesTable.playerId, playerId))).returning();
    if (!horse) { res.status(404).json({ message: "Horse not found" }); return; }
    res.json({ message: "Horse deleted" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/me/linked-player", requireAuth, async (req, res) => {
  try {
    const [player] = await db.select().from(playersTable).where(eq(playersTable.managedByUserId, req.user!.id));
    res.json(player || null);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
