import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute } from "wouter";
import { MatchClock } from "@/components/MatchClock";

interface TeamInfo {
  name: string;
  shortName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

interface MatchInfo {
  id: string;
  status: string;
  currentChukker: number;
  homeTeam: TeamInfo | null;
  awayTeam: TeamInfo | null;
  tournament: { name: string } | null;
  homeScore: number;
  awayScore: number;
  clockStartedAt: string | null;
  clockElapsedSeconds: number;
  clockIsRunning: boolean;
  lastGoalScorerName: string | null;
  lastGoalTimestamp: string | null;
  lastStoppageEvent: { eventType: string; playerName: string | null; timestamp: string } | null;
}

interface PossessionStats {
  homeSeconds: number;
  awaySeconds: number;
  homePercent: number;
  awayPercent: number;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function triggerFeedback() {
  if (navigator.vibrate) {
    navigator.vibrate(30);
  }
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 200;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.06);
    setTimeout(() => ctx.close(), 200);
  } catch {}
}

function TeamLogo({ team, size = 48, dark }: { team: TeamInfo | null; size?: number; dark?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!team?.logoUrl || failed) {
    const short = (team?.shortName || team?.name?.substring(0, 3) || "?").toUpperCase();
    return (
      <div
        style={{ width: size, height: size, borderRadius: "50%", background: (team?.primaryColor || "#1B5E20") + "15", border: `2px solid ${team?.primaryColor || "#1B5E20"}30` }}
        className="flex items-center justify-center"
      >
        <span style={{ fontSize: size * 0.32, fontWeight: 800, color: team?.primaryColor || (dark ? "#8bc34a" : "#1B5E20") }}>{short}</span>
      </div>
    );
  }
  const src = team.logoUrl.startsWith("http") ? team.logoUrl : `${BASE}${team.logoUrl}`;
  return (
    <div
      style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", border: `2px solid ${team.primaryColor || "#1B5E20"}30`, background: dark ? "#222" : "#fff" }}
      className="flex items-center justify-center"
    >
      <img src={src} onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function FlashOverlay({ color, visible }: { color: string; visible: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: color,
        opacity: visible ? 0.15 : 0,
        transition: "opacity 0.15s ease-out",
        pointerEvents: "none",
        zIndex: 100,
      }}
    />
  );
}

export function PossessionTracker() {
  const [, params] = useRoute("/possession/:matchId");
  const matchId = params?.matchId;
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token") || "";

  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [currentState, setCurrentState] = useState<string | null>(null);
  const [stats, setStats] = useState<PossessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [dk, setDk] = useState(() => localStorage.getItem("pt_dark") === "1");
  const activeStartRef = useRef<number | null>(null);

  const toggleDark = () => {
    setDk(prev => {
      const next = !prev;
      localStorage.setItem("pt_dark", next ? "1" : "0");
      return next;
    });
  };

  const fetchPossession = useCallback(async () => {
    if (!matchId) return;
    try {
      const res = await fetch(`${BASE}/api/matches/${matchId}/possession`);
      if (res.ok) {
        const data = await res.json();
        setCurrentState(data.currentState);
        setStats(data.stats);
        if (data.currentState) {
          activeStartRef.current = Date.now();
        }
      }
    } catch {}
  }, [matchId]);

  const fetchMatch = useCallback(async () => {
    if (!matchId) return;
    try {
      if (token) {
        const res = await fetch(`${BASE}/api/matches/${matchId}/possession/verify-token?token=${encodeURIComponent(token)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.valid) setMatchInfo(data.match);
      } else {
        const authToken = sessionStorage.getItem("polo_auth_token");
        if (!authToken) return;
        const res = await fetch(`${BASE}/api/matches/${matchId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) return;
        const match = await res.json();
        setMatchInfo({
          id: match.id,
          status: match.status,
          currentChukker: match.currentChukker,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          tournament: match.tournament,
          homeScore: match.homeScore ?? 0,
          awayScore: match.awayScore ?? 0,
          clockStartedAt: match.clockStartedAt ?? null,
          clockElapsedSeconds: match.clockElapsedSeconds ?? 0,
          clockIsRunning: match.clockIsRunning ?? false,
          lastGoalScorerName: match.lastGoalScorerName ?? null,
          lastGoalTimestamp: match.lastGoalTimestamp ?? null,
          lastStoppageEvent: match.lastStoppageEvent ?? null,
        });
      }
    } catch {}
  }, [matchId, token]);

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      try {
        if (token) {
          const res = await fetch(`${BASE}/api/matches/${matchId}/possession/verify-token?token=${encodeURIComponent(token)}`);
          const data = await res.json();
          if (!data.valid) { setError("Invalid or expired access link"); setLoading(false); return; }
          setMatchInfo(data.match);
        } else {
          const authToken = sessionStorage.getItem("polo_auth_token");
          if (!authToken) { setError("Access denied. Use a shared possession link."); setLoading(false); return; }
          const res = await fetch(`${BASE}/api/matches/${matchId}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (!res.ok) { setError("Could not load match"); setLoading(false); return; }
          const match = await res.json();
          setMatchInfo({
            id: match.id,
            status: match.status,
            currentChukker: match.currentChukker,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            tournament: match.tournament,
            homeScore: match.homeScore ?? 0,
            awayScore: match.awayScore ?? 0,
            clockStartedAt: match.clockStartedAt ?? null,
            clockElapsedSeconds: match.clockElapsedSeconds ?? 0,
            clockIsRunning: match.clockIsRunning ?? false,
            lastGoalScorerName: match.lastGoalScorerName ?? null,
            lastGoalTimestamp: match.lastGoalTimestamp ?? null,
            lastStoppageEvent: match.lastStoppageEvent ?? null,
          });
        }
        await fetchPossession();
        setLoading(false);
      } catch {
        setError("Failed to load match data");
        setLoading(false);
      }
    })();
  }, [matchId, token, fetchPossession]);

  useEffect(() => {
    if (!matchId || loading || error) return;
    const iv = setInterval(() => {
      fetchPossession();
      fetchMatch();
    }, 5000);
    return () => clearInterval(iv);
  }, [matchId, loading, error, fetchPossession, fetchMatch]);

  const handleSwitch = async (state: "home" | "away" | "loose") => {
    if (!matchId || sending) return;
    if (state === "loose" && currentState === null) return;
    if (state !== "loose" && state === currentState) return;
    setSending(true);
    triggerFeedback();

    const feedbackColor = state === "home" ? hColor : state === "away" ? aColor : (dk ? "#444" : "#1a1a1a");
    setFlashColor(feedbackColor);
    setTimeout(() => setFlashColor(null), 200);

    try {
      const body: any = { state };
      if (token) body.token = token;
      const headers: any = { "Content-Type": "application/json" };
      if (!token) {
        const authToken = sessionStorage.getItem("polo_auth_token");
        if (authToken) headers.Authorization = `Bearer ${authToken}`;
      }
      const res = await fetch(`${BASE}/api/matches/${matchId}/possession`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentState(data.currentState);
        activeStartRef.current = data.currentState ? Date.now() : null;
        await fetchPossession();
      }
    } catch {}
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: "100dvh", overflow: "hidden", overscrollBehavior: "none", background: dk ? "#111" : "#fff" }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: dk ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)", borderTopColor: dk ? "#fff" : "#000" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-6" style={{ height: "100dvh", overflow: "hidden", overscrollBehavior: "none", background: dk ? "#111" : "#fff" }}>
        <div className="rounded-xl p-8 max-w-sm w-full text-center" style={{ border: dk ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)" }}>
          <div className="text-lg font-semibold mb-2" style={{ color: dk ? "#f0f0f0" : "#000" }}>Error</div>
          <div className="text-sm" style={{ color: dk ? "#888" : "rgba(0,0,0,0.5)" }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!matchInfo) return null;

  const homeTeam = matchInfo.homeTeam;
  const awayTeam = matchInfo.awayTeam;
  const hColor = homeTeam?.primaryColor || "#1B5E20";
  const aColor = awayTeam?.primaryColor || "#6A1B1A";

  const bgPage = dk ? "#111" : "#fff";
  const textMain = dk ? "#f0f0f0" : "#000";
  const textSub = dk ? "#888" : "rgba(0,0,0,0.4)";
  const textMuted = dk ? "#666" : "rgba(0,0,0,0.3)";

  return (
    <div
      className="flex flex-col"
      style={{
        fontFamily: "'Inter', sans-serif",
        height: "100dvh",
        overflow: "hidden",
        overscrollBehavior: "none",
        touchAction: "manipulation",
        position: "fixed",
        inset: 0,
        background: bgPage,
      }}
    >
      <FlashOverlay color={flashColor || "#000"} visible={!!flashColor} />

      <div className="flex items-center pt-3 pb-1 px-4 shrink-0">
        <button
          onClick={toggleDark}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: dk ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.1)",
            background: dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {dk ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f5c542" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>
        <div className="flex-1 text-center pr-8">
          <div className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: textSub }}>
            {matchInfo.tournament?.name || "Possession Tracker"}
          </div>
        </div>
      </div>

      <div className="px-5 pt-2 pb-1 max-w-md mx-auto w-full shrink-0">
        <div
          className="rounded-xl px-3 py-3"
          style={{
            border: dk ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
            background: dk ? "rgba(255,255,255,0.02)" : "transparent",
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div
                className="rounded-full border-2 flex items-center justify-center overflow-hidden shrink-0"
                style={{
                  width: 56,
                  height: 56,
                  borderColor: hColor,
                  background: dk ? "#222" : "#f5f5f5",
                }}
              >
                {homeTeam?.logoUrl ? (
                  <img
                    src={homeTeam.logoUrl.startsWith("http") ? homeTeam.logoUrl : `${BASE}${homeTeam.logoUrl}`}
                    alt={homeTeam.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-bold text-base" style={{ color: hColor }}>
                    {(homeTeam?.shortName || homeTeam?.name?.substring(0, 2) || "").toUpperCase()}
                  </span>
                )}
              </div>
              <span
                className="mt-2 font-medium text-[13px] text-center truncate w-full"
                style={{ color: textMain }}
              >
                {homeTeam?.name || "TBD"}
              </span>
              <span
                className="mt-1 font-black tabular-nums"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 36,
                  lineHeight: 1,
                  color: hColor,
                }}
              >
                {matchInfo.homeScore}
              </span>
            </div>

            <div
              className="flex flex-col items-center justify-start px-1 pt-3"
              style={{ minWidth: 96, color: textMain }}
            >
              <MatchClock
                clockStartedAt={matchInfo.clockStartedAt}
                clockElapsedSeconds={matchInfo.clockElapsedSeconds}
                clockIsRunning={matchInfo.clockIsRunning}
                status={matchInfo.status}
                size="lg"
                lastGoalScorerName={matchInfo.lastGoalScorerName}
                lastGoalTimestamp={matchInfo.lastGoalTimestamp}
                lastStoppageEvent={matchInfo.lastStoppageEvent}
              />
              {matchInfo.status !== "halftime" && (
                <div
                  className="mt-1 text-[12px]"
                  style={{ color: textSub }}
                >
                  Chukker {matchInfo.currentChukker}
                </div>
              )}
            </div>

            <div className="flex flex-col items-center flex-1 min-w-0">
              <div
                className="rounded-full border-2 flex items-center justify-center overflow-hidden shrink-0"
                style={{
                  width: 56,
                  height: 56,
                  borderColor: aColor,
                  background: dk ? "#222" : "#f5f5f5",
                }}
              >
                {awayTeam?.logoUrl ? (
                  <img
                    src={awayTeam.logoUrl.startsWith("http") ? awayTeam.logoUrl : `${BASE}${awayTeam.logoUrl}`}
                    alt={awayTeam.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-bold text-base" style={{ color: aColor }}>
                    {(awayTeam?.shortName || awayTeam?.name?.substring(0, 2) || "").toUpperCase()}
                  </span>
                )}
              </div>
              <span
                className="mt-2 font-medium text-[13px] text-center truncate w-full"
                style={{ color: textMain }}
              >
                {awayTeam?.name || "TBD"}
              </span>
              <span
                className="mt-1 font-black tabular-nums"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 36,
                  lineHeight: 1,
                  color: aColor,
                }}
              >
                {matchInfo.awayScore}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-3 max-w-md mx-auto w-full min-h-0">
        <div className="w-full">
          <div className="flex items-center gap-2 mb-2 px-1">
            <TeamLogo team={homeTeam} size={32} dark={dk} />
            <span className="font-bold text-sm flex-1 truncate" style={{ color: textMain }}>{homeTeam?.name || "Home"}</span>
            {stats && (
              <span className="text-[11px] font-medium tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: textSub }}>
                {formatTime(stats.homeSeconds)}
              </span>
            )}
          </div>
          <button
            onClick={() => handleSwitch("home")}
            disabled={sending}
            className="w-full transition-all duration-150 active:scale-[0.96]"
            style={{
              height: 68,
              borderRadius: 14,
              border: currentState === "home" ? (dk ? `3px solid rgba(255,255,255,0.3)` : `3px solid #fff`) : `3px solid ${hColor}`,
              background: hColor,
              boxShadow: currentState === "home"
                ? `0 0 0 4px ${hColor}, 0 6px 20px ${hColor}50`
                : dk ? `0 2px 8px rgba(0,0,0,0.4)` : `0 2px 8px rgba(0,0,0,0.15)`,
              opacity: 1,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {currentState === "home" && (
              <div style={{
                position: "absolute",
                top: 8,
                right: 12,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#4cff4c",
                boxShadow: "0 0 8px #4cff4c80",
                animation: "pulse-dot 1.5s ease-in-out infinite",
              }} />
            )}
            <span style={{
              fontSize: 17,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: 2,
              textTransform: "uppercase",
              textShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}>
              {homeTeam?.shortName || homeTeam?.name || "Home"}
            </span>
          </button>
        </div>

        <button
          onClick={() => handleSwitch("loose")}
          disabled={sending || currentState === null}
          className="w-full transition-all duration-150 active:scale-[0.96]"
          style={{
            height: 46,
            borderRadius: 14,
            border: currentState === null
              ? (dk ? "2px solid #444" : "2px solid #ccc")
              : (dk ? "2px solid #eee" : "2px solid #1a1a1a"),
            background: currentState === null
              ? (dk ? "#222" : "#f0f0f0")
              : (dk ? "#eee" : "#1a1a1a"),
            boxShadow: currentState !== null ? (dk ? "0 2px 8px rgba(0,0,0,0.5)" : "0 2px 8px rgba(0,0,0,0.25)") : "none",
            opacity: currentState === null ? 0.5 : 1,
          }}
        >
          <span style={{
            fontSize: 13,
            fontWeight: 800,
            color: currentState === null
              ? (dk ? "#666" : "#999")
              : (dk ? "#111" : "#fff"),
            letterSpacing: 2,
            textTransform: "uppercase",
          }}>
            Loose / 50-50
          </span>
        </button>

        <div className="w-full">
          <button
            onClick={() => handleSwitch("away")}
            disabled={sending}
            className="w-full transition-all duration-150 active:scale-[0.96]"
            style={{
              height: 68,
              borderRadius: 14,
              border: currentState === "away" ? (dk ? `3px solid rgba(255,255,255,0.3)` : `3px solid #fff`) : `3px solid ${aColor}`,
              background: aColor,
              boxShadow: currentState === "away"
                ? `0 0 0 4px ${aColor}, 0 6px 20px ${aColor}50`
                : dk ? `0 2px 8px rgba(0,0,0,0.4)` : `0 2px 8px rgba(0,0,0,0.15)`,
              opacity: 1,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {currentState === "away" && (
              <div style={{
                position: "absolute",
                top: 8,
                right: 12,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#4cff4c",
                boxShadow: "0 0 8px #4cff4c80",
                animation: "pulse-dot 1.5s ease-in-out infinite",
              }} />
            )}
            <span style={{
              fontSize: 17,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: 2,
              textTransform: "uppercase",
              textShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}>
              {awayTeam?.shortName || awayTeam?.name || "Away"}
            </span>
          </button>
          <div className="flex items-center gap-2 mt-2 px-1">
            <TeamLogo team={awayTeam} size={32} dark={dk} />
            <span className="font-bold text-sm flex-1 truncate" style={{ color: textMain }}>{awayTeam?.name || "Away"}</span>
            {stats && (
              <span className="text-[11px] font-medium tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: textSub }}>
                {formatTime(stats.awaySeconds)}
              </span>
            )}
          </div>
        </div>
      </div>

      {stats && (
        <div className="px-5 pb-4 pt-2 max-w-md mx-auto w-full shrink-0">
          <div className="rounded-lg p-3" style={{ border: dk ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)" }}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: textSub }}>Possession</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-lg tabular-nums" style={{ minWidth: 44, textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: textMain }}>{stats.homePercent}%</span>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden flex" style={{ background: dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", gap: 2 }}>
                <div style={{ width: `${stats.homePercent}%`, background: hColor, borderRadius: 6, transition: "width 0.5s ease", minWidth: stats.homePercent > 0 ? 4 : 0 }} />
                <div style={{ flex: 1, background: aColor, borderRadius: 6, transition: "width 0.5s ease", minWidth: stats.awayPercent > 0 ? 4 : 0 }} />
              </div>
              <span className="font-bold text-lg tabular-nums" style={{ minWidth: 44, fontFamily: "'JetBrains Mono', monospace", color: textMain }}>{stats.awayPercent}%</span>
            </div>
            <div className="flex justify-between text-[10px]" style={{ color: textMuted }}>
              <span>{formatTime(stats.homeSeconds)}</span>
              <span>{formatTime(stats.awaySeconds)}</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
