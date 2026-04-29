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

    // Wins are computed across every match the player participated in, regardless of
    // whether they scored. We collect candidate matches from BOTH directions so that
    // legacy data without team_players rows still works:
    //   1. team_players → all matches involving any team this player has been on.
    //   2. match_events → matches where this player has at least one event recorded
    //      (covers players added directly to a tournament without a roster link).
    const playerTeamIds = Array.from(new Set(tps.map(t => t.teamId)));
    const matchesViaTeams = playerTeamIds.length > 0
      ? await db.select().from(matchesTable).where(or(
          inArray(matchesTable.homeTeamId, playerTeamIds),
          inArray(matchesTable.awayTeamId, playerTeamIds),
        )!)
      : [];
    const matchIdsViaEvents = Array.from(new Set(allEvents.map(e => e.matchId).filter((x): x is string => !!x)));
    const missingMatchIds = matchIdsViaEvents.filter(id => !matchesViaTeams.some(m => m.id === id));
    const matchesViaEvents = missingMatchIds.length > 0
      ? await db.select().from(matchesTable).where(inArray(matchesTable.id, missingMatchIds))
      : [];
    const matchRows = [...matchesViaTeams, ...matchesViaEvents];
    const matchById = new Map(matchRows.map(m => [m.id, m]));

    // For each match we need to know which side ("home" or "away") this player was on.
    // Prefer team_players (canonical roster), but fall back to match_events.team_id
    // when no roster link exists for that match.
    const playerTeamsAllSeasons = new Set(playerTeamIds);
    const playerSideByMatch = new Map<string, "home" | "away">();
    for (const m of matchRows) {
      if (m.homeTeamId && playerTeamsAllSeasons.has(m.homeTeamId)) {
        playerSideByMatch.set(m.id, "home");
      } else if (m.awayTeamId && playerTeamsAllSeasons.has(m.awayTeamId)) {
        playerSideByMatch.set(m.id, "away");
      }
    }
    for (const ev of allEvents) {
      if (!ev.matchId || !ev.teamId) continue;
      if (playerSideByMatch.has(ev.matchId)) continue;
      const m = matchById.get(ev.matchId);
      if (!m) continue;
      if (ev.teamId === m.homeTeamId) playerSideByMatch.set(ev.matchId, "home");
      else if (ev.teamId === m.awayTeamId) playerSideByMatch.set(ev.matchId, "away");
    }

    let careerWins = 0;
    let seasonWins = 0;
    let seasonGoals = 0;
    const yr = currentSeasonYear();
    for (const m of matchRows) {
      // Only finalized matches count toward wins to avoid in-progress score noise.
      if (m.status !== "final") continue;
      const homeWin = (m.homeScore ?? 0) > (m.awayScore ?? 0);
      const awayWin = (m.awayScore ?? 0) > (m.homeScore ?? 0);
      if (!homeWin && !awayWin) continue;
      const side = playerSideByMatch.get(m.id);
      if (!side) continue;
      const won = (homeWin && side === "home") || (awayWin && side === "away");
      if (!won) continue;
      careerWins++;
      const matchYr = m.scheduledAt ? new Date(m.scheduledAt as any).getUTCFullYear() : null;
      if (matchYr === yr) seasonWins++;
    }
    for (const ev of allEvents) {
      if (ev.eventType !== "goal" || !ev.matchId) continue;
      const m = matchById.get(ev.matchId);
      if (!m) continue;
      const matchYr = m.scheduledAt ? new Date(m.scheduledAt as any).getUTCFullYear() : null;
      if (matchYr === yr) seasonGoals++;
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

    // Recent matches: pick the most recent matches the player participated in
    // (by team_players OR by event), newest first. Includes tournament + opponent
    // info so the spectator profile can deep-link into a match or its tournament.
    const RECENT_LIMIT = 10;
    const goalsByMatch = new Map<string, number>();
    for (const ev of allEvents) {
      if (ev.eventType !== "goal" || !ev.matchId) continue;
      goalsByMatch.set(ev.matchId, (goalsByMatch.get(ev.matchId) ?? 0) + 1);
    }
    const sortedMatches = matchRows
      .filter(m => playerSideByMatch.has(m.id) || goalsByMatch.has(m.id))
      .sort((a, b) => {
        const aT = a.scheduledAt ? new Date(a.scheduledAt as any).getTime() : 0;
        const bT = b.scheduledAt ? new Date(b.scheduledAt as any).getTime() : 0;
        if (aT !== bT) return bT - aT;
        const aC = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
        const bC = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
        return bC - aC;
      })
      .slice(0, RECENT_LIMIT);

    const recentTeamIds = Array.from(new Set(
      sortedMatches.flatMap(m => [m.homeTeamId, m.awayTeamId]).filter((x): x is string => !!x),
    ));
    const recentTeamRows = recentTeamIds.length > 0
      ? await db.select().from(teamsTable).where(inArray(teamsTable.id, recentTeamIds))
      : [];
    const recentTeamMap = new Map(recentTeamRows.map(t => [t.id, t]));
    const recentTournamentIds = Array.from(new Set(sortedMatches.map(m => m.tournamentId).filter((x): x is string => !!x)));
    const recentTournamentRows = recentTournamentIds.length > 0
      ? await db.select({ id: tournamentsTable.id, name: tournamentsTable.name })
          .from(tournamentsTable)
          .where(inArray(tournamentsTable.id, recentTournamentIds))
      : [];
    const recentTournamentMap = new Map(recentTournamentRows.map(t => [t.id, t.name]));

    const recentMatches = sortedMatches.map(m => {
      const side = playerSideByMatch.get(m.id) ?? null;
      const playerTeamId = side === "home" ? m.homeTeamId : side === "away" ? m.awayTeamId : null;
      const opponentTeamId = side === "home" ? m.awayTeamId : side === "away" ? m.homeTeamId : null;
      const playerTeam = playerTeamId ? recentTeamMap.get(playerTeamId) : null;
      const opponentTeam = opponentTeamId ? recentTeamMap.get(opponentTeamId) : null;
      const playerScore = side === "home" ? (m.homeScore ?? 0) : side === "away" ? (m.awayScore ?? 0) : 0;
      const opponentScore = side === "home" ? (m.awayScore ?? 0) : side === "away" ? (m.homeScore ?? 0) : 0;
      let result: "win" | "loss" | "draw" | "pending" = "pending";
      if (m.status === "final" && side) {
        if (playerScore > opponentScore) result = "win";
        else if (playerScore < opponentScore) result = "loss";
        else result = "draw";
      }
      return {
        matchId: m.id,
        scheduledAt: m.scheduledAt ?? null,
        status: m.status,
        tournamentId: m.tournamentId,
        tournamentName: recentTournamentMap.get(m.tournamentId) ?? "",
        playerSide: side,
        playerTeamName: playerTeam?.name ?? null,
        playerTeamLogoUrl: playerTeam?.logoUrl ?? null,
        opponentTeamName: opponentTeam?.name ?? null,
        opponentTeamLogoUrl: opponentTeam?.logoUrl ?? null,
        playerScore,
        opponentScore,
        result,
        playerGoals: goalsByMatch.get(m.id) ?? 0,
      };
    });

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
      recentMatches,
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

// Super-admin only: cleanup duplicate-name player records and remove players
// who have never appeared in a match.
//
// Behaviour:
//   1. Group players by LOWER(TRIM(name)). For each group with >1 records, pick
//      a "canonical" record using: most match_events DESC, then most team_players
//      DESC, then oldest created_at ASC, then id ASC (deterministic).
//   2. Reassign FKs from the non-canonical records onto the canonical one
//      (match_events.player_id, team_players.player_id, horses.player_id).
//      For team_players, drop conflicting links first to respect the
//      (team_id, player_id, season_year) unique constraint.
//   3. Delete the non-canonical player rows.
//   4. Delete any player with zero match_events (the "no last match date"
//      criterion). Run AFTER merge so consolidated dups are preserved.
//
// All work runs in a single transaction. Pass ?dryRun=true (default) to preview
// without committing; pass ?dryRun=false to execute.
router.post("/admin/players/cleanup", requireAuth, async (req, res) => {
  if (!isSuperAdmin(req.user!)) {
    res.status(403).json({ message: "Super admin only" });
    return;
  }
  const dryRun = String(req.query.dryRun ?? "true") !== "false";

  type GroupSummary = { name: string; canonicalId: string; mergedDuplicateIds: string[] };
  type Summary = {
    dryRun: boolean;
    executed: boolean;
    mergedGroups: GroupSummary[];
    duplicatesRemoved: number;
    eventsReassigned: number;
    teamLinksReassigned: number;
    teamLinksDroppedAsConflict: number;
    horsesReassigned: number;
    noEventPlayersRemoved: number;
    noEventPlayerNames: string[];
  };

  // Sentinel used to roll back the transaction in dry-run mode while still
  // returning the computed summary.
  class DryRunRollback extends Error {
    constructor(public summary: Summary) { super("dry-run"); }
  }

  try {
    const summary = await db.transaction(async (tx) => {
      // --- Step 1: identify duplicate-name groups and pick canonicals.
      const dupRows = await tx.execute(sql`
        WITH player_stats AS (
          SELECT
            p.id,
            p.name,
            p.created_at,
            LOWER(TRIM(p.name)) AS norm,
            (SELECT COUNT(*) FROM match_events e
              WHERE e.player_id = p.id AND e.event_type = 'goal')::int AS goals_cnt,
            (SELECT COUNT(*) FROM team_players t WHERE t.player_id = p.id)::int AS team_cnt
          FROM players p
          WHERE LOWER(TRIM(p.name)) IN (
            SELECT LOWER(TRIM(name)) FROM players
            GROUP BY LOWER(TRIM(name)) HAVING COUNT(*) > 1
          )
        )
        SELECT id, name, norm,
          ROW_NUMBER() OVER (
            PARTITION BY norm
            ORDER BY goals_cnt DESC, team_cnt DESC, created_at ASC NULLS LAST, id ASC
          )::int AS rk
        FROM player_stats
        ORDER BY norm, rk
      `);

      type DupRow = { id: string; name: string; norm: string; rk: number };
      const rows = (dupRows.rows as unknown as DupRow[]).map(r => ({ ...r, rk: Number(r.rk) }));
      const groupsByNorm = new Map<string, { canonicalId: string; canonicalName: string; dupIds: string[] }>();
      for (const r of rows) {
        if (r.rk === 1) {
          groupsByNorm.set(r.norm, { canonicalId: r.id, canonicalName: r.name, dupIds: [] });
        } else {
          const g = groupsByNorm.get(r.norm);
          if (g) g.dupIds.push(r.id);
        }
      }

      const mergedGroups: GroupSummary[] = [];
      let eventsReassigned = 0;
      let teamLinksReassigned = 0;
      let teamLinksDroppedAsConflict = 0;
      let horsesReassigned = 0;

      for (const [, g] of groupsByNorm) {
        if (g.dupIds.length === 0) continue;
        mergedGroups.push({ name: g.canonicalName, canonicalId: g.canonicalId, mergedDuplicateIds: [...g.dupIds] });

        // Reassign match_events: simple bulk update (no unique constraints to worry about).
        const er = await tx.update(matchEventsTable)
          .set({ playerId: g.canonicalId })
          .where(inArray(matchEventsTable.playerId, g.dupIds))
          .returning({ id: matchEventsTable.id });
        eventsReassigned += er.length;

        // Reassign team_players carefully — there's a unique constraint on
        // (team_id, player_id, season_year). Drop any dup link that would
        // collide with an existing canonical link for the same (team, season).
        const dupLinks = await tx.select().from(teamPlayersTable)
          .where(inArray(teamPlayersTable.playerId, g.dupIds));
        if (dupLinks.length > 0) {
          const canonicalLinks = await tx.select().from(teamPlayersTable)
            .where(eq(teamPlayersTable.playerId, g.canonicalId));
          const canonicalKeys = new Set(canonicalLinks.map(l => `${l.teamId}::${l.seasonYear}`));
          const toDrop: string[] = [];
          const toReassign: string[] = [];
          for (const l of dupLinks) {
            const key = `${l.teamId}::${l.seasonYear}`;
            if (canonicalKeys.has(key)) toDrop.push(l.id);
            else { toReassign.push(l.id); canonicalKeys.add(key); }
          }
          if (toDrop.length > 0) {
            await tx.delete(teamPlayersTable).where(inArray(teamPlayersTable.id, toDrop));
            teamLinksDroppedAsConflict += toDrop.length;
          }
          if (toReassign.length > 0) {
            const tr = await tx.update(teamPlayersTable)
              .set({ playerId: g.canonicalId })
              .where(inArray(teamPlayersTable.id, toReassign))
              .returning({ id: teamPlayersTable.id });
            teamLinksReassigned += tr.length;
          }
        }

        // Reassign horses: no problematic unique constraint here.
        const hr = await tx.update(horsesTable)
          .set({ playerId: g.canonicalId })
          .where(inArray(horsesTable.playerId, g.dupIds))
          .returning({ id: horsesTable.id });
        horsesReassigned += hr.length;
      }

      const allDupIds = mergedGroups.flatMap(g => g.mergedDuplicateIds);
      if (allDupIds.length > 0) {
        await tx.delete(playersTable).where(inArray(playersTable.id, allDupIds));
      }

      // --- Step 2: delete remaining players with zero match_events.
      const noEventRows = await tx.execute(sql`
        SELECT p.id, p.name FROM players p
        WHERE NOT EXISTS (SELECT 1 FROM match_events e WHERE e.player_id = p.id)
        ORDER BY p.name
      `);
      const noEvent = noEventRows.rows as unknown as Array<{ id: string; name: string }>;
      if (noEvent.length > 0) {
        await tx.delete(playersTable).where(inArray(playersTable.id, noEvent.map(r => r.id)));
      }

      const result: Summary = {
        dryRun,
        executed: !dryRun,
        mergedGroups,
        duplicatesRemoved: allDupIds.length,
        eventsReassigned,
        teamLinksReassigned,
        teamLinksDroppedAsConflict,
        horsesReassigned,
        noEventPlayersRemoved: noEvent.length,
        noEventPlayerNames: noEvent.map(r => r.name),
      };

      if (dryRun) throw new DryRunRollback(result);
      return result;
    });
    res.json(summary);
  } catch (e: any) {
    if (e instanceof DryRunRollback) {
      res.json(e.summary);
      return;
    }
    res.status(500).json({ message: e.message });
  }
});

export default router;
