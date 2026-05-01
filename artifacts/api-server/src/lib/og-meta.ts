import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { matchesTable, teamsTable, tournamentsTable, clubsTable, playersTable } from "@workspace/db/schema";
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
  url: string;
  type?: string;
}

function renderHtml(og: OgData): string {
  const t = escapeHtml(og.title);
  const d = escapeHtml(og.description);
  const u = escapeHtml(og.url);
  const img = og.image ? escapeHtml(og.image) : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:type" content="${og.type || "website"}">
${img ? `<meta property="og:image" content="${img}">` : ""}
<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
${img ? `<meta name="twitter:image" content="${img}">` : ""}
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${u}">${u}</a></p>
</body>
</html>`;
}

function defaultOgImage(req: Request): string {
  const origin = `${req.protocol}://${req.get("host")}`;
  // Honor the SPA's deployment base path. In the pnpm monorepo / Replit
  // workspace artifacts each web artifact is served under its own prefix
  // (e.g. `/polo-manager`), but a standalone deploy mounts the SPA at `/`.
  // PUBLIC_BASE_PATH lets the deploy target override; otherwise default to
  // the polo-manager prefix when present and fall back to root.
  const base = (process.env.PUBLIC_BASE_PATH || "/polo-manager").replace(/\/+$/, "");
  return `${origin}${base}/opengraph.jpg`;
}

async function buildOg(req: Request): Promise<OgData | null> {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const path = req.path;
  const fallbackImage = defaultOgImage(req);

  // /tournaments/:id
  let m = path.match(/^\/tournaments\/([^/]+)\/?$/);
  if (m) {
    const id = m[1];
    const [t] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
    if (!t) return null;
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
    const id = m[1];
    const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
    if (!match) return null;
    const home = match.homeTeamId
      ? (await db.select().from(teamsTable).where(eq(teamsTable.id, match.homeTeamId)))[0] ?? null
      : null;
    const away = match.awayTeamId
      ? (await db.select().from(teamsTable).where(eq(teamsTable.id, match.awayTeamId)))[0] ?? null
      : null;
    const [tour] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, match.tournamentId));
    const homeName = home?.name || "TBD";
    const awayName = away?.name || "TBD";
    const status = match.status === "live" ? "LIVE" : match.status === "final" ? "Final" : "Scheduled";
    return {
      title: `${homeName} vs ${awayName} — ${status}`,
      description: `${tour?.name || ""} ${status} ${homeName} ${match.homeScore || 0} – ${match.awayScore || 0} ${awayName}`.trim(),
      url: fullUrl,
      image: home?.logoUrl || away?.logoUrl || fallbackImage,
      type: "article",
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
