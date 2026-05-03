import { pgTable, uuid, varchar, text, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clubsTable } from "./clubs";

export const teamsTable = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").references(() => clubsTable.id),
  name: varchar("name", { length: 255 }).notNull(),
  shortName: varchar("short_name", { length: 8 }),
  logoUrl: text("logo_url"),
  logoThumbUrl: text("logo_thumb_url"),
  primaryColor: varchar("primary_color", { length: 7 }),
  handicap: decimal("handicap"),
  scoreboardName: varchar("scoreboard_name", { length: 12 }),
  contactName: varchar("contact_name", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  notes: text("notes"),
  jerseyImageUrl: text("jersey_image_url"),
});

export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
