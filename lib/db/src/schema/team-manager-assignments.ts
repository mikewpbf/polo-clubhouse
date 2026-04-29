import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { teamsTable } from "./teams";
import { tournamentsTable } from "./tournaments";
import { assignmentStatusEnum } from "./enums";

export const teamManagerAssignmentsTable = pgTable("team_manager_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => usersTable.id),
  teamId: uuid("team_id").references(() => teamsTable.id).notNull(),
  tournamentId: uuid("tournament_id").references(() => tournamentsTable.id),
  assignedBy: uuid("assigned_by").references(() => usersTable.id),
  inviteEmail: varchar("invite_email", { length: 255 }),
  status: assignmentStatusEnum("status").default("pending_invite"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

export const insertTeamManagerAssignmentSchema = createInsertSchema(teamManagerAssignmentsTable).omit({ id: true, createdAt: true });
export type InsertTeamManagerAssignment = z.infer<typeof insertTeamManagerAssignmentSchema>;
export type TeamManagerAssignment = typeof teamManagerAssignmentsTable.$inferSelect;
