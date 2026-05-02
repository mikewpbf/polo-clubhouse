import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { tournamentsTable, tournamentTeamsTable, teamsTable, matchesTable, playDatesTable, clubsTable, fieldsTable, adminClubMembershipsTable, matchEventsTable, teamOutDatesTable, teamManagerAssignmentsTable, userInvitesTable, playersTable, horsesTable, teamPlayersTable } from "@workspace/db/schema";
import { eq, and, ilike, count, inArray, desc, asc } from "drizzle-orm";
import { requireAuth, optionalAuth, isSuperAdmin, requireSuperAdmin } from "../lib/auth";
import { invalidateMatchPreviewsForTournament } from "./match-previews";
import OpenAI from "openai";

const router: IRouter = Router();

async function requireClubAdminForTournament(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }
  const clubId = String(req.params.clubId);
  const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user.id));
  if (!memberships.some(m => m.clubId === clubId)) {
    res.status(403).json({ message: "Club admin access required" }); return;
  }
  next();
}

async function requireAdminForTournamentId(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }
  const tournamentId = String(req.params.tournamentId);
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
  if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }
  const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user.id));
  if (!memberships.some(m => m.clubId === tournament.clubId)) {
    res.status(403).json({ message: "Club admin access required to modify this tournament" }); return;
  }
  next();
}

router.get("/clubs/:clubId/tournaments", async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    const status = req.query.status as string | undefined;
    const conditions: any[] = [eq(tournamentsTable.clubId, clubId)];
    if (status) conditions.push(eq(tournamentsTable.status, status as any));
    const tournaments = await db.select().from(tournamentsTable).where(and(...conditions));
    res.json(tournaments);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/clubs/:clubId/tournaments", requireAuth, requireClubAdminForTournament, async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    const body = { ...req.body };
    if (!isSuperAdmin(req.user!)) {
      delete body.sponsored;
      delete body.sponsoredRank;
    }
    const [tournament] = await db.insert(tournamentsTable).values({
      clubId,
      ...body,
    }).returning();
    res.status(201).json(tournament);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/tournaments", requireAuth, async (req, res) => {
  try {
    const { name, clubId, format, status, startDate, endDate, handicapLevel, chukkersPerMatch, description, matchDurationMin, gapBetweenMin, chukkerDurationMinutes, hasThirdPlace, finalsDate, isVisitingLeague } = req.body;
    if (!name) { res.status(400).json({ message: "Tournament name is required" }); return; }
    if (clubId && !isSuperAdmin(req.user!)) {
      const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user!.id));
      if (!memberships.some(m => m.clubId === clubId)) {
        res.status(403).json({ message: "Club admin access required to create tournaments for this club" }); return;
      }
    }
    const [tournament] = await db.insert(tournamentsTable).values({
      clubId: clubId || null,
      name, format, status, startDate, endDate, handicapLevel, chukkersPerMatch, description,
      matchDurationMin, gapBetweenMin, chukkerDurationMinutes, hasThirdPlace, finalsDate, isVisitingLeague,
    }).returning();
    res.status(201).json(tournament);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/tournaments", optionalAuth, async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const clubSlug = req.query.clubSlug as string | undefined;
    const search = req.query.search as string | undefined;
    const conditions: any[] = [];
    const user = (req as any).user;
    const isSuperAdmin = user?.role === "super_admin";
    if (status) {
      if (status === "draft" && !isSuperAdmin) {
        conditions.push(inArray(tournamentsTable.status, ["published", "in_progress", "completed"]));
      } else {
        conditions.push(eq(tournamentsTable.status, status as any));
      }
    } else if (!isSuperAdmin) {
      conditions.push(inArray(tournamentsTable.status, ["published", "in_progress", "completed"]));
    }
    if (search) conditions.push(ilike(tournamentsTable.name, `%${search}%`));

    if (clubSlug) {
      const [club] = await db.select().from(clubsTable).where(eq(clubsTable.slug, clubSlug));
      if (club) conditions.push(eq(tournamentsTable.clubId, club.id));
    }

    const query = conditions.length > 0
      ? db.select().from(tournamentsTable).where(and(...conditions))
      : db.select().from(tournamentsTable);
    const tournaments = await query.orderBy(desc(tournamentsTable.sponsored), desc(tournamentsTable.sponsoredRank), asc(tournamentsTable.name));

    const result = await Promise.all(tournaments.map(async (t) => {
      const club = t.clubId ? (await db.select().from(clubsTable).where(eq(clubsTable.id, t.clubId)))[0] : null;
      const [teamCountResult] = await db.select({ count: count() }).from(tournamentTeamsTable).where(eq(tournamentTeamsTable.tournamentId, t.id));
      return { ...t, club: club || null, teamCount: teamCountResult?.count || 0 };
    }));

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/tournaments/:tournamentId", optionalAuth, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }
    const tUser = (req as any).user;
    const tIsSuperAdmin = tUser?.role === "super_admin";
    if (tournament.status === "draft" && !tIsSuperAdmin) { res.status(404).json({ message: "Tournament not found" }); return; }

    const club = tournament.clubId ? (await db.select().from(clubsTable).where(eq(clubsTable.id, tournament.clubId)))[0] : null;
    const ttEntries = await db.select().from(tournamentTeamsTable).where(eq(tournamentTeamsTable.tournamentId, tournament.id));
    const teams = await Promise.all(ttEntries.map(async (tt) => {
      const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, tt.teamId));
      return { ...tt, team: team || null };
    }));

    const matchRows = await db.select().from(matchesTable).where(eq(matchesTable.tournamentId, tournament.id)).orderBy(asc(matchesTable.scheduledAt));
    const matches = await Promise.all(matchRows.map(async (m) => {
      const homeTeam = m.homeTeamId ? (await db.select().from(teamsTable).where(eq(teamsTable.id, m.homeTeamId)))[0] : null;
      const awayTeam = m.awayTeamId ? (await db.select().from(teamsTable).where(eq(teamsTable.id, m.awayTeamId)))[0] : null;
      const field = m.fieldId ? (await db.select().from(fieldsTable).where(eq(fieldsTable.id, m.fieldId)))[0] : null;
      const tournamentInfo = { id: tournament.id, name: tournament.name, chukkersPerMatch: tournament.chukkersPerMatch || 6, clubId: tournament.clubId, clubName: club?.name || "" };
      const hName = homeTeam?.name || "";
      const aName = awayTeam?.name || "";
      const swap = hName && aName && aName.localeCompare(hName) < 0;
      if (swap) {
        return { ...m, homeTeamId: m.awayTeamId, awayTeamId: m.homeTeamId, homeScore: m.awayScore, awayScore: m.homeScore, homeTeam: awayTeam, awayTeam: homeTeam, field, tournament: tournamentInfo, _teamsSwapped: true };
      }
      return { ...m, homeTeam, awayTeam, field, tournament: tournamentInfo, _teamsSwapped: false };
    }));

    const playDates = await db.select().from(playDatesTable).where(eq(playDatesTable.tournamentId, tournament.id));
    res.json({ ...tournament, club, teams, matches, playDates });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.put("/tournaments/:tournamentId", requireAuth, requireAdminForTournamentId, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const body = { ...req.body };
    if (!isSuperAdmin(req.user!)) {
      delete body.sponsored;
      delete body.sponsoredRank;
    }
    const [tournament] = await db.update(tournamentsTable).set(body).where(eq(tournamentsTable.id, tournamentId)).returning();
    // Tournament name appears on the BoldDiagonal preview card, so any
    // tournament edit invalidates cached previews for every match in the
    // tournament. Cheap (single UPDATE) and avoids stale OG cards in chat
    // apps after a rename.
    if (body.name !== undefined) {
      await invalidateMatchPreviewsForTournament(tournamentId).catch(() => { /* don't block edit */ });
    }
    res.json(tournament);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/tournaments/:tournamentId/publish", requireAuth, requireAdminForTournamentId, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const [tournament] = await db.update(tournamentsTable).set({ status: "published" }).where(eq(tournamentsTable.id, tournamentId)).returning();
    res.json(tournament);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/tournaments/:tournamentId/teams", async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const entries = await db.select().from(tournamentTeamsTable).where(eq(tournamentTeamsTable.tournamentId, tournamentId));
    const result = await Promise.all(entries.map(async (tt) => {
      const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, tt.teamId));
      return { ...tt, team: team || null };
    }));
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tournaments/:tournamentId/teams", requireAuth, requireAdminForTournamentId, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const { teamId, seed, groupLabel, maxGamesPerDay } = req.body;
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
    if (!team) { res.status(404).json({ message: "Team not found" }); return; }
    await db.insert(tournamentTeamsTable).values({
      tournamentId, teamId, seed, groupLabel, maxGamesPerDay,
    });
    res.status(201).json({ tournamentId, teamId, seed, groupLabel, maxGamesPerDay: maxGamesPerDay || 2, team });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.put("/tournaments/:tournamentId/teams/:teamId", requireAuth, requireAdminForTournamentId, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const teamId = String(req.params.teamId);
    const { seed, groupLabel, maxGamesPerDay } = req.body;
    const updates: Record<string, any> = {};
    if (seed !== undefined) updates.seed = seed;
    if (groupLabel !== undefined) updates.groupLabel = groupLabel;
    if (maxGamesPerDay !== undefined) updates.maxGamesPerDay = maxGamesPerDay;
    await db.update(tournamentTeamsTable).set(updates).where(
      and(eq(tournamentTeamsTable.tournamentId, tournamentId), eq(tournamentTeamsTable.teamId, teamId))
    );
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
    res.json({ tournamentId, teamId, ...updates, team });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/tournaments/:tournamentId/teams/:teamId", requireAuth, requireAdminForTournamentId, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const teamId = String(req.params.teamId);
    await db.delete(tournamentTeamsTable).where(
      and(eq(tournamentTeamsTable.tournamentId, tournamentId), eq(tournamentTeamsTable.teamId, teamId))
    );
    res.json({ message: "Team removed" });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/tournaments/:tournamentId/standings", async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const entries = await db.select().from(tournamentTeamsTable).where(eq(tournamentTeamsTable.tournamentId, tournamentId));
    const matches = await db.select().from(matchesTable).where(
      and(eq(matchesTable.tournamentId, tournamentId), eq(matchesTable.status, "final"))
    );
    const standings = await Promise.all(entries.map(async (tt) => {
      const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, tt.teamId));
      const hasManual = tt.manualWins !== null || tt.manualLosses !== null || tt.manualNetGoals !== null || tt.manualGrossGoals !== null;
      let autoGoalsFor = 0;
      let won = 0, lost = 0, goalsFor = 0, goalsAgainst = 0;
      for (const m of matches) {
        if (m.homeTeamId === tt.teamId) {
          goalsFor += m.homeScore || 0;
          goalsAgainst += m.awayScore || 0;
          if ((m.homeScore || 0) > (m.awayScore || 0)) won++;
          else if ((m.homeScore || 0) < (m.awayScore || 0)) lost++;
        } else if (m.awayTeamId === tt.teamId) {
          goalsFor += m.awayScore || 0;
          goalsAgainst += m.homeScore || 0;
          if ((m.awayScore || 0) > (m.homeScore || 0)) won++;
          else if ((m.awayScore || 0) < (m.homeScore || 0)) lost++;
        }
      }
      autoGoalsFor = goalsFor;
      if (hasManual) {
        return {
          teamId: tt.teamId, team,
          won: tt.manualWins ?? 0,
          lost: tt.manualLosses ?? 0,
          goalDifference: tt.manualNetGoals ?? 0,
          grossGoals: tt.manualGrossGoals ?? autoGoalsFor,
          groupLabel: tt.groupLabel,
          isManual: true,
        };
      }
      return {
        teamId: tt.teamId, team, won, lost,
        goalDifference: goalsFor - goalsAgainst,
        grossGoals: goalsFor,
        groupLabel: tt.groupLabel,
        isManual: false,
      };
    }));
    standings.sort((a, b) => b.won - a.won || b.goalDifference - a.goalDifference);
    res.json(standings);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/tournaments/:tournamentId/top-scorers", async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const tournamentMatches = await db.select({ id: matchesTable.id }).from(matchesTable).where(eq(matchesTable.tournamentId, tournamentId));
    if (tournamentMatches.length === 0) { res.json([]); return; }
    const matchIds = tournamentMatches.map(m => m.id);
    const goalEvents = await db.select().from(matchEventsTable).where(
      and(eq(matchEventsTable.eventType, "goal"), inArray(matchEventsTable.matchId, matchIds))
    );
    const playerGoals: Record<string, { playerId: string | null; playerName: string | null; teamId: string | null; goals: number }> = {};
    for (const ev of goalEvents) {
      const key = ev.playerId ? `player:${ev.playerId}` : (ev.playerName ? `name:${ev.playerName}:team:${ev.teamId}` : null);
      if (!key) continue;
      if (!playerGoals[key]) {
        playerGoals[key] = { playerId: ev.playerId, playerName: ev.playerName, teamId: ev.teamId, goals: 0 };
      }
      playerGoals[key].goals++;
    }
    const scorers = Object.values(playerGoals).filter(s => s.goals > 0);
    const playerIds = scorers.map(s => s.playerId).filter(Boolean) as string[];
    const teamIds = [...new Set(scorers.map(s => s.teamId).filter(Boolean) as string[])];
    const players = playerIds.length > 0 ? await db.select().from(playersTable).where(inArray(playersTable.id, playerIds)) : [];
    const teams = teamIds.length > 0 ? await db.select().from(teamsTable).where(inArray(teamsTable.id, teamIds)) : [];
    const playerMap = new Map(players.map(p => [p.id, p]));
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const result = scorers.map(s => ({
      playerId: s.playerId || null,
      playerName: (s.playerId ? playerMap.get(s.playerId)?.name : null) || s.playerName || "Unknown",
      teamId: s.teamId || null,
      teamName: s.teamId ? (teamMap.get(s.teamId)?.name || "Unknown") : "Unknown",
      goals: s.goals,
    }));
    result.sort((a, b) => b.goals - a.goals);
    res.json(result.slice(0, 4));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.put("/tournaments/:tournamentId/standings", requireAuth, requireAdminForTournamentId, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const { standings } = req.body as { standings: { teamId: string; wins: number; losses: number; netGoals: number; grossGoals?: number }[] };
    if (!Array.isArray(standings)) { res.status(400).json({ message: "standings array required" }); return; }
    for (const s of standings) {
      await db.update(tournamentTeamsTable).set({
        manualWins: s.wins,
        manualLosses: s.losses,
        manualNetGoals: s.netGoals,
        manualGrossGoals: s.grossGoals ?? null,
      }).where(
        and(eq(tournamentTeamsTable.tournamentId, tournamentId), eq(tournamentTeamsTable.teamId, s.teamId))
      );
    }
    res.json({ message: "Standings updated" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.delete("/tournaments/:tournamentId/standings", requireAuth, requireAdminForTournamentId, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    await db.update(tournamentTeamsTable).set({
      manualWins: null,
      manualLosses: null,
      manualNetGoals: null,
      manualGrossGoals: null,
    }).where(eq(tournamentTeamsTable.tournamentId, tournamentId));
    res.json({ message: "Standings reset to auto-calculate from matches" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.delete("/tournaments/:tournamentId", requireAuth, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }

    if (!isSuperAdmin(req.user!)) {
      const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user!.id));
      const isClubAdmin = memberships.some((m) => m.clubId === tournament.clubId);
      if (!isClubAdmin) { res.status(403).json({ message: "Forbidden" }); return; }
    }

    const allMatches = await db.select({ id: matchesTable.id }).from(matchesTable).where(eq(matchesTable.tournamentId, tournamentId));
    for (const m of allMatches) {
      await db.delete(matchEventsTable).where(eq(matchEventsTable.matchId, m.id));
    }
    await db.delete(matchesTable).where(eq(matchesTable.tournamentId, tournamentId));
    await db.delete(teamOutDatesTable).where(eq(teamOutDatesTable.tournamentId, tournamentId));
    await db.delete(playDatesTable).where(eq(playDatesTable.tournamentId, tournamentId));
    const assignments = await db.select({ id: teamManagerAssignmentsTable.id }).from(teamManagerAssignmentsTable).where(eq(teamManagerAssignmentsTable.tournamentId, tournamentId));
    for (const a of assignments) {
      await db.delete(userInvitesTable).where(eq(userInvitesTable.teamManagerAssignmentId, a.id));
    }
    await db.delete(teamManagerAssignmentsTable).where(eq(teamManagerAssignmentsTable.tournamentId, tournamentId));
    await db.delete(tournamentTeamsTable).where(eq(tournamentTeamsTable.tournamentId, tournamentId));
    await db.delete(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));

    res.json({ message: "Tournament deleted" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

function getOpenAIClient() {
  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error("AI integration not configured");
  }
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

router.post("/tournaments/:tournamentId/ai-format", requireAuth, requireAdminForTournamentId, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }

    const entries = await db.select().from(tournamentTeamsTable).where(eq(tournamentTeamsTable.tournamentId, tournamentId));
    const teamCount = entries.length;

    if (teamCount < 2) {
      res.status(400).json({ message: "At least 2 teams are needed for AI format recommendation" });
      return;
    }

    const teams = await Promise.all(entries.map(async (tt) => {
      const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, tt.teamId));
      return team;
    }));

    const daysAvailable = tournament.startDate && tournament.endDate
      ? Math.ceil((new Date(tournament.endDate).getTime() - new Date(tournament.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
      : null;

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a polo tournament format advisor. Given the number of teams and tournament details, recommend the best tournament format. Available formats: round_robin, single_elim, double_elim, swiss, group_knockout. Respond with valid JSON only, no markdown. Schema: { "recommended_format": "<format_value>", "reason": "<1-2 sentence explanation>", "total_matches": <number>, "notes": "<optional scheduling tip>" }`
        },
        {
          role: "user",
          content: `Tournament: "${tournament.name}"\nTeams: ${teamCount} (${teams.filter(Boolean).map(t => t!.name).join(", ")})\nHandicap level: ${tournament.handicapLevel || "not specified"}\nDays available: ${daysAvailable ?? "not specified"}\nChukkers per match: ${tournament.chukkersPerMatch || 6}\n\nRecommend the best tournament format for ${teamCount} teams.`
        }
      ],
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const validFormats = ["round_robin", "single_elim", "double_elim", "swiss", "group_knockout"];
    let recommendation;
    try {
      recommendation = JSON.parse(raw);
      if (!validFormats.includes(recommendation.recommended_format)) {
        recommendation.recommended_format = "round_robin";
      }
    } catch {
      recommendation = { recommended_format: "round_robin", reason: raw, total_matches: 0 };
    }

    await db.update(tournamentsTable).set({ aiRecommendation: recommendation }).where(eq(tournamentsTable.id, tournamentId));

    res.json(recommendation);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/tournaments/:tournamentId/ai-schedule", requireAuth, requireAdminForTournamentId, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }

    const entries = await db.select().from(tournamentTeamsTable).where(eq(tournamentTeamsTable.tournamentId, tournamentId));
    if (entries.length < 2) {
      res.status(400).json({ message: "At least 2 teams are needed to generate a schedule" }); return;
    }

    const teams = await Promise.all(entries.map(async (tt) => {
      const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, tt.teamId));
      return { id: tt.teamId, name: team?.name || "Unknown", seed: tt.seed, groupLabel: tt.groupLabel };
    }));

    const outDates = await db.select().from(teamOutDatesTable).where(eq(teamOutDatesTable.tournamentId, tournamentId));
    const outDatesByTeam: Record<string, string[]> = {};
    for (const od of outDates) {
      if (!outDatesByTeam[od.teamId]) outDatesByTeam[od.teamId] = [];
      outDatesByTeam[od.teamId].push(od.outDate);
    }

    const existingPlayDates = await db.select().from(playDatesTable).where(eq(playDatesTable.tournamentId, tournamentId));

    const clubFields = await db.select().from(fieldsTable).where(eq(fieldsTable.clubId, tournament.clubId));
    const activeFields = clubFields.filter(f => f.isActive !== false);

    const daysAvailable = tournament.startDate && tournament.endDate
      ? Math.ceil((new Date(tournament.endDate).getTime() - new Date(tournament.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
      : null;

    const teamsInfo = teams.map(t => {
      const outs = outDatesByTeam[t.id];
      return `${t.name}${outs ? ` (unavailable: ${outs.join(", ")})` : ""}`;
    }).join("\n");

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a polo tournament scheduler. Generate a match schedule based on the tournament format, teams, out-dates, and available fields. Respond with valid JSON only, no markdown. Schema:
{
  "matches": [
    {
      "round": "<round label, e.g. Round 1, Quarterfinal, etc.>",
      "homeTeamName": "<team name>",
      "awayTeamName": "<team name>",
      "suggestedDate": "<YYYY-MM-DD or null if no dates set>",
      "fieldName": "<field name or null>"
    }
  ],
  "summary": "<brief explanation of the schedule>",
  "notes": "<any scheduling notes or conflicts>"
}
Rules:
- Respect team out-dates: never schedule a team on a date they are unavailable
- Distribute matches evenly across available dates
- Avoid scheduling a team for more than 2 matches per day
- For round_robin: every team plays every other team once
- For single_elim: standard bracket elimination
- For double_elim: winners and losers bracket
- For swiss: pair teams with similar records each round
- For group_knockout: divide into groups, then elimination rounds`
        },
        {
          role: "user",
          content: `Tournament: "${tournament.name}"
Format: ${tournament.format || "round_robin"}
Start: ${tournament.startDate || "not set"}
End: ${tournament.endDate || "not set"}
Days available: ${daysAvailable ?? "not specified"}
Chukkers per match: ${tournament.chukkersPerMatch || 6}
Match duration: ${tournament.matchDurationMin || 90} minutes
Gap between matches: ${tournament.gapBetweenMin || 20} minutes
Fields: ${activeFields.length > 0 ? activeFields.map(f => f.name || `Field ${f.number}`).join(", ") : "not specified"}

Teams (${teams.length}):
${teamsInfo}

${existingPlayDates.length > 0 ? `Play dates: ${existingPlayDates.map(pd => `${pd.date} (${pd.startTime || "TBA"}-${pd.endTime || "TBA"})`).join(", ")}` : ""}

Generate the optimal match schedule.`
        }
      ],
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    let schedule;
    try {
      schedule = JSON.parse(raw);
    } catch {
      schedule = { matches: [], summary: raw, notes: "Failed to parse AI response" };
    }

    if (schedule.matches && Array.isArray(schedule.matches) && schedule.matches.length > 0) {
      const teamNameToId: Record<string, string> = {};
      for (const t of teams) {
        teamNameToId[t.name.toLowerCase()] = t.id;
      }
      const fieldNameToId: Record<string, string> = {};
      for (const f of activeFields) {
        const key = (f.name || `Field ${f.number}`).toLowerCase();
        fieldNameToId[key] = f.id;
      }

      const validMatches = schedule.matches.filter((m: any) => {
        const home = teamNameToId[m.homeTeamName?.toLowerCase()];
        const away = teamNameToId[m.awayTeamName?.toLowerCase()];
        return home && away;
      });

      if (validMatches.length === 0) {
        schedule.notes = (schedule.notes || "") + " Warning: AI returned team names that could not be matched to enrolled teams.";
      } else {
        const createdCount = await db.transaction(async (tx) => {
          const existingMatches = await tx.select({ id: matchesTable.id }).from(matchesTable).where(eq(matchesTable.tournamentId, tournamentId));
          for (const m of existingMatches) {
            await tx.delete(matchEventsTable).where(eq(matchEventsTable.matchId, m.id));
          }
          await tx.delete(matchesTable).where(eq(matchesTable.tournamentId, tournamentId));

          let count = 0;
          for (let i = 0; i < validMatches.length; i++) {
            const m = validMatches[i];
            const homeTeamId = teamNameToId[m.homeTeamName.toLowerCase()];
            const awayTeamId = teamNameToId[m.awayTeamName.toLowerCase()];
            const fieldId = m.fieldName ? (fieldNameToId[m.fieldName.toLowerCase()] || null) : null;
            const scheduledAt = m.suggestedDate ? new Date(`${m.suggestedDate}T12:00:00Z`) : null;

            await tx.insert(matchesTable).values({
              tournamentId,
              homeTeamId,
              awayTeamId,
              fieldId,
              scheduledAt,
              round: m.round || `Round ${Math.floor(i / Math.max(1, Math.floor(teams.length / 2))) + 1}`,
              bracketPosition: i + 1,
              status: "scheduled",
            });
            count++;
          }
          return count;
        });

        schedule.createdCount = createdCount;
      }
    }

    res.json(schedule);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/tournaments/:tournamentId/mvp", async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }

    if (!tournament.mvpPlayerId) { res.json(null); return; }

    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, tournament.mvpPlayerId));
    const [team] = tournament.mvpTeamId ? await db.select().from(teamsTable).where(eq(teamsTable.id, tournament.mvpTeamId)) : [null];

    let gamesPlayed = 0;
    let goalsScored = 0;

    if (tournament.mvpTeamId) {
      const tournamentMatches = await db.select().from(matchesTable).where(
        and(eq(matchesTable.tournamentId, tournamentId), eq(matchesTable.status, "final"))
      );
      for (const m of tournamentMatches) {
        if (m.homeTeamId === tournament.mvpTeamId || m.awayTeamId === tournament.mvpTeamId) {
          gamesPlayed++;
        }
      }

      const allMatches = await db.select({ id: matchesTable.id }).from(matchesTable).where(eq(matchesTable.tournamentId, tournamentId));
      if (allMatches.length > 0) {
        const matchIds = allMatches.map(m => m.id);
        const goalEvents = await db.select().from(matchEventsTable).where(
          and(eq(matchEventsTable.eventType, "goal"), inArray(matchEventsTable.matchId, matchIds))
        );
        for (const ev of goalEvents) {
          if (ev.playerId === tournament.mvpPlayerId) {
            goalsScored++;
          }
        }
      }
    }

    res.json({
      playerId: tournament.mvpPlayerId,
      playerName: player?.name || "Unknown",
      teamId: tournament.mvpTeamId,
      teamName: team?.name || null,
      gamesPlayed: tournament.mvpGamesOverride ?? gamesPlayed,
      goalsScored: tournament.mvpGoalsOverride ?? goalsScored,
      autoGamesPlayed: gamesPlayed,
      autoGoalsScored: goalsScored,
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.put("/tournaments/:tournamentId/mvp", requireAuth, requireAdminForTournamentId, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const { teamId, playerId, gamesOverride, goalsOverride } = req.body;

    if (teamId) {
      const ttEntries = await db.select().from(tournamentTeamsTable).where(
        and(eq(tournamentTeamsTable.tournamentId, tournamentId), eq(tournamentTeamsTable.teamId, teamId))
      );
      if (ttEntries.length === 0) { res.status(400).json({ message: "Team is not in this tournament" }); return; }
    }
    if (playerId && teamId) {
      // Membership is established via the canonical team_players link.
      const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!player) { res.status(400).json({ message: "Player not found" }); return; }
      const [link] = await db.select({ id: teamPlayersTable.id })
        .from(teamPlayersTable)
        .where(and(eq(teamPlayersTable.teamId, teamId), eq(teamPlayersTable.playerId, playerId))).limit(1);
      if (!link) { res.status(400).json({ message: "Player does not belong to selected team" }); return; }
    }

    await db.update(tournamentsTable).set({
      mvpTeamId: teamId || null,
      mvpPlayerId: playerId || null,
      mvpGamesOverride: gamesOverride !== undefined && gamesOverride !== null && gamesOverride !== "" ? Number(gamesOverride) : null,
      mvpGoalsOverride: goalsOverride !== undefined && goalsOverride !== null && goalsOverride !== "" ? Number(goalsOverride) : null,
    }).where(eq(tournamentsTable.id, tournamentId));
    res.json({ message: "MVP updated" });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/tournaments/:tournamentId/bpp", async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }

    if (!tournament.bppHorseId) { res.json(null); return; }

    const [horse] = await db.select().from(horsesTable).where(eq(horsesTable.id, tournament.bppHorseId));
    const [player] = tournament.bppPlayerId ? await db.select().from(playersTable).where(eq(playersTable.id, tournament.bppPlayerId)) : [null];
    const [team] = tournament.bppTeamId ? await db.select().from(teamsTable).where(eq(teamsTable.id, tournament.bppTeamId)) : [null];

    let gamesPlayed = 0;
    if (tournament.bppTeamId) {
      const tournamentMatches = await db.select().from(matchesTable).where(
        and(eq(matchesTable.tournamentId, tournamentId), eq(matchesTable.status, "final"))
      );
      for (const m of tournamentMatches) {
        if (m.homeTeamId === tournament.bppTeamId || m.awayTeamId === tournament.bppTeamId) {
          gamesPlayed++;
        }
      }
    }

    const displaySettings = (tournament.bppDisplaySettings as Record<string, boolean>) || {};

    const horseData: Record<string, any> = {
      horseId: horse?.id || null,
    };

    if (displaySettings.showHorseName !== false) horseData.horseName = horse?.horseName || null;
    if (displaySettings.showPlayerName) horseData.playerName = player?.name || null;
    if (displaySettings.showTeamName) horseData.teamName = team?.name || null;
    if (displaySettings.showOwner) horseData.owner = horse?.owner || null;
    if (displaySettings.showBreeder) horseData.breeder = horse?.breeder || null;
    if (displaySettings.showOwnedAndBredBy) horseData.ownedAndBredBy = horse?.ownedAndBredBy || null;
    if (displaySettings.showAge) horseData.age = horse?.age || null;
    if (displaySettings.showColor) horseData.color = horse?.color || null;
    if (displaySettings.showSex) horseData.sex = horse?.sex || null;
    if (displaySettings.showBreed) horseData.typeOrBreed = horse?.typeOrBreed || null;
    if (displaySettings.showSireDam) {
      horseData.sire = horse?.sire || null;
      horseData.dam = horse?.dam || null;
    }
    if (displaySettings.showGamesPlayed) horseData.gamesPlayed = tournament.bppGamesOverride ?? gamesPlayed;
    if (displaySettings.showNotes) horseData.notes = horse?.notes || null;

    horseData.displaySettings = displaySettings;
    horseData.autoGamesPlayed = gamesPlayed;

    res.json(horseData);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.put("/tournaments/:tournamentId/bpp", requireAuth, requireAdminForTournamentId, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const { teamId, playerId, horseId, displaySettings, gamesOverride } = req.body;

    if (teamId) {
      const ttEntries = await db.select().from(tournamentTeamsTable).where(
        and(eq(tournamentTeamsTable.tournamentId, tournamentId), eq(tournamentTeamsTable.teamId, teamId))
      );
      if (ttEntries.length === 0) { res.status(400).json({ message: "Team is not in this tournament" }); return; }
    }
    if (playerId && teamId) {
      // Membership is established via the canonical team_players link (see MVP handler).
      const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!player) { res.status(400).json({ message: "Player not found" }); return; }
      const [link] = await db.select({ id: teamPlayersTable.id })
        .from(teamPlayersTable)
        .where(and(eq(teamPlayersTable.teamId, teamId), eq(teamPlayersTable.playerId, playerId))).limit(1);
      if (!link) { res.status(400).json({ message: "Player does not belong to selected team" }); return; }
    }
    if (horseId && playerId) {
      const [horse] = await db.select().from(horsesTable).where(eq(horsesTable.id, horseId));
      if (!horse || horse.playerId !== playerId) { res.status(400).json({ message: "Horse does not belong to selected player" }); return; }
    }

    await db.update(tournamentsTable).set({
      bppTeamId: teamId || null,
      bppPlayerId: playerId || null,
      bppHorseId: horseId || null,
      bppDisplaySettings: displaySettings || {},
      bppGamesOverride: gamesOverride !== undefined && gamesOverride !== null && gamesOverride !== "" ? Number(gamesOverride) : null,
    }).where(eq(tournamentsTable.id, tournamentId));
    res.json({ message: "BPP updated" });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

// NOTE: legacy player-horse routes (`GET /players/:playerId/horses`,
// `POST /players/:playerId/horses`, `DELETE /horses/:horseId`) used to live
// here. They were removed because they shadowed the canonical authorization
// in `routes/players.ts`, where mutations go through `requireSelfOrEditor(true)`
// — restricted to home-club admins, super admins, or the linked managed user
// editing their own player. Roster-scoped horse mutations are served by
// `/teams/:teamId/players/:playerId/horses[/:horseId]` in teams.ts.

export default router;
