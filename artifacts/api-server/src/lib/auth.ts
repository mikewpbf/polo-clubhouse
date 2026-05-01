import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable, adminClubMembershipsTable, teamManagerAssignmentsTable, clubsTable, teamsTable, matchesTable, tournamentsTable, matchShareLinksTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return "polo-manager-dev-secret-not-for-production";
})();

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export type SharePageType = "stats" | "gfx" | "scoreboard" | "full_control";
export interface ShareAuth {
  shareLinkId: string;
  matchId: string;
  pageType: SharePageType;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      share?: ShareAuth;
    }
  }
}

export function isSuperAdmin(user?: AuthUser | null): boolean {
  return user?.role === "super_admin";
}

export function generateToken(user: { id: string; email: string; displayName: string; role: string }): string {
  return jwt.sign({ id: user.id, email: user.email, displayName: user.displayName, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  const token = authHeader.substring(7);
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }
  req.user = user;
  next();
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  if (!isSuperAdmin(req.user)) {
    res.status(403).json({ message: "Super admin access required" });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  if (isSuperAdmin(req.user)) {
    next();
    return;
  }
  const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user.id));
  if (memberships.length === 0) {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
}

export async function requireClubAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  if (isSuperAdmin(req.user)) {
    next();
    return;
  }
  const clubId = String(req.params.clubId);
  if (!clubId) {
    next();
    return;
  }
  const memberships = await db.select().from(adminClubMembershipsTable).where(
    eq(adminClubMembershipsTable.userId, req.user.id)
  );
  const hasAccess = memberships.some(m => m.clubId === clubId);
  if (!hasAccess) {
    res.status(403).json({ message: "You don't have admin access to this club" });
    return;
  }
  next();
}

// Resolve and validate a share token from header or query string.
// Returns the share-link metadata if active, not revoked, not expired; otherwise null.
export async function resolveShareToken(req: Request): Promise<ShareAuth | null> {
  const raw = (req.header("x-share-token") || req.query.shareToken || "").toString().trim();
  if (!raw) return null;
  const [link] = await db.select().from(matchShareLinksTable).where(eq(matchShareLinksTable.token, raw));
  if (!link) return null;
  if (!link.active || link.revokedAt) return null;
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) return null;
  return {
    shareLinkId: link.id,
    matchId: link.matchId,
    pageType: link.pageType as SharePageType,
  };
}

// True if user is a club admin for the match's tournament club, or super admin.
async function userCanAdminMatch(userId: string, matchId: string): Promise<boolean> {
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) return false;
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, match.tournamentId));
  if (!tournament) return false;
  const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, userId));
  return memberships.some(m => m.clubId === tournament.clubId);
}

// Match-admin middleware: requires a real authenticated admin (no share token).
// Use this for routes whose semantics are admin-only (e.g. score/clock/chukker/
// goal/undo-goal/clock-adjust, match config, etc.).
export function requireMatchAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const matchId = String(req.params.matchId);
    if (!matchId) { res.status(400).json({ message: "matchId required" }); return; }
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ message: "Authentication required" }); return;
    }
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) { res.status(401).json({ message: "Invalid or expired token" }); return; }
    req.user = user;
    if (isSuperAdmin(user)) { next(); return; }
    const ok = await userCanAdminMatch(user.id, matchId);
    if (!ok) { res.status(403).json({ message: "Club admin access required to modify match" }); return; }
    next();
  };
}

// Match-write middleware: allows EITHER an authenticated club-admin (or super-admin)
// for the match in :matchId, OR a valid share token bound to that match.
// The share token must belong to one of `allowedPages` (default: stats+gfx).
export function requireMatchWrite(...allowedPages: SharePageType[]) {
  const allow: Set<SharePageType> = allowedPages.length
    ? new Set(allowedPages)
    : new Set<SharePageType>(["stats", "gfx"]);
  return async (req: Request, res: Response, next: NextFunction) => {
    const matchId = String(req.params.matchId);
    if (!matchId) { res.status(400).json({ message: "matchId required" }); return; }

    // Try a share token first (for share-mode operators).
    const share = await resolveShareToken(req);
    if (share) {
      if (share.matchId !== matchId) {
        res.status(403).json({ message: "Share token does not authorize this match" }); return;
      }
      if (!allow.has(share.pageType)) {
        res.status(403).json({ message: "Share link cannot perform this action" }); return;
      }
      req.share = share;
      next();
      return;
    }

    // Fall back to standard authenticated path.
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ message: "Authentication required" }); return;
    }
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (!user) { res.status(401).json({ message: "Invalid or expired token" }); return; }
    req.user = user;

    if (isSuperAdmin(user)) { next(); return; }
    const ok = await userCanAdminMatch(user.id, matchId);
    if (!ok) { res.status(403).json({ message: "Club admin access required to modify match" }); return; }
    next();
  };
}

export async function getUserWithRoles(userId: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;

  const clubMemberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, userId));
  const teamAssignments = await db.select().from(teamManagerAssignmentsTable).where(eq(teamManagerAssignmentsTable.userId, userId));

  const clubDetails = await Promise.all(
    clubMemberships.map(async (m) => {
      const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, m.clubId));
      return {
        clubId: m.clubId,
        clubName: club?.name || "",
        clubSlug: club?.slug || "",
        role: m.role,
      };
    })
  );

  const teamDetails = await Promise.all(
    teamAssignments.map(async (a) => {
      const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, a.teamId));
      return {
        assignmentId: a.id,
        teamId: a.teamId,
        teamName: team?.name || "",
        tournamentId: a.tournamentId,
        status: a.status,
      };
    })
  );

  return {
    id: user.id,
    email: user.email || "",
    displayName: user.displayName || "",
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role || "spectator",
    clubMemberships: clubDetails,
    teamAssignments: teamDetails,
  };
}
