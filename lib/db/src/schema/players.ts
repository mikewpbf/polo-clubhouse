import { pgTable, uuid, varchar, decimal, boolean, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clubsTable } from "./clubs";
import { usersTable } from "./users";

export const playersTable = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  handicap: decimal("handicap"),
  isActive: boolean("is_active").default(true).notNull(),
  headshotUrl: text("headshot_url"),
  // Original full-resolution upload preserved alongside the cropped JPEG so
  // owners/admins can re-crop without re-uploading the source photo.
  headshotSourceUrl: text("headshot_source_url"),
  broadcastImageUrl: text("broadcast_image_url"),
  // Same purpose as headshotSourceUrl — original of the cropped broadcast aux
  // image, kept private (only readable by owner / club admin / super_admin).
  broadcastImageSourceUrl: text("broadcast_image_source_url"),
  dateOfBirth: date("date_of_birth"),
  homeClubId: uuid("home_club_id").references(() => clubsTable.id),
  bio: text("bio"),
  managedByUserId: uuid("managed_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
