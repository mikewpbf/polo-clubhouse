import { db } from "@workspace/db";
import { tournamentsTable, adminClubMembershipsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import type { AuthUser } from "./auth";
import { isSuperAdmin } from "./auth";

// "draft" and "test" are admin-only tournament statuses. Public/spectator
// surfaces (lists, detail pages, /matches/:id, OG cards, club pages) must
// hide tournaments and matches in these statuses. Super admins always see
// everything; club admins of the tournament's club see their own.
export const HIDDEN_TOURNAMENT_STATUSES = ["draft", "test"] as const;

export function isHiddenStatus(status: string | null | undefined): boolean {
  return status === "draft" || status === "test";
}

// Resolve admin access for a single tournament. Returns true if the user is
// a super admin or a club admin of the tournament's owning club. Cheap
// enough to call inline because we already have the tournament loaded.
export async function userCanAdminTournament(
  user: AuthUser | null | undefined,
  tournament: { clubId: string | null },
): Promise<boolean> {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (!tournament.clubId) return false;
  const memberships = await db
    .select()
    .from(adminClubMembershipsTable)
    .where(eq(adminClubMembershipsTable.userId, user.id));
  return memberships.some(m => m.clubId === tournament.clubId);
}

// True when the requesting user may see this tournament (and its matches).
// Public if not hidden; otherwise only super admins + club admins of the
// owning club.
export async function userCanSeeTournament(
  user: AuthUser | null | undefined,
  tournament: { status: string | null; clubId: string | null },
): Promise<boolean> {
  if (!isHiddenStatus(tournament.status)) return true;
  return userCanAdminTournament(user, tournament);
}

// Convenience: load + check by tournamentId. Returns the tournament if
// visible to the user, else null. Caller decides 404 vs alternative.
export async function loadVisibleTournament(
  user: AuthUser | null | undefined,
  tournamentId: string,
) {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));
  if (!tournament) return null;
  const ok = await userCanSeeTournament(user, tournament);
  return ok ? tournament : null;
}

// For routes that look up a match: returns true if the parent tournament
// is visible to the user. Used to gate /matches/:id and its sub-routes.
export async function userCanSeeMatchTournament(
  user: AuthUser | null | undefined,
  match: { tournamentId: string },
): Promise<boolean> {
  const [tournament] = await db
    .select({ status: tournamentsTable.status, clubId: tournamentsTable.clubId })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, match.tournamentId));
  if (!tournament) return true;
  return userCanSeeTournament(user, tournament);
}

// Filter a list of tournaments to only those the user may see. Used by
// list-style endpoints (e.g. /clubs/:slug returns the club's tournaments).
export async function filterVisibleTournaments<T extends { status: string | null; clubId: string | null }>(
  user: AuthUser | null | undefined,
  tournaments: T[],
): Promise<T[]> {
  if (isSuperAdmin(user)) return tournaments;
  // Pre-fetch admin clubIds once instead of per-tournament.
  let adminClubIds = new Set<string>();
  if (user) {
    const memberships = await db
      .select()
      .from(adminClubMembershipsTable)
      .where(eq(adminClubMembershipsTable.userId, user.id));
    adminClubIds = new Set(memberships.map(m => m.clubId));
  }
  return tournaments.filter(t => {
    if (!isHiddenStatus(t.status)) return true;
    return !!(t.clubId && adminClubIds.has(t.clubId));
  });
}
