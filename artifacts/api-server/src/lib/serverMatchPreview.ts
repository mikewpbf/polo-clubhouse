import { db } from "@workspace/db";
import {
  matchesTable,
  teamsTable,
  tournamentsTable,
  fieldsTable,
  clubsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { Resvg } from "@resvg/resvg-js";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

// Server-side fallback preview-image generator.
//
// Why this exists separately from the client `BoldDiagonal` template:
// the client snap pipeline (`matchPreviewSnap.tsx`) is the source of
// truth for visual fidelity — it renders the same React component
// admins see in the Match Graphics editor. But it requires an admin
// browser session to run, so until an admin opens any admin page (or
// edits/saves the match), there is no preview at all and link-unfurls
// fall back to the team logo / generic OG image.
//
// This module fills that gap by producing a *simpler* SVG-based card
// server-side, with no DOM and no font/image fetches. It runs from a
// scheduled job (`matchPreviewBackfillJob.ts`) and from the match
// creation routes so every match has *some* preview within minutes of
// being created, with zero admin clicks. The card is intentionally
// distinct from BoldDiagonal — coloured initials instead of logos, no
// diagonal split — both because it's cheaper and because it is
// transparently the "auto-generated fallback" rather than a faithful
// copy of the editor template. The high-fidelity client snap will
// overwrite this PNG at the same storage key the next time an admin
// opens Match Graphics or saves the match in Tournaments.

const objectStorage = new ObjectStorageService();

const WIDTH = 1920;
const HEIGHT = 1080;

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!),
  );
}

// Truncate so very long team / tournament names don't blow out the
// fixed-size SVG layout. We can't measure text without a font metrics
// engine, so we cap by character count tuned for the font sizes below.
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

function initials(name: string, max = 3): string {
  const cleaned = (name || "").trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(0, max).map(p => p[0]!.toUpperCase()).join("");
  }
  return cleaned.slice(0, max).toUpperCase();
}

// Hex parser tolerant of #rgb / #rrggbb / null. Returns null if the
// input isn't a recognisable hex colour so callers can fall back.
function parseHex(hex: string | null | undefined): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const m = hex.trim().replace(/^#/, "");
  if (m.length === 3) {
    const r = parseInt(m[0]! + m[0]!, 16);
    const g = parseInt(m[1]! + m[1]!, 16);
    const b = parseInt(m[2]! + m[2]!, 16);
    if ([r, g, b].every(n => Number.isFinite(n))) return { r, g, b };
    return null;
  }
  if (m.length === 6) {
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    if ([r, g, b].every(n => Number.isFinite(n))) return { r, g, b };
    return null;
  }
  return null;
}

// WCAG-style relative-luminance threshold for picking white vs dark
// foreground text on top of a team-colour swatch.
function readableTextOn(bgHex: string | null | undefined): string {
  const c = parseHex(bgHex);
  if (!c) return "#ffffff";
  const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  return lum > 0.6 ? "#0a0a0a" : "#ffffff";
}

export interface ServerPreviewSourceData {
  homeName: string;
  awayName: string;
  homeColor: string | null;
  awayColor: string | null;
  homeShortName?: string | null;
  awayShortName?: string | null;
  headline: string;
  badge: string;
  date: string;
  time: string;
  location: string;
  accentColor: string | null;
}

export function buildMatchPreviewSvg(data: ServerPreviewSourceData): string {
  const accent = parseHex(data.accentColor) ? data.accentColor!.trim() : "#1B5E20";
  const homeBg = parseHex(data.homeColor) ? data.homeColor!.trim() : accent;
  const awayBg = parseHex(data.awayColor) ? data.awayColor!.trim() : "#374151";
  const homeText = readableTextOn(homeBg);
  const awayText = readableTextOn(awayBg);

  const homeName = escapeXml(truncate(data.homeName || "TBD", 18));
  const awayName = escapeXml(truncate(data.awayName || "TBD", 18));
  const homeInit = escapeXml(initials(data.homeShortName || data.homeName || "?"));
  const awayInit = escapeXml(initials(data.awayShortName || data.awayName || "?"));
  const headline = escapeXml(truncate(data.headline || "Match Day", 42));
  const badge = escapeXml(truncate((data.badge || "").toUpperCase(), 14));
  const date = escapeXml(truncate(data.date || "", 28));
  const time = escapeXml(truncate(data.time || "", 16));
  const location = escapeXml(truncate(data.location || "", 60));

  // Layout: centred headline + badge top, two team panels on either
  // side of a slim divider, footer with date/time/location.
  // Pure SVG primitives — no <foreignObject>, no external fonts; we
  // rely on resvg's default sans-serif fallback so the renderer never
  // needs to fetch anything off-disk.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0b1620"/>
      <stop offset="100%" stop-color="#1b2a36"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${WIDTH}" height="14" fill="${accent}"/>
  <rect x="0" y="${HEIGHT - 14}" width="${WIDTH}" height="14" fill="${accent}"/>

  ${badge ? `
  <g transform="translate(${WIDTH / 2}, 110)">
    <rect x="-180" y="-46" width="360" height="76" rx="38" ry="38" fill="${accent}" opacity="0.92"/>
    <text x="0" y="8" text-anchor="middle" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="44" font-weight="700" fill="#ffffff" letter-spacing="6">${badge}</text>
  </g>` : ""}

  <text x="${WIDTH / 2}" y="220" text-anchor="middle" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="58" font-weight="700" fill="#ffffff">${headline}</text>

  <g transform="translate(${WIDTH / 4}, ${HEIGHT / 2 + 30})">
    <circle cx="0" cy="-100" r="180" fill="${homeBg}" stroke="rgba(255,255,255,0.25)" stroke-width="6"/>
    <text x="0" y="-78" text-anchor="middle" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="140" font-weight="800" fill="${homeText}">${homeInit}</text>
    <text x="0" y="180" text-anchor="middle" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="60" font-weight="700" fill="#ffffff">${homeName}</text>
  </g>

  <g transform="translate(${WIDTH / 2}, ${HEIGHT / 2 + 30})">
    <text x="0" y="-60" text-anchor="middle" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="120" font-weight="800" fill="rgba(255,255,255,0.55)">VS</text>
    <line x1="0" y1="20" x2="0" y2="180" stroke="rgba(255,255,255,0.18)" stroke-width="4"/>
  </g>

  <g transform="translate(${(WIDTH * 3) / 4}, ${HEIGHT / 2 + 30})">
    <circle cx="0" cy="-100" r="180" fill="${awayBg}" stroke="rgba(255,255,255,0.25)" stroke-width="6"/>
    <text x="0" y="-78" text-anchor="middle" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="140" font-weight="800" fill="${awayText}">${awayInit}</text>
    <text x="0" y="180" text-anchor="middle" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="60" font-weight="700" fill="#ffffff">${awayName}</text>
  </g>

  <g transform="translate(${WIDTH / 2}, ${HEIGHT - 110})">
    ${date || time ? `<text x="0" y="-20" text-anchor="middle" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="42" font-weight="600" fill="#ffffff">${[date, time].filter(Boolean).join("  ·  ")}</text>` : ""}
    ${location ? `<text x="0" y="34" text-anchor="middle" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="32" font-weight="500" fill="rgba(255,255,255,0.75)">${location}</text>` : ""}
  </g>
</svg>`;
}

// Rasterise the SVG to a PNG buffer. Kept as its own export so tests
// can exercise rendering without DB / storage calls.
export function renderMatchPreviewPng(data: ServerPreviewSourceData): Buffer {
  const svg = buildMatchPreviewSvg(data);
  const resvg = new Resvg(svg, {
    background: "rgba(0,0,0,0)",
    fitTo: { mode: "width", value: WIDTH },
    font: {
      // IMPORTANT: @resvg/resvg-js does NOT actually bundle a fallback
      // font — with loadSystemFonts:false and no fontFiles, every <text>
      // element silently renders to nothing, producing card images with
      // colored shapes but no labels (and FB / iMessage refuse to use
      // them as link-preview thumbnails). Replit's Linux base image
      // ships DejaVu Sans at /usr/share/fonts/truetype/dejavu/, which
      // is what we point at here. A plain `loadSystemFonts: true`
      // would also work, but is slower (scans every system font dir on
      // first render) and non-deterministic across host upgrades — so
      // we explicitly load just the two TTF files we use, and fall
      // back to system scanning only if those files aren't present.
      loadSystemFonts: true,
      defaultFontFamily: "DejaVu Sans",
      fontFiles: [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
      ],
    },
  });
  return resvg.render().asPng();
}

// Build the source data from a match row + its related rows. Pulled out
// so callers (single-match generation, scheduled backfill) can share
// the same projection logic.
async function loadMatchSourceData(matchId: string): Promise<ServerPreviewSourceData | null> {
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) return null;

  const home = match.homeTeamId
    ? (await db.select().from(teamsTable).where(eq(teamsTable.id, match.homeTeamId)))[0] ?? null
    : null;
  const away = match.awayTeamId
    ? (await db.select().from(teamsTable).where(eq(teamsTable.id, match.awayTeamId)))[0] ?? null
    : null;
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, match.tournamentId));
  const club = tournament?.clubId
    ? (await db.select().from(clubsTable).where(eq(clubsTable.id, tournament.clubId)))[0] ?? null
    : null;
  const field = match.fieldId
    ? (await db.select().from(fieldsTable).where(eq(fieldsTable.id, match.fieldId)))[0] ?? null
    : null;

  let date = "";
  let time = "";
  if (match.scheduledAt) {
    try {
      const d = new Date(match.scheduledAt);
      // Use a UTC-stable, locale-independent format. The OG card shows
      // the *scheduled* slot, not the viewer's local time, so we don't
      // try to detect a timezone here.
      date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
      time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";
    } catch { /* ignore */ }
  }

  const status = (match.status || "").toLowerCase();
  const badge =
    status === "final" || status === "completed" ? "FINAL" :
    status === "live" ? "LIVE" :
    status === "halftime" ? "HALFTIME" :
    "UPCOMING";

  return {
    homeName: home?.name || "TBD",
    awayName: away?.name || "TBD",
    homeColor: home?.primaryColor ?? null,
    awayColor: away?.primaryColor ?? null,
    homeShortName: home?.shortName ?? null,
    awayShortName: away?.shortName ?? null,
    headline: tournament?.name || "Match Day",
    badge,
    date,
    time,
    location: [field?.name, club?.name].filter(Boolean).join(" — "),
    accentColor: home?.primaryColor ?? null,
  };
}

// Generates and uploads a fallback preview for a single match, then
// records the URL on the match row. Idempotent at the storage layer
// (same key per match) and at the DB layer (same row update). Returns
// `true` on success, `false` if the match doesn't exist or rendering
// failed. Always resolves — never throws — so callers can fire and
// forget without try/catch.
export async function generateAndStoreMatchPreview(matchId: string): Promise<boolean> {
  try {
    const source = await loadMatchSourceData(matchId);
    if (!source) {
      logger.warn({ matchId }, "Match preview skipped: match not found");
      return false;
    }
    const png = renderMatchPreviewPng(source);
    if (!png || png.length < 200) {
      // resvg occasionally returns a tiny / empty buffer when font
      // loading fails or the SVG silently mis-parses. Reject these so
      // we don't poison R2 with a blank PNG that link-preview scrapers
      // refuse to render.
      logger.warn({ matchId, bytes: png?.length ?? 0 }, "Match preview render produced an empty PNG");
      return false;
    }
    const filePath = `match-previews/${matchId}.png`;
    const { url } = await objectStorage.uploadPublicObject(filePath, png, "image/png");
    await db.update(matchesTable)
      .set({ previewImageUrl: url, previewImageUpdatedAt: new Date() })
      .where(eq(matchesTable.id, matchId));
    logger.info({ matchId, bytes: png.length }, "Generated server-side match preview");
    return true;
  } catch (err) {
    logger.error({ err, matchId }, "Failed to generate server-side match preview");
    return false;
  }
}

// Fire-and-forget convenience for use in route handlers — never blocks
// the user-visible response. The promise is intentionally orphaned so
// the request can reply immediately; the snap finishes (or fails
// silently) in the background.
export function scheduleMatchPreviewGeneration(matchId: string): void {
  if (!matchId) return;
  void generateAndStoreMatchPreview(matchId).catch(() => false);
}
