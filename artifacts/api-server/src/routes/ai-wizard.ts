import { Router, type IRouter } from "express";
import { requireAuth, requireSuperAdmin } from "../lib/auth";
import { db } from "@workspace/db";
import { clubsTable, teamsTable, tournamentsTable, fieldsTable, playersTable, teamPlayersTable, tournamentTeamsTable, matchesTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import OpenAI from "openai";

const router: IRouter = Router();

function getOpenAIClient() {
  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error("AI integration not configured");
  }
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

function fuzzyGet(map: Map<string, string>, key: string | undefined | null): string | undefined {
  if (!key) return undefined;
  const lower = key.toLowerCase().trim();
  const exact = map.get(lower);
  if (exact) return exact;
  for (const [k, v] of map.entries()) {
    if (k.includes(lower) || lower.includes(k)) return v;
    const kNorm = k.replace(/[–—\-]/g, " ").replace(/\s+/g, " ").trim();
    const lNorm = lower.replace(/[–—\-]/g, " ").replace(/\s+/g, " ").trim();
    if (kNorm.includes(lNorm) || lNorm.includes(kNorm)) return v;
  }
  return undefined;
}

const SYSTEM_PROMPT = `You are a data extraction assistant for a polo tournament management system. 
Given raw text about polo clubs, teams, tournaments, and fields, extract structured data.

Return a JSON object with these arrays (any can be empty if not found in the text):

{
  "clubs": [
    {
      "name": "string (required)",
      "slug": "string (auto-generated lowercase-hyphenated from name)",
      "description": "string or null",
      "website": "string or null",
      "country": "string or null",
      "region": "string or null"
    }
  ],
  "teams": [
    {
      "name": "string (required)",
      "clubName": "string (name of the club this team belongs to - must match a club name from the clubs array or an existing club)",
      "shortName": "string or null (2-4 letter abbreviation)",
      "primaryColor": "string or null (hex color like #FF0000)",
      "handicap": "number or null (team handicap rating)",
      "contactName": "string or null",
      "contactPhone": "string or null",
      "players": [
        {
          "name": "string (required - the player's FULL NAME as a text string, e.g. 'John Smith'. NEVER put a number here.)",
          "handicap": "number or null (individual player handicap rating, e.g. 10)"
        }
      ],
      "tournamentNames": ["array of tournament names this team is participating in - use the EXACT tournament name from the tournaments array"]
    }
  ],
  "tournaments": [
    {
      "name": "string (required - use the EXACT name from the existing tournaments list if it matches, otherwise use the name from the text)",
      "clubName": "string (name of the club hosting this tournament)",
      "format": "one of: round_robin, single_elim, double_elim, swiss, group_knockout",
      "handicapLevel": "string or null (e.g. '0-4 goals', '12-16 goals')",
      "startDate": "YYYY-MM-DD or null",
      "endDate": "YYYY-MM-DD or null",
      "chukkersPerMatch": "number or null (typically 4-8)",
      "teamNames": ["array of team names participating in this tournament - use EXACT team names from the teams array"]
    }
  ],
  "fields": [
    {
      "name": "string (required)",
      "clubName": "string (name of the club this field belongs to)",
      "number": "number or null",
      "surfaceType": "string or null (e.g. 'grass', 'turf', 'sand')"
    }
  ],
  "matches": [
    {
      "tournamentName": "string (EXACT name of the tournament - must match the tournament name in the tournaments array or existing tournaments)",
      "homeTeamName": "string (EXACT name of the home team - must match team names in the teams array)",
      "awayTeamName": "string (EXACT name of the away team - must match team names in the teams array)",
      "scheduledDate": "YYYY-MM-DD or null",
      "scheduledTime": "HH:MM or null (24-hour format)",
      "fieldName": "string or null (name of the field)",
      "round": "string or null (e.g. 'Preliminary', 'Semifinals', 'Final')"
    }
  ],
  "warnings": ["array of strings for anything the AI couldn't parse or was ambiguous"]
}

Important rules:
- Only extract data that is clearly present in the text. Do not invent data.
- CRITICAL: If a tournament name in the text closely matches an existing tournament (e.g. "Madelon Bourdieu – 6 Goal Tournament" matches existing "Madelon Bourdieu"), use the EXACT existing tournament name. Do NOT create a new tournament with a slightly different name.
- Similarly, if teams mentioned in the text already exist (check existing teams list), use the EXACT existing team name.
- If a team mentions a club that isn't in the text, still reference it by name in clubName.
- For tournament format, default to "round_robin" if not specified.
- For dates, try to parse various formats. If a year isn't specified, assume 2026.
- Generate reasonable slugs from club names (lowercase, hyphens, no special chars).
- IMPORTANT: When the text mentions player names on a team (e.g. "Black Watch: Facundo Pieres 10, Hilario Ulloa 10"), extract each player with their FULL NAME (text string like "Facundo Pieres") in the "name" field and their handicap (number like 10) in the "handicap" field. The "name" field must ALWAYS be the player's actual name, NEVER a number.
- When teams are listed under a tournament or in a schedule, include those team names in the tournament's teamNames array AND the tournament name in each team's tournamentNames array.
- If a schedule/draw is provided with matchups, extract them into the matches array. For matches where both teams are known, include them. For matches where one or both teams are not yet determined (e.g. "Final" without specific teams), use "TBD" as the team name.
- ALL team name references across teams, tournaments, and matches MUST be consistent and exact.
- Return ONLY valid JSON, no markdown fences or explanation.`;

router.post("/admin/ai/parse-setup", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim().length < 10) {
      res.status(400).json({ message: "Please provide at least 10 characters of text to parse." });
      return;
    }

    const existingClubs = await db.select({ id: clubsTable.id, name: clubsTable.name, slug: clubsTable.slug }).from(clubsTable);
    const existingTeams = await db.select({ id: teamsTable.id, name: teamsTable.name, clubId: teamsTable.clubId }).from(teamsTable);
    const existingTournaments = await db.select({ id: tournamentsTable.id, name: tournamentsTable.name, clubId: tournamentsTable.clubId }).from(tournamentsTable);

    const userPrompt = `Here is existing data in the system for context. IMPORTANT: If you find a match for an existing item, use the EXACT name as listed below. Do not create duplicates with slightly different names.

Existing clubs: ${existingClubs.map(c => `"${c.name}" (slug: ${c.slug})`).join(", ") || "None"}
Existing teams: ${existingTeams.map(t => `"${t.name}"`).join(", ") || "None"}
Existing tournaments: ${existingTournaments.map(t => `"${t.name}"`).join(", ") || "None"}

Now parse the following raw text and extract polo club/team/tournament/field data. Be thorough - extract ALL player names, team rosters, tournament assignments, and schedule data:

${text}`;

    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      res.status(500).json({ message: "AI returned empty response. Please try again." });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      res.status(500).json({ message: "AI returned invalid JSON. Please try again." });
      return;
    }

    parsed.clubs = parsed.clubs || [];
    parsed.teams = parsed.teams || [];
    parsed.tournaments = parsed.tournaments || [];
    parsed.fields = parsed.fields || [];
    parsed.matches = parsed.matches || [];
    parsed.warnings = parsed.warnings || [];

    const existingSlugs = new Set(existingClubs.map(c => c.slug));
    parsed.clubs = parsed.clubs.filter((c: any) => !existingSlugs.has(c.slug));

    const existingClubNames = new Set(existingClubs.map(c => c.name.toLowerCase()));
    parsed.clubs = parsed.clubs.filter((c: any) => !existingClubNames.has(c.name.toLowerCase()));

    for (const m of parsed.matches) {
      if (!m.homeTeamName) m.homeTeamName = "TBD";
      if (!m.awayTeamName) m.awayTeamName = "TBD";
    }

    res.json(parsed);
  } catch (e: any) {
    console.error("AI parse error:", e);
    res.status(500).json({ message: e.message || "Failed to parse text with AI" });
  }
});

router.post("/admin/ai/execute-setup", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { clubs, teams, tournaments, fields, matches } = req.body;
    const results = {
      clubs: { created: 0, errors: [] as string[] },
      teams: { created: 0, errors: [] as string[] },
      players: { created: 0, errors: [] as string[] },
      tournaments: { created: 0, errors: [] as string[] },
      fields: { created: 0, errors: [] as string[] },
      tournamentTeams: { created: 0, errors: [] as string[] },
      matches: { created: 0, errors: [] as string[] },
    };

    const existingClubs = await db.select({ id: clubsTable.id, name: clubsTable.name, slug: clubsTable.slug }).from(clubsTable);
    const clubMap = new Map<string, string>();
    for (const c of existingClubs) {
      clubMap.set(c.name.toLowerCase(), c.id);
      clubMap.set(c.slug.toLowerCase(), c.id);
    }

    const existingTeamsDb = await db.select({ id: teamsTable.id, name: teamsTable.name, clubId: teamsTable.clubId }).from(teamsTable);
    const teamMap = new Map<string, string>();
    for (const t of existingTeamsDb) {
      teamMap.set(t.name.toLowerCase(), t.id);
    }

    const existingTournamentsDb = await db.select({ id: tournamentsTable.id, name: tournamentsTable.name, clubId: tournamentsTable.clubId }).from(tournamentsTable);
    const tournamentMap = new Map<string, string>();
    for (const t of existingTournamentsDb) {
      tournamentMap.set(t.name.toLowerCase(), t.id);
    }

    const existingFieldsDb = await db.select({ id: fieldsTable.id, name: fieldsTable.name, clubId: fieldsTable.clubId }).from(fieldsTable);
    const fieldMap = new Map<string, string>();
    for (const f of existingFieldsDb) {
      fieldMap.set(f.name.toLowerCase(), f.id);
    }

    // 1. Create clubs first
    if (Array.isArray(clubs)) {
      for (const club of clubs) {
        try {
          if (!club.name) continue;
          const slug = club.slug || club.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          if (clubMap.has(club.name.toLowerCase()) || clubMap.has(slug.toLowerCase())) {
            results.clubs.errors.push(`"${club.name}" already exists, skipped`);
            continue;
          }
          const [created] = await db.insert(clubsTable).values({
            name: club.name,
            slug,
            description: club.description || null,
            website: club.website || null,
            country: club.country || null,
            region: club.region || null,
          }).returning({ id: clubsTable.id });
          clubMap.set(club.name.toLowerCase(), created.id);
          clubMap.set(slug.toLowerCase(), created.id);
          results.clubs.created++;
        } catch (e: any) {
          results.clubs.errors.push(`"${club.name}": ${e.message}`);
        }
      }
    }

    // 2. Create fields
    if (Array.isArray(fields)) {
      for (const f of fields) {
        try {
          if (!f.name) continue;
          const clubId = fuzzyGet(clubMap, f.clubName);
          if (!clubId) {
            results.fields.errors.push(`"${f.name}": club "${f.clubName}" not found`);
            continue;
          }
          const existingField = await db.select({ id: fieldsTable.id }).from(fieldsTable)
            .where(and(eq(fieldsTable.clubId, clubId), eq(fieldsTable.name, f.name)));
          if (existingField.length > 0) {
            fieldMap.set(f.name.toLowerCase(), existingField[0].id);
            results.fields.errors.push(`"${f.name}" already exists in this club, skipped`);
            continue;
          }
          const [created] = await db.insert(fieldsTable).values({
            name: f.name,
            clubId,
            number: f.number || null,
            surfaceType: f.surfaceType || null,
          }).returning({ id: fieldsTable.id });
          fieldMap.set(f.name.toLowerCase(), created.id);
          results.fields.created++;
        } catch (e: any) {
          results.fields.errors.push(`"${f.name}": ${e.message}`);
        }
      }
    }

    // 3. Create tournaments BEFORE teams (so team→tournament links work)
    if (Array.isArray(tournaments)) {
      for (const t of tournaments) {
        try {
          if (!t.name) continue;
          const clubId = fuzzyGet(clubMap, t.clubName);
          if (!clubId) {
            results.tournaments.errors.push(`"${t.name}": club "${t.clubName}" not found`);
            continue;
          }

          let tournId = fuzzyGet(tournamentMap, t.name);
          if (!tournId) {
            const existingTournament = await db.select({ id: tournamentsTable.id }).from(tournamentsTable)
              .where(and(eq(tournamentsTable.clubId, clubId), eq(tournamentsTable.name, t.name)));
            if (existingTournament.length > 0) {
              tournId = existingTournament[0].id;
              tournamentMap.set(t.name.toLowerCase(), tournId);
              results.tournaments.errors.push(`"${t.name}" already exists in this club, skipped`);
            } else {
              const [created] = await db.insert(tournamentsTable).values({
                name: t.name,
                clubId,
                format: t.format || "round_robin",
                handicapLevel: t.handicapLevel || null,
                startDate: t.startDate || null,
                endDate: t.endDate || null,
                chukkersPerMatch: t.chukkersPerMatch || 6,
                status: "draft",
              }).returning({ id: tournamentsTable.id });
              tournId = created.id;
              tournamentMap.set(t.name.toLowerCase(), tournId);
              results.tournaments.created++;
            }
          }

          // Link teams that are already in the system
          if (Array.isArray(t.teamNames) && tournId) {
            for (const teamName of t.teamNames) {
              const tId = fuzzyGet(teamMap, teamName);
              if (tId) {
                try {
                  const existing = await db.select().from(tournamentTeamsTable)
                    .where(and(eq(tournamentTeamsTable.tournamentId, tournId), eq(tournamentTeamsTable.teamId, tId)));
                  if (existing.length === 0) {
                    await db.insert(tournamentTeamsTable).values({ tournamentId: tournId, teamId: tId });
                    results.tournamentTeams.created++;
                  }
                } catch (e: any) {
                  results.tournamentTeams.errors.push(`Link "${teamName}" to "${t.name}": ${e.message}`);
                }
              }
            }
          }
        } catch (e: any) {
          results.tournaments.errors.push(`"${t.name}": ${e.message}`);
        }
      }
    }

    // 4. Create teams and players, link to tournaments
    if (Array.isArray(teams)) {
      for (const team of teams) {
        try {
          if (!team.name) continue;
          const clubId = fuzzyGet(clubMap, team.clubName);
          if (!clubId) {
            results.teams.errors.push(`"${team.name}": club "${team.clubName}" not found`);
            continue;
          }

          let teamId = fuzzyGet(teamMap, team.name);
          if (!teamId) {
            const existingTeam = await db.select({ id: teamsTable.id }).from(teamsTable)
              .where(and(eq(teamsTable.clubId, clubId), eq(teamsTable.name, team.name)));
            if (existingTeam.length > 0) {
              teamId = existingTeam[0].id;
              teamMap.set(team.name.toLowerCase(), teamId);
              results.teams.errors.push(`"${team.name}" already exists in this club, skipped`);
            } else {
              const [created] = await db.insert(teamsTable).values({
                name: team.name,
                clubId,
                shortName: team.shortName || null,
                primaryColor: team.primaryColor || null,
                handicap: team.handicap != null ? String(team.handicap) : null,
                contactName: team.contactName || null,
                contactPhone: team.contactPhone || null,
              }).returning({ id: teamsTable.id });
              teamId = created.id;
              teamMap.set(team.name.toLowerCase(), teamId);
              results.teams.created++;
            }
          }

          if (Array.isArray(team.players) && team.players.length > 0 && teamId) {
            // Players are top-level entities; rosters live in team_players. Skip a
            // wizard import if the team already has someone with that name on the
            // current-season roster.
            const seasonYear = new Date().getUTCFullYear();
            const existingLinks = await db.select({ playerId: teamPlayersTable.playerId })
              .from(teamPlayersTable)
              .where(and(eq(teamPlayersTable.teamId, teamId), eq(teamPlayersTable.seasonYear, seasonYear)));
            const existingNames = new Set<string>();
            const linkedIds = existingLinks.map(l => l.playerId).filter((x): x is string => !!x);
            if (linkedIds.length > 0) {
              const linkedPlayers = await db.select({ name: playersTable.name })
                .from(playersTable).where(inArray(playersTable.id, linkedIds));
              for (const p of linkedPlayers) existingNames.add(p.name);
            }
            for (const player of team.players) {
              try {
                if (!player.name) continue;
                if (existingNames.has(player.name)) continue;
                const [created] = await db.insert(playersTable).values({
                  name: player.name,
                  handicap: player.handicap != null ? String(player.handicap) : null,
                  isActive: true,
                }).returning({ id: playersTable.id });
                await db.insert(teamPlayersTable).values({
                  teamId,
                  playerId: created.id,
                  seasonYear,
                }).onConflictDoNothing();
                results.players.created++;
              } catch (e: any) {
                results.players.errors.push(`"${player.name}" on "${team.name}": ${e.message}`);
              }
            }
          }

          if (Array.isArray(team.tournamentNames) && teamId) {
            for (const tName of team.tournamentNames) {
              const tId = fuzzyGet(tournamentMap, tName);
              if (tId) {
                try {
                  const existing = await db.select().from(tournamentTeamsTable)
                    .where(and(eq(tournamentTeamsTable.tournamentId, tId), eq(tournamentTeamsTable.teamId, teamId)));
                  if (existing.length === 0) {
                    await db.insert(tournamentTeamsTable).values({ tournamentId: tId, teamId: teamId });
                    results.tournamentTeams.created++;
                  }
                } catch (e: any) {
                  results.tournamentTeams.errors.push(`Link "${team.name}" to "${tName}": ${e.message}`);
                }
              }
            }
          }
        } catch (e: any) {
          results.teams.errors.push(`"${team.name}": ${e.message}`);
        }
      }
    }

    // 5. Create matches
    if (Array.isArray(matches)) {
      for (const m of matches) {
        try {
          const tournId = fuzzyGet(tournamentMap, m.tournamentName);
          if (!tournId) {
            results.matches.errors.push(`Match "${m.homeTeamName || 'TBD'} vs ${m.awayTeamName || 'TBD'}": tournament "${m.tournamentName}" not found`);
            continue;
          }
          const isTbdHome = !m.homeTeamName || m.homeTeamName.toUpperCase() === "TBD";
          const isTbdAway = !m.awayTeamName || m.awayTeamName.toUpperCase() === "TBD";
          const homeId = isTbdHome ? null : fuzzyGet(teamMap, m.homeTeamName);
          const awayId = isTbdAway ? null : fuzzyGet(teamMap, m.awayTeamName);
          if (!isTbdHome && !homeId) {
            results.matches.errors.push(`Match "${m.homeTeamName} vs ${m.awayTeamName || 'TBD'}": home team "${m.homeTeamName}" not found`);
            continue;
          }
          if (!isTbdAway && !awayId) {
            results.matches.errors.push(`Match "${m.homeTeamName || 'TBD'} vs ${m.awayTeamName}": away team "${m.awayTeamName}" not found`);
            continue;
          }
          const fId = m.fieldName ? fuzzyGet(fieldMap, m.fieldName) || null : null;

          let scheduledAt: Date | null = null;
          if (m.scheduledDate) {
            const dateStr = m.scheduledTime ? `${m.scheduledDate}T${m.scheduledTime}:00Z` : `${m.scheduledDate}T10:00:00Z`;
            scheduledAt = new Date(dateStr);
          }

          await db.insert(matchesTable).values({
            tournamentId: tournId,
            homeTeamId: homeId,
            awayTeamId: awayId,
            fieldId: fId,
            scheduledAt,
            round: m.round || null,
            status: "scheduled",
          });
          results.matches.created++;
        } catch (e: any) {
          results.matches.errors.push(`Match "${m.homeTeamName} vs ${m.awayTeamName}": ${e.message}`);
        }
      }
    }

    res.json(results);
  } catch (e: any) {
    console.error("Execute setup error:", e);
    res.status(500).json({ message: e.message || "Failed to execute setup" });
  }
});

export default router;
