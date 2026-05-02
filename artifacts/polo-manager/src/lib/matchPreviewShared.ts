import { getStoredToken } from "@/hooks/use-auth";
import type { GraphicData, GraphicTeam } from "@/components/MatchGraphicTemplates";

// Shared rendering primitives used by both the visible Match Graphics editor
// (`pages/admin/MatchGraphics.tsx`) and the headless OG-card snapper
// (`lib/matchPreviewSnap.tsx`). Keeping these in one module avoids the two
// rendering paths drifting apart — they must produce visually identical
// output because the snap result is what unfurlers (iMessage / WhatsApp /
// Slack / Discord) display, and admins reason about it via the editor.

function apiBase(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

export async function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

// Three-stage logo loader: direct fetch → /image-proxy → <img> via canvas.
// Necessary because the html-to-image renderer needs a same-origin (or data
// URL) image, and many team logos live on third-party CDNs that lack CORS.
export async function imageToBase64(url: string): Promise<string | null> {
  const headers: Record<string, string> = {};
  if (url.startsWith("/api")) {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { headers });
    if (response.ok) {
      const result = await blobToDataUrl(await response.blob());
      if (result) return result;
    }
  } catch { /* fall through */ }

  const base = apiBase();
  if (!url.startsWith("/api") && !url.startsWith(`${base}/api`)) {
    try {
      const proxyUrl = `${base}/api/image-proxy?url=${encodeURIComponent(url)}`;
      const token = getStoredToken();
      const proxyHeaders: Record<string, string> = {};
      if (token) proxyHeaders["Authorization"] = `Bearer ${token}`;
      const response = await fetch(proxyUrl, { headers: proxyHeaders });
      if (response.ok) {
        const result = await blobToDataUrl(await response.blob());
        if (result) return result;
      }
    } catch { /* fall through */ }
  }

  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        try { resolve(canvas.toDataURL("image/png")); } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch {
    return null;
  }
}

export interface MatchSourceData {
  id: string;
  homeScore: number;
  awayScore: number;
  homeTeam: { id: string; name: string; shortName?: string; logoUrl?: string; primaryColor?: string } | null;
  awayTeam: { id: string; name: string; shortName?: string; logoUrl?: string; primaryColor?: string } | null;
  field: { name: string } | null;
  tournament: { id: string; name: string; clubName?: string } | null;
  status: string;
  scheduledAt?: string | null;
}

// Build a `GraphicTeam` ready to feed `MatchGraphicTemplates`. Score is left
// to the caller because the visible editor shows live scores while the
// headless snap intentionally renders zeros.
export async function buildMatchGraphicTeam(
  team: MatchSourceData["homeTeam"],
  score: number,
): Promise<GraphicTeam> {
  let logoBase64: string | null = null;
  if (team?.logoUrl) {
    logoBase64 = await imageToBase64(team.logoUrl);
  }
  return {
    name: team?.name || "TBD",
    shortName: team?.shortName,
    logoBase64,
    primaryColor: team?.primaryColor,
    score,
  };
}

interface MetaDefaults {
  headline: string;
  date: string;
  time: string;
  location: string;
  badge: string;
  accentColor: string;
}

// Derives the default metadata fields shown on the BoldDiagonal template.
// MatchGraphics uses these as initial state values (admins can then edit);
// the snapper feeds them straight through.
export function defaultGraphicMeta(match: MatchSourceData): MetaDefaults {
  let date = "";
  let time = "";
  if (match.scheduledAt) {
    try {
      const d = new Date(match.scheduledAt);
      date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    } catch { /* ignore */ }
  }
  const venue = match.field?.name || "";
  const clubName = match.tournament?.clubName || "";
  const badge =
    match.status === "final" || match.status === "completed" ? "FINAL" :
    match.status === "live" ? "LIVE" :
    "UPCOMING";
  return {
    headline: match.tournament?.name || "Match Day",
    date,
    time,
    location: [venue, clubName].filter(Boolean).join(" - "),
    badge,
    accentColor: match.homeTeam?.primaryColor || "#1B5E20",
  };
}

// Full GraphicData with scores forced to zero — used by the headless snapper
// so cached preview cards never expose a stale live score.
export async function buildScorelessGraphicData(match: MatchSourceData): Promise<GraphicData> {
  const meta = defaultGraphicMeta(match);
  const [homeTeam, awayTeam] = await Promise.all([
    buildMatchGraphicTeam(match.homeTeam, 0),
    buildMatchGraphicTeam(match.awayTeam, 0),
  ]);
  return {
    headline: meta.headline,
    subheadline: "",
    date: meta.date,
    time: meta.time,
    location: meta.location,
    badge: meta.badge,
    accentColor: meta.accentColor,
    textColor: "#ffffff",
    homeTeam,
    awayTeam,
  };
}
