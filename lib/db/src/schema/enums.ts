import { pgEnum } from "drizzle-orm/pg-core";

export const tournamentFormatEnum = pgEnum("tournament_format", [
  "round_robin",
  "single_elim",
  "double_elim",
  "group_knockout",
  "swiss",
]);

export const tournamentStatusEnum = pgEnum("tournament_status", [
  "draft",
  "published",
  "in_progress",
  "completed",
  "archived",
]);

export const matchStatusEnum = pgEnum("match_status", [
  "scheduled",
  "live",
  "halftime",
  "final",
  "postponed",
  "cancelled",
]);

export const userRoleEnum = pgEnum("user_role", [
  "spectator",
  "team_manager",
  "admin",
  "super_admin",
]);

export const clubMembershipRoleEnum = pgEnum("club_membership_role", [
  "owner",
  "manager",
]);

export const assignmentStatusEnum = pgEnum("assignment_status", [
  "pending_invite",
  "active",
  "revoked",
]);

export const scoringLocationEnum = pgEnum("scoring_location", [
  "studio",
  "field",
]);

export const matchEventTypeEnum = pgEnum("match_event_type", [
  "goal",
  "score_correction",
  "chukker_start",
  "chukker_end",
  "match_start",
  "match_end",
  "clock_start",
  "clock_pause",
  "penalty",
  "horse_change",
  "safety",
  "injury_timeout",
  "bowl_in",
  "knock_in",
  "foul",
  "penalty_goal",
  "shot_on_goal",
  "penalty_in",
  "penalty_out",
  "throw_in_won",
  "foul_committed",
  "fouls_won",
]);

export const sharePageTypeEnum = pgEnum("share_page_type", [
  "stats",
  "gfx",
]);
