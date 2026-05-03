import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import {
  matchesTable,
  teamsTable,
  tournamentsTable,
  clubsTable,
  playersTable,
  matchShareLinksTable,
  fieldsTable,
} from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";

const BOT_UA_REGEX = /facebookexternalhit|Twitterbot|Slackbot|WhatsApp|Discordbot|LinkedInBot|embedly|Pinterest|TelegramBot|SkypeUriPreview|redditbot|Applebot|Googlebot/i;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

interface OgData {
  title: string;
  description: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageType?: string; // e.g. "image/png"
  url: string;
  type?: string;
}

function renderHtml(og: OgData): string {
  const t = escapeHtml(og.title);
  const d = escapeHtml(og.description);
  const u = escapeHtml(og.url);
  const img = og.image ? escapeHtml(og.image) : "";
  // Declaring og:image:width / height / type / alt makes Facebook, iMessage,
  // WhatsApp, LinkedIn, and others much more likely to render the thumbnail
  // synchronously instead of falling back to the bare-domain card.
  const imgMeta = img
    ? `<meta property="og:image" content="${img}">
<meta property="og:image:secure_url" content="${img}">
${og.imageType ? `<meta property="og:image:type" content="${escapeHtml(og.imageType)}">` : ""}
${og.imageWidth ? `<meta property="og:image:width" content="${og.imageWidth}">` : ""}
${og.imageHeight ? `<meta property="og:image:height" content="${og.imageHeight}">` : ""}
<meta property="og:image:alt" content="${t}">`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:site_name" content="Polo Clubhouse">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:type" content="${og.type || "website"}">
${imgMeta}
<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
${img ? `<meta name="twitter:image" content="${img}">
<meta name="twitter:image:alt" content="${t}">` : ""}
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${u}">${u}</a></p>
</body>
</html>`;
}

function originFor(req: Request): string {
  return `${req.protocol}://${req.get("host")}`;
}

function basePathFor(): string {
  return (process.env.PUBLIC_BASE_PATH || "/polo-manager").replace(/\/+$/, "");
}

function defaultOgImage(req: Request): string {
  // Honor the SPA's deployment base path. In the pnpm monorepo / Replit
  // workspace artifacts each web artifact is served under its own prefix
  // (e.g. `/polo-manager`), but a standalone deploy mounts the SPA at `/`.
  // PUBLIC_BASE_PATH lets the deploy target override; otherwise default to
  // the polo-manager prefix when present and fall back to root.
  return `${originFor(req)}${basePathFor()}/opengraph.jpg`;
}

// Convert a stored preview-image path (e.g. "/api/storage/public-objects/…")
// into a fully-qualified URL with cache-busting query string. Returns null if
// the input is empty.
function absolutePreviewUrl(req: Request, storedUrl: string | null, updatedAt: Date | null): string | null {
  if (!storedUrl) return null;
  let absolute: string;
  if (/^https?:\/\//i.test(storedUrl)) {
    absolute = storedUrl;
  } else {
    const path = storedUrl.startsWith("/") ? storedUrl : `/${storedUrl}`;
    absolute = `${originFor(req)}${path}`;
  }
  const v = updatedAt ? new Date(updatedAt).getTime() : null;
  if (v) {
    const sep = absolute.includes("?") ? "&" : "?";
    return `${absolute}${sep}v=${v}`;
  }
  return absolute;
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  scoreboard: "Scoreboard Control",
  stats: "Stats Control",
  gfx: "GFX Control",
  full_control: "Full Match Control",
};

function statusLabel(status: string | null | undefined): string {
  if (status === "live") return "LIVE";
  if (status === "halftime") return "Halftime";
  if (status === "final" || status === "completed") return "Final";
  if (status === "cancelled") return "Cancelled";
  return "Scheduled";
}

function formatScheduled(date: Date | string | null | undefined): string {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    // Compact UTC string. The OG description is read by humans inside chat
    // apps; we keep it short and unambiguous rather than locale-dependent.
    return d.toISOString().replace("T", " ").replace(/:\d\d\.\d{3}Z$/, " UTC");
  } catch {
    return "";
  }
}

async function buildMatchContext(matchId: string) {
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
  return { match, home, away, tournament: tournament ?? null, club };
}

async function buildOg(req: Request): Promise<OgData | null> {
  const fullUrl = `${originFor(req)}${req.originalUrl}`;
  const path = req.path;
  const fallbackImage = defaultOgImage(req);

  // /tournaments/:id
  let m = path.match(/^\/tournaments\/([^/]+)\/?$/);
  if (m) {
    const id = m[1];
    const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
    if (!t) return null;
    // Hidden statuses (draft / test) must not produce OG cards — those leak
    // tournament names into social-link unfurls. Fall back to the default
    // OG card so the page still has *some* preview, just nothing identifying.
    if (t.status === "draft" || t.status === "test") return null;
    const club = t.clubId
      ? (await db.select().from(clubsTable).where(eq(clubsTable.id, t.clubId)))[0] ?? null
      : null;
    return {
      title: `${t.name} — Polo Clubhouse`,
      description: `${t.name}${club ? ` at ${club.name}` : ""}. View matches, scores, and standings.`,
      url: fullUrl,
      image: club?.logoUrl || fallbackImage,
      type: "website",
    };
  }

  // /match/:id
  m = path.match(/^\/match\/([^/]+)\/?$/);
  if (m) {
    const ctx = await buildMatchContext(m[1]);
    if (!ctx) return null;
    // Same hidden-tournament guard as /tournaments/:id above.
    if (ctx.tournament?.status === "draft" || ctx.tournament?.status === "test") return null;
    const { match, home, away, tournament } = ctx;
    const homeName = home?.name || "TBD";
    const awayName = away?.name || "TBD";
    const status = statusLabel(match.status);
    let field: { name: string } | null = null;
    if (match.fieldId) {
      const rows = await db.select({ name: fieldsTable.name }).from(fieldsTable).where(eq(fieldsTable.id, match.fieldId));
      if (rows[0]?.name) field = { name: rows[0].name };
    }
    const tournamentName = tournament?.name || "";
    const scheduled = formatScheduled(match.scheduledAt);

    // Title: tournament + matchup + status. No live score (would go stale).
    const titleParts: string[] = [`${homeName} vs ${awayName}`];
    if (tournamentName) titleParts.push(tournamentName);
    titleParts.push(status);
    const title = titleParts.join(" — ");

    // Description: tournament, status, scheduled time, field. No score.
    const descParts: string[] = [];
    if (tournamentName) descParts.push(tournamentName);
    if (status === "LIVE" || status === "Halftime") {
      descParts.push(status);
    } else if (status === "Final") {
      descParts.push("Final");
    } else if (scheduled) {
      descParts.push(`Scheduled ${scheduled}`);
    } else {
      descParts.push("Scheduled");
    }
    if (field?.name) descParts.push(`Field: ${field.name}`);
    const description = descParts.join(" · ") || `${homeName} vs ${awayName}`;

    const previewImage = absolutePreviewUrl(req, match.previewImageUrl, match.previewImageUpdatedAt);
    const finalImage = previewImage || home?.logoUrl || away?.logoUrl || fallbackImage;
    // The server-rendered match preview PNG is always 1920x1080 (see
    // serverMatchPreview.ts). Declare those dims so chat apps render the
    // thumbnail without having to fetch the image to measure it.
    const isPreviewImage = finalImage === previewImage;
    return {
      title,
      description,
      url: fullUrl,
      image: finalImage,
      imageType: isPreviewImage ? "image/png" : undefined,
      imageWidth: isPreviewImage ? 1920 : undefined,
      imageHeight: isPreviewImage ? 1080 : undefined,
      type: "article",
    };
  }

  // /share/:pageType/:token
  m = path.match(/^\/share\/(stats|gfx|scoreboard|full_control)\/([^/]+)\/?$/);
  if (m) {
    const pageType = m[1];
    const token = m[2];
    const pageLabel = PAGE_TYPE_LABELS[pageType] || "Polo Clubhouse share link";

    const [link] = await db.select().from(matchShareLinksTable).where(eq(matchShareLinksTable.token, token));
    const isExpired = !!link?.expiresAt && new Date(link.expiresAt).getTime() < Date.now();
    const isRevoked = !!link?.revokedAt;
    // pageType in URL must match the link's stored pageType. Otherwise a
    // sender could craft `/share/full_control/<stats-token>` and the OG
    // card would mislabel the link's actual capability. We treat
    // mismatches the same as unknown tokens (non-leaky generic card).
    const isPageTypeMismatch = !!link && link.pageType !== pageType;
    if (!link || isExpired || isRevoked || isPageTypeMismatch) {
      // Graceful, non-leaky fallback so chat apps still render a clean card
      // without exposing match details for revoked/expired tokens.
      return {
        title: "Polo Clubhouse share link — no longer active",
        description: "This share link is no longer active. Ask the match admin for a new one.",
        url: fullUrl,
        image: fallbackImage,
        type: "website",
      };
    }

    const ctx = await buildMatchContext(link.matchId);
    if (!ctx) {
      return {
        title: "Polo Clubhouse share link — no longer active",
        description: "This share link is no longer active. Ask the match admin for a new one.",
        url: fullUrl,
        image: fallbackImage,
        type: "website",
      };
    }
    const { match, home, away, tournament } = ctx;
    const homeName = home?.name || "TBD";
    const awayName = away?.name || "TBD";
    const tournamentName = tournament?.name || "";
    const status = statusLabel(match.status);

    const title = `${pageLabel} — ${homeName} vs ${awayName}`;

    const descParts: string[] = [];
    if (tournamentName) descParts.push(tournamentName);
    if (status === "LIVE" || status === "Halftime") {
      descParts.push(status);
    } else if (status === "Final") {
      descParts.push("Final");
    } else {
      const scheduled = formatScheduled(match.scheduledAt);
      if (scheduled) descParts.push(`Scheduled ${scheduled}`);
    }
    if (link.expiresAt) {
      const exp = formatScheduled(link.expiresAt);
      if (exp) descParts.push(`Link expires ${exp}`);
    }
    const description = descParts.join(" · ") || `${pageLabel} for ${homeName} vs ${awayName}`;

    const previewImage = absolutePreviewUrl(req, match.previewImageUrl, match.previewImageUpdatedAt);
    const finalImage = previewImage || home?.logoUrl || away?.logoUrl || fallbackImage;
    const isPreviewImage = finalImage === previewImage;
    return {
      title,
      description,
      url: fullUrl,
      image: finalImage,
      imageType: isPreviewImage ? "image/png" : undefined,
      imageWidth: isPreviewImage ? 1920 : undefined,
      imageHeight: isPreviewImage ? 1080 : undefined,
      type: "website",
    };
  }

  // /clubs/:idOrSlug
  m = path.match(/^\/clubs\/([^/]+)\/?$/);
  if (m) {
    const idOrSlug = m[1];
    const [club] = await db.select().from(clubsTable).where(or(eq(clubsTable.id, idOrSlug), eq(clubsTable.slug, idOrSlug)));
    if (!club) return null;
    return {
      title: `${club.name} — Polo Clubhouse`,
      description: `${club.name}. Tournaments, matches, and players.`,
      url: fullUrl,
      image: club.logoUrl || fallbackImage,
      type: "website",
    };
  }

  // /players/:id
  m = path.match(/^\/players\/([^/]+)\/?$/);
  if (m) {
    const id = m[1];
    const [p] = await db.select().from(playersTable).where(eq(playersTable.id, id));
    if (!p) return null;
    return {
      title: `${p.name} — Polo Clubhouse`,
      description: `${p.name}${p.handicap ? ` · Handicap ${p.handicap}` : ""}. Career stats and matches.`,
      url: fullUrl,
      image: p.headshotUrl || fallbackImage,
      type: "profile",
    };
  }

  // /teams/:id
  m = path.match(/^\/teams\/([^/]+)\/?$/);
  if (m) {
    const id = m[1];
    const [t] = await db.select().from(teamsTable).where(eq(teamsTable.id, id));
    if (!t) return null;
    return {
      title: `${t.name} — Polo Clubhouse`,
      description: `${t.name} team profile, roster, and matches.`,
      url: fullUrl,
      image: t.logoUrl || fallbackImage,
      type: "website",
    };
  }

  // / (root)
  if (path === "/" || path === "") {
    return {
      title: "Polo Clubhouse",
      description: "Live polo scores, tournaments, players and clubs.",
      url: fullUrl,
      image: fallbackImage,
      type: "website",
    };
  }

  return null;
}

export function ogMetaMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ua = req.get("user-agent") || "";
  if (!BOT_UA_REGEX.test(ua)) return next();
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) return next();
  if (req.path.match(/\.(js|css|png|jpe?g|svg|ico|webp|gif|woff2?|ttf|map|json)$/i)) return next();

  buildOg(req)
    .then((og) => {
      if (!og) return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(renderHtml(og));
    })
    .catch(() => next());
}

// Exported for tests so they can exercise the buildOg path without needing to
// stand up the production-only static-asset middleware in app.ts.
export { buildOg };
