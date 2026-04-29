import { pgTable, uuid, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { clubsTable } from "./clubs";
import { clubMembershipRoleEnum } from "./enums";

export const adminClubMembershipsTable = pgTable("admin_club_memberships", {
  userId: uuid("user_id").references(() => usersTable.id).notNull(),
  clubId: uuid("club_id").references(() => clubsTable.id).notNull(),
  role: clubMembershipRoleEnum("role").notNull(),
  assignedBy: uuid("assigned_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.clubId] }),
]);

export const insertAdminClubMembershipSchema = createInsertSchema(adminClubMembershipsTable).omit({ createdAt: true });
export type InsertAdminClubMembership = z.infer<typeof insertAdminClubMembershipSchema>;
export type AdminClubMembership = typeof adminClubMembershipsTable.$inferSelect;
