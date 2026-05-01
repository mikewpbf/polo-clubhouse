import { useRoute, useLocation } from "wouter";
import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { MatchClock } from "@/components/MatchClock";
import { PageLoading } from "@/components/LoadingBar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Pause, RotateCcw, ChevronLeft, ChevronRight, CheckSquare, ChevronUp, ChevronDown, Plus, AlertTriangle, RefreshCw, Shield, HeartPulse, Copy, Eye, EyeOff, Monitor, Crosshair, Trash2, Link, Moon, Sun, Video, Timer } from "lucide-react";
import { getStoredToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getStoredToken();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

interface Player {
  id: string;
  name: string;
  position: number | null;
  handicap: string | null;
  isActive: boolean;
}

interface MatchData {
  id: string;
  homeScore: number;
  awayScore: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeam: { id: string; name: string; shortName?: string; logoUrl?: string; primaryColor?: string; players?: Player[] } | null;
  awayTeam: { id: string; name: string; shortName?: string; logoUrl?: string; primaryColor?: string; players?: Player[] } | null;
  field: { name: string } | null;
  tournament: { id: string; name: string; chukkersPerMatch: number; clubId?: string } | null;
  status: string;
  currentChukker: number;
  clockStartedAt: string | null;
  clockElapsedSeconds: number;
  clockIsRunning: boolean;
  round: string | null;
  broadcastVisible?: boolean;
  broadcastStyle?: string;
  broadcastResolution?: string;
  broadcast4kScale?: number;
  broadcast4kOffsetX?: number;
  broadcast4kOffsetY?: number;
  broadcastChannel?: string | null;
  streamUrl?: string | null;
  streamStartedAt?: string | null;
  scoringLocation?: "studio" | "field";
  broadcastOffsetSeconds?: number;
}

export function MatchControl() {
  const [, params] = useRoute("/admin/match/:id/control");
  const [, navigate] = useLocation();
  const matchId = params?.id;

  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("mc_dark") === "1");
  const [previewOpen, setPreviewOpen] = useState(true);
  const [streamOpen, setStreamOpen] = useState(false);
  const [outputResOpen, setOutputResOpen] = useState(false);
  const [streamUrlLocal, setStreamUrlLocal] = useState<string | null>(null);
  const mutatingRef = useRef(0);
  const seqRef = useRef(0);

  const fetchMatch = useCallback(async () => {
    if (!matchId) return;
    try {
      const data = await apiFetch(`/matches/${matchId}`);
      if (mutatingRef.current === 0) {
        setMatch(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (match && streamUrlLocal === null) {
      setStreamUrlLocal(match.streamUrl || "");
    }
  }, [match?.id]);

  const [sseConnected, setSseConnected] = useState(false);

  useEffect(() => {
    fetchMatch();
    const pollInterval = sseConnected ? 5000 : 3000;
    const interval = setInterval(fetchMatch, pollInterval);
    return () => clearInterval(interval);
  }, [fetchMatch, sseConnected]);

  useEffect(() => {
    if (!matchId) return;
    const isLive = match?.status === "live" || match?.status === "halftime";
    if (!isLive) {
      setSseConnected(false);
      return;
    }

    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const es = new EventSource(`${base}/api/matches/${matchId}/stream`);
    es.onopen = () => { setSseConnected(true); };
    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "update" && mutatingRef.current === 0) {
          fetchMatch();
        } else if (msg.type === "match_ended") {
          fetchMatch();
          es.close();
          setSseConnected(false);
        }
      } catch {}
    };
    es.onerror = () => { setSseConnected(false); };
    return () => { es.close(); setSseConnected(false); };
  }, [matchId, match?.status, fetchMatch]);

  const mutate = useCallback(async (path: string, body: any, optimistic?: (prev: MatchData) => MatchData) => {
    if (!matchId || !match) return;
    mutatingRef.current++;
    const mySeq = ++seqRef.current;
    if (optimistic) {
      setMatch(prev => prev ? optimistic(prev) : prev);
    }
    try {
      const data = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
      if (seqRef.current === mySeq) {
        setMatch(data);
      }
    } catch {
      if (seqRef.current === mySeq) {
        fetchMatch();
      }
    } finally {
      mutatingRef.current--;
    }
  }, [matchId, match, fetchMatch]);

  const mutatePut = useCallback(async (path: string, body: any) => {
    if (!matchId) return;
    try {
      await apiFetch(path, { method: "PUT", body: JSON.stringify(body) });
      fetchMatch();
    } catch {}
  }, [matchId, fetchMatch]);

  const { toast } = useToast();

  const [possessionOpen, setPossessionOpen] = useState(false);
  const [possessionToken, setPossessionToken] = useState<string | null>(null);

  const [timingOpen, setTimingOpen] = useState(false);
  const [broadcastOffsetLocal, setBroadcastOffsetLocal] = useState<string>("");
  const [scoringLocationLocal, setScoringLocationLocal] = useState<"studio" | "field">("studio");
  const [editAnchorOpen, setEditAnchorOpen] = useState(false);
  const [editAnchorDateInput, setEditAnchorDateInput] = useState<string>("");

  useEffect(() => {
    if (!match) return;
    setScoringLocationLocal(match.scoringLocation || "studio");
    setBroadcastOffsetLocal(match.broadcastOffsetSeconds != null ? String(match.broadcastOffsetSeconds) : "0");
  }, [match?.id]);
  const [possessionStats, setPossessionStats] = useState<{ homePercent: number; awayPercent: number; homeSeconds: number; awaySeconds: number } | null>(null);
  const [possessionState, setPossessionState] = useState<string | null>(null);

  const fetchPossessionData = useCallback(async () => {
    if (!matchId) return;
    try {
      const data = await apiFetch(`/matches/${matchId}/possession`);
      setPossessionState(data.currentState);
      setPossessionStats(data.stats);
    } catch {}
  }, [matchId]);

  useEffect(() => {
    if (!possessionOpen || !matchId) return;
    fetchPossessionData();
    const iv = setInterval(fetchPossessionData, 3000);
    return () => clearInterval(iv);
  }, [possessionOpen, matchId, fetchPossessionData]);

  if (loading || !match) return <div className="min-h-screen bg-bg flex items-center justify-center"><PageLoading /></div>;

  const isFinal = match.status === "final";
  const homePlayers = (match.homeTeam?.players || []).filter(p => p.isActive).sort((a, b) => (a.position || 99) - (b.position || 99));
  const awayPlayers = (match.awayTeam?.players || []).filter(p => p.isActive).sort((a, b) => (a.position || 99) - (b.position || 99));

  const handleScore = (team: "home" | "away", delta: number) => {
    if (delta < 0) {
      const teamId = team === "home" ? match.homeTeamId : match.awayTeamId;
      mutate(`/matches/${match.id}/undo-goal`, { teamId }, prev => ({
        ...prev,
        homeScore: team === "home" ? Math.max(0, prev.homeScore - 1) : prev.homeScore,
        awayScore: team === "away" ? Math.max(0, prev.awayScore - 1) : prev.awayScore,
      }));
      return;
    }
    const newHome = team === "home" ? Math.max(0, match.homeScore + delta) : match.homeScore;
    const newAway = team === "away" ? Math.max(0, match.awayScore + delta) : match.awayScore;
    const swapped = (match as any)._teamsSwapped;
    mutate(`/matches/${match.id}/score`, {
      homeScore: swapped ? newAway : newHome,
      awayScore: swapped ? newHome : newAway,
    }, prev => ({
      ...prev,
      homeScore: team === "home" ? Math.max(0, prev.homeScore + delta) : prev.homeScore,
      awayScore: team === "away" ? Math.max(0, prev.awayScore + delta) : prev.awayScore,
    }));
  };

  const handleGoal = (teamId: string, playerId: string, team: "home" | "away") => {
    mutate(`/matches/${match.id}/goal`, { teamId, playerId }, prev => ({
      ...prev,
      homeScore: team === "home" ? prev.homeScore + 1 : prev.homeScore,
      awayScore: team === "away" ? prev.awayScore + 1 : prev.awayScore,
    }));
  };

  const handleClock = (action: "start" | "pause" | "reset") => {
    if (action === "reset" && !window.confirm("Reset clock to 7:30?")) return;
    mutate(`/matches/${match.id}/clock`, { action }, prev => {
      if (action === "start") return { ...prev, clockStartedAt: new Date().toISOString(), clockIsRunning: true };
      if (action === "pause") return { ...prev, clockIsRunning: false, clockStartedAt: null };
      return { ...prev, clockElapsedSeconds: 0, clockIsRunning: false, clockStartedAt: null };
    });
  };

  const handleClockAdjust = (seconds: number) => {
    mutate(`/matches/${match.id}/clock/adjust`, { seconds }, prev => ({
      ...prev,
      clockElapsedSeconds: Math.max(0, (prev.clockElapsedSeconds || 0) + seconds),
    }));
  };

  const handleStat = (eventType: "bowl_in" | "knock_in" | "foul" | "penalty_goal" | "shot_on_goal", teamId: string) => {
    mutate(`/matches/${match.id}/stat`, { eventType, teamId }, prev => prev);
  };

  const handleEvent = (eventType: "penalty" | "horse_change" | "safety" | "injury_timeout", description?: string, teamId?: string) => {
    mutate(`/matches/${match.id}/event`, { eventType, description, teamId }, prev => ({
      ...prev,
      clockIsRunning: false,
      clockStartedAt: null,
    }));
  };

  const handleStatus = (status: string) => {
    if (status === "final" && !window.confirm("End match? This will lock the score.")) return;
    mutate(`/matches/${match.id}/status`, { status }, prev => ({ ...prev, status }));
  };

  const handleChukkerChange = (direction: "forward" | "back") => {
    const current = match.currentChukker || 1;
    if (direction === "back" && current <= 1) return;
    const label = direction === "forward" ? "next" : "previous";
    if (!window.confirm(`Go to ${label} chukker? Clock will reset to 7:30.`)) return;
    const newChukker = direction === "forward" ? current + 1 : Math.max(1, current - 1);
    mutate(`/matches/${match.id}/chukker`, { direction }, prev => ({
      ...prev,
      currentChukker: newChukker,
      clockElapsedSeconds: 0,
      clockIsRunning: false,
      clockStartedAt: null,
    }));
  };

  const handleHalftime = () => {
    mutate(`/matches/${match.id}/status`, { status: "halftime" }, prev => ({ ...prev, status: "halftime" }));
  };

  const isHalftime = match.status === "halftime";

  const statusOptions = [
    { value: "scheduled", label: "Scheduled" },
    { value: "live", label: "Live" },
    { value: "final", label: "Final" },
    { value: "postponed", label: "Postponed" },
  ];

  const renderTeamColumn = (
    team: MatchData["homeTeam"],
    score: number,
    side: "home" | "away",
    players: Player[],
  ) => {
    const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    return (
      <div className="flex flex-col items-center w-5/12">
        <div className="w-14 h-14 rounded-full border-2 overflow-hidden flex items-center justify-center" style={{ borderColor: team?.primaryColor || (dk ? "rgba(255,255,255,0.15)" : "var(--g200)"), background: dk ? "rgba(255,255,255,0.05)" : undefined }}>
          {team?.logoUrl ? (
            <img src={team.logoUrl} className="w-full h-full object-cover" />
          ) : (
            <span className="font-display font-bold text-[14px]" style={dk ? { color: textSecondary } : undefined}>{team?.shortName || (team?.name || "?").substring(0, 2).toUpperCase()}</span>
          )}
        </div>
        <span className="mt-2 text-center font-sans font-medium text-[13px] leading-tight line-clamp-2 h-8" style={dk ? { color: textPrimary } : undefined}>
          {team?.name || (side === "home" ? "Home" : "Away")}
        </span>

        <div className="text-[56px] font-display font-extrabold leading-none my-3 tracking-tighter" style={dk ? { color: "#4caf50" } : undefined}>
          {score}
        </div>

        <div className="flex w-full gap-2">
          <button
            onClick={() => handleScore(side, -1)}
            disabled={isFinal || score === 0}
            className={`h-11 flex-1 rounded-[8px] disabled:opacity-30 flex items-center justify-center font-mono text-lg transition-colors active:scale-95 ${dk ? "" : "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"}`}
            style={dk ? { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" } : undefined}
          >
            -
          </button>
          <button
            onClick={() => handleScore(side, 1)}
            disabled={isFinal}
            className={`h-11 w-2/3 rounded-[8px] disabled:opacity-30 flex items-center justify-center font-mono text-xl font-bold transition-colors active:scale-95 ${dk ? "" : "bg-g50 text-g900 border border-g200 hover:bg-g100"}`}
            style={dk ? { background: btnMuted, color: textPrimary, border: borderCard } : undefined}
          >
            +
          </button>
        </div>

        {players.length > 0 && teamId && (
          <div className="mt-3 w-full space-y-1">
            <span className="text-[10px] font-sans font-semibold uppercase tracking-wider" style={dk ? { color: textMuted } : undefined}>Goal Scorer</span>
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => handleGoal(teamId, p.id, side)}
                disabled={isFinal}
                className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-[6px] disabled:opacity-30 transition-colors text-left active:scale-[0.97] group ${dk ? "" : "bg-g50/60 hover:bg-g100"}`}
                style={dk ? { background: "rgba(255,255,255,0.05)" } : undefined}
              >
                <Plus className="w-3 h-3 flex-shrink-0" style={dk ? { color: "#4caf50" } : undefined} />
                <span className="text-[12px] font-sans font-medium truncate" style={dk ? { color: textPrimary } : undefined}>{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const toggleDark = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem("mc_dark", next ? "1" : "0");
      return next;
    });
  };

  const dk = darkMode;
  const bgPage = dk ? "#111" : undefined;
  const bgCard = dk ? "#1a1a1a" : "#fff";
  const borderCard = dk ? "1px solid rgba(255,255,255,0.08)" : undefined;
  const textPrimary = dk ? "#f0f0f0" : undefined;
  const textSecondary = dk ? "#aaa" : undefined;
  const textMuted = dk ? "#777" : undefined;
  const btnMuted = dk ? "rgba(255,255,255,0.08)" : undefined;
  const btnMutedHover = dk ? "rgba(255,255,255,0.14)" : undefined;
  const btnMutedText = dk ? "#ccc" : undefined;

  return (
    <div className={`min-h-screen ${dk ? "" : "bg-bg"}`} style={dk ? { background: bgPage } : undefined}>
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (match.tournament?.id) {
                navigate(`/tournaments/${match.tournament.id}`);
              } else {
                window.history.back();
              }
            }}
            className={`w-9 h-9 rounded-[8px] flex items-center justify-center transition-colors ${dk ? "" : "bg-white border border-g200 hover:border-g300 card-shadow"}`}
            style={dk ? { background: bgCard, border: borderCard } : undefined}
          >
            <ArrowLeft className="w-4 h-4" style={dk ? { color: textPrimary } : undefined} />
          </button>
          <button
            onClick={toggleDark}
            className={`w-9 h-9 rounded-[8px] flex items-center justify-center transition-colors ${dk ? "" : "bg-white border border-g200 hover:border-g300 card-shadow"}`}
            style={dk ? { background: bgCard, border: borderCard } : undefined}
            title={dk ? "Light mode" : "Dark mode"}
          >
            {dk ? <Sun className="w-4 h-4" style={{ color: "#f5c542" }} /> : <Moon className="w-4 h-4 text-ink2" />}
          </button>
          <div className="flex-1 min-w-0">
            <h1 className={`font-display text-xl font-bold truncate ${dk ? "" : "text-ink"}`} style={dk ? { color: textPrimary } : undefined}>Match Control</h1>
            <p className={`text-[13px] truncate ${dk ? "" : "text-ink2"}`} style={dk ? { color: textSecondary } : undefined}>
              {match.tournament?.name} {match.round ? `- ${match.round}` : ""} {match.field?.name ? `- ${match.field.name}` : ""}
            </p>
          </div>
          {match.status === "live" && (
            <div className="flex items-center gap-1.5 bg-live/10 px-2.5 py-1 rounded-[6px]">
              <div className="w-2 h-2 rounded-full bg-live animate-live-dot" />
              <span className="text-[11px] font-sans font-bold tracking-wider text-live uppercase">Live</span>
            </div>
          )}
        </div>

        <div className={`rounded-[12px] p-6 ${dk ? "" : "bg-white card-shadow"}`} style={dk ? { background: bgCard, border: borderCard } : undefined}>
          <div className="flex justify-between items-stretch">
            {renderTeamColumn(match.homeTeam, match.homeScore, "home", homePlayers)}
            <div className="flex flex-col items-center justify-center px-2">
              <div className="w-px h-full" style={dk ? { background: "rgba(255,255,255,0.1)" } : undefined} />
            </div>
            {renderTeamColumn(match.awayTeam, match.awayScore, "away", awayPlayers)}
          </div>
        </div>

        <div className={`rounded-[12px] p-6 flex flex-col items-center ${dk ? "" : "bg-white card-shadow"}`} style={dk ? { background: bgCard, border: borderCard, minHeight: 220 } : { minHeight: 220 }}>
          <span className="text-[12px] font-sans font-medium uppercase tracking-wider mb-3" style={dk ? { color: textMuted } : undefined}>Game Clock</span>

          <ClockAdjuster
            clockStartedAt={match.clockStartedAt}
            clockElapsedSeconds={match.clockElapsedSeconds}
            clockIsRunning={match.clockIsRunning}
            disabled={isFinal}
            onAdjust={handleClockAdjust}
            dark={dk}
          />

          <div className="flex w-full gap-2 mt-5" style={{ minHeight: 40 }}>
            <Button
              className={`flex-1 h-10 text-[13px] rounded-[8px] ${match.clockIsRunning ? "" : "bg-g700 hover:bg-g900"}`}
              variant={match.clockIsRunning ? "danger" : "default"}
              disabled={isFinal}
              onClick={() => {
                if (match.clockIsRunning) {
                  handleClock("pause");
                } else {
                  if (isHalftime) handleStatus("live");
                  handleClock("start");
                }
              }}
            >
              {match.clockIsRunning ? (
                <><Pause className="w-3.5 h-3.5 mr-1.5 fill-current" /> Pause</>
              ) : (
                <><Play className="w-3.5 h-3.5 mr-1.5 fill-current" /> {isHalftime ? "Halftime" : "Start"}</>
              )}
            </Button>
            <Button
              variant="outline"
              className="h-10 px-3 rounded-[8px] text-[13px] gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
              disabled={isFinal}
              onClick={() => handleEvent("horse_change")}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Horse Change
            </Button>
            <Button
              variant="outline"
              className="w-10 h-10 rounded-[8px]"
              disabled={isFinal || match.clockIsRunning}
              onClick={() => handleClock("reset")}
            >
              <RotateCcw className="w-3.5 h-3.5 text-ink2" />
            </Button>
          </div>
          <div className="flex w-full gap-2 mt-2">
            <Button
              variant="outline"
              className="flex-1 h-10 rounded-[8px] text-[13px] gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              disabled={isFinal}
              onClick={() => handleEvent("safety")}
            >
              <Shield className="w-3.5 h-3.5" /> Safety
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-10 rounded-[8px] text-[13px] gap-1.5 text-rose-700 border-rose-200 hover:bg-rose-50"
              disabled={isFinal}
              onClick={() => handleEvent("injury_timeout")}
            >
              <HeartPulse className="w-3.5 h-3.5" /> Injury T/O
            </Button>
          </div>
        </div>

        {match.homeTeam && match.homeTeamId && (
          <div className={`rounded-[12px] p-4 ${dk ? "" : "bg-white card-shadow"}`} style={dk ? { background: bgCard, border: borderCard } : undefined}>
            <span className="text-[12px] font-sans font-medium uppercase tracking-wider block mb-3" style={dk ? { color: textMuted } : undefined}>{match.homeTeam.name}</span>
            <div className="flex gap-2">
              {[
                { label: "Bowl In", type: "bowl_in" as const },
                { label: "Knock In", type: "knock_in" as const },
                { label: "Foul", type: "foul" as const },
              ].map((s) => (
                <button
                  key={s.type}
                  onClick={() => handleStat(s.type, match.homeTeamId!)}
                  disabled={isFinal}
                  className={`flex-1 py-2.5 px-1 rounded-[8px] font-sans font-bold text-[11px] transition-colors disabled:opacity-30 ${dk ? "" : "bg-g50 text-ink2 hover:bg-g100 hover:text-ink"}`}
                  style={dk ? { background: btnMuted, color: btnMutedText } : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              {[
                { label: "Penalty Goal", type: "penalty_goal" as const },
                { label: "Shot on Goal", type: "shot_on_goal" as const },
              ].map((s) => (
                <button
                  key={s.type}
                  onClick={() => handleStat(s.type, match.homeTeamId!)}
                  disabled={isFinal}
                  className={`flex-1 py-2.5 px-1 rounded-[8px] font-sans font-bold text-[11px] transition-colors disabled:opacity-30 ${dk ? "" : "bg-g50 text-ink2 hover:bg-g100 hover:text-ink"}`}
                  style={dk ? { background: btnMuted, color: btnMutedText } : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              {[
                { label: "Penalty 1", desc: "PENALTY 1" },
                { label: "Penalty 2", desc: "PENALTY 2" },
                { label: "Penalty 3", desc: "PENALTY 3" },
                { label: "Penalty 4", desc: "PENALTY 4" },
                { label: "Penalty 5A", desc: "PENALTY 5A" },
                { label: "Penalty 5B", desc: "PENALTY 5B" },
              ].map((p) => (
                <button
                  key={p.desc}
                  onClick={() => handleEvent("penalty", p.desc, match.homeTeamId!)}
                  disabled={isFinal}
                  className={`flex-1 py-2.5 px-1 rounded-[8px] font-sans font-bold text-[10px] transition-colors disabled:opacity-30 ${dk ? "" : "bg-amber-50 text-amber-800 hover:bg-amber-100"}`}
                  style={dk ? { background: "rgba(202,138,4,0.18)", color: "#facc15" } : undefined}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {match.awayTeam && match.awayTeamId && (
          <div className={`rounded-[12px] p-4 ${dk ? "" : "bg-white card-shadow"}`} style={dk ? { background: bgCard, border: borderCard } : undefined}>
            <span className="text-[12px] font-sans font-medium uppercase tracking-wider block mb-3" style={dk ? { color: textMuted } : undefined}>{match.awayTeam.name}</span>
            <div className="flex gap-2">
              {[
                { label: "Bowl In", type: "bowl_in" as const },
                { label: "Knock In", type: "knock_in" as const },
                { label: "Foul", type: "foul" as const },
              ].map((s) => (
                <button
                  key={s.type}
                  onClick={() => handleStat(s.type, match.awayTeamId!)}
                  disabled={isFinal}
                  className={`flex-1 py-2.5 px-1 rounded-[8px] font-sans font-bold text-[11px] transition-colors disabled:opacity-30 ${dk ? "" : "bg-g50 text-ink2 hover:bg-g100 hover:text-ink"}`}
                  style={dk ? { background: btnMuted, color: btnMutedText } : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              {[
                { label: "Penalty Goal", type: "penalty_goal" as const },
                { label: "Shot on Goal", type: "shot_on_goal" as const },
              ].map((s) => (
                <button
                  key={s.type}
                  onClick={() => handleStat(s.type, match.awayTeamId!)}
                  disabled={isFinal}
                  className={`flex-1 py-2.5 px-1 rounded-[8px] font-sans font-bold text-[11px] transition-colors disabled:opacity-30 ${dk ? "" : "bg-g50 text-ink2 hover:bg-g100 hover:text-ink"}`}
                  style={dk ? { background: btnMuted, color: btnMutedText } : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              {[
                { label: "Penalty 1", desc: "PENALTY 1" },
                { label: "Penalty 2", desc: "PENALTY 2" },
                { label: "Penalty 3", desc: "PENALTY 3" },
                { label: "Penalty 4", desc: "PENALTY 4" },
                { label: "Penalty 5A", desc: "PENALTY 5A" },
                { label: "Penalty 5B", desc: "PENALTY 5B" },
              ].map((p) => (
                <button
                  key={p.desc}
                  onClick={() => handleEvent("penalty", p.desc, match.awayTeamId!)}
                  disabled={isFinal}
                  className={`flex-1 py-2.5 px-1 rounded-[8px] font-sans font-bold text-[10px] transition-colors disabled:opacity-30 ${dk ? "" : "bg-amber-50 text-amber-800 hover:bg-amber-100"}`}
                  style={dk ? { background: "rgba(202,138,4,0.18)", color: "#facc15" } : undefined}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`rounded-[12px] p-6 ${dk ? "" : "bg-white card-shadow"}`} style={dk ? { background: bgCard, border: borderCard } : undefined}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 mr-3">
              <button
                className={`w-10 h-10 rounded-[8px] flex items-center justify-center disabled:opacity-30 transition-colors active:scale-95 shrink-0 ${dk ? "" : "bg-g50 border border-g200 hover:bg-g100"}`}
                style={dk ? { background: btnMuted, border: borderCard } : undefined}
                disabled={isFinal || match.clockIsRunning || (match.currentChukker || 1) <= 1}
                onClick={() => handleChukkerChange("back")}
              >
                <ChevronLeft className="w-5 h-5" style={dk ? { color: btnMutedText } : undefined} />
              </button>
              <span className="font-display font-bold text-xl min-w-[120px] text-center shrink-0" style={dk ? { color: textPrimary } : undefined}>
                Chukker {match.currentChukker}
              </span>
              <button
                className={`w-10 h-10 rounded-[8px] flex items-center justify-center disabled:opacity-30 transition-colors active:scale-95 shrink-0 ${dk ? "" : "bg-g50 border border-g200 hover:bg-g100"}`}
                style={dk ? { background: btnMuted, border: borderCard } : undefined}
                disabled={isFinal || match.clockIsRunning}
                onClick={() => handleChukkerChange("forward")}
              >
                <ChevronRight className="w-5 h-5" style={dk ? { color: btnMutedText } : undefined} />
              </button>
              <Button
                variant="outline"
                className={`flex-1 h-10 rounded-[8px] text-[13px] font-semibold ${isHalftime ? "text-orange-700 border-orange-300 bg-orange-50 hover:bg-orange-100" : "text-orange-700 border-orange-200 hover:bg-orange-50"}`}
                disabled={isFinal || match.clockIsRunning || isHalftime}
                onClick={handleHalftime}
              >
                Halftime
              </Button>
            </div>
            <Button
              variant="danger"
              className="h-10 px-4 rounded-[8px] text-[13px]"
              disabled={isFinal}
              onClick={() => handleStatus("final")}
            >
              <CheckSquare className="w-4 h-4 mr-2" /> End Match
            </Button>
          </div>
        </div>

        <div className={`rounded-[12px] p-4 ${dk ? "" : "bg-white card-shadow"}`} style={dk ? { background: bgCard, border: borderCard } : undefined}>
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="w-4 h-4" style={dk ? { color: textMuted } : undefined} />
            <span className="text-[12px] font-sans font-medium uppercase tracking-wider flex-1" style={dk ? { color: textMuted } : undefined}>Broadcast GFX</span>
            {!previewOpen && (
              <button
                onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[11px] font-semibold transition-colors"
                style={{
                  background: dk ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  color: dk ? "#888" : "#888",
                  border: dk ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <Eye className="w-3 h-3" />
                Preview
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const newVal = !match.broadcastVisible;
                  setMatch(prev => prev ? { ...prev, broadcastVisible: newVal } : prev);
                  mutatePut(`/matches/${match.id}/broadcast`, { broadcastVisible: newVal });
                }}
                className={`flex-1 h-10 rounded-[8px] font-sans font-medium text-[13px] flex items-center justify-center gap-2 transition-colors ${
                  match.broadcastVisible
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-g100 text-ink2 hover:bg-g200"
                }`}
              >
                {match.broadcastVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {match.broadcastVisible ? "Hide" : "Show"}
              </button>
            </div>

            <div className="flex gap-2">
              {([
                { label: "Scorebug", val: "option1" },
                { label: "Stats", val: "stats" },
                { label: "Mini Stats", val: "stats_mini" },
                { label: "Field", val: "field" },
              ] as const).map((b) => {
                const active = b.val === "option1" ? (match.broadcastStyle || "option1") === "option1" : match.broadcastStyle === b.val;
                return (
                  <button
                    key={b.val}
                    onClick={() => {
                      setMatch(prev => prev ? { ...prev, broadcastStyle: b.val } : prev);
                      mutatePut(`/matches/${match.id}/broadcast`, { broadcastStyle: b.val });
                    }}
                    className={`flex-1 py-2.5 px-2 rounded-[8px] font-sans font-medium text-[13px] transition-colors ${
                      active ? "bg-g700 text-white" : dk ? "" : "bg-g50 text-ink2 hover:bg-g100"
                    }`}
                    style={!active && dk ? { background: btnMuted, color: btnMutedText } : undefined}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className={`rounded-[12px] p-4 ${dk ? "" : "bg-white card-shadow"}`} style={dk ? { background: bgCard, border: borderCard } : undefined}>
          <span className="text-[12px] font-sans font-medium uppercase tracking-wider block mb-3" style={dk ? { color: textMuted } : undefined}>Match Status</span>
          <div className="flex gap-2">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatus(opt.value)}
                className={`flex-1 py-2.5 px-2 rounded-[8px] font-sans font-medium text-[13px] transition-colors ${
                  match.status === opt.value
                    ? "bg-g700 text-white"
                    : dk ? "" : "bg-g50 text-ink2 hover:bg-g100 hover:text-ink"
                }`}
                style={match.status !== opt.value && dk ? { background: btnMuted, color: btnMutedText } : undefined}
              >
                {opt.value === "live" && match.status === "live" && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white mr-1.5 animate-live-dot align-middle" />
                )}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`rounded-[12px] p-4 ${dk ? "" : "bg-white card-shadow"}`} style={dk ? { background: bgCard, border: borderCard } : undefined}>
          <button
            onClick={() => setStreamOpen(prev => !prev)}
            className="w-full flex items-center gap-2"
          >
            <Video className="w-4 h-4" style={dk ? { color: textMuted } : undefined} />
            <span className="text-[12px] font-sans font-medium uppercase tracking-wider flex-1 text-left" style={dk ? { color: textMuted } : undefined}>Broadcast URL</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${streamOpen ? "rotate-90" : ""}`} style={dk ? { color: textMuted } : undefined} />
          </button>

          {streamOpen && (
            <div className="mt-3 space-y-3">
              {match.tournament?.clubId ? (
                <>
                  <div className="flex gap-2">
                    {(["ch1", "ch2"] as const).map((ch) => (
                      <Button
                        key={ch}
                        variant="outline"
                        className="flex-1 h-10 rounded-[8px] text-[13px] gap-2"
                        onClick={() => {
                          const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
                          const url = `${base}/broadcast/channel/${match.tournament!.clubId}/${ch}`;
                          navigator.clipboard.writeText(url).then(() => {
                            toast({ title: "URL copied", description: `${ch.toUpperCase()} broadcast URL copied to clipboard` });
                          }).catch(() => {
                            window.prompt(`Copy ${ch.toUpperCase()} URL:`, url);
                          });
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy {ch.toUpperCase()} URL
                      </Button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: dk ? textMuted : "#888" }}>This Match Renders On</label>
                    <div className="flex gap-2">
                      {([
                        { label: "None", val: null as null | "ch1" | "ch2" },
                        { label: "CH1", val: "ch1" as const },
                        { label: "CH2", val: "ch2" as const },
                      ]).map((opt) => {
                        const current = (match.broadcastChannel as "ch1" | "ch2" | null | undefined) ?? null;
                        const active = current === opt.val;
                        return (
                          <button
                            key={String(opt.val)}
                            onClick={async () => {
                              setMatch(prev => prev ? ({ ...prev, broadcastChannel: opt.val } as MatchData) : prev);
                              try {
                                const resp = await apiFetch(`/matches/${match.id}/broadcast`, { method: "PUT", body: JSON.stringify({ broadcastChannel: opt.val }) });
                                if (resp?.releasedFromMatchId && opt.val) {
                                  toast({ title: `${opt.val.toUpperCase()} reassigned`, description: "Another match was released from this channel." });
                                }
                                fetchMatch();
                              } catch {}
                            }}
                            className={`flex-1 py-2 px-2 rounded-[8px] font-sans font-medium text-[12px] transition-colors ${
                              active ? "bg-g700 text-white" : dk ? "" : "bg-g50 text-ink2 hover:bg-g100"
                            }`}
                            style={!active && dk ? { background: btnMuted, color: btnMutedText } : undefined}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[10px]" style={{ color: dk ? textMuted : "#999" }}>
                      The CH1 / CH2 URLs always stay live. Assign a match here and that match's overlay starts rendering on the chosen channel — no need to re-paste URLs in OBS.
                    </p>
                  </div>
                </>
              ) : null}

              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: dk ? textMuted : "#888" }}>Stream URL (YouTube)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={streamUrlLocal ?? ""}
                    onChange={(e) => setStreamUrlLocal(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="flex-1 h-9 px-3 rounded-[8px] text-[13px] font-sans outline-none"
                    style={{
                      background: dk ? "rgba(255,255,255,0.06)" : "#f5f5f5",
                      color: dk ? "#e0e0e0" : "#333",
                      border: dk ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e0e0e0",
                    }}
                    onBlur={() => {
                      const val = (streamUrlLocal ?? "").trim();
                      if (val !== (match.streamUrl || "")) {
                        setMatch(prev => prev ? { ...prev, streamUrl: val || null } : prev);
                        mutatePut(`/matches/${match.id}`, { streamUrl: val || null });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`rounded-[12px] p-4 ${dk ? "" : "bg-white card-shadow"}`} style={dk ? { background: bgCard, border: borderCard } : undefined}>
          <button
            onClick={() => setTimingOpen(prev => !prev)}
            className="w-full flex items-center gap-2"
          >
            <Timer className="w-4 h-4" style={dk ? { color: textMuted } : undefined} />
            <span className="text-[12px] font-sans font-medium uppercase tracking-wider flex-1 text-left" style={dk ? { color: textMuted } : undefined}>Timing Offset</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${timingOpen ? "rotate-90" : ""}`} style={dk ? { color: textMuted } : undefined} />
          </button>

          {timingOpen && (
            <div className="mt-3 space-y-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={dk ? { color: textMuted } : { color: "#888" }}>Stream Anchor</div>
                {match.streamStartedAt ? (
                  <div className="space-y-2">
                    <div className="rounded-[8px] p-3 flex items-start justify-between gap-3" style={dk ? { background: "rgba(255,255,255,0.05)" } : { background: "rgba(0,0,0,0.03)" }}>
                      <div>
                        <div className="text-[12px] font-medium" style={dk ? { color: textPrimary } : undefined}>Stream live since</div>
                        <div className="text-[11px] mt-0.5" style={dk ? { color: textMuted } : { color: "#777" }}>
                          {formatDate(match.streamStartedAt, "MMM d, h:mm:ss a")}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 mt-0.5">
                        <button
                          onClick={() => {
                            setEditAnchorOpen(prev => !prev);
                            setEditAnchorDateInput(
                              new Date(new Date(match.streamStartedAt!).getTime() - new Date().getTimezoneOffset() * 60000)
                                .toISOString().slice(0, 16)
                            );
                          }}
                          className="text-[11px] font-medium"
                          style={dk ? { color: "#86efac" } : { color: "#166534" }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setEditAnchorOpen(false);
                            setMatch(prev => prev ? { ...prev, streamStartedAt: null } : prev);
                            mutatePut(`/matches/${match.id}`, { streamStartedAt: null });
                          }}
                          className="text-[11px] text-red-500 hover:text-red-700 font-medium"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    {editAnchorOpen && (
                      <div className="rounded-[8px] p-3 space-y-3" style={dk ? { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" } : { background: "#f9f9f9", border: "1px solid #e8e8e8" }}>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={dk ? { color: textMuted } : { color: "#888" }}>Shift anchor</div>
                          <div className="flex flex-wrap gap-1.5">
                            {([-60, -30, -10, +10, +30, +60] as const).map(delta => (
                              <button
                                key={delta}
                                className="px-2.5 h-7 rounded-[6px] text-[12px] font-medium font-mono transition-colors"
                                style={dk
                                  ? { background: "rgba(255,255,255,0.08)", color: textPrimary }
                                  : { background: "#f0f0f0", color: "#333" }}
                                onClick={() => {
                                  const current = new Date(match.streamStartedAt!).getTime();
                                  const updated = new Date(current + delta * 1000).toISOString();
                                  setMatch(prev => prev ? { ...prev, streamStartedAt: updated } : prev);
                                  mutatePut(`/matches/${match.id}`, { streamStartedAt: updated });
                                }}
                              >
                                {delta > 0 ? `+${delta}s` : `${delta}s`}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={dk ? { color: textMuted } : { color: "#888" }}>Set exact time</div>
                          <div className="flex gap-2">
                            <input
                              type="datetime-local"
                              className="flex-1 h-8 rounded-[6px] px-2 text-[12px]"
                              style={dk
                                ? { background: "rgba(255,255,255,0.06)", color: "#e0e0e0", border: "1px solid rgba(255,255,255,0.1)" }
                                : { background: "#fff", color: "#333", border: "1px solid #e0e0e0" }}
                              value={editAnchorDateInput}
                              onChange={e => setEditAnchorDateInput(e.target.value)}
                            />
                            <button
                              className="px-3 h-8 rounded-[6px] text-[12px] font-medium transition-colors"
                              style={dk
                                ? { background: "rgba(34,197,94,0.15)", color: "#86efac" }
                                : { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}
                              onClick={() => {
                                if (!editAnchorDateInput) return;
                                const updated = new Date(editAnchorDateInput).toISOString();
                                setMatch(prev => prev ? { ...prev, streamStartedAt: updated } : prev);
                                mutatePut(`/matches/${match.id}`, { streamStartedAt: updated });
                                setEditAnchorOpen(false);
                              }}
                            >
                              Set
                            </button>
                            <button
                              className="px-3 h-8 rounded-[6px] text-[12px] font-medium transition-colors"
                              style={dk
                                ? { background: "rgba(255,255,255,0.06)", color: textMuted }
                                : { background: "#f5f5f5", color: "#555" }}
                              onClick={() => setEditAnchorOpen(false)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-[12px]" style={dk ? { color: textMuted } : { color: "#777" }}>
                      No stream anchor set. Set it now to enable jump-to-video on the spectator timeline.
                    </div>
                    <button
                      className="w-full h-9 rounded-[8px] text-[13px] font-medium flex items-center justify-center gap-2 transition-colors"
                      style={dk
                        ? { background: "rgba(255,255,255,0.08)", color: textPrimary, border: "1px solid rgba(255,255,255,0.15)" }
                        : { background: "#f5f5f5", color: "#333", border: "1px solid #e0e0e0" }}
                      onClick={() => {
                        const now = new Date().toISOString();
                        setMatch(prev => prev ? { ...prev, streamStartedAt: now } : prev);
                        mutatePut(`/matches/${match.id}`, { streamStartedAt: now });
                      }}
                    >
                      <Video className="w-3.5 h-3.5" />
                      Anchor stream to now
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={dk ? { color: textMuted } : { color: "#888" }}>Broadcast Timing</div>
                <div className="flex gap-2 mb-3">
                  {(["studio", "field"] as const).map(loc => (
                    <button
                      key={loc}
                      className={`flex-1 h-9 rounded-[8px] text-[13px] font-medium capitalize transition-colors ${scoringLocationLocal === loc ? "ring-2 ring-green-500" : ""}`}
                      style={scoringLocationLocal === loc
                        ? (dk ? { background: "rgba(34,197,94,0.15)", color: "#86efac" } : { background: "#f0fdf4", color: "#166534" })
                        : (dk ? { background: "rgba(255,255,255,0.06)", color: textMuted } : { background: "#f5f5f5", color: "#555" })}
                      onClick={() => {
                        setScoringLocationLocal(loc);
                        mutatePut(`/matches/${match.id}`, { scoringLocation: loc });
                      }}
                    >
                      {loc === "studio" ? "Studio" : "Field Side"}
                    </button>
                  ))}
                </div>
                {scoringLocationLocal === "field" && (
                  <div>
                    <label className="text-[12px] block mb-1.5" style={dk ? { color: textMuted } : { color: "#777" }}>
                      Broadcast delay (seconds)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="w-full h-9 rounded-[8px] px-3 text-[13px] font-mono"
                      style={dk
                        ? { background: "rgba(255,255,255,0.06)", color: "#e0e0e0", border: "1px solid rgba(255,255,255,0.1)" }
                        : { background: "#f5f5f5", color: "#333", border: "1px solid #e0e0e0" }}
                      value={broadcastOffsetLocal}
                      onChange={e => setBroadcastOffsetLocal(e.target.value)}
                      onBlur={() => {
                        const val = parseFloat(broadcastOffsetLocal);
                        const clamped = isNaN(val) ? 0 : Math.max(0, val);
                        setBroadcastOffsetLocal(String(clamped));
                        if (clamped !== (match.broadcastOffsetSeconds ?? 0)) {
                          setMatch(prev => prev ? { ...prev, broadcastOffsetSeconds: clamped } : prev);
                          mutatePut(`/matches/${match.id}`, { broadcastOffsetSeconds: clamped });
                        }
                      }}
                      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    />
                    <div className="text-[11px] mt-1.5" style={dk ? { color: textMuted } : { color: "#999" }}>
                      Score updates on the broadcast overlay will be delayed by this many seconds.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={`rounded-[12px] p-4 ${dk ? "" : "bg-white card-shadow"}`} style={dk ? { background: bgCard, border: borderCard } : undefined}>
          <button
            onClick={() => setPossessionOpen(prev => !prev)}
            className="w-full flex items-center gap-2"
          >
            <Crosshair className="w-4 h-4" style={dk ? { color: textMuted } : undefined} />
            <span className="text-[12px] font-sans font-medium uppercase tracking-wider flex-1 text-left" style={dk ? { color: textMuted } : undefined}>Possession Tracker</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${possessionOpen ? "rotate-90" : ""}`} style={dk ? { color: textMuted } : undefined} />
          </button>

          {possessionOpen && (
            <div className="mt-3 space-y-3">
              {possessionStats && (
                <div className="rounded-[8px] p-3" style={dk ? { background: "rgba(255,255,255,0.05)" } : { background: "rgba(0,0,0,0.03)" }}>
                  <div className="flex items-center justify-between text-[13px] font-semibold mb-1.5">
                    <span style={dk ? { color: textPrimary } : undefined}>{possessionStats.homePercent}%</span>
                    <span className="text-[11px] uppercase tracking-wider" style={dk ? { color: textMuted } : undefined}>Possession</span>
                    <span style={dk ? { color: textPrimary } : undefined}>{possessionStats.awayPercent}%</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden gap-0.5" style={{ background: "rgba(0,0,0,0.08)" }}>
                    <div style={{ width: `${possessionStats.homePercent}%`, background: match.homeTeam?.primaryColor || "#1B5E20", borderRadius: 4, transition: "width 0.5s", minWidth: possessionStats.homePercent > 0 ? 4 : 0 }} />
                    <div style={{ flex: 1, background: match.awayTeam?.primaryColor || "#6A1B1A", borderRadius: 4, transition: "width 0.5s", minWidth: possessionStats.awayPercent > 0 ? 4 : 0 }} />
                  </div>
                  {possessionState && (
                    <div className="mt-1.5 text-[11px] text-ink3 text-center">
                      Active: <span className="font-semibold text-ink2">{possessionState === "home" ? (match.homeTeam?.name || "Home") : possessionState === "away" ? (match.awayTeam?.name || "Away") : "Loose / 50-50"}</span>
                    </div>
                  )}
                </div>
              )}

              {!possessionToken ? (
                <Button
                  variant="outline"
                  className="w-full h-9 rounded-[8px] text-[13px] gap-2"
                  onClick={async () => {
                    try {
                      const data = await apiFetch(`/matches/${match.id}/possession/token`, { method: "POST", body: JSON.stringify({}) });
                      setPossessionToken(data.token);
                    } catch (e: any) {
                      toast({ title: "Error", description: e.message });
                    }
                  }}
                >
                  <Link className="w-3.5 h-3.5" />
                  Generate Tracker Link
                </Button>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[11px] text-ink3 font-medium">Share this link:</label>
                  <div className="flex gap-1.5">
                    <input
                      readOnly
                      value={`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/possession/${match.id}?token=${possessionToken}`}
                      className="flex-1 h-9 rounded-[8px] border border-g200 bg-g50/50 px-2.5 text-[12px] text-ink2 font-mono select-all focus:outline-none focus:ring-1 focus:ring-g400"
                      onFocus={(e) => e.target.select()}
                    />
                    <Button
                      variant="outline"
                      className="h-9 px-3 rounded-[8px] text-[12px] gap-1.5"
                      onClick={() => {
                        const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/possession/${match.id}?token=${possessionToken}`;
                        navigator.clipboard.writeText(url).then(() => {
                          toast({ title: "Copied", description: "Link copied to clipboard" });
                        }).catch(() => {
                          toast({ title: "Select & copy", description: "Tap the link above and copy manually" });
                        });
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-9 rounded-[8px] text-[13px] gap-1.5"
                  onClick={() => {
                    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
                    window.open(`${base}/possession/${match.id}`, "_blank");
                  }}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  Open Tracker
                </Button>
                <Button
                  variant="outline"
                  className="h-9 rounded-[8px] text-[13px] gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={async () => {
                    if (!confirm("Reset all possession data for this match?")) return;
                    try {
                      await apiFetch(`/matches/${match.id}/possession`, { method: "DELETE" });
                      setPossessionStats(null);
                      setPossessionState(null);
                      toast({ title: "Reset", description: "Possession data cleared" });
                    } catch (e: any) {
                      toast({ title: "Error", description: e.message });
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className={`rounded-[12px] p-4 ${dk ? "" : "bg-white card-shadow"}`} style={dk ? { background: bgCard, border: borderCard } : undefined}>
          <button
            onClick={() => setOutputResOpen(prev => !prev)}
            className="w-full flex items-center gap-2"
          >
            <Monitor className="w-4 h-4" style={dk ? { color: textMuted } : undefined} />
            <span className="text-[12px] font-sans font-medium uppercase tracking-wider flex-1 text-left" style={dk ? { color: textMuted } : undefined}>Output Resolution</span>
            <span className="text-[11px] font-sans font-medium" style={{ color: dk ? textMuted : "#888" }}>
              {((match as any).broadcastResolution || "1080p") === "4k" ? "4K" : "1080P"}
            </span>
            <ChevronRight className={`w-4 h-4 transition-transform ${outputResOpen ? "rotate-90" : ""}`} style={dk ? { color: textMuted } : undefined} />
          </button>

          {outputResOpen && (
            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                {([
                  { label: "1080P", val: "1080p" },
                  { label: "4K", val: "4k" },
                ] as const).map((r) => {
                  const current = (match as any).broadcastResolution || "1080p";
                  const active = current === r.val;
                  return (
                    <button
                      key={r.val}
                      onClick={() => {
                        setMatch(prev => prev ? ({ ...prev, broadcastResolution: r.val } as any) : prev);
                        mutatePut(`/matches/${match.id}/broadcast`, { broadcastResolution: r.val });
                      }}
                      className={`flex-1 py-2 px-2 rounded-[8px] font-sans font-medium text-[12px] transition-colors ${
                        active ? "bg-g700 text-white" : dk ? "" : "bg-g50 text-ink2 hover:bg-g100"
                      }`}
                      style={!active && dk ? { background: btnMuted, color: btnMutedText } : undefined}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>

              {(match.broadcastResolution || "1080p") === "4k" && (
                <FourKAdjustments
                  matchId={match.id}
                  scale={match.broadcast4kScale ?? 100}
                  offsetX={match.broadcast4kOffsetX ?? 0}
                  offsetY={match.broadcast4kOffsetY ?? 0}
                  onChange={(patch) => {
                    setMatch(prev => prev ? ({ ...prev, ...patch } as MatchData) : prev);
                    mutatePut(`/matches/${match.id}/broadcast`, patch);
                  }}
                  dark={dk}
                  textMuted={textMuted}
                  btnMuted={btnMuted}
                  btnMutedText={btnMutedText}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <BroadcastPreview matchId={match.id} dark={dk} broadcastStyle={match.broadcastStyle} broadcastVisible={match.broadcastVisible} broadcastResolution={match.broadcastResolution} broadcast4kScale={match.broadcast4kScale} broadcast4kOffsetX={match.broadcast4kOffsetX} broadcast4kOffsetY={match.broadcast4kOffsetY} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}

function ClockAdjuster({
  clockStartedAt,
  clockElapsedSeconds,
  clockIsRunning,
  disabled,
  onAdjust,
  dark,
}: {
  clockStartedAt: string | null;
  clockElapsedSeconds: number;
  clockIsRunning: boolean;
  disabled: boolean;
  onAdjust: (seconds: number) => void;
  dark?: boolean;
}) {
  const [display, setDisplay] = useState({ m: 7, s: 30 });

  useEffect(() => {
    const compute = () => {
      let elapsed = clockElapsedSeconds;
      if (clockIsRunning && clockStartedAt) {
        elapsed += Math.floor((Date.now() - new Date(clockStartedAt).getTime()) / 1000);
      }
      const remaining = Math.max(0, 450 - elapsed);
      setDisplay({ m: Math.floor(remaining / 60), s: remaining % 60 });
    };
    compute();
    if (!clockIsRunning) return;
    const iv = setInterval(compute, 1000);
    return () => clearInterval(iv);
  }, [clockStartedAt, clockElapsedSeconds, clockIsRunning]);

  const adjBtnClass = dark
    ? "w-10 h-7 flex items-center justify-center rounded-[6px] disabled:opacity-20 transition-colors active:scale-95"
    : "w-10 h-7 flex items-center justify-center rounded-[6px] bg-g50 hover:bg-g100 disabled:opacity-20 transition-colors active:scale-95";
  const adjBtnStyle = dark ? { background: "rgba(255,255,255,0.08)" } : undefined;

  const clockColor = clockIsRunning
    ? (dark ? "#4caf50" : undefined)
    : (dark ? "#f87171" : undefined);
  const clockClass = clockIsRunning ? "text-g700" : "text-red-600";

  const tens = Math.floor(display.s / 10);
  const ones = display.s % 10;

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center gap-1">
        <button className={adjBtnClass} style={adjBtnStyle} disabled={disabled || clockIsRunning} onClick={() => onAdjust(-60)}>
          <ChevronUp className="w-4 h-4" style={dark ? { color: "#aaa" } : undefined} />
        </button>
        <span className={`font-mono text-[48px] leading-none font-bold tracking-tighter ${dark ? "" : clockClass}`} style={dark ? { color: clockColor } : undefined}>
          {String(display.m)}
        </span>
        <button className={adjBtnClass} style={adjBtnStyle} disabled={disabled || clockIsRunning} onClick={() => onAdjust(60)}>
          <ChevronDown className="w-4 h-4" style={dark ? { color: "#aaa" } : undefined} />
        </button>
      </div>
      <span className={`font-mono text-[48px] leading-none font-bold tracking-tighter ${dark ? "" : clockClass}`} style={dark ? { color: clockColor } : undefined}>:</span>
      <div className="flex flex-col items-center gap-1">
        <button className={adjBtnClass} style={adjBtnStyle} disabled={disabled || clockIsRunning} onClick={() => onAdjust(-10)}>
          <ChevronUp className="w-4 h-4" style={dark ? { color: "#aaa" } : undefined} />
        </button>
        <span className={`font-mono text-[48px] leading-none font-bold tracking-tighter ${dark ? "" : clockClass}`} style={dark ? { color: clockColor } : undefined}>
          {String(tens)}
        </span>
        <button className={adjBtnClass} style={adjBtnStyle} disabled={disabled || clockIsRunning} onClick={() => onAdjust(10)}>
          <ChevronDown className="w-4 h-4" style={dark ? { color: "#aaa" } : undefined} />
        </button>
      </div>
      <div className="flex flex-col items-center gap-1">
        <button className={adjBtnClass} style={adjBtnStyle} disabled={disabled || clockIsRunning} onClick={() => onAdjust(-1)}>
          <ChevronUp className="w-4 h-4" style={dark ? { color: "#aaa" } : undefined} />
        </button>
        <span className={`font-mono text-[48px] leading-none font-bold tracking-tighter ${dark ? "" : clockClass}`} style={dark ? { color: clockColor } : undefined}>
          {String(ones)}
        </span>
        <button className={adjBtnClass} style={adjBtnStyle} disabled={disabled || clockIsRunning} onClick={() => onAdjust(1)}>
          <ChevronDown className="w-4 h-4" style={dark ? { color: "#aaa" } : undefined} />
        </button>
      </div>
    </div>
  );
}

function BroadcastPreview({ matchId, dark, broadcastStyle, broadcastVisible, broadcastResolution, broadcast4kScale, broadcast4kOffsetX, broadcast4kOffsetY, open, onClose }: { matchId: string; dark: boolean; broadcastStyle?: string; broadcastVisible?: boolean; broadcastResolution?: string; broadcast4kScale?: number; broadcast4kOffsetX?: number; broadcast4kOffsetY?: number; open: boolean; onClose: () => void }) {
  const [posRight, setPosRight] = useState<number | null>(null);
  const is4K = (broadcastResolution || "1080p") === "4k";
  const scaleParam = broadcast4kScale ?? 100;
  const oxParam = broadcast4kOffsetX ?? 0;
  const oyParam = broadcast4kOffsetY ?? 0;
  const iframeKey = is4K
    ? `${broadcastStyle || "option1"}-${broadcastVisible ? "vis" : "hid"}-4k-${scaleParam}-${oxParam}-${oyParam}`
    : `${broadcastStyle || "option1"}-${broadcastVisible ? "vis" : "hid"}-1080p`;

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      if (w < 1100) {
        setPosRight(null);
        return;
      }
      const contentW = 576;
      const contentLeft = (w - contentW) / 2;
      const rightEdge = contentLeft - 16;
      if (rightEdge < 340) {
        setPosRight(null);
        return;
      }
      setPosRight(w - contentLeft + 16);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  if (posRight === null || !open) return null;

  const previewW = 320;
  const previewH = previewW * (9 / 16);
  const fullScreenStyle = broadcastStyle === "stats" || broadcastStyle === "stats_mini" || broadcastStyle === "field";
  const showFull4K = is4K && fullScreenStyle;
  const iframeW = showFull4K ? 3840 : 1920;
  const iframeH = showFull4K ? 2160 : 1080;
  const scaleRatio = previewW / iframeW;
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const leftPos = Math.max(16, (window.innerWidth - 576) / 2 - previewW - 24);
  const previewSrc = is4K
    ? `${base}/broadcast/scorebug/${matchId}?res=4k&scale=${scaleParam}&ox=${oxParam}&oy=${oyParam}`
    : `${base}/broadcast/scorebug/${matchId}?res=1080p`;

  return (
    <div
      style={{
        position: "fixed",
        top: 24,
        left: leftPos,
        width: previewW,
        zIndex: 50,
      }}
    >
      <div
        style={{
          borderRadius: 10,
          overflow: "hidden",
          border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
          boxShadow: dark ? "0 4px 24px rgba(0,0,0,0.6)" : "0 4px 20px rgba(0,0,0,0.12)",
          background: dark ? "#1a1a1a" : "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderBottom: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-live animate-live-dot" />
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: dark ? "#888" : "#999", flex: 1 }}>
            Broadcast Preview
          </span>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            padding: "2px 5px",
            borderRadius: 3,
            background: is4K ? (dark ? "rgba(74,222,128,0.18)" : "rgba(22,163,74,0.1)") : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
            color: is4K ? (dark ? "#86efac" : "#16a34a") : (dark ? "#888" : "#888"),
          }}>
            {is4K ? "4K" : "1080p"}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              border: "none",
              cursor: "pointer",
              color: dark ? "#666" : "#aaa",
              fontSize: 12,
              lineHeight: 1,
            }}
            title="Close preview"
          >
            x
          </button>
        </div>
        <div style={{ position: "relative", width: previewW, height: previewH, overflow: "hidden", background: "#000" }}>
          <iframe
            key={iframeKey}
            src={previewSrc}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: iframeW,
              height: iframeH,
              transform: `scale(${scaleRatio})`,
              transformOrigin: "top left",
              border: "none",
              pointerEvents: "none",
            }}
            title="Broadcast Preview"
          />
        </div>
      </div>
    </div>
  );
}

function FourKAdjustments({
  scale,
  offsetX,
  offsetY,
  onChange,
  dark,
  textMuted,
  btnMuted,
  btnMutedText,
}: {
  matchId: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  onChange: (patch: { broadcast4kScale?: number; broadcast4kOffsetX?: number; broadcast4kOffsetY?: number }) => void;
  dark: boolean;
  textMuted?: string;
  btnMuted?: string;
  btnMutedText?: string;
}) {
  const clampScale = (v: number) => Math.min(110, Math.max(90, Math.round(v)));
  const clampOffset = (v: number) => Math.min(500, Math.max(-500, Math.round(v)));

  const isDirty = scale !== 100 || offsetX !== 0 || offsetY !== 0;

  const inputStyle: CSSProperties = {
    background: dark ? "rgba(255,255,255,0.06)" : "#f5f5f5",
    color: dark ? "#e0e0e0" : "#333",
    border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e0e0e0",
  };

  const renderField = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onCommit: (v: number) => void,
    suffix?: string,
  ) => (
    <div className="flex-1 min-w-0">
      <label className="block text-[10px] font-sans font-medium uppercase tracking-wider mb-1" style={{ color: dark ? textMuted : "#888" }}>
        {label}
      </label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onCommit(value - step)}
          className="w-7 h-8 rounded-[6px] font-sans font-bold text-[14px] flex items-center justify-center"
          style={{ background: dark ? btnMuted : "#f0f0f0", color: dark ? btnMutedText : "#555" }}
          aria-label={`Decrease ${label}`}
        >
          -
        </button>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            onCommit(next);
          }}
          className="flex-1 min-w-0 h-8 px-2 rounded-[6px] text-[12px] font-mono text-center outline-none"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => onCommit(value + step)}
          className="w-7 h-8 rounded-[6px] font-sans font-bold text-[14px] flex items-center justify-center"
          style={{ background: dark ? btnMuted : "#f0f0f0", color: dark ? btnMutedText : "#555" }}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
        {suffix && (
          <span className="text-[10px] font-sans" style={{ color: dark ? textMuted : "#888" }}>{suffix}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="mt-3 pt-3" style={{ borderTop: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-sans font-medium uppercase tracking-wider" style={dark ? { color: textMuted } : { color: "var(--ink3)" }}>
          4K Fine Tune
        </span>
        {isDirty && (
          <button
            type="button"
            onClick={() => onChange({ broadcast4kScale: 100, broadcast4kOffsetX: 0, broadcast4kOffsetY: 0 })}
            className="text-[10px] font-sans font-medium uppercase tracking-wider"
            style={{ color: dark ? "#aaa" : "#888" }}
          >
            Reset
          </button>
        )}
      </div>
      <div className="flex gap-2">
        {renderField("Scale", scale, 90, 110, 1, (v) => {
          const c = clampScale(v);
          if (c !== scale) onChange({ broadcast4kScale: c });
        }, "%")}
        {renderField("X Nudge", offsetX, -500, 500, 4, (v) => {
          const c = clampOffset(v);
          if (c !== offsetX) onChange({ broadcast4kOffsetX: c });
        }, "px")}
        {renderField("Y Nudge", offsetY, -500, 500, 4, (v) => {
          const c = clampOffset(v);
          if (c !== offsetY) onChange({ broadcast4kOffsetY: c });
        }, "px")}
      </div>
      <p className="mt-2 text-[10px] font-sans leading-snug" style={{ color: dark ? textMuted : "#999" }}>
        Tweaks only apply when broadcasting in 4K. 1080P output is unchanged.
      </p>
    </div>
  );
}
