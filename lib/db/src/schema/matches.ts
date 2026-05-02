import { pgTable, uuid, varchar, integer, boolean, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tournamentsTable } from "./tournaments";
import { teamsTable } from "./teams";
import { fieldsTable } from "./fields";
import { matchStatusEnum, scoringLocationEnum } from "./enums";

export const matchesTable = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  tournamentId: uuid("tournament_id").references(() => tournamentsTable.id).notNull(),
  homeTeamId: uuid("home_team_id").references(() => teamsTable.id),
  awayTeamId: uuid("away_team_id").references(() => teamsTable.id),
  fieldId: uuid("field_id").references(() => fieldsTable.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  homeScore: integer("home_score").default(0),
  awayScore: integer("away_score").default(0),
  currentChukker: integer("current_chukker").default(1),
  clockStartedAt: timestamp("clock_started_at", { withTimezone: true }),
  clockElapsedSeconds: integer("clock_elapsed_seconds").default(0),
  clockIsRunning: boolean("clock_is_running").default(false),
  status: matchStatusEnum("status").default("scheduled"),
  round: varchar("round", { length: 100 }),
  bracketPosition: integer("bracket_position"),
  isLocked: boolean("is_locked").default(false),
  notes: text("notes"),
  broadcastVisible: boolean("broadcast_visible").default(false),
  broadcastStyle: varchar("broadcast_style", { length: 20 }).default("option1"),
  broadcastResolution: varchar("broadcast_resolution", { length: 10 }).default("4k"),
  broadcast4kScale: integer("broadcast_4k_scale").default(100),
  broadcast4kOffsetX: integer("broadcast_4k_offset_x").default(0),
  broadcast4kOffsetY: integer("broadcast_4k_offset_y").default(0),
  broadcastChannel: varchar("broadcast_channel", { length: 8 }),
  lastGoalScorerName: varchar("last_goal_scorer_name", { length: 255 }),
  lastGoalTeamSide: varchar("last_goal_team_side", { length: 10 }),
  lastGoalTimestamp: timestamp("last_goal_timestamp", { withTimezone: true }),
  streamUrl: text("stream_url"),
  possessionToken: varchar("possession_token", { length: 64 }),
  streamStartedAt: timestamp("stream_started_at", { withTimezone: true }),
  scoringLocation: scoringLocationEnum("scoring_location").notNull().default("studio"),
  broadcastOffsetSeconds: numeric("broadcast_offset_seconds", { precision: 6, scale: 2 }).notNull().default("0"),
  previewImageUrl: text("preview_image_url"),
  previewImageUpdatedAt: timestamp("preview_image_updated_at", { withTimezone: true }),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({ id: true });
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
