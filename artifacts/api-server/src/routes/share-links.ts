import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { matchShareLinksTable, matchesTable, teamsTable, tournamentsTable, clubsTable } from "@workspace/db/schema";
import { and, eq, desc, isNull } from "drizzle-orm";
import { requireMatchWrite } from "../lib/auth";

const router: IRouter = Router();

type SharePageType = "stats" | "gfx";
const ALLOWED_PAGE_TYPES = new Set<SharePageType>(["stats", "gfx"]);

// Compute the natural expiration for a new share link based on the match's
// schedule. Floor-clamped to (now + 6h) so links are never born already
// expired for past-scheduled matches.
function computeExpiry(match: { scheduledAt: Date | null }): Date {
  const now = Date.now();
  const minExpiry = now + 6 * 3600_000;
  const candidate = match.scheduledAt
    ? new Date(match.scheduledAt).getTime() + 4 * 3600_000
    : minExpiry;
  return new Date(Math.max(candidate, minExpiry));
}

function newToken(): string {
  // URL-safe ~32 chars (24 bytes -> 32 base64url chars).
  return crypto.randomBytes(24).toString("base64url");
}

// Block share-token callers (no req.user) from administering share links.
// Only authenticated club admins or super-admins may list/create/revoke.
function isAdminCaller(req: { user?: unknown; share?: unknown }): boolean {
  return Boolean(req.user) && !req.share;
}

// List all share links for a match (admin only).
router.get(
  "/matches/:matchId/share-links",
  requireMatchWrite("stats", "gfx"),
  async (req, res) => {
    try {
      if (!isAdminCaller(req)) { res.status(403).json({ message: "Admin access required" }); return; }
      const matchId = String(req.params.matchId);
      const links = await db.select().from(matchShareLinksTable)
        .where(eq(matchShareLinksTable.matchId, matchId))
        .orderBy(desc(matchShareLinksTable.createdAt));
      res.json(links.map((l) => ({
        id: l.id,
        pageType: l.pageType,
        token: l.token,
        label: l.label,
        createdAt: l.createdAt,
        expiresAt: l.expiresAt,
        revokedAt: l.revokedAt,
        active: !l.revokedAt && (!l.expiresAt || new Date(l.expiresAt).getTime() > Date.now()),
      })));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  },
);

// Create (or regenerate) a share link for a given page type. Any previous
// active link for the same (match, pageType) is automatically revoked so that
// only one link per page type is ever live at a time.
router.post(
  "/matches/:matchId/share-links",
  requireMatchWrite("stats", "gfx"),
  async (req, res) => {
    try {
      if (!isAdminCaller(req)) { res.status(403).json({ message: "Admin access required" }); return; }
      const matchId = String(req.params.matchId);
      const { pageType, label } = req.body || {};
      if (!ALLOWED_PAGE_TYPES.has(pageType as SharePageType)) {
        res.status(400).json({ message: "pageType must be 'stats' or 'gfx'" });
        return;
      }
      const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      if (!match) { res.status(404).json({ message: "Match not found" }); return; }

      // Revoke any previous active link for this (match, pageType) — one live link at a time.
      await db.update(matchShareLinksTable)
        .set({ active: false, revokedAt: new Date() })
        .where(and(
          eq(matchShareLinksTable.matchId, matchId),
          eq(matchShareLinksTable.pageType, pageType as SharePageType),
          isNull(matchShareLinksTable.revokedAt),
        ));

      const token = newToken();
      const expiresAt = computeExpiry(match);
      const userId = req.user?.id ?? null;
      const [link] = await db.insert(matchShareLinksTable).values({
        matchId,
        pageType: pageType as SharePageType,
        token,
        label: label ? String(label).slice(0, 120) : null,
        createdBy: userId,
        expiresAt,
        active: true,
      }).returning();
      res.status(201).json({
        id: link.id,
        pageType: link.pageType,
        token: link.token,
        label: link.label,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
        revokedAt: link.revokedAt,
        active: true,
      });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  },
);

// Revoke (soft-delete) a share link.
router.delete(
  "/matches/:matchId/share-links/:linkId",
  requireMatchWrite("stats", "gfx"),
  async (req, res) => {
    try {
      if (!isAdminCaller(req)) { res.status(403).json({ message: "Admin access required" }); return; }
      const matchId = String(req.params.matchId);
      const linkId = String(req.params.linkId);
      const [link] = await db.select().from(matchShareLinksTable).where(eq(matchShareLinksTable.id, linkId));
      if (!link || link.matchId !== matchId) { res.status(404).json({ message: "Share link not found" }); return; }
      await db.update(matchShareLinksTable).set({ active: false, revokedAt: new Date() }).where(eq(matchShareLinksTable.id, linkId));
      res.json({ message: "revoked" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  },
);

// Public token resolver — used by the share-mode pages to bootstrap their match context.
// Returns explicit "revoked" or "expired" status codes so the UI can show a clear message.
router.get("/share/:token", async (req, res) => {
  try {
    const token = String(req.params.token);
    const [link] = await db.select().from(matchShareLinksTable).where(eq(matchShareLinksTable.token, token));
    if (!link) { res.status(404).json({ message: "Share link not found", reason: "not_found" }); return; }
    if (link.revokedAt) { res.status(410).json({ message: "This share link has been revoked.", reason: "revoked" }); return; }
    if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
      res.status(410).json({ message: "This share link has expired.", reason: "expired" }); return;
    }

    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, link.matchId));
    if (!match) { res.status(404).json({ message: "Match not found", reason: "match_missing" }); return; }
    const homeTeam = match.homeTeamId ? (await db.select().from(teamsTable).where(eq(teamsTable.id, match.homeTeamId)))[0] : null;
    const awayTeam = match.awayTeamId ? (await db.select().from(teamsTable).where(eq(teamsTable.id, match.awayTeamId)))[0] : null;
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, match.tournamentId));
    const club = tournament?.clubId
      ? (await db.select().from(clubsTable).where(eq(clubsTable.id, tournament.clubId)))[0]
      : null;

    res.json({
      pageType: link.pageType,
      matchId: link.matchId,
      expiresAt: link.expiresAt,
      label: link.label,
      match: {
        id: match.id,
        status: match.status,
        homeTeam: homeTeam ? { name: homeTeam.name, shortName: homeTeam.shortName, primaryColor: homeTeam.primaryColor, logoUrl: homeTeam.logoUrl } : null,
        awayTeam: awayTeam ? { name: awayTeam.name, shortName: awayTeam.shortName, primaryColor: awayTeam.primaryColor, logoUrl: awayTeam.logoUrl } : null,
        tournament: tournament ? { id: tournament.id, name: tournament.name, clubId: tournament.clubId, clubName: club?.name || "" } : null,
      },
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
