import { pgTable, uuid, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { clubsTable } from "./clubs";

export const producerClubMembershipsTable = pgTable("producer_club_memberships", {
  userId: uuid("user_id").references(() => usersTable.id).notNull(),
  clubId: uuid("club_id").references(() => clubsTable.id).notNull(),
  assignedBy: uuid("assigned_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.clubId] }),
]);

export const insertProducerClubMembershipSchema = createInsertSchema(producerClubMembershipsTable).omit({ createdAt: true });
export type InsertProducerClubMembership = z.infer<typeof insertProducerClubMembershipSchema>;
export type ProducerClubMembership = typeof producerClubMembershipsTable.$inferSelect;
