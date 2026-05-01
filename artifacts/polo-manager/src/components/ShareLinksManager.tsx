import { useState, useEffect } from "react";
import { Share2, Copy, RefreshCw, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type SharePageType = "stats" | "gfx";

interface ShareLink {
  id: string;
  token: string;
  pageType: SharePageType;
  label: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  active: boolean;
}

interface Props {
  matchId: string;
  mode: SharePageType;
  dark: boolean;
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
}

function formatExpiry(iso: string | null): string {
  if (!iso) return "no expiry";
  const d = new Date(iso);
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return "expired";
  const hrs = Math.floor(ms / 3600_000);
  if (hrs < 1) return `expires in ${Math.max(1, Math.floor(ms / 60_000))}m`;
  if (hrs < 48) return `expires in ${hrs}h`;
  return `expires ${d.toLocaleDateString()}`;
}

export function ShareLinksManager({ matchId, mode, dark, apiFetch }: Props) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const { toast } = useToast();

  const activeLink = links.find((l) => l.pageType === mode && l.active) || null;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiFetch(`/matches/${matchId}/share-links`)
      .then((data) => { if (Array.isArray(data)) setLinks(data); })
      .catch((e) => toast({ title: "Error", description: e.message }))
      .finally(() => setLoading(false));
  }, [open, matchId]);

  function buildUrl(link: ShareLink): string {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const origin = window.location.origin;
    return `${origin}${base}/share/${link.pageType}/${link.token}`;
  }

  async function generate() {
    if (activeLink) {
      const ok = confirm(
        `An active ${mode.toUpperCase()} share link already exists. ` +
        "Generating a new one will revoke the old one immediately. Continue?",
      );
      if (!ok) return;
    }
    setWorking(true);
    try {
      const link = await apiFetch(`/matches/${matchId}/share-links`, {
        method: "POST",
        body: JSON.stringify({ pageType: mode }),
      });
      setLinks((prev) => [
        link,
        ...prev.map((l) =>
          l.pageType === mode && l.active && l.id !== link.id
            ? { ...l, active: false, revokedAt: new Date().toISOString() }
            : l,
        ),
      ]);
      toast({ title: activeLink ? "Regenerated" : "Created", description: "New share link is ready" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message });
    } finally {
      setWorking(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this link? It will stop working immediately.")) return;
    try {
      await apiFetch(`/matches/${matchId}/share-links/${id}`, { method: "DELETE" });
      setLinks((prev) =>
        prev.map((l) => (l.id === id ? { ...l, active: false, revokedAt: new Date().toISOString() } : l)),
      );
      toast({ title: "Revoked" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message });
    }
  }

  async function copyUrl(link: ShareLink) {
    try {
      await navigator.clipboard.writeText(buildUrl(link));
      toast({ title: "Copied", description: "Share URL copied" });
    } catch {
      toast({ title: "Error", description: "Could not copy" });
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-9 h-9 rounded-[8px] flex items-center justify-center transition-colors ${dark ? "" : "bg-white border border-g200 hover:border-g300 card-shadow"}`}
        style={dark ? { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" } : undefined}
        title="Share links"
      >
        <Share2 className="w-4 h-4" style={dark ? { color: "#fff" } : undefined} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setOpen(false)}>
          <div
            className={`w-full max-w-md rounded-[12px] p-5 ${dark ? "" : "bg-white"}`}
            style={dark ? { background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <h2 className={`font-display text-lg font-bold flex-1 ${dark ? "" : "text-ink"}`} style={dark ? { color: "#fff" } : undefined}>
                Share Link — {mode.toUpperCase()}
              </h2>
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-[6px] flex items-center justify-center">
                <X className="w-4 h-4" style={dark ? { color: "#fff" } : undefined} />
              </button>
            </div>

            {loading && <div className="text-[13px] text-ink2">Loading...</div>}

            {!loading && (
              <>
                {activeLink ? (
                  <div
                    className={`p-3 rounded-[8px] mb-3 ${dark ? "" : "bg-g50 border border-g200"}`}
                    style={dark ? { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" } : undefined}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[12px] font-bold uppercase tracking-wider`} style={dark ? { color: "#fff" } : undefined}>Active</span>
                      <span className={`text-[12px] ${dark ? "" : "text-ink2"}`} style={dark ? { color: "#9ca3af" } : undefined}>
                        · {formatExpiry(activeLink.expiresAt)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={buildUrl(activeLink)}
                        className={`flex-1 h-9 px-2 rounded-[6px] text-[11px] font-mono ${dark ? "" : "bg-white border border-g200"}`}
                        style={dark ? { background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" } : undefined}
                      />
                      <button
                        onClick={() => copyUrl(activeLink)}
                        className={`w-9 h-9 rounded-[6px] flex items-center justify-center ${dark ? "" : "bg-white border border-g200 hover:border-g300"}`}
                        style={dark ? { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" } : undefined}
                        title="Copy URL"
                      >
                        <Copy className="w-4 h-4" style={dark ? { color: "#fff" } : undefined} />
                      </button>
                      <button
                        onClick={() => revoke(activeLink.id)}
                        className="w-9 h-9 rounded-[6px] flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600"
                        style={dark ? { background: "rgba(239,68,68,0.15)", color: "#ef4444" } : undefined}
                        title="Revoke"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`text-[13px] mb-3 ${dark ? "" : "text-ink2"}`} style={dark ? { color: "#9ca3af" } : undefined}>
                    No active {mode.toUpperCase()} share link.
                  </div>
                )}

                <Button onClick={generate} disabled={working} className="w-full h-9 rounded-[8px] gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  {activeLink ? "Regenerate Link" : "Generate Link"}
                </Button>

                {links.filter((l) => l.pageType === mode && !l.active).length > 0 && (
                  <details className="mt-4">
                    <summary className={`text-[12px] cursor-pointer ${dark ? "" : "text-ink2"}`} style={dark ? { color: "#9ca3af" } : undefined}>
                      Past links ({links.filter((l) => l.pageType === mode && !l.active).length})
                    </summary>
                    <div className="space-y-1 mt-2 max-h-[160px] overflow-y-auto">
                      {links.filter((l) => l.pageType === mode && !l.active).map((l) => (
                        <div key={l.id} className={`text-[11px] font-mono truncate px-2 py-1 rounded ${dark ? "" : "bg-g50"}`} style={dark ? { background: "rgba(255,255,255,0.03)", color: "#9ca3af" } : undefined}>
                          {buildUrl(l)} · revoked
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
