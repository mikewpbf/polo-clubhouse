import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ChevronDown, Check } from "lucide-react";
import { getStoredToken } from "@/hooks/use-auth";

type Mode = "score" | "stats" | "gfx" | "full";

interface MatchOption {
  id: string;
  homeName: string;
  awayName: string;
  scheduledAt: string | null;
  status: string;
  tournamentName?: string;
}

const MODE_PATHS: Record<Mode, string> = {
  score: "/admin/score-control",
  stats: "/admin/stats-control",
  gfx: "/admin/gfx-control",
  full: "/admin/match",
};

export function GamePicker({ mode, currentMatchId, dark, fallbackTitle }: { mode: Mode; currentMatchId: string; dark: boolean; fallbackTitle: string }) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open || matches.length > 0) return;
    setLoading(true);
    const token = getStoredToken();
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/matches/manageable`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMatches(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, matches.length]);

  const current = matches.find((m) => m.id === currentMatchId);
  const label = current ? `${current.homeName} vs ${current.awayName}` : fallbackTitle;

  function go(matchId: string) {
    setOpen(false);
    if (mode === "full") {
      navigate(`${MODE_PATHS.full}/${matchId}/control`);
    } else {
      navigate(`${MODE_PATHS[mode]}/${matchId}`);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 max-w-full ${dark ? "" : ""}`}
      >
        <h1 className={`font-display text-xl font-bold truncate ${dark ? "" : "text-ink"}`} style={dark ? { color: "#fff" } : undefined}>{label}</h1>
        <ChevronDown className="w-4 h-4 flex-shrink-0" style={dark ? { color: "#9ca3af" } : { color: "#6b7280" }} />
      </button>
      {open && (
        <div
          className={`absolute left-0 top-full mt-2 z-50 min-w-[280px] max-h-[400px] overflow-y-auto rounded-[10px] ${dark ? "" : "bg-white border border-g200 card-shadow"}`}
          style={dark ? { background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" } : undefined}
        >
          {loading && <div className="px-3 py-2 text-[13px] text-ink2">Loading...</div>}
          {!loading && matches.length === 0 && <div className="px-3 py-2 text-[13px] text-ink2">No matches</div>}
          {matches.map((m) => (
            <button
              key={m.id}
              onClick={() => go(m.id)}
              className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:${dark ? "" : "bg-g50"} transition-colors`}
              style={dark ? { background: m.id === currentMatchId ? "rgba(255,255,255,0.05)" : undefined } : undefined}
            >
              <div className="flex-1 min-w-0">
                <div className={`text-[13px] font-medium truncate ${dark ? "" : "text-ink"}`} style={dark ? { color: "#fff" } : undefined}>
                  {m.homeName} vs {m.awayName}
                </div>
                <div className={`text-[11px] truncate ${dark ? "" : "text-ink2"}`} style={dark ? { color: "#9ca3af" } : undefined}>
                  {m.tournamentName || ""} {m.status === "live" ? "• LIVE" : m.status === "scheduled" ? "• Scheduled" : `• ${m.status}`}
                </div>
              </div>
              {m.id === currentMatchId && <Check className="w-3.5 h-3.5 mt-1 flex-shrink-0" style={dark ? { color: "#9ca3af" } : { color: "#6b7280" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
