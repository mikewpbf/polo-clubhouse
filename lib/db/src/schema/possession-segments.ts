import { pgTable, uuid, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";
import { usersTable } from "./users";

export const possessionSegmentsTable = pgTable("possession_segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").references(() => matchesTable.id).notNull(),
  possessionState: varchar("possession_state", { length: 20 }).notNull(),
  chukker: integer("chukker"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertPossessionSegmentSchema = createInsertSchema(possessionSegmentsTable).omit({ id: true, createdAt: true });
export type InsertPossessionSegment = z.infer<typeof insertPossessionSegmentSchema>;
export type PossessionSegment = typeof possessionSegmentsTable.$inferSelect;
