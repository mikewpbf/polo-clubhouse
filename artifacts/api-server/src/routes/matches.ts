import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { matchesTable, matchEventsTable, teamsTable, fieldsTable, tournamentsTable, clubsTable, adminClubMembershipsTable, playersTable, teamPlayersTable, possessionSegmentsTable } from "@workspace/db/schema";
import crypto from "crypto";
import { eq, and, gte, lte, gt, desc, asc, isNull, inArray, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { requireAuth, optionalAuth, isSuperAdmin, requireMatchWrite, requireMatchAdmin as requireMatchAdminFactory, resolveShareToken } from "../lib/auth";
import { addSSEClient, emitMatchUpdate, emitMatchEnded } from "../lib/sse";

const router: IRouter = Router();

const LIVE_STATUSES = new Set(["live", "halftime"]);
const END_STATUSES = new Set(["final", "cancelled", "completed"]);

const DEDUP_WINDOW_MS = 2000;
async function isDuplicateEvent(matchId: string, eventType: string): Promise<boolean> {
  const [latest] = await db.select().from(matchEventsTable)
    .where(and(eq(matchEventsTable.matchId, matchId), eq(matchEventsTable.eventType, eventType as any)))
    .orderBy(desc(matchEventsTable.createdAt))
    .limit(1);
  if (!latest) return false;
  return Date.now() - new Date(latest.createdAt).getTime() < DEDUP_WINDOW_MS;
}

type MatchRow = InferSelectModel<typeof matchesTable>;

async function enrichMatch(m: MatchRow, includePlayers = false) {
  const homeTeam = m.homeTeamId ? (await db.select().from(teamsTable).where(eq(teamsTable.id, m.homeTeamId)))[0] : null;
  const awayTeam = m.awayTeamId ? (await db.select().from(teamsTable).where(eq(teamsTable.id, m.awayTeamId)))[0] : null;
  const field = m.fieldId ? (await db.select().from(fieldsTable).where(eq(fieldsTable.id, m.fieldId)))[0] : null;
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, m.tournamentId));
  const [club] = tournament ? await db.select().from(clubsTable).where(eq(clubsTable.id, tournament.clubId)) : [null];

  let homePlayers: any[] = [];
  let awayPlayers: any[] = [];
  if (includePlayers) {
    // Canonical roster comes from team_players. Per-roster position lives on the
    // join row, so we attach it to each player record for downstream sort/display.
    const seasonYear = new Date().getUTCFullYear();
    const loadRoster = async (teamId: string) => {
      // Only load players who are currently active on this team's roster.
      // team_players.is_active is the per-team flag; players.is_active is the
      // global flag. Both must be true for a player to appear in match control.
      const links = await db.select().from(teamPlayersTable).where(and(
        eq(teamPlayersTable.teamId, teamId),
        eq(teamPlayersTable.seasonYear, seasonYear),
        eq(teamPlayersTable.isActive, true),
      ));
      const linkedIds = links.map(l => l.playerId).filter((x): x is string => !!x);
      if (linkedIds.length === 0) return [];
      const linkedPlayers = await db.select().from(playersTable)
        .where(and(inArray(playersTable.id, linkedIds), eq(playersTable.isActive, true)));
      const positionByPlayer = new Map(links.map(l => [l.playerId, l.position]));
      return linkedPlayers.map(p => ({ ...p, position: positionByPlayer.get(p.id) ?? null }));
    };
    if (m.homeTeamId) homePlayers = await loadRoster(m.homeTeamId);
    if (m.awayTeamId) awayPlayers = await loadRoster(m.awayTeamId);
  }

  const stoppageTypes = ["penalty", "horse_change", "safety", "injury_timeout"] as const;
  const boundaryTypes = ["chukker_end", "chukker_start", "match_start", "match_end", "halftime_start", "halftime_end", "score_correction", "goal"];
  let lastStoppageEvent: { eventType: string; playerName: string | null; teamSide: string | null; timestamp: string } | null = null;
  if (m.status === "live" && !m.clockIsRunning) {
    const recentEvents = await db.select().from(matchEventsTable)
      .where(eq(matchEventsTable.matchId, m.id))
      .orderBy(desc(matchEventsTable.createdAt))
      .limit(10);
    for (const ev of recentEvents) {
      if (boundaryTypes.includes(ev.eventType)) break;
      if ((stoppageTypes as readonly string[]).includes(ev.eventType)) {
        lastStoppageEvent = {
          eventType: ev.eventType,
          playerName: ev.playerName || null,
          teamSide: ev.teamId === m.homeTeamId ? "home" : ev.teamId === m.awayTeamId ? "away" : null,
          timestamp: ev.createdAt?.toISOString() || new Date().toISOString(),
        };
        break;
      }
    }
  }

  const homeName = homeTeam?.name || "";
  const awayName = awayTeam?.name || "";
  const shouldSwap = homeName && awayName && awayName.localeCompare(homeName) < 0;

  const { possessionToken: _pt, ...sanitized } = m;

  if (shouldSwap) {
    if (lastStoppageEvent && lastStoppageEvent.teamSide) {
      lastStoppageEvent.teamSide = lastStoppageEvent.teamSide === "home" ? "away" : lastStoppageEvent.teamSide === "away" ? "home" : lastStoppageEvent.teamSide;
    }
    return {
      ...sanitized,
      homeTeamId: m.awayTeamId,
      awayTeamId: m.homeTeamId,
      homeScore: m.awayScore,
      awayScore: m.homeScore,
      lastGoalTeamSide: m.lastGoalTeamSide === "home" ? "away" : m.lastGoalTeamSide === "away" ? "home" : m.lastGoalTeamSide,
      homeTeam: awayTeam ? { ...awayTeam, players: awayPlayers } : null,
      awayTeam: homeTeam ? { ...homeTeam, players: homePlayers } : null,
      field,
      tournament: tournament ? { id: tournament.id, name: tournament.name, chukkersPerMatch: tournament.chukkersPerMatch || 6, clubId: tournament.clubId, clubName: club?.name || "" } : null,
      lastStoppageEvent,
      _teamsSwapped: true,
    };
  }

  return {
    ...sanitized,
    homeTeam: homeTeam ? { ...homeTeam, players: homePlayers } : null,
    awayTeam: awayTeam ? { ...awayTeam, players: awayPlayers } : null,
    field,
    tournament: tournament ? { id: tournament.id, name: tournament.name, chukkersPerMatch: tournament.chukkersPerMatch || 6, clubId: tournament.clubId, clubName: club?.name || "" } : null,
    lastStoppageEvent,
    _teamsSwapped: false,
  };
}

async function requireMatchAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }
  const matchId = String(req.params.matchId);
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) { res.status(404).json({ message: "Match not found" }); return; }
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, match.tournamentId));
  if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }
  const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user.id));
  if (!memberships.some(mem => mem.clubId === tournament.clubId)) {
    res.status(403).json({ message: "Club admin access required to modify match" }); return;
  }
  next();
}

router.get("/tournaments/:tournamentId/matches", async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const teamId = req.query.teamId as string | undefined;
    const matchRows = await db.select().from(matchesTable).where(eq(matchesTable.tournamentId, tournamentId));
    let filtered = matchRows;
    if (teamId) {
      filtered = filtered.filter(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
    }
    const result = await Promise.all(filtered.map(enrichMatch));
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/matches/manageable", requireAuth, async (req, res) => {
  try {
    const userIsSuper = isSuperAdmin(req.user);
    const memberships = userIsSuper
      ? null
      : await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user!.id));
    const allowedClubIds = userIsSuper ? null : new Set((memberships || []).map(m => m.clubId));

    // Team-manager scope: a user managing a player on either team should also
    // see those matches in the picker. Look up team-ids that contain a player
    // managed by this user.
    let managedTeamIds: Set<string> = new Set();
    if (!userIsSuper) {
      const managedPlayers = await db
        .select({ id: playersTable.id })
        .from(playersTable)
        .where(eq(playersTable.managedByUserId, req.user!.id));
      const managedPlayerIds = managedPlayers.map(p => p.id);
      if (managedPlayerIds.length) {
        const teamLinks = await db
          .select({ teamId: teamPlayersTable.teamId })
          .from(teamPlayersTable)
          .where(inArray(teamPlayersTable.playerId, managedPlayerIds));
        managedTeamIds = new Set(teamLinks.map(l => l.teamId));
      }
    }

    const since = new Date();
    since.setDate(since.getDate() - 1);
    const matchRows = await db.select().from(matchesTable).where(gte(matchesTable.scheduledAt, since));
    const tournaments = await db.select().from(tournamentsTable);
    const tournamentMap = new Map(tournaments.map(t => [t.id, t]));

    const filtered = matchRows
      .filter(m => {
        const t = tournamentMap.get(m.tournamentId);
        if (!t) return false;
        if (userIsSuper) return true;
        // Club admin path
        if (t.clubId && allowedClubIds!.has(t.clubId)) return true;
        // Team-manager path
        if (m.homeTeamId && managedTeamIds.has(m.homeTeamId)) return true;
        if (m.awayTeamId && managedTeamIds.has(m.awayTeamId)) return true;
        return false;
      })
      .sort((a, b) => {
        // Strict scheduled-time ascending (live matches naturally appear first
        // since they are scheduled earlier today).
        const aTs = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        const bTs = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        return aTs - bTs;
      })
      .slice(0, 50);

    const homeTeamIds = filtered.map(m => m.homeTeamId).filter(Boolean) as string[];
    const awayTeamIds = filtered.map(m => m.awayTeamId).filter(Boolean) as string[];
    const teamIds = Array.from(new Set([...homeTeamIds, ...awayTeamIds]));
    const teams = teamIds.length > 0 ? await db.select().from(teamsTable).where(inArray(teamsTable.id, teamIds)) : [];
    const teamMap = new Map(teams.map(t => [t.id, t]));

    res.json(filtered.map(m => ({
      id: m.id,
      homeName: m.homeTeamId ? (teamMap.get(m.homeTeamId)?.name || "TBD") : "TBD",
      awayName: m.awayTeamId ? (teamMap.get(m.awayTeamId)?.name || "TBD") : "TBD",
      scheduledAt: m.scheduledAt,
      status: m.status,
      tournamentName: tournamentMap.get(m.tournamentId)?.name || "",
    })));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/matches/live", async (_req, res) => {
  try {
    const liveMatches = await db.select().from(matchesTable).where(eq(matchesTable.status, "live"));
    const result = await Promise.all(liveMatches.map(enrichMatch));
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/matches/today", async (req, res) => {
  try {
    const clubId = req.query.clubId as string | undefined;
    const clubIds = req.query.clubIds as string | undefined;
    const tz = req.query.tz as string | undefined;

    const allClubIds: string[] = clubIds ? clubIds.split(",").filter(Boolean) : clubId ? [clubId] : [];

    let startOfDay: Date;
    let endOfDay: Date;

    if (tz) {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
        });
        const parts = formatter.formatToParts(now);
        const year = parts.find(p => p.type === "year")!.value;
        const month = parts.find(p => p.type === "month")!.value;
        const day = parts.find(p => p.type === "day")!.value;
        const dateStr = `${year}-${month}-${day}`;

        const midnightLocal = new Date(`${dateStr}T00:00:00`);
        const midnightInTz = new Date(midnightLocal.toLocaleString("en-US", { timeZone: tz }));
        const offsetMs = midnightInTz.getTime() - midnightLocal.getTime();

        startOfDay = new Date(midnightLocal.getTime() - offsetMs);
        endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      } catch {
        const today = new Date();
        startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      }
    } else {
      const today = new Date();
      startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    }

    let matchRows = await db.select().from(matchesTable).where(
      and(gte(matchesTable.scheduledAt, startOfDay), lte(matchesTable.scheduledAt, endOfDay))
    );
    matchRows = matchRows.filter(m => m.status !== "final" && m.status !== "cancelled" && m.status !== "completed");
    if (allClubIds.length > 0) {
      const clubTournaments = await db.select().from(tournamentsTable).where(inArray(tournamentsTable.clubId, allClubIds));
      const tIds = clubTournaments.map(t => t.id);
      matchRows = matchRows.filter(m => tIds.includes(m.tournamentId));
    }

    const draftTournaments = await db.select({ id: tournamentsTable.id }).from(tournamentsTable).where(eq(tournamentsTable.status, "draft"));
    const draftIds = new Set(draftTournaments.map(t => t.id));
    matchRows = matchRows.filter(m => !draftIds.has(m.tournamentId));

    matchRows.sort((a, b) => {
      const statusOrder: Record<string, number> = { live: 0, halftime: 1, scheduled: 2, postponed: 3 };
      const sa = statusOrder[a.status] ?? 9;
      const sb = statusOrder[b.status] ?? 9;
      if (sa !== sb) return sa - sb;
      return (a.scheduledAt?.getTime() || 0) - (b.scheduledAt?.getTime() || 0);
    });
    const result = await Promise.all(matchRows.map(enrichMatch));
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/matches/upcoming", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const clubId = req.query.clubId as string | undefined;
    const clubIds = req.query.clubIds as string | undefined;
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const allClubIds: string[] = clubIds ? clubIds.split(",").filter(Boolean) : clubId ? [clubId] : [];

    let matchRows = await db.select().from(matchesTable).where(
      and(gt(matchesTable.scheduledAt, now), lte(matchesTable.scheduledAt, sevenDaysOut))
    ).orderBy(asc(matchesTable.scheduledAt)).limit(limit + offset + 10);

    matchRows = matchRows.filter(m => m.status !== "final" && m.status !== "cancelled");

    if (allClubIds.length > 0) {
      const clubTournaments = await db.select().from(tournamentsTable).where(inArray(tournamentsTable.clubId, allClubIds));
      const tIds = clubTournaments.map(t => t.id);
      matchRows = matchRows.filter(m => tIds.includes(m.tournamentId));
    }

    const draftTournaments = await db.select({ id: tournamentsTable.id }).from(tournamentsTable).where(eq(tournamentsTable.status, "draft"));
    const draftIds = new Set(draftTournaments.map(t => t.id));
    matchRows = matchRows.filter(m => !draftIds.has(m.tournamentId));

    const total = matchRows.length;
    matchRows = matchRows.slice(offset, offset + limit);
    const result = await Promise.all(matchRows.map(enrichMatch));
    if (req.query.paginated === "true") {
      res.json({ matches: result, total, offset, limit });
    } else {
      res.json(result);
    }
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/matches/:matchId", async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!match) { res.status(404).json({ message: "Match not found" }); return; }
    const enriched = await enrichMatch(match, true);
    const events = await db.select().from(matchEventsTable).where(eq(matchEventsTable.matchId, match.id));
    const enrichedEvents = await Promise.all(events.map(async (evt) => {
      let teamName: string | null = null;
      let teamColor: string | null = null;
      if (evt.teamId) {
        const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, evt.teamId));
        if (team) {
          teamName = team.name;
          teamColor = team.primaryColor || null;
        }
      }
      return { ...evt, teamName, teamColor };
    }));
    res.json({ ...enriched, events: enrichedEvents });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.put("/matches/:matchId", requireMatchWrite("gfx", "full_control", "scoreboard"), async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const { homeTeamId, awayTeamId, fieldId, scheduledAt, round, isLocked, notes, streamUrl, streamStartedAt, scoringLocation, broadcastOffsetSeconds } = req.body;
    const updates: Record<string, any> = {};

    // Field-level allowlist by share-token page type. Admins (no share token)
    // may update any field; share-mode operators may only touch fields owned
    // by their page type. Only "gfx" share tokens reach this route.
    const sharePage = req.share?.pageType;
    const canGfxFields    = !sharePage || sharePage === "gfx" || sharePage === "full_control" || sharePage === "scoreboard";
    const canAdminFields  = !sharePage; // teams/field/schedule/round/lock/notes/scoringLocation are admin-only

    if (canAdminFields) {
      if (homeTeamId !== undefined) updates.homeTeamId = homeTeamId;
      if (awayTeamId !== undefined) updates.awayTeamId = awayTeamId;
      if (fieldId !== undefined) updates.fieldId = fieldId;
      if (scheduledAt !== undefined) updates.scheduledAt = new Date(scheduledAt);
      if (round !== undefined) updates.round = round;
      if (isLocked !== undefined) updates.isLocked = isLocked;
      if (notes !== undefined) updates.notes = notes;
      if (scoringLocation !== undefined && ["studio", "field"].includes(scoringLocation)) updates.scoringLocation = scoringLocation;
    }
    if (canGfxFields) {
      if (streamUrl !== undefined) updates.streamUrl = streamUrl || null;
      if (streamStartedAt !== undefined) updates.streamStartedAt = streamStartedAt ? new Date(streamStartedAt) : null;
      if (broadcastOffsetSeconds !== undefined && typeof broadcastOffsetSeconds === "number") updates.broadcastOffsetSeconds = String(broadcastOffsetSeconds);
    }
    const [match] = await db.update(matchesTable).set(updates).where(eq(matchesTable.id, matchId)).returning();
    emitMatchUpdate(matchId);
    const enriched = await enrichMatch(match);
    res.json(enriched);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/matches/:matchId/score", requireMatchWrite("full_control", "scoreboard"), async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const { homeScore, awayScore } = req.body;
    const [match] = await db.update(matchesTable).set({ homeScore, awayScore }).where(eq(matchesTable.id, matchId)).returning();
    if (!(await isDuplicateEvent(matchId, "score_correction"))) {
      await db.insert(matchEventsTable).values({
        matchId: match.id,
        eventType: "score_correction",
        chukker: match.currentChukker,
        clockSeconds: match.clockElapsedSeconds,
        scoreSnapshot: { home: homeScore, away: awayScore },
        createdBy: req.user?.id ?? null,
      });
    }
    const enriched = await enrichMatch(match, true);
    emitMatchUpdate(matchId);
    res.json(enriched);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/matches/:matchId/clock", requireMatchWrite("full_control", "scoreboard"), async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const { action } = req.body;
    const [current] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!current) { res.status(404).json({ message: "Match not found" }); return; }

    let updates: Record<string, any> = {};
    let eventType: string;

    if (action === "start") {
      updates = { clockStartedAt: new Date(), clockIsRunning: true };
      eventType = "clock_start";
    } else if (action === "pause") {
      const elapsed = current.clockElapsedSeconds || 0;
      const additional = current.clockStartedAt
        ? Math.floor((Date.now() - new Date(current.clockStartedAt).getTime()) / 1000)
        : 0;
      updates = { clockElapsedSeconds: elapsed + additional, clockIsRunning: false, clockStartedAt: null };
      eventType = "clock_pause";
    } else if (action === "reset") {
      updates = { clockElapsedSeconds: 0, clockStartedAt: null, clockIsRunning: false };
      eventType = "clock_pause";
    } else {
      res.status(400).json({ message: "Invalid action" }); return;
    }

    const [match] = await db.update(matchesTable).set(updates).where(eq(matchesTable.id, matchId)).returning();
    if (!(await isDuplicateEvent(matchId, eventType))) {
      await db.insert(matchEventsTable).values({
        matchId: match.id, eventType: eventType as any,
        chukker: match.currentChukker, clockSeconds: match.clockElapsedSeconds,
        scoreSnapshot: { home: match.homeScore, away: match.awayScore },
        createdBy: req.user?.id ?? null,
      });
    }
    const enriched = await enrichMatch(match, true);
    emitMatchUpdate(matchId);
    res.json(enriched);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/matches/:matchId/status", requireMatchWrite("full_control"), async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const { status } = req.body;
    const [current] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    const updates: Record<string, any> = { status };
    if (status === "final") {
      if (current?.clockIsRunning && current?.clockStartedAt) {
        const additional = Math.floor((Date.now() - new Date(current.clockStartedAt).getTime()) / 1000);
        updates.clockElapsedSeconds = (current.clockElapsedSeconds || 0) + additional;
      }
      updates.clockIsRunning = false;
      updates.clockStartedAt = null;
    }
    if (status === "live" && !current?.streamStartedAt) {
      updates.streamStartedAt = new Date();
    }
    const [match] = await db.update(matchesTable).set(updates).where(eq(matchesTable.id, matchId)).returning();

    const eventType = status === "live" ? "match_start" : status === "final" ? "match_end" : "clock_pause";
    if (!(await isDuplicateEvent(matchId, eventType))) {
      await db.insert(matchEventsTable).values({
        matchId: match.id, eventType: eventType as any,
        chukker: match.currentChukker, clockSeconds: match.clockElapsedSeconds,
        scoreSnapshot: { home: match.homeScore, away: match.awayScore },
        createdBy: req.user?.id ?? null,
      });
    }
    const enriched = await enrichMatch(match, true);
    if (END_STATUSES.has(status)) {
      emitMatchEnded(matchId);
    } else {
      emitMatchUpdate(matchId);
    }
    res.json(enriched);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/matches/:matchId/chukker", requireMatchWrite("full_control", "scoreboard"), async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const direction = req.body?.direction === "back" ? -1 : 1;
    const [current] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!current) { res.status(404).json({ message: "Match not found" }); return; }

    const newChukker = Math.max(1, (current.currentChukker || 1) + direction);
    if (newChukker === current.currentChukker) {
      const enriched = await enrichMatch(current, true);
      res.json(enriched);
      return;
    }

    if (direction === 1) {
      if (await isDuplicateEvent(matchId, "chukker_end")) {
        const enriched = await enrichMatch(current, true);
        res.json(enriched);
        return;
      }

      await db.insert(matchEventsTable).values({
        matchId: current.id, eventType: "chukker_end",
        chukker: current.currentChukker, clockSeconds: current.clockElapsedSeconds,
        scoreSnapshot: { home: current.homeScore, away: current.awayScore },
        createdBy: req.user?.id ?? null,
      });
    }

    const [match] = await db.update(matchesTable).set({
      currentChukker: newChukker,
      clockElapsedSeconds: 0, clockStartedAt: null, clockIsRunning: false,
    }).where(eq(matchesTable.id, matchId)).returning();

    if (direction === 1) {
      await db.insert(matchEventsTable).values({
        matchId: match.id, eventType: "chukker_start",
        chukker: match.currentChukker, clockSeconds: 0,
        scoreSnapshot: { home: match.homeScore, away: match.awayScore },
        createdBy: req.user?.id ?? null,
      });
    }

    const enriched = await enrichMatch(match, true);
    emitMatchUpdate(matchId);
    res.json(enriched);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/matches/:matchId/goal", requireMatchWrite("full_control", "scoreboard"), async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const { teamId, playerId } = req.body;
    if (!teamId) { res.status(400).json({ message: "teamId required" }); return; }

    const [current] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!current) { res.status(404).json({ message: "Match not found" }); return; }

    const isHome = current.homeTeamId === teamId;
    const isAway = current.awayTeamId === teamId;
    if (!isHome && !isAway) { res.status(400).json({ message: "Team not in this match" }); return; }

    let playerName: string | null = null;
    if (playerId) {
      const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!player) { res.status(400).json({ message: "Player not found" }); return; }
      if (!player.isActive) { res.status(400).json({ message: "Player is not active" }); return; }
      // Canonical eligibility: player must be on the team's team_players roster.
      const [link] = await db.select({ id: teamPlayersTable.id }).from(teamPlayersTable)
        .where(and(eq(teamPlayersTable.teamId, teamId), eq(teamPlayersTable.playerId, playerId))).limit(1);
      if (!link) { res.status(400).json({ message: "Player does not belong to this team" }); return; }
      playerName = player.name;
    }

    const newHome = isHome ? (current.homeScore || 0) + 1 : (current.homeScore || 0);
    const newAway = isAway ? (current.awayScore || 0) + 1 : (current.awayScore || 0);

    const teamSide = isHome ? "home" : "away";
    const [match] = await db.update(matchesTable).set({
      homeScore: newHome,
      awayScore: newAway,
      lastGoalScorerName: playerName || "Goal",
      lastGoalTeamSide: teamSide,
      lastGoalTimestamp: new Date(),
    }).where(eq(matchesTable.id, matchId)).returning();

    await db.insert(matchEventsTable).values({
      matchId: match.id,
      eventType: "goal",
      teamId,
      playerId: playerId || null,
      playerName,
      chukker: match.currentChukker,
      clockSeconds: match.clockElapsedSeconds,
      scoreSnapshot: { home: newHome, away: newAway },
      createdBy: req.user?.id ?? null,
    });

    const enriched = await enrichMatch(match, true);
    emitMatchUpdate(matchId);
    res.json(enriched);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/matches/:matchId/undo-goal", requireMatchWrite("full_control", "scoreboard"), async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const { teamId } = req.body;
    if (!teamId) { res.status(400).json({ message: "teamId required" }); return; }

    const [current] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!current) { res.status(404).json({ message: "Match not found" }); return; }

    const isHome = current.homeTeamId === teamId;
    const isAway = current.awayTeamId === teamId;
    if (!isHome && !isAway) { res.status(400).json({ message: "Team not in this match" }); return; }

    const [lastGoal] = await db.select().from(matchEventsTable)
      .where(and(eq(matchEventsTable.matchId, matchId), eq(matchEventsTable.eventType, "goal"), eq(matchEventsTable.teamId, teamId)))
      .orderBy(desc(matchEventsTable.createdAt))
      .limit(1);

    if (!lastGoal) {
      res.status(409).json({ message: "No goal event found for this team to undo" });
      return;
    }

    const newHome = isHome ? Math.max(0, (current.homeScore || 0) - 1) : (current.homeScore || 0);
    const newAway = isAway ? Math.max(0, (current.awayScore || 0) - 1) : (current.awayScore || 0);

    const [match] = await db.update(matchesTable).set({
      homeScore: newHome,
      awayScore: newAway,
    }).where(eq(matchesTable.id, matchId)).returning();

    await db.delete(matchEventsTable).where(eq(matchEventsTable.id, lastGoal.id));

    const enriched = await enrichMatch(match, true);
    emitMatchUpdate(matchId);
    res.json(enriched);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/matches/:matchId/events/:eventId", requireMatchWrite("stats", "full_control", "scoreboard"), async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const eventId = String(req.params.eventId);

    const [current] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!current) { res.status(404).json({ message: "Match not found" }); return; }

    const [evt] = await db.select().from(matchEventsTable).where(eq(matchEventsTable.id, eventId));
    if (!evt || evt.matchId !== matchId) { res.status(404).json({ message: "Event not found" }); return; }

    // Score-affecting events may only be deleted by an authenticated admin —
    // a stats share token must not be able to mutate the score.
    const isScoreAffecting = (evt.eventType === "goal" || evt.eventType === "penalty_goal");
    if (isScoreAffecting && req.share) {
      res.status(403).json({ message: "Share link cannot delete score-affecting events" });
      return;
    }

    let newHome = current.homeScore || 0;
    let newAway = current.awayScore || 0;

    if (isScoreAffecting && evt.teamId) {
      if (evt.teamId === current.homeTeamId) newHome = Math.max(0, newHome - 1);
      else if (evt.teamId === current.awayTeamId) newAway = Math.max(0, newAway - 1);
    }

    await db.delete(matchEventsTable).where(eq(matchEventsTable.id, eventId));

    const [match] = await db.update(matchesTable).set({
      homeScore: newHome,
      awayScore: newAway,
    }).where(eq(matchesTable.id, matchId)).returning();

    const enriched = await enrichMatch(match, true);
    emitMatchUpdate(matchId);
    res.json(enriched);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/matches/:matchId/clock/adjust", requireMatchWrite("full_control", "scoreboard"), async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const { seconds } = req.body;
    if (typeof seconds !== "number") { res.status(400).json({ message: "seconds required (number)" }); return; }

    const [current] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!current) { res.status(404).json({ message: "Match not found" }); return; }

    const currentElapsed = current.clockElapsedSeconds || 0;
    const newElapsed = Math.max(0, currentElapsed + seconds);

    const [match] = await db.update(matchesTable).set({
      clockElapsedSeconds: newElapsed,
    }).where(eq(matchesTable.id, matchId)).returning();

    const enriched = await enrichMatch(match, true);
    emitMatchUpdate(matchId);
    res.json(enriched);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/matches/:matchId/event", requireMatchWrite("stats", "full_control", "scoreboard"), async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const { eventType, description, teamId, playerId, distance, severity } = req.body;
    // Stoppage events (pause clock) and per-player stat events (do not pause).
    const stoppageTypes = ["penalty", "horse_change", "safety", "injury_timeout"];
    const playerStatTypes = ["penalty_in", "penalty_out", "throw_in_won", "foul_committed", "fouls_won", "shot_on_goal"];
    const allowedTypes = [...stoppageTypes, ...playerStatTypes];
    if (!allowedTypes.includes(eventType)) { res.status(400).json({ message: "Invalid event type" }); return; }
    const isStoppage = stoppageTypes.includes(eventType);

    // Sub-attribute validation: distance only valid on penalty_in; severity only on foul_committed.
    let normDistance: string | null = null;
    let normSeverity: string | null = null;
    if (eventType === "penalty_in") {
      if (distance != null) {
        const d = String(distance);
        if (!["30", "40", "60", "5A", "5B"].includes(d)) { res.status(400).json({ message: "distance must be 30, 40, 60, 5A or 5B" }); return; }
        normDistance = d;
      }
    } else if (distance != null) {
      res.status(400).json({ message: "distance only allowed on penalty_in events" }); return;
    }
    if (eventType === "foul_committed") {
      if (severity != null) {
        const s = String(severity);
        if (!["1", "2", "3", "4", "5a", "5b"].includes(s)) { res.status(400).json({ message: "severity must be 1, 2, 3, 4, 5a or 5b" }); return; }
        normSeverity = s;
      }
    } else if (severity != null) {
      res.status(400).json({ message: "severity only allowed on foul_committed events" }); return;
    }

    const [current] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!current) { res.status(404).json({ message: "Match not found" }); return; }

    if (teamId && teamId !== current.homeTeamId && teamId !== current.awayTeamId) {
      res.status(400).json({ message: "Team not in this match" }); return;
    }

    // Resolve player name when a playerId is provided (for per-player stat events).
    let playerName: string | null = null;
    if (playerId) {
      const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
      if (!player) { res.status(400).json({ message: "Player not found" }); return; }
      playerName = player.name;
    }

    let elapsed = current.clockElapsedSeconds || 0;
    if (current.clockIsRunning && current.clockStartedAt) {
      elapsed += Math.floor((Date.now() - new Date(current.clockStartedAt).getTime()) / 1000);
    }

    let match = current;
    if (isStoppage) {
      const [updated] = await db.update(matchesTable).set({
        clockIsRunning: false,
        clockStartedAt: null,
        clockElapsedSeconds: elapsed,
      }).where(eq(matchesTable.id, matchId)).returning();
      match = updated;
    }

    if (eventType === "penalty" && teamId) {
      const opposingTeamId = teamId === current.homeTeamId ? current.awayTeamId : current.homeTeamId;
      const penaltyTime = new Date();
      const foulTime = new Date(penaltyTime.getTime() + 1);
      await db.insert(matchEventsTable).values({
        matchId: match.id,
        eventType,
        teamId: teamId || null,
        chukker: match.currentChukker,
        clockSeconds: elapsed,
        description: description || null,
        scoreSnapshot: { home: match.homeScore || 0, away: match.awayScore || 0 },
        createdBy: req.user?.id ?? null,
        createdAt: penaltyTime,
      });
      if (opposingTeamId) {
        await db.insert(matchEventsTable).values({
          matchId: match.id,
          eventType: "foul",
          teamId: opposingTeamId,
          chukker: match.currentChukker,
          clockSeconds: elapsed,
          description: `Auto-recorded from ${description || "penalty"}`,
          scoreSnapshot: { home: match.homeScore || 0, away: match.awayScore || 0 },
          createdBy: req.user?.id ?? null,
          createdAt: foulTime,
        });
      }
    } else {
      await db.insert(matchEventsTable).values({
        matchId: match.id,
        eventType,
        teamId: teamId || null,
        playerId: playerId || null,
        playerName,
        chukker: match.currentChukker,
        clockSeconds: elapsed,
        description: description || null,
        distance: normDistance,
        severity: normSeverity,
        scoreSnapshot: { home: match.homeScore || 0, away: match.awayScore || 0 },
        createdBy: req.user?.id ?? null,
      });

      // When a player records a penalty_in, auto-record a penalty_goal for their team.
      if (eventType === "penalty_in" && teamId) {
        await db.insert(matchEventsTable).values({
          matchId: match.id,
          eventType: "penalty_goal",
          teamId,
          playerId: playerId || null,
          playerName,
          chukker: match.currentChukker,
          clockSeconds: elapsed,
          description: normDistance ? `${normDistance}y penalty` : null,
          scoreSnapshot: { home: match.homeScore || 0, away: match.awayScore || 0 },
          createdBy: req.user?.id ?? null,
        });
      }

      // When a player records a shot on goal, auto-record a knock_in for the opposing team.
      if (eventType === "shot_on_goal" && teamId) {
        const opposingTeamId = teamId === current.homeTeamId ? current.awayTeamId : current.homeTeamId;
        if (opposingTeamId) {
          await db.insert(matchEventsTable).values({
            matchId: match.id,
            eventType: "knock_in",
            teamId: opposingTeamId,
            chukker: match.currentChukker,
            clockSeconds: elapsed,
            description: "Auto-recorded from shot on goal",
            scoreSnapshot: { home: match.homeScore || 0, away: match.awayScore || 0 },
            createdBy: req.user?.id ?? null,
          });
        }
      }
    }

    const enriched = await enrichMatch(match, true);
    emitMatchUpdate(matchId);
    res.json(enriched);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/matches/:matchId/stats", async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!match) { res.status(404).json({ message: "Match not found" }); return; }

    const events = await db.select().from(matchEventsTable).where(eq(matchEventsTable.matchId, matchId));

    const statTypes = ["goal", "foul", "bowl_in", "knock_in", "penalty_goal", "shot_on_goal"] as const;
    const homeStats: Record<string, number> = {};
    const awayStats: Record<string, number> = {};
    for (const t of statTypes) { homeStats[t] = 0; awayStats[t] = 0; }

    for (const evt of events) {
      if (!(statTypes as readonly string[]).includes(evt.eventType)) continue;
      if (evt.teamId === match.homeTeamId) homeStats[evt.eventType]++;
      else if (evt.teamId === match.awayTeamId) awayStats[evt.eventType]++;
    }

    homeStats["shot_on_goal"] += homeStats["goal"] + homeStats["penalty_goal"];
    awayStats["shot_on_goal"] += awayStats["goal"] + awayStats["penalty_goal"];

    const homeTeam = match.homeTeamId ? (await db.select().from(teamsTable).where(eq(teamsTable.id, match.homeTeamId)))[0] : null;
    const awayTeam = match.awayTeamId ? (await db.select().from(teamsTable).where(eq(teamsTable.id, match.awayTeamId)))[0] : null;
    const sHomeName = homeTeam?.name || "";
    const sAwayName = awayTeam?.name || "";
    const sSwap = sHomeName && sAwayName && sAwayName.localeCompare(sHomeName) < 0;

    const possession = await getPossessionStats(matchId);
    const poss = possession ? (sSwap ? { homePercent: possession.awayPercent, awayPercent: possession.homePercent, homeSeconds: possession.awaySeconds, awaySeconds: possession.homeSeconds } : possession) : null;

    res.json({ home: sSwap ? awayStats : homeStats, away: sSwap ? homeStats : awayStats, possession: poss });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/matches/:matchId/stat", requireMatchWrite("stats", "full_control", "scoreboard"), async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const { eventType, teamId, description } = req.body;
    const allowedTypes = ["bowl_in", "knock_in", "foul", "penalty_goal", "shot_on_goal"];
    if (!allowedTypes.includes(eventType)) { res.status(400).json({ message: "Invalid stat type" }); return; }

    const [current] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!current) { res.status(404).json({ message: "Match not found" }); return; }

    if (teamId && teamId !== current.homeTeamId && teamId !== current.awayTeamId) {
      res.status(400).json({ message: "Team not in this match" }); return;
    }

    let elapsed = current.clockElapsedSeconds || 0;
    if (current.clockIsRunning && current.clockStartedAt) {
      elapsed += Math.floor((Date.now() - new Date(current.clockStartedAt).getTime()) / 1000);
    }

    if (eventType === "knock_in" && teamId) {
      const opposingTeamId = teamId === current.homeTeamId ? current.awayTeamId : current.homeTeamId;
      if (opposingTeamId) {
        await db.insert(matchEventsTable).values({
          matchId,
          eventType: "shot_on_goal",
          teamId: opposingTeamId,
          chukker: current.currentChukker,
          clockSeconds: elapsed,
          description: "Auto-recorded from knock in",
          scoreSnapshot: { home: current.homeScore || 0, away: current.awayScore || 0 },
          createdBy: req.user?.id ?? null,
        });
      }
    }

    await db.insert(matchEventsTable).values({
      matchId,
      eventType,
      teamId: teamId || null,
      chukker: current.currentChukker,
      clockSeconds: elapsed,
      description: description || null,
      scoreSnapshot: { home: current.homeScore || 0, away: current.awayScore || 0 },
      createdBy: req.user?.id ?? null,
    });

    const enriched = await enrichMatch(current, true);
    emitMatchUpdate(matchId);
    res.json(enriched);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/tournaments/:tournamentId/matches", requireAuth, async (req, res) => {
  try {
    const tournamentId = String(req.params.tournamentId);
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }
    const { homeTeamId, awayTeamId, fieldId, scheduledAt, round, notes, streamUrl } = req.body;
    const [match] = await db.insert(matchesTable).values({
      tournamentId,
      homeTeamId: homeTeamId || null,
      awayTeamId: awayTeamId || null,
      fieldId: fieldId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      round: round || null,
      notes: notes || null,
      streamUrl: streamUrl || null,
      status: "scheduled",
    }).returning();
    const enriched = await enrichMatch(match);
    res.status(201).json(enriched);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/matches/:matchId", requireAuth, async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!match) { res.status(404).json({ message: "Match not found" }); return; }
    await db.delete(matchEventsTable).where(eq(matchEventsTable.matchId, matchId));
    await db.delete(possessionSegmentsTable).where(eq(possessionSegmentsTable.matchId, matchId));
    await db.delete(matchesTable).where(eq(matchesTable.id, matchId));
    res.json({ message: "Match deleted" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/matches/:matchId/events", async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const events = await db.select().from(matchEventsTable).where(eq(matchEventsTable.matchId, matchId));
    const enrichedEvents = await Promise.all(events.map(async (evt) => {
      let teamName: string | null = null;
      let teamColor: string | null = null;
      if (evt.teamId) {
        const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, evt.teamId));
        if (team) {
          teamName = team.name;
          teamColor = team.primaryColor || null;
        }
      }
      return { ...evt, teamName, teamColor };
    }));
    res.json(enrichedEvents);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/matches/:matchId/stream", async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!match) { res.status(404).json({ message: "Match not found" }); return; }
    if (!LIVE_STATUSES.has(match.status)) {
      res.status(204).end();
      return;
    }
    addSSEClient(matchId, res);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

async function buildBroadcastPayload(matchId: string) {
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) return null;

    const homeTeam = match.homeTeamId ? (await db.select().from(teamsTable).where(eq(teamsTable.id, match.homeTeamId)))[0] : null;
    const awayTeam = match.awayTeamId ? (await db.select().from(teamsTable).where(eq(teamsTable.id, match.awayTeamId)))[0] : null;
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, match.tournamentId));
    const [club] = tournament ? await db.select().from(clubsTable).where(eq(clubsTable.id, tournament.clubId)) : [null];
    const field = match.fieldId ? (await db.select().from(fieldsTable).where(eq(fieldsTable.id, match.fieldId)))[0] : null;

    const stoppageTypes = ["penalty", "horse_change", "safety", "injury_timeout"] as const;
    const boundaryTypes = ["chukker_end", "chukker_start", "match_start", "match_end", "halftime_start", "halftime_end", "score_correction", "goal"];
    let lastStoppageEvent: { eventType: string; description: string | null; playerName: string | null; teamSide: string | null; timestamp: string } | null = null;
    const recentEvents = await db.select().from(matchEventsTable)
      .where(eq(matchEventsTable.matchId, matchId))
      .orderBy(desc(matchEventsTable.createdAt))
      .limit(20);
    for (const ev of recentEvents) {
      if (boundaryTypes.includes(ev.eventType)) break;
      if ((stoppageTypes as readonly string[]).includes(ev.eventType)) {
        lastStoppageEvent = {
          eventType: ev.eventType,
          description: ev.description || null,
          playerName: ev.playerName || null,
          teamSide: ev.teamId === match.homeTeamId ? "home" : ev.teamId === match.awayTeamId ? "away" : null,
          timestamp: ev.createdAt?.toISOString() || new Date().toISOString(),
        };
        break;
      }
    }

    const allEvents = await db.select().from(matchEventsTable).where(eq(matchEventsTable.matchId, matchId));
    const statTypes = ["goal", "foul", "bowl_in", "knock_in", "penalty_goal", "shot_on_goal"] as const;
    const rawHomeStats: Record<string, number> = {};
    const rawAwayStats: Record<string, number> = {};
    for (const t of statTypes) { rawHomeStats[t] = 0; rawAwayStats[t] = 0; }
    for (const evt of allEvents) {
      if (!(statTypes as readonly string[]).includes(evt.eventType)) continue;
      // Skip goal — we use the authoritative stored score below, not the event count.
      if (evt.eventType === "goal") continue;
      if (evt.teamId === match.homeTeamId) rawHomeStats[evt.eventType]++;
      else if (evt.teamId === match.awayTeamId) rawAwayStats[evt.eventType]++;
    }

    // Use the stored match score as the authoritative goal count.
    // Score corrections made via the match controller update homeScore/awayScore
    // directly on the match record without always creating corresponding goal events,
    // so event-counting goals can diverge from the real score.
    rawHomeStats["goal"] = match.homeScore || 0;
    rawAwayStats["goal"] = match.awayScore || 0;

    rawHomeStats["shot_on_goal"] += rawHomeStats["goal"] + rawHomeStats["penalty_goal"];
    rawAwayStats["shot_on_goal"] += rawAwayStats["goal"] + rawAwayStats["penalty_goal"];

    const scorerMap: Record<string, { playerId: string | null; name: string; goals: number; teamSide: "home" | "away" }> = {};
    for (const evt of allEvents) {
      if (evt.eventType !== "goal" || !evt.playerName) continue;
      const side = evt.teamId === match.homeTeamId ? "home" as const : "away" as const;
      const key = evt.playerId ? `id:${evt.playerId}__${side}` : `name:${evt.playerName}__${side}`;
      if (!scorerMap[key]) scorerMap[key] = { playerId: evt.playerId ?? null, name: evt.playerName, goals: 0, teamSide: side };
      scorerMap[key].goals++;
    }
    // Hydrate display names from canonical players: when a goal event is linked by
    // playerId, prefer the live player.name so renames/edits propagate to live match
    // top-scorer displays without requiring back-fills of cached match_events.playerName.
    const scorerPlayerIds = Array.from(new Set(
      Object.values(scorerMap).map(s => s.playerId).filter((x): x is string => !!x)
    ));
    if (scorerPlayerIds.length > 0) {
      const canonicalScorers = await db.select({ id: playersTable.id, name: playersTable.name })
        .from(playersTable)
        .where(inArray(playersTable.id, scorerPlayerIds));
      const nameById = new Map(canonicalScorers.map(p => [p.id, p.name]));
      for (const s of Object.values(scorerMap)) {
        if (s.playerId && nameById.has(s.playerId)) s.name = nameById.get(s.playerId)!;
      }
    }
    const topScorers = Object.values(scorerMap).sort((a, b) => b.goals - a.goals).slice(0, 2);

    // Hydrate lastGoalScorerName: if the cached scorer name is stale relative to the
    // canonical player record, prefer the canonical name. We resolve by matching the
    // most recent goal event for this match (whose playerId still points at canonical).
    let liveLastGoalScorerName = match.lastGoalScorerName;
    const lastGoalEvt = [...allEvents]
      .filter(e => e.eventType === "goal" && e.playerId)
      .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())[0];
    if (lastGoalEvt?.playerId) {
      const [livePlayer] = await db.select({ name: playersTable.name }).from(playersTable)
        .where(eq(playersTable.id, lastGoalEvt.playerId)).limit(1);
      if (livePlayer?.name) liveLastGoalScorerName = livePlayer.name;
    }

    const bHomeName = homeTeam?.name || "";
    const bAwayName = awayTeam?.name || "";
    const bSwap = bHomeName && bAwayName && bAwayName.localeCompare(bHomeName) < 0;

    if (bSwap) {
      if (lastStoppageEvent && lastStoppageEvent.teamSide) {
        lastStoppageEvent.teamSide = lastStoppageEvent.teamSide === "home" ? "away" : lastStoppageEvent.teamSide === "away" ? "home" : lastStoppageEvent.teamSide;
      }
    }

    return {
      id: match.id,
      status: match.status,
      homeScore: bSwap ? match.awayScore : match.homeScore,
      awayScore: bSwap ? match.homeScore : match.awayScore,
      currentChukker: match.currentChukker,
      clockStartedAt: match.clockStartedAt,
      clockElapsedSeconds: match.clockElapsedSeconds,
      clockIsRunning: match.clockIsRunning,
      broadcastVisible: match.broadcastVisible,
      broadcastStyle: match.broadcastStyle,
      broadcastResolution: match.broadcastResolution || "1080p",
      broadcast4kScale: match.broadcast4kScale ?? 100,
      broadcast4kOffsetX: match.broadcast4kOffsetX ?? 0,
      broadcast4kOffsetY: match.broadcast4kOffsetY ?? 0,
      broadcastChannel: match.broadcastChannel || null,
      serverNow: new Date().toISOString(),
      lastGoalScorerName: liveLastGoalScorerName,
      lastGoalTeamSide: bSwap ? (match.lastGoalTeamSide === "home" ? "away" : match.lastGoalTeamSide === "away" ? "home" : match.lastGoalTeamSide) : match.lastGoalTeamSide,
      lastGoalTimestamp: match.lastGoalTimestamp,
      lastStoppageEvent,
      homeTeam: (bSwap ? awayTeam : homeTeam) ? { name: (bSwap ? awayTeam : homeTeam)!.name, shortName: (bSwap ? awayTeam : homeTeam)!.shortName, scoreboardName: (bSwap ? awayTeam : homeTeam)!.scoreboardName, logoUrl: (bSwap ? awayTeam : homeTeam)!.logoUrl, primaryColor: (bSwap ? awayTeam : homeTeam)!.primaryColor } : null,
      awayTeam: (bSwap ? homeTeam : awayTeam) ? { name: (bSwap ? homeTeam : awayTeam)!.name, shortName: (bSwap ? homeTeam : awayTeam)!.shortName, scoreboardName: (bSwap ? homeTeam : awayTeam)!.scoreboardName, logoUrl: (bSwap ? homeTeam : awayTeam)!.logoUrl, primaryColor: (bSwap ? homeTeam : awayTeam)!.primaryColor } : null,
      tournament: tournament ? { name: tournament.name, chukkersPerMatch: tournament.chukkersPerMatch || 6, clubId: tournament.clubId } : null,
      club: club ? { name: club.name, logoUrl: club.logoUrl || null } : null,
      field: field ? { id: field.id, name: field.name, number: field.number, imageUrl: field.imageUrl || null, hasLocation: !!(field.lat && field.lng) || !!field.zipcode } : null,
      stats: { home: bSwap ? rawAwayStats : rawHomeStats, away: bSwap ? rawHomeStats : rawAwayStats },
      topScorers: topScorers.map(s => ({ playerId: s.playerId, name: s.name, goals: s.goals, teamSide: bSwap ? (s.teamSide === "home" ? "away" : "home") : s.teamSide })),
      possession: await (async () => {
        const p = await getPossessionStats(matchId);
        if (!p) return null;
        return bSwap ? { homePercent: p.awayPercent, awayPercent: p.homePercent, homeSeconds: p.awaySeconds, awaySeconds: p.homeSeconds } : p;
      })(),
      streamStartedAt: match.streamStartedAt ? match.streamStartedAt.toISOString() : null,
      scoringLocation: match.scoringLocation || "studio",
      broadcastOffsetSeconds: Number(match.broadcastOffsetSeconds ?? 0),
    };
}

router.get("/matches/:matchId/broadcast", async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const payload = await buildBroadcastPayload(matchId);
    if (!payload) { res.status(404).json({ message: "Match not found" }); return; }
    res.setHeader("Cache-Control", "no-store");
    res.json(payload);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/clubs/:clubId/broadcast/channel/:channel", async (req, res) => {
  try {
    const clubId = String(req.params.clubId);
    const channel = String(req.params.channel).toLowerCase();
    if (channel !== "ch1" && channel !== "ch2") {
      res.status(400).json({ message: "channel must be ch1 or ch2" });
      return;
    }
    const clubTournaments = await db.select().from(tournamentsTable).where(eq(tournamentsTable.clubId, clubId));
    if (clubTournaments.length === 0) { res.json({ assigned: false }); return; }
    const tournamentIds = clubTournaments.map(t => t.id);
    const assignedMatches = await db.select().from(matchesTable)
      .where(and(eq(matchesTable.broadcastChannel, channel), inArray(matchesTable.tournamentId, tournamentIds)))
      .limit(1);
    const assigned = assignedMatches[0];
    if (!assigned) { res.json({ assigned: false }); return; }
    const payload = await buildBroadcastPayload(assigned.id);
    if (!payload) { res.json({ assigned: false }); return; }
    res.setHeader("Cache-Control", "no-store");
    res.json({ assigned: true, ...payload });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.put("/matches/:matchId/broadcast", requireMatchWrite("gfx", "full_control", "scoreboard"), async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const { broadcastVisible, broadcastStyle, broadcastResolution, broadcast4kScale, broadcast4kOffsetX, broadcast4kOffsetY, broadcastChannel } = req.body;
    const updates: Record<string, any> = {};
    if (broadcastVisible !== undefined) {
      if (typeof broadcastVisible !== "boolean") { res.status(400).json({ message: "broadcastVisible must be boolean" }); return; }
      updates.broadcastVisible = broadcastVisible;
    }
    if (broadcastStyle !== undefined) {
      const allowedStyles = ["option1", "option2", "stats", "stats_mini", "field"];
      if (!allowedStyles.includes(broadcastStyle)) { res.status(400).json({ message: "broadcastStyle must be option1, option2, stats, stats_mini, or field" }); return; }
      updates.broadcastStyle = broadcastStyle;
    }
    if (broadcastResolution !== undefined) {
      const allowedRes = ["1080p", "4k"];
      if (!allowedRes.includes(broadcastResolution)) { res.status(400).json({ message: "broadcastResolution must be 1080p or 4k" }); return; }
      updates.broadcastResolution = broadcastResolution;
    }
    if (broadcast4kScale !== undefined) {
      if (typeof broadcast4kScale !== "number" || !Number.isFinite(broadcast4kScale) || broadcast4kScale < 90 || broadcast4kScale > 110) {
        res.status(400).json({ message: "broadcast4kScale must be a number between 90 and 110" }); return;
      }
      updates.broadcast4kScale = Math.round(broadcast4kScale);
    }
    if (broadcast4kOffsetX !== undefined) {
      if (typeof broadcast4kOffsetX !== "number" || !Number.isFinite(broadcast4kOffsetX) || broadcast4kOffsetX < -500 || broadcast4kOffsetX > 500) {
        res.status(400).json({ message: "broadcast4kOffsetX must be a number between -500 and 500" }); return;
      }
      updates.broadcast4kOffsetX = Math.round(broadcast4kOffsetX);
    }
    if (broadcast4kOffsetY !== undefined) {
      if (typeof broadcast4kOffsetY !== "number" || !Number.isFinite(broadcast4kOffsetY) || broadcast4kOffsetY < -500 || broadcast4kOffsetY > 500) {
        res.status(400).json({ message: "broadcast4kOffsetY must be a number between -500 and 500" }); return;
      }
      updates.broadcast4kOffsetY = Math.round(broadcast4kOffsetY);
    }
    let releasedFromMatchId: string | null = null;
    const releasedMatchIds: string[] = [];
    if (broadcastChannel !== undefined) {
      if (broadcastChannel !== null && broadcastChannel !== "ch1" && broadcastChannel !== "ch2") {
        res.status(400).json({ message: "broadcastChannel must be null, ch1, or ch2" }); return;
      }
      updates.broadcastChannel = broadcastChannel;
    }
    const match = await db.transaction(async (tx) => {
      if (broadcastChannel) {
        const [thisMatch] = await tx.select().from(matchesTable).where(eq(matchesTable.id, matchId));
        if (!thisMatch) throw new Error("Match not found");
        const [thisTournament] = await tx.select().from(tournamentsTable).where(eq(tournamentsTable.id, thisMatch.tournamentId));
        if (thisTournament) {
          const lockKey = `${thisTournament.clubId}:${broadcastChannel}`;
          const lockHash = crypto.createHash("sha256").update(lockKey).digest();
          const lockInt = lockHash.readBigInt64BE(0).toString();
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${sql.raw(lockInt)})`);
          const sameClubTournaments = await tx.select().from(tournamentsTable).where(eq(tournamentsTable.clubId, thisTournament.clubId));
          const tournamentIds = sameClubTournaments.map(t => t.id);
          const cleared = await tx.update(matchesTable)
            .set({ broadcastChannel: null })
            .where(and(
              eq(matchesTable.broadcastChannel, broadcastChannel),
              inArray(matchesTable.tournamentId, tournamentIds),
            ))
            .returning({ id: matchesTable.id });
          for (const c of cleared) {
            if (c.id !== matchId) {
              releasedMatchIds.push(c.id);
              releasedFromMatchId = c.id;
            }
          }
        }
      }
      const [updated] = await tx.update(matchesTable).set(updates).where(eq(matchesTable.id, matchId)).returning();
      return updated;
    });
    for (const releasedId of releasedMatchIds) emitMatchUpdate(releasedId);
    emitMatchUpdate(matchId);
    res.json({
      broadcastVisible: match.broadcastVisible,
      broadcastStyle: match.broadcastStyle,
      broadcastResolution: match.broadcastResolution,
      broadcast4kScale: match.broadcast4kScale ?? 100,
      broadcast4kOffsetX: match.broadcast4kOffsetX ?? 0,
      broadcast4kOffsetY: match.broadcast4kOffsetY ?? 0,
      broadcastChannel: match.broadcastChannel || null,
      releasedFromMatchId,
    });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

async function getPossessionStats(matchId: string) {
  const segments = await db.select().from(possessionSegmentsTable)
    .where(eq(possessionSegmentsTable.matchId, matchId));
  if (segments.length === 0) return null;

  let homeTime = 0, awayTime = 0;
  const now = new Date();
  for (const seg of segments) {
    const dur = seg.durationSeconds ?? (seg.endedAt ? Math.round((seg.endedAt.getTime() - seg.startedAt.getTime()) / 1000) : Math.round((now.getTime() - seg.startedAt.getTime()) / 1000));
    if (seg.possessionState === "home") homeTime += dur;
    else if (seg.possessionState === "away") awayTime += dur;
  }
  const controlled = homeTime + awayTime;
  if (controlled === 0) return null;
  const homePercent = Math.round((homeTime / controlled) * 100);
  const awayPercent = 100 - homePercent;
  return {
    homeSeconds: homeTime,
    awaySeconds: awayTime,
    homePercent,
    awayPercent,
  };
}

router.get("/matches/:matchId/possession", async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!match) { res.status(404).json({ message: "Match not found" }); return; }

    const [activeSegment] = await db.select().from(possessionSegmentsTable)
      .where(and(eq(possessionSegmentsTable.matchId, matchId), isNull(possessionSegmentsTable.endedAt)))
      .orderBy(desc(possessionSegmentsTable.startedAt))
      .limit(1);

    const stats = await getPossessionStats(matchId);

    res.json({
      currentState: activeSegment?.possessionState || null,
      stats,
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/matches/:matchId/possession", optionalAuth, async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const { state, token } = req.body;
    if (!["home", "away", "loose"].includes(state)) {
      res.status(400).json({ message: "state must be home, away, or loose" }); return;
    }

    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!match) { res.status(404).json({ message: "Match not found" }); return; }

    const hasValidToken = token && match.possessionToken && match.possessionToken === token;
    const hasAuth = req.user && (isSuperAdmin(req.user) || req.user.role === "admin");

    // Also accept full_control or stats share tokens for this match.
    const share = await resolveShareToken(req);
    const hasShareAccess = share && share.matchId === matchId &&
      (share.pageType === "full_control" || share.pageType === "stats");

    if (!hasValidToken && !hasAuth && !hasShareAccess) {
      res.status(403).json({ message: "Valid possession token or admin auth required" }); return;
    }

    const now = new Date();
    const [activeSegment] = await db.select().from(possessionSegmentsTable)
      .where(and(eq(possessionSegmentsTable.matchId, matchId), isNull(possessionSegmentsTable.endedAt)))
      .orderBy(desc(possessionSegmentsTable.startedAt))
      .limit(1);

    if (state === "loose") {
      if (activeSegment) {
        const dur = Math.round((now.getTime() - activeSegment.startedAt.getTime()) / 1000);
        await db.update(possessionSegmentsTable).set({
          endedAt: now,
          durationSeconds: dur,
        }).where(eq(possessionSegmentsTable.id, activeSegment.id));
      }
      emitMatchUpdate(matchId);
      res.json({ currentState: null });
      return;
    }

    if (activeSegment && activeSegment.possessionState === state) {
      res.json({ currentState: state, message: "Already in this state" }); return;
    }

    await db.transaction(async (tx) => {
      if (activeSegment) {
        const dur = Math.round((now.getTime() - activeSegment.startedAt.getTime()) / 1000);
        await tx.update(possessionSegmentsTable).set({
          endedAt: now,
          durationSeconds: dur,
        }).where(eq(possessionSegmentsTable.id, activeSegment.id));
      }

      await tx.insert(possessionSegmentsTable).values({
        matchId,
        possessionState: state,
        chukker: match.currentChukker,
        startedAt: now,
      });
    });

    emitMatchUpdate(matchId);
    res.json({ currentState: state });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.delete("/matches/:matchId/possession", requireMatchWrite("stats", "full_control"), async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    await db.delete(possessionSegmentsTable).where(eq(possessionSegmentsTable.matchId, matchId));
    emitMatchUpdate(matchId);
    res.json({ message: "Possession data reset" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/matches/:matchId/possession/token", requireAuth, requireMatchAdmin, async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!match) { res.status(404).json({ message: "Match not found" }); return; }

    let token = match.possessionToken;
    if (!token) {
      token = crypto.randomBytes(24).toString("hex");
      await db.update(matchesTable).set({ possessionToken: token }).where(eq(matchesTable.id, matchId));
    }

    res.json({ token });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/matches/:matchId/possession/verify-token", async (req, res) => {
  try {
    const matchId = String(req.params.matchId);
    const token = String(req.query.token || "");
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
    if (!match) { res.status(404).json({ message: "Match not found" }); return; }
    if (!match.possessionToken || match.possessionToken !== token) {
      res.status(403).json({ valid: false }); return;
    }

    const homeTeam = match.homeTeamId ? (await db.select().from(teamsTable).where(eq(teamsTable.id, match.homeTeamId)))[0] : null;
    const awayTeam = match.awayTeamId ? (await db.select().from(teamsTable).where(eq(teamsTable.id, match.awayTeamId)))[0] : null;
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, match.tournamentId));

    const stoppageTypes = ["penalty", "horse_change", "safety", "injury_timeout"] as const;
    const boundaryTypes = ["chukker_end", "chukker_start", "match_start", "match_end", "halftime_start", "halftime_end", "score_correction", "goal"];
    let lastStoppageEvent: { eventType: string; playerName: string | null; teamSide: string | null; timestamp: string } | null = null;
    if (match.status === "live" && !match.clockIsRunning) {
      const recentEvents = await db.select().from(matchEventsTable)
        .where(eq(matchEventsTable.matchId, match.id))
        .orderBy(desc(matchEventsTable.createdAt))
        .limit(10);
      for (const ev of recentEvents) {
        if (boundaryTypes.includes(ev.eventType)) break;
        if ((stoppageTypes as readonly string[]).includes(ev.eventType)) {
          lastStoppageEvent = {
            eventType: ev.eventType,
            playerName: ev.playerName || null,
            teamSide: ev.teamId === match.homeTeamId ? "home" : ev.teamId === match.awayTeamId ? "away" : null,
            timestamp: ev.createdAt?.toISOString() || new Date().toISOString(),
          };
          break;
        }
      }
    }

    res.json({
      valid: true,
      match: {
        id: match.id,
        status: match.status,
        currentChukker: match.currentChukker,
        homeScore: match.homeScore ?? 0,
        awayScore: match.awayScore ?? 0,
        clockStartedAt: match.clockStartedAt,
        clockElapsedSeconds: match.clockElapsedSeconds ?? 0,
        clockIsRunning: match.clockIsRunning ?? false,
        lastGoalScorerName: match.lastGoalScorerName,
        lastGoalTimestamp: match.lastGoalTimestamp,
        lastStoppageEvent,
        homeTeam: homeTeam ? { name: homeTeam.name, shortName: homeTeam.shortName, logoUrl: homeTeam.logoUrl, primaryColor: homeTeam.primaryColor } : null,
        awayTeam: awayTeam ? { name: awayTeam.name, shortName: awayTeam.shortName, logoUrl: awayTeam.logoUrl, primaryColor: awayTeam.primaryColor } : null,
        tournament: tournament ? { name: tournament.name } : null,
      },
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
