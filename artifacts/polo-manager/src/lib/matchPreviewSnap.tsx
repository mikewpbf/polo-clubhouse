import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import { getStoredToken } from "@/hooks/use-auth";
import { BoldDiagonal } from "@/components/MatchGraphicTemplates";
import {
  buildScorelessGraphicData,
  type MatchSourceData,
} from "./matchPreviewShared";

// Headless renderer + uploader that produces the per-match link-preview PNG
// reused by the OG meta middleware. Designed to run silently in the
// background after a match is created/edited or whenever an admin opens the
// Match Graphics page; failures are swallowed so user-facing flows are never
// blocked.
//
// Why client-side? html-to-image needs a real DOM, and the existing template
// (`MatchGraphicTemplates.tsx`) is the source of truth — replicating it on
// the server (puppeteer/satori) would be a maintenance burden and require a
// much heavier deployment surface. The client renders the same component the
// admin already sees in the Match Graphics page, just without scores. All
// shared rendering primitives (logo loader, GraphicData builder) live in
// `matchPreviewShared.ts` so this path cannot drift visually from the
// editor.

function apiBase(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

async function fetchMatchData(matchId: string): Promise<MatchSourceData | null> {
  const token = getStoredToken();
  try {
    const res = await fetch(`${apiBase()}/api/matches/${matchId}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as MatchSourceData;
  } catch {
    return null;
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function uploadPreview(matchId: string, blob: Blob): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;
  try {
    const res = await fetch(`${apiBase()}/api/matches/${matchId}/preview-image`, {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        Authorization: `Bearer ${token}`,
      },
      body: blob,
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Renders the BoldDiagonal template in a detached, off-screen container,
// captures it as a PNG, uploads it, then tears the container down. Returns
// true on success. Always resolves — never throws — so callers can fire and
// forget without try/catch.
export async function snapAndUploadMatchPreview(matchId: string): Promise<boolean> {
  if (typeof document === "undefined") return false;

  const match = await fetchMatchData(matchId);
  if (!match) return false;

  const data = await buildScorelessGraphicData(match);

  // Off-screen 1920x1080 host. Position fixed well outside the viewport so it
  // never paints into the visible page; html-to-image still measures it.
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.style.width = "1920px";
  host.style.height = "1080px";
  host.style.pointerEvents = "none";
  host.style.zIndex = "-1";
  document.body.appendChild(host);

  const root = createRoot(host);
  let success = false;
  try {
    await new Promise<void>((resolve) => {
      root.render(<BoldDiagonal data={data} orientation="horizontal" />);
      // Two RAFs: first lets React commit, second lets layout/paint settle.
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    // Warm-up render (mirrors the MatchGraphics download path) — first toPng
    // pass primes font/image loading, second produces the final PNG.
    const opts = { width: 1920, height: 1080, pixelRatio: 1, skipFonts: true };
    await toPng(host, opts);
    await new Promise(r => setTimeout(r, 100));
    const dataUrl = await toPng(host, opts);
    const blob = await dataUrlToBlob(dataUrl);
    success = await uploadPreview(matchId, blob);
  } catch {
    success = false;
  } finally {
    try { root.unmount(); } catch { /* ignore */ }
    if (host.parentNode) host.parentNode.removeChild(host);
  }
  return success;
}

// Convenience wrapper that swallows everything (including thrown promises).
// Use this from UI handlers where you want true fire-and-forget semantics.
export function snapMatchPreviewInBackground(matchId: string): void {
  void snapAndUploadMatchPreview(matchId).catch(() => false);
}

// Returns the list of match IDs that don't yet have a stored preview image.
// Used by the admin "Backfill missing previews" tool to drive sequential
// snaps for matches created before this feature shipped.
export async function fetchMatchesMissingPreview(limit = 50): Promise<string[]> {
  const token = getStoredToken();
  if (!token) return [];
  try {
    const res = await fetch(`${apiBase()}/api/admin/match-previews/missing?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.matchIds) ? json.matchIds : [];
  } catch {
    return [];
  }
}

// Sequentially snap + upload previews for every match returned by the
// `missing` endpoint. Returns counts so the caller can surface progress in
// the UI. Sequential (not parallel) because each snap mounts a 1920x1080
// off-screen renderer — running many at once would peg the main thread.
export async function backfillMissingMatchPreviews(
  onProgress?: (done: number, total: number, lastSucceeded: boolean) => void,
): Promise<{ total: number; succeeded: number; failed: number }> {
  const ids = await fetchMatchesMissingPreview(200);
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i++) {
    const ok = await snapAndUploadMatchPreview(ids[i]);
    if (ok) succeeded++; else failed++;
    onProgress?.(i + 1, ids.length, ok);
  }
  return { total: ids.length, succeeded, failed };
}

// Once-per-session guard: AdminLayout mounts on every admin route, so
// without this the backfill would re-fire on every navigation. We only
// want one auto-pass per browser session — the manual "Backfill missing
// previews" button on Match Graphics is the explicit retry path.
let autoBackfillRan = false;

// Fire-and-forget background trigger that runs the missing-previews
// backfill the first time an admin opens *any* admin page in their
// session. This is the auto-resnap mechanism that pairs with the
// server-side invalidation hooks in teams.ts / tournaments.ts /
// fields.ts: a team logo edit nulls preview_image_url on every match,
// then the next admin page mount snaps fresh PNGs without anyone
// touching the Match Graphics page. Idle-callback scheduled so it
// doesn't fight the page's first paint.
export function triggerAdminPreviewAutoBackfill(): void {
  if (autoBackfillRan) return;
  if (typeof window === "undefined") return;
  if (!getStoredToken()) return;
  autoBackfillRan = true;

  const run = () => { void backfillMissingMatchPreviews().catch(() => undefined); };
  // requestIdleCallback isn't available in Safari; setTimeout(2s) is a
  // safe fallback that still gets us past initial layout/paint.
  type WindowWithIdleCallback = Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  const w = window as WindowWithIdleCallback;
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(run, { timeout: 5000 });
  } else {
    setTimeout(run, 2000);
  }
}

// Test seam — vitest doesn't tear down module state between tests, so
// expose a reset for the once-per-session flag. Not exported to JS callers
// outside tests by convention.
export function __resetAdminPreviewAutoBackfillForTests(): void {
  autoBackfillRan = false;
}
