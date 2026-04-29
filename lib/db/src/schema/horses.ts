import { pgTable, uuid, varchar, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const horsesTable = pgTable("horses", {
  id: uuid("id").defaultRandom().primaryKey(),
  playerId: uuid("player_id").references(() => playersTable.id, { onDelete: "cascade" }).notNull(),
  horseName: varchar("horse_name", { length: 255 }).notNull(),
  owner: varchar("owner", { length: 255 }),
  breeder: varchar("breeder", { length: 255 }),
  ownedAndBredBy: varchar("owned_and_bred_by", { length: 255 }),
  sire: varchar("sire", { length: 255 }),
  dam: varchar("dam", { length: 255 }),
  age: integer("age"),
  color: varchar("color", { length: 50 }),
  sex: varchar("sex", { length: 20 }),
  typeOrBreed: varchar("type_or_breed", { length: 255 }),
  notes: text("notes"),
});

export const HORSE_SEX_OPTIONS = ["Mare", "Gelding", "Stallion"] as const;
export const HORSE_COLOR_OPTIONS = ["Bay", "Chestnut", "Liver Chestnut", "Gray", "Black", "Paint", "Other"] as const;

export const insertHorseSchema = createInsertSchema(horsesTable).omit({ id: true });
export type InsertHorse = z.infer<typeof insertHorseSchema>;
export type Horse = typeof horsesTable.$inferSelect;
