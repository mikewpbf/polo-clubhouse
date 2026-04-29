import { pgTable, uuid, varchar, decimal, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";

export const playersTable = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").references(() => teamsTable.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  handicap: decimal("handicap"),
  position: integer("position"),
  isActive: boolean("is_active").default(true).notNull(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
