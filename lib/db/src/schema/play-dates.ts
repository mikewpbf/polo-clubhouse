import { pgTable, uuid, date, time, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tournamentsTable } from "./tournaments";

export const playDatesTable = pgTable("play_dates", {
  id: uuid("id").defaultRandom().primaryKey(),
  tournamentId: uuid("tournament_id").references(() => tournamentsTable.id).notNull(),
  date: date("date").notNull(),
  startTime: time("start_time"),
  endTime: time("end_time"),
  fieldIds: jsonb("field_ids"),
  lunchStart: time("lunch_start"),
  lunchEnd: time("lunch_end"),
});

export const insertPlayDateSchema = createInsertSchema(playDatesTable).omit({ id: true });
export type InsertPlayDate = z.infer<typeof insertPlayDateSchema>;
export type PlayDate = typeof playDatesTable.$inferSelect;
