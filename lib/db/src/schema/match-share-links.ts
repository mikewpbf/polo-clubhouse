import { pgTable, uuid, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { matchesTable } from "./matches";
import { usersTable } from "./users";
import { sharePageTypeEnum } from "./enums";

export const matchShareLinksTable = pgTable("match_share_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").references(() => matchesTable.id, { onDelete: "cascade" }).notNull(),
  pageType: sharePageTypeEnum("page_type").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  label: varchar("label", { length: 120 }),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
});

export type MatchShareLink = typeof matchShareLinksTable.$inferSelect;
