import { db } from "@workspace/db";
import { matchesTable, tournamentTeamsTable, playDatesTable, teamOutDatesTable, tournamentsTable } from "@workspace/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

interface ScheduleSlot {
  playDateId: string;
  playDate: string;
  fieldId: string;
  startTime: string;
  slotIndex: number;
}

interface ScheduleWarning {
  type: "unscheduled_match" | "insufficient_slots" | "team_overload" | "format_fallback" | "bye_round";
  message: string;
}

interface ScheduleMatch {
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
  fieldId: string | null;
  scheduledAt: Date | null;
  round: string;
  status: string;
}

interface ScheduleResult {
  matches: ScheduleMatch[];
  warnings: ScheduleWarning[];
}

type PlayDateRow = InferSelectModel<typeof playDatesTable>;
type TournamentTeamRow = InferSelectModel<typeof tournamentTeamsTable>;

export async function generateSchedule(tournamentId: string): Promise<ScheduleResult> {
  const warnings: ScheduleWarning[] = [];

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
  if (!tournament) return { matches: [], warnings: [{ type: "format_fallback", message: "Tournament not found" }] };

  const entries = await db.select().from(tournamentTeamsTable).where(eq(tournamentTeamsTable.tournamentId, tournamentId));
  const teamIds = entries.map((e: TournamentTeamRow) => e.teamId);
  if (teamIds.length < 2) return { matches: [], warnings: [{ type: "insufficient_slots", message: "Need at least 2 teams to generate a schedule" }] };

  const pdRows = await db.select().from(playDatesTable).where(eq(playDatesTable.tournamentId, tournamentId));
  pdRows.sort((a: PlayDateRow, b: PlayDateRow) => a.date.localeCompare(b.date));
  if (pdRows.length === 0) return { matches: [], warnings: [{ type: "insufficient_slots", message: "No play dates configured" }] };

  const outDates = await db.select().from(teamOutDatesTable).where(
    or(eq(teamOutDatesTable.tournamentId, tournamentId), isNull(teamOutDatesTable.tournamentId))
  );
  const outDateMap = new Map<string, Set<string>>();
  for (const od of outDates) {
    if (!outDateMap.has(od.teamId)) outDateMap.set(od.teamId, new Set());
    outDateMap.get(od.teamId)!.add(od.outDate);
  }

  const maxGamesMap = new Map<string, number>();
  for (const e of entries) {
    maxGamesMap.set(e.teamId, e.maxGamesPerDay ?? 2);
  }

  const slots = buildSlots(pdRows);
  const format = tournament.format || "round_robin";

  let matchups: [string, string, string][];

  switch (format) {
    case "round_robin":
      matchups = generateRoundRobinPairings(teamIds);
      break;
    case "single_elim":
      matchups = generateSingleElimFirstRound(teamIds, warnings);
      break;
    case "double_elim":
      matchups = generateDoubleElimFirstRound(teamIds, warnings);
      break;
    case "group_knockout":
      matchups = generateGroupStagePairings(teamIds, entries, warnings);
      break;
    case "swiss":
      matchups = generateSwissFirstRound(teamIds, warnings);
      break;
    default:
      warnings.push({ type: "format_fallback", message: `Unknown format "${format}", falling back to round robin` });
      matchups = generateRoundRobinPairings(teamIds);
  }

  const matches = assignMatchupsToSlots(matchups, slots, outDateMap, maxGamesMap, tournamentId, warnings);
  return { matches, warnings };
}

function generateRoundRobinPairings(teamIds: string[]): [string, string, string][] {
  const pairs: [string, string, string][] = [];
  const n = teamIds.length;
  const teams = [...teamIds];
  if (n % 2 !== 0) teams.push("BYE");
  const numRounds = teams.length - 1;
  const half = teams.length / 2;

  for (let round = 0; round < numRounds; round++) {
    for (let i = 0; i < half; i++) {
      const home = teams[i];
      const away = teams[teams.length - 1 - i];
      if (home !== "BYE" && away !== "BYE") {
        pairs.push([home, away, `Round ${round + 1}`]);
      }
    }
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  return pairs;
}

function generateSingleElimFirstRound(teamIds: string[], warnings: ScheduleWarning[]): [string, string, string][] {
  const n = teamIds.length;
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));
  const byes = nextPow2 - n;

  if (byes > 0) {
    warnings.push({ type: "bye_round", message: `${byes} team(s) receive a first-round bye (${n} teams, bracket size ${nextPow2})` });
  }

  const shuffled = [...teamIds].sort(() => Math.random() - 0.5);
  const pairs: [string, string, string][] = [];
  const roundLabel = getRoundLabel(nextPow2);

  const bracketTeams = [...shuffled];
  while (bracketTeams.length < nextPow2) {
    bracketTeams.push("BYE");
  }

  for (let i = 0; i < bracketTeams.length; i += 2) {
    const a = bracketTeams[i];
    const b = bracketTeams[i + 1];
    if (a !== "BYE" && b !== "BYE") {
      pairs.push([a, b, roundLabel]);
    }
  }

  if (nextPow2 > n) {
    warnings.push({ type: "format_fallback", message: "Subsequent elimination rounds will be generated after first-round results are recorded" });
  }

  return pairs;
}

function generateDoubleElimFirstRound(teamIds: string[], warnings: ScheduleWarning[]): [string, string, string][] {
  warnings.push({ type: "format_fallback", message: "Double elimination: generating winners bracket first round only. Loser bracket matches are created after results are recorded." });
  return generateSingleElimFirstRound(teamIds, warnings);
}

function generateGroupStagePairings(
  teamIds: string[],
  entries: TournamentTeamRow[],
  warnings: ScheduleWarning[]
): [string, string, string][] {
  const groups = new Map<string, string[]>();
  for (const entry of entries) {
    const label = entry.groupLabel || "A";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(entry.teamId);
  }

  if (groups.size < 2) {
    warnings.push({ type: "format_fallback", message: "Only one group found; generating round robin within the group. Assign group labels for proper group+knockout." });
  }

  const pairs: [string, string, string][] = [];

  for (const [label, members] of groups) {
    const groupPairs = generateRoundRobinPairings(members);
    for (const [a, b] of groupPairs) {
      pairs.push([a, b, `Group ${label}`]);
    }
  }

  warnings.push({ type: "format_fallback", message: "Knockout stage matches will be generated after group stage results are finalized." });

  return pairs;
}

function generateSwissFirstRound(teamIds: string[], warnings: ScheduleWarning[]): [string, string, string][] {
  const numRounds = Math.ceil(Math.log2(teamIds.length));
  warnings.push({ type: "format_fallback", message: `Swiss system: generating round 1 pairings only. Subsequent rounds (${numRounds} total) are re-paired based on results.` });

  if (teamIds.length % 2 !== 0) {
    warnings.push({ type: "bye_round", message: "Odd number of teams; one team will receive a bye each round" });
  }

  const pairs: [string, string, string][] = [];
  const shuffled = [...teamIds].sort(() => Math.random() - 0.5);

  for (let i = 0; i < shuffled.length - 1; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1], "Swiss R1"]);
  }

  return pairs;
}

function getRoundLabel(bracketSize: number): string {
  if (bracketSize === 2) return "Final";
  if (bracketSize === 4) return "Semi-Final";
  if (bracketSize === 8) return "Quarter-Final";
  return `Round of ${bracketSize}`;
}

function buildSlots(playDates: PlayDateRow[]): ScheduleSlot[] {
  const slots: ScheduleSlot[] = [];
  for (const pd of playDates) {
    const fIds = (pd.fieldIds || []) as string[];
    const start = pd.startTime || "09:00:00";
    const end = pd.endTime || "17:00:00";
    const slotMins = 90;
    const startMinutes = parseTime(start);
    const endMinutes = parseTime(end);
    let slotIdx = 0;
    for (let t = startMinutes; t + slotMins <= endMinutes; t += slotMins) {
      for (const fId of fIds) {
        const hours = Math.floor(t / 60).toString().padStart(2, "0");
        const mins = (t % 60).toString().padStart(2, "0");
        slots.push({
          playDateId: pd.id,
          playDate: pd.date,
          fieldId: fId,
          startTime: `${hours}:${mins}`,
          slotIndex: slotIdx,
        });
      }
      slotIdx++;
    }
  }
  return slots;
}

function parseTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function assignMatchupsToSlots(
  matchups: [string, string, string][],
  slots: ScheduleSlot[],
  outDateMap: Map<string, Set<string>>,
  maxGamesMap: Map<string, number>,
  tournamentId: string,
  warnings: ScheduleWarning[],
): ScheduleMatch[] {
  const dayTeamCount = new Map<string, Map<string, number>>();
  const result: ScheduleMatch[] = [];
  let roundNum = 1;

  for (const [home, away, roundLabel] of matchups) {
    if (home === "BYE" || away === "BYE") continue;

    let assigned = false;
    for (const slot of slots) {
      const dateKey = slot.playDate;
      const homeOut = outDateMap.get(home)?.has(dateKey);
      const awayOut = outDateMap.get(away)?.has(dateKey);
      if (homeOut || awayOut) continue;

      if (!dayTeamCount.has(dateKey)) dayTeamCount.set(dateKey, new Map());
      const dayMap = dayTeamCount.get(dateKey)!;
      const homeCount = dayMap.get(home) || 0;
      const awayCount = dayMap.get(away) || 0;
      const homeMax = maxGamesMap.get(home) || 2;
      const awayMax = maxGamesMap.get(away) || 2;
      if (homeCount >= homeMax || awayCount >= awayMax) continue;

      const alreadyUsed = result.some((r) =>
        r.scheduledAt &&
        slot.playDate === new Date(r.scheduledAt).toISOString().split("T")[0] &&
        r.fieldId === slot.fieldId &&
        new Date(r.scheduledAt).toTimeString().startsWith(slot.startTime)
      );
      if (alreadyUsed) continue;

      const timeConflict = result.some((r) =>
        r.scheduledAt &&
        slot.playDate === new Date(r.scheduledAt).toISOString().split("T")[0] &&
        new Date(r.scheduledAt).toTimeString().startsWith(slot.startTime) &&
        (r.homeTeamId === home || r.homeTeamId === away || r.awayTeamId === home || r.awayTeamId === away)
      );
      if (timeConflict) continue;

      result.push({
        tournamentId,
        homeTeamId: home,
        awayTeamId: away,
        fieldId: slot.fieldId,
        scheduledAt: new Date(`${dateKey}T${slot.startTime}:00`),
        round: roundLabel || String(roundNum),
        status: "scheduled",
      });
      dayMap.set(home, homeCount + 1);
      dayMap.set(away, awayCount + 1);
      assigned = true;
      roundNum++;
      break;
    }
    if (!assigned) {
      warnings.push({ type: "unscheduled_match", message: `Could not find a slot for ${home} vs ${away} (${roundLabel})` });
      result.push({
        tournamentId,
        homeTeamId: home,
        awayTeamId: away,
        fieldId: null,
        scheduledAt: null,
        round: roundLabel || String(roundNum),
        status: "scheduled",
      });
      roundNum++;
    }
  }

  if (result.length > 0 && slots.length > 0) {
    const scheduledCount = result.filter(m => m.scheduledAt).length;
    if (scheduledCount < result.length) {
      warnings.push({
        type: "insufficient_slots",
        message: `${result.length - scheduledCount} of ${result.length} matches could not be assigned a time slot`,
      });
    }
  }

  return result;
}

export async function saveSchedule(tournamentId: string, matches: ScheduleMatch[]): Promise<Array<InferSelectModel<typeof matchesTable>>> {
  const existingMatches = await db.select().from(matchesTable).where(eq(matchesTable.tournamentId, tournamentId));

  const lockedMatchIds = new Set(
    existingMatches.filter(m => m.isLocked).map(m => m.id)
  );

  if (lockedMatchIds.size > 0) {
    const unlocked = existingMatches.filter(m => !m.isLocked);
    for (const m of unlocked) {
      await db.delete(matchesTable).where(eq(matchesTable.id, m.id));
    }
  } else {
    await db.delete(matchesTable).where(eq(matchesTable.tournamentId, tournamentId));
  }

  const inserted: Array<InferSelectModel<typeof matchesTable>> = [];
  for (const m of matches) {
    const [row] = await db.insert(matchesTable).values({
      tournamentId: m.tournamentId,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      fieldId: m.fieldId,
      scheduledAt: m.scheduledAt,
      round: m.round,
      status: m.status || "scheduled",
    } as typeof matchesTable.$inferInsert).returning();
    inserted.push(row);
  }

  const lockedMatches = existingMatches.filter(m => m.isLocked);
  return [...lockedMatches, ...inserted];
}
