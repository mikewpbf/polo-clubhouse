import { pgTable, uuid, date, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";
import { tournamentsTable } from "./tournaments";
import { usersTable } from "./users";

export const teamOutDatesTable = pgTable("team_out_dates", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").references(() => teamsTable.id).notNull(),
  tournamentId: uuid("tournament_id").references(() => tournamentsTable.id),
  outDate: date("out_date").notNull(),
  reason: varchar("reason", { length: 500 }),
  createdByUserId: uuid("created_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertTeamOutDateSchema = createInsertSchema(teamOutDatesTable).omit({ id: true, createdAt: true });
export type InsertTeamOutDate = z.infer<typeof insertTeamOutDateSchema>;
export type TeamOutDate = typeof teamOutDatesTable.$inferSelect;
