import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { teamManagerAssignmentsTable } from "./team-manager-assignments";

export const userInvitesTable = pgTable("user_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }),
  teamManagerAssignmentId: uuid("team_manager_assignment_id").references(() => teamManagerAssignmentsTable.id),
  clubMembershipUserId: uuid("club_membership_user_id"),
  clubMembershipClubId: uuid("club_membership_club_id"),
  token: varchar("token", { length: 255 }).unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  sentBy: uuid("sent_by").references(() => usersTable.id),
});

export const insertUserInviteSchema = createInsertSchema(userInvitesTable).omit({ id: true });
export type InsertUserInvite = z.infer<typeof insertUserInviteSchema>;
export type UserInvite = typeof userInvitesTable.$inferSelect;
