import { Router, type IRouter, type Request, type Response, type NextFunction, raw } from "express";
import { db } from "@workspace/db";
import { matchesTable, tournamentsTable, adminClubMembershipsTable } from "@workspace/db/schema";
import { eq, isNull, or } from "drizzle-orm";
import { requireAuth, isSuperAdmin } from "../lib/auth";
import { ObjectStorageService } from "../lib/objectStorage";
import { generateAndStoreMatchPreview } from "../lib/serverMatchPreview";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

const MAX_PNG_BYTES = 5 * 1024 * 1024;

// Invalidate cached preview images so the next admin page mount picks the
// match up via the auto-backfill trigger in AdminLayout (see
// `triggerAdminPreviewAutoBackfill` in matchPreviewSnap.tsx) and regenerates
// the PNG silently in the background. We null both columns so the OG meta
// builder falls back to the team-logo image until the new snap arrives, and
// `/admin/match-previews/missing` lists the match for re-snap.
//
// Why invalidate rather than re-snap server-side: the snap pipeline lives in
// the browser (html-to-image needs a real DOM, and `MatchGraphicTemplates`
// is the source of truth — replicating it server-side would mean
// puppeteer/satori plus font/image loaders, doubling the maintenance
// surface). Server-side invalidation + admin-mount auto-backfill gives the
// same end-user outcome (fresh preview within seconds of the next admin
// page view) without that infrastructure cost.
//
// These are exported (not behind an HTTP route) because callers are other
// route handlers — teams.ts, tournaments.ts, fields.ts — that already
// enforce write authorization for their own resource. Wiring through HTTP
// would just double-bill the auth check.
export async function invalidateMatchPreviewsForTeam(teamId: string): Promise<void> {
  await db.update(matchesTable)
    .set({ previewImageUrl: null, previewImageUpdatedAt: null })
    .where(or(eq(matchesTable.homeTeamId, teamId), eq(matchesTable.awayTeamId, teamId)));
}

export async function invalidateMatchPreviewsForTournament(tournamentId: string): Promise<void> {
  await db.update(matchesTable)
    .set({ previewImageUrl: null, previewImageUpdatedAt: null })
    .where(eq(matchesTable.tournamentId, tournamentId));
}

// Field name appears on the BoldDiagonal preview card under "location", so a
// rename invalidates every match scheduled on that field.
export async function invalidateMatchPreviewsForField(fieldId: string): Promise<void> {
  await db.update(matchesTable)
    .set({ previewImageUrl: null, previewImageUpdatedAt: null })
    .where(eq(matchesTable.fieldId, fieldId));
}

// Single-match invalidation used by routes that mutate fields shown on the
// BoldDiagonal preview card directly on the match row — currently scheduled
// time, field assignment, and home/away team selection (PUT /matches/:matchId).
// The team/tournament/field-rename helpers above cover the indirect case
// where an entity referenced by many matches changes; this one covers the
// case where an admin reassigns a field/time/team on a single match.
export async function invalidateMatchPreview(matchId: string): Promise<void> {
  await db.update(matchesTable)
    .set({ previewImageUrl: null, previewImageUpdatedAt: null })
    .where(eq(matchesTable.id, matchId));
}

// Per-match write authorization: super-admin OR admin of the tournament's club.
// Mirrors the requireMatchAdmin pattern used elsewhere; kept local because the
// preview-image endpoint runs *before* express.json (raw body parser), so we
// can't share the matches.ts middleware factories without refactoring those.
async function requireMatchAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { res.status(401).json({ message: "Authentication required" }); return; }
  // Look up the match for *all* roles (super-admin included) so an unknown
  // matchId returns 404 consistently — otherwise super-admin would 200 the
  // upload and we'd silently no-op the UPDATE.
  const matchId = String(req.params.matchId);
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) { res.status(404).json({ message: "Match not found" }); return; }
  if (isSuperAdmin(req.user)) { next(); return; }
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, match.tournamentId));
  if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }
  const memberships = await db.select().from(adminClubMembershipsTable).where(eq(adminClubMembershipsTable.userId, req.user.id));
  if (!memberships.some(mem => mem.clubId === tournament.clubId)) {
    res.status(403).json({ message: "Club admin access required to update match preview" }); return;
  }
  next();
}

// Accept the auto-snapped PNG produced by the client-side MatchGraphicTemplates
// renderer. Stores it under a stable per-match key so the same URL is reused
// every time the preview is re-snapped, then records the public URL on the
// match row. Idempotent — safe to call repeatedly.
router.post(
  "/matches/:matchId/preview-image",
  requireAuth,
  raw({ type: ["image/png", "application/octet-stream"], limit: MAX_PNG_BYTES }),
  requireMatchAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const matchId = String(req.params.matchId);
      const body = req.body as Buffer | undefined;
      if (!body || !Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ message: "PNG body required" });
        return;
      }
      // Quick sanity check on the PNG signature so we don't store junk.
      const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (body.length < 8 || !body.subarray(0, 8).equals(PNG_SIG)) {
        res.status(400).json({ message: "Body is not a PNG" });
        return;
      }

      const filePath = `match-previews/${matchId}.png`;
      const { url } = await objectStorage.uploadPublicObject(filePath, body, "image/png");
      const updatedAt = new Date();
      await db.update(matchesTable)
        .set({ previewImageUrl: url, previewImageUpdatedAt: updatedAt })
        .where(eq(matchesTable.id, matchId));
      res.json({ previewImageUrl: url, previewImageUpdatedAt: updatedAt.toISOString() });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  },
);

// Backfill helper: returns the IDs of matches that don't yet have a saved
// preview image. The admin Match Graphics page (or a one-time deploy script)
// can iterate this list and trigger the client-side snap for each one.
router.get(
  "/admin/match-previews/missing",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userIsSuper = isSuperAdmin(req.user);
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);

      let allowedClubIds: Set<string> | null = null;
      if (!userIsSuper) {
        const memberships = await db.select().from(adminClubMembershipsTable)
          .where(eq(adminClubMembershipsTable.userId, req.user!.id));
        allowedClubIds = new Set(memberships.map(m => m.clubId));
        if (allowedClubIds.size === 0) { res.json({ matchIds: [] }); return; }
      }

      const rows = await db.select({
        id: matchesTable.id,
        tournamentId: matchesTable.tournamentId,
      }).from(matchesTable)
        .where(isNull(matchesTable.previewImageUrl))
        .limit(limit * 4);

      let filtered = rows;
      if (!userIsSuper && allowedClubIds) {
        const tournaments = await db.select().from(tournamentsTable);
        const allowedTournamentIds = new Set(
          tournaments.filter(t => t.clubId && allowedClubIds!.has(t.clubId)).map(t => t.id),
        );
        filtered = rows.filter(r => allowedTournamentIds.has(r.tournamentId));
      }

      res.json({ matchIds: filtered.slice(0, limit).map(r => r.id) });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  },
);

// Force-regenerate the server-side fallback preview for every match in a
// tournament. Used when the renderer code or fonts change and existing R2
// PNGs need to be refreshed (otherwise the auto-backfill only re-renders
// matches with `previewImageUrl IS NULL`, so the broken cached PNGs stay
// in R2 forever). Authorized for super-admin or admin of the tournament's
// club. Returns counts; never throws on individual failures so one bad
// match doesn't abort the whole regen.
router.post(
  "/tournaments/:tournamentId/regenerate-match-previews",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tournamentId = String(req.params.tournamentId);
      const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
      if (!tournament) { res.status(404).json({ message: "Tournament not found" }); return; }

      if (!isSuperAdmin(req.user)) {
        const memberships = await db.select().from(adminClubMembershipsTable)
          .where(eq(adminClubMembershipsTable.userId, req.user!.id));
        const ok = tournament.clubId && memberships.some(m => m.clubId === tournament.clubId);
        if (!ok) { res.status(403).json({ message: "Not an admin of this tournament's club" }); return; }
      }

      const matches = await db.select({ id: matchesTable.id }).from(matchesTable)
        .where(eq(matchesTable.tournamentId, tournamentId));

      let ok = 0, failed = 0;
      for (const m of matches) {
        const success = await generateAndStoreMatchPreview(m.id);
        if (success) ok++; else failed++;
      }
      res.json({ tournamentId, total: matches.length, regenerated: ok, failed });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  },
);

export default router;
