import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { matchShareLinksTable, matchesTable, teamsTable, tournamentsTable, clubsTable } from "@workspace/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { requireAuth, requireMatchWrite } from "../lib/auth";

const router: IRouter = Router();

const ALLOWED_PAGE_TYPES = new Set(["score", "stats", "gfx"]);

// Compute the natural expiration for a new share link based on the match's
// schedule. Falls back to 6 hours from "now" if no scheduled time is known.
function computeExpiry(match: {
  scheduledAt: Date | null;
  scheduledEnd?: Date | null;
}): Date {
  const now = Date.now();
  const minExpiry = now + 6 * 3600_000;
  let candidate = minExpiry;
  if ((match as any).scheduledEnd) {
    candidate = new Date((match as any).scheduledEnd).getTime() + 6 * 3600_000;
  } else if (match.scheduledAt) {
    candidate = new Date(match.scheduledAt).getTime() + 4 * 3600_000;
  }
  return new Date(Math.max(candidate, minExpiry));
}

function newToken(): string {
  // URL-safe ~32 chars (24 bytes -> 32 base64url chars).
  return crypto.randomBytes(24).toString("base64url");
}

// List all share links for a match (admin only — share-token holders cannot list other links).
router.get(
  "/matches/:matchId/share-links",
  requireMatchWrite("score", "stats", "gfx"),
  async (req, res) => {
    try {
      // Block share-token callers from listing — admin auth only.
      if (req.share && !req.user) { res.status(403).json({ message: "Admin access required" }); return; }
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
        active: l.active && !l.revokedAt && (!l.expiresAt || new Date(l.expiresAt).getTime() > Date.now()),
      })));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  },
);

// Create a new share link for a given page type.
router.post(
  "/matches/:matchId/share-links",
  requireMatchWrite("score", "stats", "gfx"),
  async (req, res) => {
    try {
      if (req.share && !req.user) { res.status(403).json({ message: "Admin access required" }); return; }
      const matchId = String(req.params.matchId);
      const { pageType, label } = req.body || {};
      if (!ALLOWED_PAGE_TYPES.has(pageType)) {
        res.status(400).json({ message: "pageType must be score, stats, or gfx" }); return;
      }
      const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
      if (!match) { res.status(404).json({ message: "Match not found" }); return; }

      const token = newToken();
      const expiresAt = computeExpiry(match as any);
      const [link] = await db.insert(matchShareLinksTable).values({
        matchId,
        pageType,
        token,
        label: label ? String(label).slice(0, 120) : null,
        createdBy: req.user?.id ?? null,
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
  requireMatchWrite("score", "stats", "gfx"),
  async (req, res) => {
    try {
      if (req.share && !req.user) { res.status(403).json({ message: "Admin access required" }); return; }
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
router.get("/share/:token", async (req, res) => {
  try {
    const token = String(req.params.token);
    const [link] = await db.select().from(matchShareLinksTable).where(eq(matchShareLinksTable.token, token));
    if (!link) { res.status(404).json({ message: "Share link not found" }); return; }
    if (!link.active || link.revokedAt) { res.status(410).json({ message: "Share link revoked" }); return; }
    if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
      res.status(410).json({ message: "Share link expired" }); return;
    }

    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, link.matchId));
    if (!match) { res.status(404).json({ message: "Match not found" }); return; }
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
