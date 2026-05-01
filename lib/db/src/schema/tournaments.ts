import { pgTable, uuid, varchar, date, integer, boolean, jsonb, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clubsTable } from "./clubs";
import { tournamentFormatEnum, tournamentStatusEnum } from "./enums";

export const tournamentsTable = pgTable("tournaments", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").references(() => clubsTable.id),
  name: varchar("name", { length: 255 }).notNull(),
  logoUrl: text("logo_url"),
  format: tournamentFormatEnum("format"),
  handicapLevel: varchar("handicap_level", { length: 50 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  finalsDate: date("finals_date"),
  status: tournamentStatusEnum("status").default("draft"),
  matchDurationMin: integer("match_duration_min").default(90),
  gapBetweenMin: integer("gap_between_min").default(20),
  chukkersPerMatch: integer("chukkers_per_match").default(6),
  chukkerDurationMinutes: integer("chukker_duration_minutes").default(7),
  hasThirdPlace: boolean("has_third_place").default(true),
  scheduleConfig: jsonb("schedule_config"),
  aiRecommendation: jsonb("ai_recommendation"),
  isVisitingLeague: boolean("is_visiting_league").default(false),
  sponsored: boolean("sponsored").default(false),
  sponsoredRank: integer("sponsored_rank").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  mvpTeamId: uuid("mvp_team_id"),
  mvpPlayerId: uuid("mvp_player_id"),
  mvpGamesOverride: integer("mvp_games_override"),
  mvpGoalsOverride: integer("mvp_goals_override"),
  bppTeamId: uuid("bpp_team_id"),
  bppPlayerId: uuid("bpp_player_id"),
  bppHorseId: uuid("bpp_horse_id"),
  bppDisplaySettings: jsonb("bpp_display_settings"),
  bppGamesOverride: integer("bpp_games_override"),
});

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({ id: true, createdAt: true });
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournamentsTable.$inferSelect;
