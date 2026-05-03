import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userSessionsTable = pgTable(
  "user_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
    refreshTokenHash: varchar("refresh_token_hash", { length: 128 }).notNull().unique(),
    deviceLabel: varchar("device_label", { length: 255 }),
    deviceId: varchar("device_id", { length: 255 }),
    platform: varchar("platform", { length: 32 }),
    clientKind: varchar("client_kind", { length: 32 }),
    userAgent: text("user_agent"),
    ip: varchar("ip", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("user_sessions_user_idx").on(table.userId)],
);

export type UserSession = typeof userSessionsTable.$inferSelect;
