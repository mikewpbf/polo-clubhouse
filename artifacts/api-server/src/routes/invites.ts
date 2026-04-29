import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { userInvitesTable, teamManagerAssignmentsTable, adminClubMembershipsTable, tournamentsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, isSuperAdmin } from "../lib/auth";
import crypto from "crypto";

const router: IRouter = Router();

async function requireClubAdminForInvite(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }

  const { clubId, tournamentId } = req.body;
  let resolvedClubId = clubId;

  if (!resolvedClubId && tournamentId) {
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }
    resolvedClubId = tournament.clubId;
  }

  if (!resolvedClubId) { res.status(400).json({ message: "clubId or tournamentId required" }); return; }

  const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user.id));
  if (!memberships.some(m => m.clubId === resolvedClubId)) {
    res.status(403).json({ message: "Club admin access required to send invites" }); return;
  }

  next();
}

router.post("/invites/team-manager", requireAuth, requireClubAdminForInvite, async (req, res) => {
  try {
    const { email, teamId, tournamentId } = req.body;
    const token = crypto.randomBytes(12).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [assignment] = await db.insert(teamManagerAssignmentsTable).values({
      teamId,
      tournamentId,
      assignedBy: req.user!.id,
      inviteEmail: email,
      status: "pending_invite",
    }).returning();

    const [invite] = await db.insert(userInvitesTable).values({
      email,
      teamManagerAssignmentId: assignment.id,
      token,
      expiresAt,
      sentBy: req.user!.id,
    }).returning();

    res.status(201).json(invite);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/invites/admin", requireAuth, requireClubAdminForInvite, async (req, res) => {
  try {
    const { email, clubId } = req.body;
    const token = crypto.randomBytes(12).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [invite] = await db.insert(userInvitesTable).values({
      email,
      clubMembershipClubId: clubId,
      token,
      expiresAt,
      sentBy: req.user!.id,
    }).returning();

    res.status(201).json(invite);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/invites", requireAuth, async (req, res) => {
  try {
    const invites = await db.select().from(userInvitesTable).where(eq(userInvitesTable.sentBy, req.user!.id));
    res.json(invites);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/invites/:token", async (req, res) => {
  try {
    const token = String(req.params.token);
    const [invite] = await db.select().from(userInvitesTable).where(eq(userInvitesTable.token, token));
    if (!invite) { res.status(404).json({ message: "Invite not found" }); return; }
    if (invite.usedAt) { res.status(400).json({ message: "Invite already used" }); return; }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      res.status(400).json({ message: "Invite expired" }); return;
    }
    res.json({ email: invite.email, type: invite.teamManagerAssignmentId ? "team_manager" : "admin" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/invites/accept", requireAuth, async (req, res) => {
  try {
    const { token: inviteToken } = req.body;
    if (!inviteToken) { res.status(400).json({ message: "Token is required" }); return; }

    const [invite] = await db.select().from(userInvitesTable).where(eq(userInvitesTable.token, inviteToken));
    if (!invite) { res.status(404).json({ message: "Invite not found" }); return; }
    if (invite.usedAt) { res.status(400).json({ message: "Invite already used" }); return; }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      res.status(400).json({ message: "Invite expired" }); return;
    }
    if (invite.email && invite.email !== req.user!.email) {
      res.status(403).json({ message: "This invite was sent to a different email address" }); return;
    }

    if (invite.teamManagerAssignmentId) {
      await db.update(teamManagerAssignmentsTable).set({
        userId: req.user!.id,
        status: "active",
        acceptedAt: new Date(),
      }).where(eq(teamManagerAssignmentsTable.id, invite.teamManagerAssignmentId));
    }

    if (invite.clubMembershipClubId) {
      await db.insert(adminClubMembershipsTable).values({
        userId: req.user!.id,
        clubId: invite.clubMembershipClubId,
        role: "manager",
      }).onConflictDoNothing();
    }

    await db.update(userInvitesTable).set({
      usedAt: new Date(),
    }).where(eq(userInvitesTable.id, invite.id));

    res.json({ message: "Invite accepted" });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.post("/invites/:token/accept", requireAuth, async (req, res) => {
  try {
    const inviteToken = String(req.params.token);

    const [invite] = await db.select().from(userInvitesTable).where(eq(userInvitesTable.token, inviteToken));
    if (!invite) { res.status(404).json({ message: "Invite not found" }); return; }
    if (invite.usedAt) { res.status(400).json({ message: "Invite already used" }); return; }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      res.status(400).json({ message: "Invite expired" }); return;
    }
    if (invite.email && invite.email !== req.user!.email) {
      res.status(403).json({ message: "This invite was sent to a different email address" }); return;
    }

    if (invite.teamManagerAssignmentId) {
      await db.update(teamManagerAssignmentsTable).set({
        userId: req.user!.id,
        status: "active",
        acceptedAt: new Date(),
      }).where(eq(teamManagerAssignmentsTable.id, invite.teamManagerAssignmentId));
    }

    if (invite.clubMembershipClubId) {
      await db.insert(adminClubMembershipsTable).values({
        userId: req.user!.id,
        clubId: invite.clubMembershipClubId,
        role: "manager",
      }).onConflictDoNothing();
    }

    await db.update(userInvitesTable).set({
      usedAt: new Date(),
    }).where(eq(userInvitesTable.id, invite.id));

    res.json({ message: "Invite accepted" });
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

export default router;
