import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable, adminClubMembershipsTable, teamManagerAssignmentsTable, clubsTable, teamsTable } from "@workspace/db/schema";
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

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
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
