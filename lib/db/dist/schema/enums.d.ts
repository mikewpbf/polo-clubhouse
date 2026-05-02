export declare const tournamentFormatEnum: import("drizzle-orm/pg-core").PgEnum<["round_robin", "single_elim", "double_elim", "group_knockout", "swiss"]>;
export declare const tournamentStatusEnum: import("drizzle-orm/pg-core").PgEnum<["draft", "published", "in_progress", "completed", "archived"]>;
export declare const matchStatusEnum: import("drizzle-orm/pg-core").PgEnum<["scheduled", "live", "halftime", "final", "postponed", "cancelled"]>;
export declare const userRoleEnum: import("drizzle-orm/pg-core").PgEnum<["spectator", "team_manager", "admin", "super_admin"]>;
export declare const clubMembershipRoleEnum: import("drizzle-orm/pg-core").PgEnum<["owner", "manager"]>;
export declare const assignmentStatusEnum: import("drizzle-orm/pg-core").PgEnum<["pending_invite", "active", "revoked"]>;
export declare const scoringLocationEnum: import("drizzle-orm/pg-core").PgEnum<["studio", "field"]>;
export declare const matchEventTypeEnum: import("drizzle-orm/pg-core").PgEnum<["goal", "score_correction", "chukker_start", "chukker_end", "match_start", "match_end", "clock_start", "clock_pause", "penalty", "horse_change", "safety", "injury_timeout", "bowl_in", "knock_in", "foul", "penalty_goal", "shot_on_goal", "penalty_in", "penalty_out", "throw_in_won", "foul_committed", "fouls_won"]>;
export declare const sharePageTypeEnum: import("drizzle-orm/pg-core").PgEnum<["stats", "gfx", "scoreboard", "full_control"]>;
//# sourceMappingURL=enums.d.ts.map