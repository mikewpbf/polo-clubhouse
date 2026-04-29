import { pgTable, uuid, integer, varchar, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tournamentsTable } from "./tournaments";
import { teamsTable } from "./teams";

export const tournamentTeamsTable = pgTable("tournament_teams", {
  tournamentId: uuid("tournament_id").references(() => tournamentsTable.id).notNull(),
  teamId: uuid("team_id").references(() => teamsTable.id).notNull(),
  seed: integer("seed"),
  groupLabel: varchar("group_label", { length: 10 }),
  maxGamesPerDay: integer("max_games_per_day").default(2),
  manualWins: integer("manual_wins"),
  manualLosses: integer("manual_losses"),
  manualNetGoals: integer("manual_net_goals"),
  manualGrossGoals: integer("manual_gross_goals"),
}, (table) => [
  primaryKey({ columns: [table.tournamentId, table.teamId] }),
]);

export const insertTournamentTeamSchema = createInsertSchema(tournamentTeamsTable);
export type InsertTournamentTeam = z.infer<typeof insertTournamentTeamSchema>;
export type TournamentTeam = typeof tournamentTeamsTable.$inferSelect;
