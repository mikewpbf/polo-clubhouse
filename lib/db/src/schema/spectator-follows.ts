import { pgTable, uuid, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { clubsTable } from "./clubs";

export const spectatorFollowsTable = pgTable("spectator_follows", {
  userId: uuid("user_id").references(() => usersTable.id).notNull(),
  clubId: uuid("club_id").references(() => clubsTable.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.clubId] }),
]);

export const insertSpectatorFollowSchema = createInsertSchema(spectatorFollowsTable).omit({ createdAt: true });
export type InsertSpectatorFollow = z.infer<typeof insertSpectatorFollowSchema>;
export type SpectatorFollow = typeof spectatorFollowsTable.$inferSelect;
