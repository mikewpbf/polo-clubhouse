import { pgTable, uuid, varchar, integer, decimal, boolean, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clubsTable } from "./clubs";

export const fieldsTable = pgTable("fields", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").references(() => clubsTable.id).notNull(),
  name: varchar("name", { length: 255 }),
  number: integer("number"),
  lat: decimal("lat"),
  lng: decimal("lng"),
  zipcode: varchar("zipcode", { length: 20 }),
  imageUrl: text("image_url"),
  surfaceType: varchar("surface_type", { length: 100 }),
  isActive: boolean("is_active").default(true),
});

export const insertFieldSchema = createInsertSchema(fieldsTable).omit({ id: true });
export type InsertField = z.infer<typeof insertFieldSchema>;
export type Field = typeof fieldsTable.$inferSelect;
