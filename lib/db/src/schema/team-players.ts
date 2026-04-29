import { pgTable, uuid, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";
import { playersTable } from "./players";

export const teamPlayersTable = pgTable("team_players", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").references(() => teamsTable.id, { onDelete: "cascade" }).notNull(),
  playerId: uuid("player_id").references(() => playersTable.id, { onDelete: "cascade" }).notNull(),
  seasonYear: integer("season_year").notNull(),
  position: integer("position"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  unique("team_players_team_player_season_unique").on(t.teamId, t.playerId, t.seasonYear),
]);

export const insertTeamPlayerSchema = createInsertSchema(teamPlayersTable).omit({ id: true, createdAt: true });
export type InsertTeamPlayer = z.infer<typeof insertTeamPlayerSchema>;
export type TeamPlayer = typeof teamPlayersTable.$inferSelect;
