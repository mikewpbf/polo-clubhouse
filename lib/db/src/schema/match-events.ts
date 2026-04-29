import { pgTable, uuid, integer, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";
import { teamsTable } from "./teams";
import { usersTable } from "./users";
import { playersTable } from "./players";
import { matchEventTypeEnum } from "./enums";

export const matchEventsTable = pgTable("match_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").references(() => matchesTable.id).notNull(),
  eventType: matchEventTypeEnum("event_type").notNull(),
  teamId: uuid("team_id").references(() => teamsTable.id),
  playerId: uuid("player_id").references(() => playersTable.id),
  playerName: varchar("player_name", { length: 255 }),
  chukker: integer("chukker"),
  clockSeconds: integer("clock_seconds"),
  description: varchar("description", { length: 255 }),
  scoreSnapshot: jsonb("score_snapshot"),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertMatchEventSchema = createInsertSchema(matchEventsTable).omit({ id: true, createdAt: true });
export type InsertMatchEvent = z.infer<typeof insertMatchEventSchema>;
export type MatchEvent = typeof matchEventsTable.$inferSelect;
