import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, adminClubMembershipsTable, teamManagerAssignmentsTable, userInvitesTable, spectatorFollowsTable, pushSubscriptionsTable } from "@workspace/db/schema";
import { eq, ilike, or, count } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../lib/auth";
import { sendEmail, welcomeEmailHtml } from "../lib/email";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const router: IRouter = Router();

router.get("/admin/users", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const role = req.query.role as string | undefined;

    let users;
    if (search) {
      users = await db.select({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        phone: usersTable.phone,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      }).from(usersTable).where(
        or(
          ilike(usersTable.email, `%${search}%`),
          ilike(usersTable.displayName, `%${search}%`)
        )
      );
    } else {
      users = await db.select({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        phone: usersTable.phone,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      }).from(usersTable);
    }

    if (role) {
      users = users.filter((u: any) => u.role === role);
    }

    res.json(users);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.put("/admin/users/:userId/role", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const userId = String(req.params.userId);
    const { role } = req.body;
    const validRoles = ["spectator", "team_manager", "admin", "super_admin"];
    if (!validRoles.includes(role)) {
      res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
      return;
    }
    if (userId === req.user!.id && role !== "super_admin") {
      res.status(400).json({ message: "Cannot change your own role" });
      return;
    }
    const [user] = await db.update(usersTable).set({ role }).where(eq(usersTable.id, userId)).returning({
      id: usersTable.id,
      email: usersTable.email,
      displayName: usersTable.displayName,
      role: usersTable.role,
    });
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    res.json(user);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.delete("/admin/users/:userId", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const userId = String(req.params.userId);
    if (userId === req.user!.id) {
      res.status(400).json({ message: "Cannot delete your own account" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ message: "User not found" }); return; }

    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
    await db.delete(spectatorFollowsTable).where(eq(spectatorFollowsTable.userId, userId));
    await db.delete(userInvitesTable).where(eq(userInvitesTable.sentBy, userId));
    await db.delete(teamManagerAssignmentsTable).where(eq(teamManagerAssignmentsTable.userId, userId));
    await db.delete(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));

    res.json({ message: "User deleted" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/admin/users/invite", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { email, displayName, role, password } = req.body;
    if (!email) { res.status(400).json({ message: "Email is required" }); return; }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing.length > 0) {
      res.status(400).json({ message: "A user with this email already exists" });
      return;
    }

    const validRoles = ["spectator", "team_manager", "admin", "super_admin"];
    const userRole = validRoles.includes(role) ? role : "spectator";

    const tempPassword = password || crypto.randomBytes(6).toString("hex");
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const [user] = await db.insert(usersTable).values({
      email,
      displayName: displayName || email.split("@")[0],
      role: userRole,
      passwordHash,
    }).returning({
      id: usersTable.id,
      email: usersTable.email,
      displayName: usersTable.displayName,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    });

    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["host"] || "localhost";
    const loginUrl = `${protocol}://${host}/login`;

    sendEmail({
      to: email,
      subject: "Welcome to Polo Clubhouse",
      html: welcomeEmailHtml({
        displayName: user.displayName || email,
        email,
        tempPassword,
        loginUrl,
      }),
    }).catch((err) => console.error("[Email] Welcome email failed:", err));

    res.status(201).json({ ...user, tempPassword });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
