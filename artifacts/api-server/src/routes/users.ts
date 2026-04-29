import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, adminClubMembershipsTable } from "@workspace/db/schema";
import { eq, ilike, or } from "drizzle-orm";
import { requireAuth, isSuperAdmin } from "../lib/auth";

const router: IRouter = Router();

// Authorize callers that may search the user directory for autocomplete pickers
// (e.g. the "link a user account" picker on a player record). We deliberately
// allow any club admin — not just super_admins — because this endpoint exists
// to power the player→user link UI on the admin player page, which club admins
// of the player's home club must be able to use. Spectators / team managers /
// unauthenticated callers are rejected to avoid leaking the user directory.
async function requireAdminOrClubAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }
  const memberships = await db.select().from(adminClubMembershipsTable)
    .where(eq(adminClubMembershipsTable.userId, req.user.id));
  if (memberships.length === 0) {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
}

router.get("/users/search", requireAuth, requireAdminOrClubAdmin, async (req, res) => {
  try {
    const q = (req.query.q as string | undefined)?.trim() ?? "";
    const limit = Math.max(1, Math.min(20, Number(req.query.limit ?? 10)));
    if (!q) { res.json([]); return; }
    const rows = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      displayName: usersTable.displayName,
      role: usersTable.role,
    }).from(usersTable).where(or(
      ilike(usersTable.email, `%${q}%`),
      ilike(usersTable.displayName, `%${q}%`),
    )).limit(limit);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
