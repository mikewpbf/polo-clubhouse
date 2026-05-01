import { useState, useEffect } from "react";
import { Share2, Copy, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type SharePageType = "score" | "stats" | "gfx";

interface ShareLink {
  id: string;
  token: string;
  pageType: SharePageType;
  label: string | null;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string;
}

interface Props {
  matchId: string;
  mode: SharePageType;
  dark: boolean;
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
}

export function ShareLinksManager({ matchId, mode, dark, apiFetch }: Props) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiFetch(`/matches/${matchId}/share-links`)
      .then((data) => {
        if (Array.isArray(data)) setLinks(data);
      })
      .catch((e) => toast({ title: "Error", description: e.message }))
      .finally(() => setLoading(false));
  }, [open, matchId]);

  async function createLink() {
    setCreating(true);
    try {
      const link = await apiFetch(`/matches/${matchId}/share-links`, {
        method: "POST",
        body: JSON.stringify({ pageType: mode, label: label || null }),
      });
      setLinks((prev) => [link, ...prev]);
      setLabel("");
      toast({ title: "Created", description: "Share link generated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message });
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this link? It will stop working immediately.")) return;
    try {
      await apiFetch(`/matches/${matchId}/share-links/${id}`, { method: "DELETE" });
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, revoked: true } : l)));
      toast({ title: "Revoked" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message });
    }
  }

  function buildUrl(link: ShareLink): string {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const origin = window.location.origin;
    return `${origin}${base}/share/${link.pageType}/${link.token}`;
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
                Share Links — {mode.toUpperCase()}
              </h2>
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-[6px] flex items-center justify-center">
                <X className="w-4 h-4" style={dark ? { color: "#fff" } : undefined} />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Optional label (e.g. 'Stats Dad')"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={`flex-1 h-9 px-3 rounded-[8px] text-[13px] ${dark ? "" : "bg-white border border-g200"}`}
                style={dark ? { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" } : undefined}
              />
              <Button onClick={createLink} disabled={creating} className="h-9 rounded-[8px] gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Create
              </Button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {loading && <div className="text-[13px] text-ink2">Loading...</div>}
              {!loading && links.length === 0 && <div className="text-[13px] text-ink2">No share links yet</div>}
              {links.map((l) => (
                <div
                  key={l.id}
                  className={`p-3 rounded-[8px] ${dark ? "" : "bg-g50 border border-g200"}`}
                  style={dark ? { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" } : undefined}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[12px] font-bold uppercase tracking-wider ${l.revoked ? "text-red-500" : ""}`} style={dark && !l.revoked ? { color: "#fff" } : undefined}>
                      {l.pageType}
                    </span>
                    {l.label && <span className={`text-[12px] ${dark ? "" : "text-ink2"}`} style={dark ? { color: "#9ca3af" } : undefined}>· {l.label}</span>}
                    {l.revoked && <span className="text-[11px] text-red-500">REVOKED</span>}
                  </div>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={buildUrl(l)}
                      className={`flex-1 h-8 px-2 rounded-[6px] text-[11px] font-mono ${dark ? "" : "bg-white border border-g200"}`}
                      style={dark ? { background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" } : undefined}
                    />
                    <button onClick={() => copyUrl(l)} disabled={l.revoked} className={`w-8 h-8 rounded-[6px] flex items-center justify-center ${l.revoked ? "opacity-30" : ""} ${dark ? "" : "bg-white border border-g200 hover:border-g300"}`} style={dark ? { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" } : undefined}>
                      <Copy className="w-3.5 h-3.5" style={dark ? { color: "#fff" } : undefined} />
                    </button>
                    {!l.revoked && (
                      <button onClick={() => revoke(l.id)} className="w-8 h-8 rounded-[6px] flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600" style={dark ? { background: "rgba(239,68,68,0.15)", color: "#ef4444" } : undefined}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
