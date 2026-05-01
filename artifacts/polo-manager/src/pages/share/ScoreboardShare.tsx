import { useRoute } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { MatchClock } from "@/components/MatchClock";
import { PageLoading } from "@/components/LoadingBar";

interface ErrorState {
  reason: "revoked" | "expired" | "not_found" | "match_missing" | "mismatch" | "network";
  message: string;
}

interface MatchData {
  id: string;
  status: string;
  homeScore: number;
  awayScore: number;
  currentChukker: number;
  clockIsRunning: boolean;
  clockStartedAt: string | null;
  clockElapsedSeconds: number;
  homeTeam?: { name: string; shortName?: string; primaryColor?: string; logoUrl?: string } | null;
  awayTeam?: { name: string; shortName?: string; primaryColor?: string; logoUrl?: string } | null;
}

function reasonTitle(reason: ErrorState["reason"]): string {
  switch (reason) {
    case "revoked": return "This scoreboard link has been revoked";
    case "expired": return "This scoreboard link has expired";
    case "not_found": return "Scoreboard link not found";
    case "match_missing": return "Match not found";
    default: return "Link unavailable";
  }
}

export function ScoreboardShare() {
  const [, params] = useRoute("/share/scoreboard/:token");
  const token = params?.token;
  const [matchId, setMatchId] = useState<string | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [resolving, setResolving] = useState(true);
  const [match, setMatch] = useState<MatchData | null>(null);

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  useEffect(() => {
    if (match) {
      const home = match.homeTeam?.name || "Home";
      const away = match.awayTeam?.name || "Away";
      document.title = `${home} vs ${away} — Polo Clubhouse`;
    }
    return () => { document.title = "Polo Clubhouse"; };
  }, [match?.homeTeam?.name, match?.awayTeam?.name]);

  useEffect(() => {
    if (!token) return;
    fetch(`${base}/api/share/${token}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          const reason = (data?.reason as ErrorState["reason"]) || "network";
          throw { reason, message: data?.message || "Invalid link" } as ErrorState;
        }
        if (data.pageType !== "scoreboard") {
          throw { reason: "mismatch", message: "This link is not a scoreboard link." } as ErrorState;
        }
        setMatchId(data.matchId);
      })
      .catch((e: ErrorState | Error) => {
        if ((e as ErrorState).reason) setError(e as ErrorState);
        else setError({ reason: "network", message: (e as Error).message || "Network error" });
      })
      .finally(() => setResolving(false));
  }, [token]);

  const fetchMatch = useCallback(async () => {
    if (!matchId || !token) return;
    try {
      const r = await fetch(`${base}/api/matches/${matchId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const data = await r.json();
      setMatch(data);
    } catch {}
  }, [matchId, token]);

  useEffect(() => {
    if (!matchId) return;
    fetchMatch();
    const iv = setInterval(fetchMatch, 5000);
    return () => clearInterval(iv);
  }, [matchId, fetchMatch]);

  if (resolving) return <PageLoading />;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <div className="rounded-[16px] p-8 max-w-md text-center" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h1 className="font-display text-xl font-bold text-white mb-2">{reasonTitle(error.reason)}</h1>
          <p className="text-[14px] text-gray-400">{error.message}</p>
          <p className="text-[12px] text-gray-600 mt-3">Contact the match admin for a new link.</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <PageLoading />
      </div>
    );
  }

  const homeColor = match.homeTeam?.primaryColor || "#4ade80";
  const awayColor = match.awayTeam?.primaryColor || "#f87171";
  const isLive = match.status === "live" || match.status === "halftime";
  const matchTitle = (match.homeTeam?.name && match.awayTeam?.name)
    ? `${match.homeTeam.name} vs ${match.awayTeam.name}`
    : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black px-4 py-8">
      <div className="w-full max-w-sm">
        {matchTitle && (
          <h1 className="text-center text-[13px] font-semibold mb-3 tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>
            {matchTitle}
          </h1>
        )}
        <div className="rounded-[20px] overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Status bar */}
          <div className="flex items-center justify-center gap-2 px-4 py-2.5" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {isLive && (
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
            <span className="text-[12px] font-medium tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
              {match.status === "final" ? "Final" : match.status === "halftime" ? "Halftime" : match.status === "live" ? "Live" : "Upcoming"}
            </span>
            {match.currentChukker > 0 && (
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>· Ch.{match.currentChukker}</span>
            )}
          </div>

          {/* Score display */}
          <div className="flex items-stretch px-4 pt-6 pb-4 gap-3">
            {/* Home team */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden shrink-0" style={{ background: `${homeColor}22`, border: `2px solid ${homeColor}55` }}>
                {match.homeTeam?.logoUrl
                  ? <img src={match.homeTeam.logoUrl} alt="" className="w-full h-full object-cover" />
                  : <span className="font-display font-bold text-xl" style={{ color: homeColor }}>{(match.homeTeam?.shortName || match.homeTeam?.name || "H").substring(0, 2)}</span>
                }
              </div>
              <span className="text-[12px] font-medium text-center leading-tight" style={{ color: "rgba(255,255,255,0.55)" }}>
                {match.homeTeam?.name || "Home"}
              </span>
              <span className="font-display font-bold text-[56px] leading-none" style={{ color: homeColor }}>
                {Number(match.homeScore || 0)}
              </span>
            </div>

            {/* Center clock */}
            <div className="flex flex-col items-center justify-center shrink-0 w-16">
              <span className="text-[10px] font-medium tracking-widest uppercase mb-2" style={{ color: "rgba(255,255,255,0.2)" }}>
                {isLive ? "Time" : ""}
              </span>
              {isLive ? (
                <MatchClock
                  clockStartedAt={match.clockStartedAt}
                  clockElapsedSeconds={match.clockElapsedSeconds}
                  clockIsRunning={match.clockIsRunning}
                  status={match.status}
                  size="sm"
                />
              ) : (
                <span className="text-[14px] font-display font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>vs</span>
              )}
            </div>

            {/* Away team */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden shrink-0" style={{ background: `${awayColor}22`, border: `2px solid ${awayColor}55` }}>
                {match.awayTeam?.logoUrl
                  ? <img src={match.awayTeam.logoUrl} alt="" className="w-full h-full object-cover" />
                  : <span className="font-display font-bold text-xl" style={{ color: awayColor }}>{(match.awayTeam?.shortName || match.awayTeam?.name || "A").substring(0, 2)}</span>
                }
              </div>
              <span className="text-[12px] font-medium text-center leading-tight" style={{ color: "rgba(255,255,255,0.55)" }}>
                {match.awayTeam?.name || "Away"}
              </span>
              <span className="font-display font-bold text-[56px] leading-none" style={{ color: awayColor }}>
                {Number(match.awayScore || 0)}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 pb-4 text-center">
            <span className="text-[10px] tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.15)" }}>Polo Clubhouse</span>
          </div>
        </div>

        {/* Live indicator */}
        {isLive && (
          <p className="text-center text-[11px] mt-4" style={{ color: "rgba(255,255,255,0.2)" }}>
            Updates automatically every 5 seconds
          </p>
        )}
      </div>
    </div>
  );
}
