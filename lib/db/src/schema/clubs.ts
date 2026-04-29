import { pgTable, uuid, varchar, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clubsTable = pgTable("clubs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).unique().notNull(),
  logoUrl: text("logo_url"),
  logo96Url: text("logo_96_url"),
  logo40Url: text("logo_40_url"),
  logoInitials: varchar("logo_initials", { length: 2 }),
  description: text("description"),
  website: varchar("website", { length: 500 }),
  country: varchar("country", { length: 100 }),
  region: varchar("region", { length: 100 }),
  sponsored: boolean("sponsored").default(false),
  sponsoredRank: integer("sponsored_rank").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertClubSchema = createInsertSchema(clubsTable).omit({ id: true, createdAt: true });
export type InsertClub = z.infer<typeof insertClubSchema>;
export type Club = typeof clubsTable.$inferSelect;
