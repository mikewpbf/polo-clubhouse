import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const apiKeysTable = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  clientKind: varchar("client_kind", { length: 32 }).notNull(),
  keyHash: varchar("key_hash", { length: 128 }).notNull().unique(),
  keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export type ApiKey = typeof apiKeysTable.$inferSelect;
