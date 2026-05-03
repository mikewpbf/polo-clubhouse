import { useRoute, Link } from "wouter";
import { useGetMatch, useListMatchEvents, useSyncMatchAnchor } from "@workspace/api-client-react";
import { SpectatorLayout } from "@/components/layout/SpectatorLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { Badge } from "@/components/ui/badge";
import { MatchClock } from "@/components/MatchClock";
import { formatDate } from "@/lib/utils";
import { MapPin, Calendar, BarChart3, Clock } from "lucide-react";
import { getYouTubeVideoId } from "@/lib/youtube";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getStoredToken, useAuth } from "@/hooks/use-auth";
import { X } from "lucide-react";

interface MatchEvent {
  id: string;
  eventType: string;
  description: string | null;
  teamId: string | null;
  playerId: string | null;
  playerName: string | null;
  teamName: string | null;
  teamColor: string | null;
  chukker: number;
  clockSeconds: number;
  scoreSnapshot: { home: number; away: number } | null;
  createdAt: string;
}

const VISIBLE_EVENT_TYPES = new Set(["goal", "chukker_start", "chukker_end", "match_start", "match_end", "penalty", "horse_change", "bowl_in", "knock_in", "foul", "penalty_goal", "shot_on_goal"]);

function renderEventLabel(evt: MatchEvent, style?: React.CSSProperties, className?: string): React.ReactNode {
  if (evt.eventType === "goal") {
    const playerPart = evt.playerName ? <span>{evt.playerName}</span> : null;
    return (
      <span className={className} style={style}>
        Goal{evt.teamName ? ` \u2014 ${evt.teamName}` : ""}{playerPart ? <span>{" \u2014 "}</span> : null}{playerPart}
      </span>
    );
  }
  let label = evt.eventType.replace(/_/g, " ");
  if (evt.eventType === "penalty") label = evt.description || "Penalty";
  else if (evt.eventType === "horse_change") label = "Horse Change";
  else if (evt.eventType === "bowl_in") label = `Bowl In${evt.teamName ? ` \u2014 ${evt.teamName}` : ""}`;
  else if (evt.eventType === "knock_in") label = `Knock In${evt.teamName ? ` \u2014 ${evt.teamName}` : ""}`;
  else if (evt.eventType === "foul") label = `Foul${evt.teamName ? ` \u2014 ${evt.teamName}` : ""}`;
  else if (evt.eventType === "penalty_goal") label = `Penalty Goal${evt.teamName ? ` \u2014 ${evt.teamName}` : ""}`;
  else if (evt.eventType === "shot_on_goal") label = `Shot on Goal${evt.teamName ? ` \u2014 ${evt.teamName}` : ""}`;
  const playerSuffix = evt.playerName ? ` \u2014 ${evt.playerName}` : "";
  return <span className={className} style={style}>{label}{playerSuffix}</span>;
}

function eventDotColor(evt: MatchEvent): string {
  if (evt.eventType === "goal") return "bg-g500";
  if (evt.eventType === "penalty") return "bg-amber-500";
  if (evt.eventType === "foul") return "bg-red-500";
  if (evt.eventType === "horse_change") return "bg-blue-400";
  if (evt.eventType === "match_start") return "bg-blue-400";
  if (evt.eventType === "match_end") return "bg-ink3";
  return "bg-g300";
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

function formatStreamOffset(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MatchDetail() {
  const [, params] = useRoute("/match/:id");
  const matchId = params?.id || "";

  const { data: match, isLoading, refetch: refetchMatch } = useGetMatch(matchId, {
    query: { refetchInterval: 3000 } as any,
  });
  const { data: events, refetch: refetchEvents } = useListMatchEvents(matchId, {
    query: { refetchInterval: 3000 } as any,
  });
  const { user } = useAuth();
  const canManage = user?.role === "super_admin" || user?.role === "admin";

  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const embedRef = useRef<HTMLDivElement>(null);
  const currentVideoIdRef = useRef<string | null>(null);
  // Mirror of playerReadyRef as state so React re-renders the admin sync
  // strip once the YouTube player is interactive (so chips don't appear
  // before getCurrentTime/pauseVideo are usable).
  const [playerReady, setPlayerReady] = useState(false);

  // Admin sync-strip state. `syncToast` shows the most recent action with an
  // Undo button; the previousAnchor is captured per-action so Undo restores it
  // even after the next refetch.
  const syncMutation = useSyncMatchAnchor();
  const [syncToast, setSyncToast] = useState<{ label: string; previousIso: string | null } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((label: string, previousIso: string | null) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setSyncToast({ label, previousIso });
    toastTimeoutRef.current = setTimeout(() => setSyncToast(null), 10_000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm("Remove this event from the timeline?")) return;
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const token = getStoredToken();
      const res = await fetch(`${base}/api/matches/${matchId}/events/${eventId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || "Failed to delete event");
        return;
      }
      refetchEvents();
    } catch (e: any) {
      alert(e?.message || "Failed to delete event");
    }
  };

  const [matchStats, setMatchStats] = useState<{ home: Record<string, number>; away: Record<string, number>; possession?: { homePercent: number; awayPercent: number } | null } | null>(null);
  useEffect(() => {
    if (!matchId) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const fetchStats = async () => {
      try {
        const token = getStoredToken();
        const res = await fetch(`${base}/api/matches/${matchId}/stats`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) setMatchStats(await res.json());
      } catch {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, [matchId]);

  const seekTo = useCallback((seconds: number) => {
    if (playerReadyRef.current && playerRef.current) {
      playerRef.current.seekTo(seconds, true);
      playerRef.current.playVideo();
      embedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      pendingSeekRef.current = seconds;
      embedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const m = match as Record<string, any> | undefined;
  const videoId = m ? getYouTubeVideoId(m.streamUrl) : null;
  const isLive = m?.status === "live";
  const isHalftime = m?.status === "halftime";
  const hasVideo = !!(videoId && (isLive || isHalftime || m?.status === "final"));
  const autoplay = isLive || isHalftime;

  useEffect(() => {
    if (!hasVideo || !videoId) return;

    const createPlayer = () => {
      if (!embedRef.current) return;
      if (currentVideoIdRef.current === videoId && playerRef.current) return;

      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
        playerReadyRef.current = false;
      }

      currentVideoIdRef.current = videoId;
      const divId = `yt-player-${matchId}`;
      const container = embedRef.current;
      container.innerHTML = `<div id="${divId}"></div>`;

      playerRef.current = new window.YT.Player(divId, {
        width: "100%",
        height: "100%",
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          mute: autoplay ? 1 : 0,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
            setPlayerReady(true);
            if (pendingSeekRef.current !== null) {
              playerRef.current.seekTo(pendingSeekRef.current, true);
              playerRef.current.playVideo();
              pendingSeekRef.current = null;
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        createPlayer();
      };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    }
  }, [videoId, hasVideo, autoplay, matchId]);

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
        playerReadyRef.current = false;
        setPlayerReady(false);
        currentVideoIdRef.current = null;
      }
    };
  }, []);

  // Reset readiness whenever the embedded video changes.
  useEffect(() => {
    setPlayerReady(false);
  }, [videoId]);

  // Anchor candidates for the admin sync strip. Chukker starts come first
  // (one per chukker, in chronological order), then the most recent goals
  // are appended as fallback so the strip always has something to click.
  // Computed before early returns to obey the Rules of Hooks.
  const anchorCandidates = useMemo(() => {
    const mm = match as Record<string, any> | undefined;
    if (!mm) return [] as Array<{ id: string; label: string; tooltip: string }>;
    const canAdmin = !!mm.canAdminMatch;
    const vId = getYouTubeVideoId(mm.streamUrl);
    const status = mm.status;
    const hasVid = !!(vId && (status === "live" || status === "halftime" || status === "final"));
    if (!canAdmin || !hasVid) return [];
    const evts: MatchEvent[] = (mm.events || []) as MatchEvent[];
    const fmtClock = (iso: string) => {
      try {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      } catch { return ""; }
    };
    const chukkerStarts = evts
      .filter(e => e.eventType === "chukker_start")
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(e => {
        const score = e.scoreSnapshot ? `${e.scoreSnapshot.home}-${e.scoreSnapshot.away}` : "";
        const time = fmtClock(e.createdAt);
        const extras = [score, time].filter(Boolean).join(" · ");
        const label = `Ch.${e.chukker ?? "?"} Start${extras ? " · " + extras : ""}`;
        return {
          id: e.id,
          label,
          tooltip: `Pause the video at the moment Chukker ${e.chukker ?? "?"} starts (score ${score || "—"}, ${time}), then click here.`,
        };
      });
    // Spec: include the most recent 2 goals as fallback after chukker starts.
    const goalChips = evts
      .filter(e => e.eventType === "goal" || e.eventType === "penalty_goal")
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 2)
      .map(e => {
        const score = e.scoreSnapshot ? `${e.scoreSnapshot.home}-${e.scoreSnapshot.away}` : "";
        const who = e.playerName ? ` · ${e.playerName}` : "";
        const ck = e.chukker != null ? `Ch.${e.chukker} ` : "";
        const labelExtras = [score, e.playerName].filter(Boolean).join(" · ");
        const label = `${ck}Goal${labelExtras ? " · " + labelExtras : ""}`;
        return {
          id: e.id,
          label,
          tooltip: `Pause the video at the moment of this goal${who}, then click here.`,
        };
      });
    const out = [...chukkerStarts];
    for (const g of goalChips) {
      if (out.length >= 6) break;
      out.push(g);
    }
    return out;
  }, [match]);

  const handleSyncToEvent = useCallback(async (eventId: string, label: string) => {
    if (!playerRef.current || !playerReadyRef.current) return;
    try {
      try { playerRef.current.pauseVideo(); } catch {}
      const videoSeconds = Number(playerRef.current.getCurrentTime?.() ?? 0);
      const result = await syncMutation.mutateAsync({
        matchId,
        data: { mode: "event", eventId, videoSeconds: Math.max(0, videoSeconds) },
      });
      showToast(`Synced to "${label}"`, result.previousStreamStartedAt ?? null);
      refetchMatch();
    } catch (e: any) {
      const msg = e?.message || e?.error?.message || "Failed to sync";
      window.alert(msg);
    }
  }, [matchId, refetchMatch, showToast, syncMutation]);

  const handleNudge = useCallback(async (shiftSeconds: number) => {
    try {
      const result = await syncMutation.mutateAsync({
        matchId,
        data: { mode: "nudge", shiftSeconds },
      });
      const sign = shiftSeconds >= 0 ? "+" : "";
      showToast(`Nudged ${sign}${shiftSeconds}s`, result.previousStreamStartedAt ?? null);
      refetchMatch();
    } catch (e: any) {
      const msg = e?.message || e?.error?.message || "Failed to nudge";
      window.alert(msg);
    }
  }, [matchId, refetchMatch, showToast, syncMutation]);

  const handleUndo = useCallback(async () => {
    if (!syncToast) return;
    const restoreToIso = syncToast.previousIso;
    try {
      await syncMutation.mutateAsync({
        matchId,
        data: { mode: "restore", restoreToIso },
      });
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setSyncToast(null);
      refetchMatch();
    } catch (e: any) {
      const msg = e?.message || e?.error?.message || "Failed to undo";
      window.alert(msg);
    }
  }, [matchId, refetchMatch, syncMutation, syncToast]);

  if (isLoading) return <SpectatorLayout><PageLoading /></SpectatorLayout>;
  if (!match) return <SpectatorLayout><EmptyState title="Match not found" /></SpectatorLayout>;

  const homeTeam = m!.homeTeam;
  const awayTeam = m!.awayTeam;
  const field = m!.field;
  const tournament = m!.tournament;
  const rawEvents: MatchEvent[] = (m!.events || events || []);
  const eventList = rawEvents
    .filter(e => VISIBLE_EVENT_TYPES.has(e.eventType))
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const showClock = m!.status === "live" || m!.status === "halftime";

  const streamStartedAt: string | null = m!.streamStartedAt || null;
  const streamAnchorMs = streamStartedAt ? new Date(streamStartedAt).getTime() : null;
  const canAdminMatch: boolean = !!m!.canAdminMatch;
  // Wait for the YouTube player to be ready before rendering the strip so
  // admins can't click a chip before getCurrentTime/pauseVideo are usable.
  const showSyncStrip = canAdminMatch && hasVideo && playerReady;
  const noAnchorYet = streamAnchorMs === null;

  return (
    <SpectatorLayout>
      <div className="space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {isLive && <div className="w-2 h-2 rounded-full bg-live animate-live-dot" />}
            <Badge variant={isLive ? "destructive" : m!.status === "final" ? "default" : "status"}>
              {String(m!.status || "").replace("_", " ").toUpperCase()}
            </Badge>
          </div>
          {tournament && (
            <p className="text-[14px] text-ink2 font-medium">{tournament.name}</p>
          )}
        </div>

        {hasVideo && (
          <div className="rounded-[12px] overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <div
              ref={embedRef}
              className="w-full h-full [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:block"
              style={{ background: "#000" }}
            />
          </div>
        )}

        {showSyncStrip && (
          <div
            className="bg-white rounded-[12px] px-4 py-3 border border-line2"
            style={{ boxShadow: 'var(--shadow-card)' }}
            data-testid="admin-sync-strip"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink3">
                Video Sync · Admin
                {noAnchorYet && (
                  <span className="ml-2 normal-case font-normal text-ink3">— pick an event to set the initial anchor</span>
                )}
              </span>
              <div className="flex items-center gap-1" title={noAnchorYet ? "Set an anchor first by clicking an event chip below." : undefined}>
                <button
                  onClick={(e) => handleNudge(e.shiftKey ? -0.5 : -5)}
                  title="Shift anchor 5s earlier (hold Shift for 0.5s)"
                  className="px-2 py-1 text-[11px] font-mono rounded border border-line2 hover:bg-g50 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={syncMutation.isPending || noAnchorYet}
                  data-testid="sync-nudge-minus-5"
                >−5s</button>
                <button
                  onClick={(e) => handleNudge(e.shiftKey ? -0.5 : -1)}
                  title="Shift anchor 1s earlier (hold Shift for 0.5s)"
                  className="px-2 py-1 text-[11px] font-mono rounded border border-line2 hover:bg-g50 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={syncMutation.isPending || noAnchorYet}
                  data-testid="sync-nudge-minus-1"
                >−1s</button>
                <button
                  onClick={(e) => handleNudge(e.shiftKey ? 0.5 : 1)}
                  title="Shift anchor 1s later (hold Shift for 0.5s)"
                  className="px-2 py-1 text-[11px] font-mono rounded border border-line2 hover:bg-g50 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={syncMutation.isPending || noAnchorYet}
                  data-testid="sync-nudge-plus-1"
                >+1s</button>
                <button
                  onClick={(e) => handleNudge(e.shiftKey ? 0.5 : 5)}
                  title="Shift anchor 5s later (hold Shift for 0.5s)"
                  className="px-2 py-1 text-[11px] font-mono rounded border border-line2 hover:bg-g50 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={syncMutation.isPending || noAnchorYet}
                  data-testid="sync-nudge-plus-5"
                >+5s</button>
              </div>
            </div>
            {anchorCandidates.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {anchorCandidates.map(chip => (
                  <button
                    key={chip.id}
                    onClick={() => handleSyncToEvent(chip.id, chip.label)}
                    title={chip.tooltip}
                    disabled={syncMutation.isPending}
                    className="px-2.5 py-1 text-[12px] font-medium rounded-[6px] bg-g50 hover:bg-g100 text-ink border border-line2 transition-colors disabled:opacity-50"
                    data-testid={`sync-chip-${chip.id}`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-ink3">No anchor candidates yet — record a chukker start or goal first.</p>
            )}
            <p className="mt-2 text-[10px] text-ink3 leading-tight">
              Pause the video at the moment you see an event happen on screen, then click its chip. The whole timeline re-aligns.
            </p>
          </div>
        )}

        {syncToast && (
          <div
            className="bg-ink text-white rounded-[10px] px-4 py-2.5 flex items-center justify-between gap-3"
            data-testid="sync-toast"
          >
            <span className="text-[13px] font-medium">{syncToast.label}</span>
            <button
              onClick={handleUndo}
              disabled={syncMutation.isPending}
              className="text-[12px] font-semibold underline hover:text-g100 disabled:opacity-50"
              data-testid="sync-undo"
            >
              Undo
            </button>
          </div>
        )}

        <div className={`bg-white rounded-[12px] p-8 ${isLive ? "border border-live/20" : ""}`} style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="flex items-start justify-between">
            <div className="flex flex-col items-center flex-1">
              <div
                className="w-16 h-16 rounded-full border-2 bg-g50 flex items-center justify-center overflow-hidden"
                style={{ borderColor: homeTeam?.primaryColor || "var(--g100)" }}
              >
                {homeTeam?.logoUrl ? (
                  <img src={homeTeam.logoUrl} alt={homeTeam.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display font-bold text-g700 text-lg">{homeTeam?.shortName || homeTeam?.name?.substring(0, 2) || ""}</span>
                )}
              </div>
              <span className="mt-3 font-sans font-medium text-[15px] text-ink text-center">{homeTeam?.name || "TBD"}</span>
              <span className="mt-2 font-display font-bold text-5xl" style={{ color: homeTeam?.primaryColor || "var(--ink)" }}>
                {Number(m!.homeScore || 0)}
              </span>
              {homeTeam?.players?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line2 w-full">
                  {homeTeam.players
                    .sort((a: any, b: any) => (a.position || 99) - (b.position || 99))
                    .slice(0, 4)
                    .map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between py-1">
                      {p.id ? (
                        <Link href={`/players/${p.id}`} className="text-[13px] font-sans text-ink hover:text-g700 hover:underline">{p.name}</Link>
                      ) : (
                        <span className="text-[13px] font-sans text-ink">{p.name}</span>
                      )}
                      {p.handicap != null && (
                        <span className="text-[11px] font-mono text-ink3 bg-g50 px-1.5 py-0.5 rounded-[4px]">{Number(p.handicap) > 0 ? `+${p.handicap}` : p.handicap}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col items-center justify-center px-4 pt-6">
              {showClock && (
                <>
                  <MatchClock
                    clockStartedAt={m!.clockStartedAt ?? null}
                    clockElapsedSeconds={m!.clockElapsedSeconds ?? 0}
                    clockIsRunning={m!.clockIsRunning ?? false}
                    status={m!.status}
                    size="lg"
                    lastGoalScorerName={m!.lastGoalScorerName}
                    lastGoalTimestamp={m!.lastGoalTimestamp}
                    lastStoppageEvent={m!.lastStoppageEvent}
                  />
                  {!isHalftime && (
                    <div className="mt-2 text-[13px] text-ink3">
                      Chukker {Number(m!.currentChukker || 1)}
                    </div>
                  )}
                </>
              )}
              {m!.status === "scheduled" && (
                <span className="text-2xl font-display font-bold text-g300">vs</span>
              )}
              {m!.status === "final" && (
                <span className="text-[13px] font-sans text-ink3 uppercase tracking-wider font-semibold">Final</span>
              )}
            </div>

            <div className="flex flex-col items-center flex-1">
              <div
                className="w-16 h-16 rounded-full border-2 bg-g50 flex items-center justify-center overflow-hidden"
                style={{ borderColor: awayTeam?.primaryColor || "var(--g100)" }}
              >
                {awayTeam?.logoUrl ? (
                  <img src={awayTeam.logoUrl} alt={awayTeam.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display font-bold text-g700 text-lg">{awayTeam?.shortName || awayTeam?.name?.substring(0, 2) || ""}</span>
                )}
              </div>
              <span className="mt-3 font-sans font-medium text-[15px] text-ink text-center">{awayTeam?.name || "TBD"}</span>
              <span className="mt-2 font-display font-bold text-5xl" style={{ color: awayTeam?.primaryColor || "var(--ink)" }}>
                {Number(m!.awayScore || 0)}
              </span>
              {awayTeam?.players?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line2 w-full">
                  {awayTeam.players
                    .sort((a: any, b: any) => (a.position || 99) - (b.position || 99))
                    .slice(0, 4)
                    .map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between py-1">
                      {p.id ? (
                        <Link href={`/players/${p.id}`} className="text-[13px] font-sans text-ink hover:text-g700 hover:underline">{p.name}</Link>
                      ) : (
                        <span className="text-[13px] font-sans text-ink">{p.name}</span>
                      )}
                      {p.handicap != null && (
                        <span className="text-[11px] font-mono text-ink3 bg-g50 px-1.5 py-0.5 rounded-[4px]">{Number(p.handicap) > 0 ? `+${p.handicap}` : p.handicap}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-line flex items-center justify-center gap-6 text-[14px] text-ink2 font-medium">
            {field && <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5" />{field.name}</span>}
            {m!.scheduledAt && <span className="flex items-center"><Calendar className="w-4 h-4 mr-1.5" />{formatDate(String(m!.scheduledAt), "MMM d, h:mm a")}</span>}
            {m!.round && <span>{String(m!.round)}</span>}
          </div>
        </div>

        {matchStats && (homeTeam || awayTeam) && (
          <div className="bg-white rounded-[12px] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="p-5">
              <h2 className="font-display font-bold text-lg text-ink mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-g500" />
                Match Stats
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-line2">
                      <th className="text-left py-2 pr-3 font-sans font-medium text-ink3 w-[140px]">Team</th>
                      {[
                        { key: "goal", label: "Goals" },
                        { key: "foul", label: "Fouls" },
                        { key: "bowl_in", label: "Bowl Ins" },
                        { key: "knock_in", label: "Knock Ins" },
                        { key: "penalty_goal", label: "Pen. Goals" },
                        { key: "shot_on_goal", label: "Shots" },
                        { key: "shot_accuracy", label: "Conversion" },
                      ].map(col => (
                        <th key={col.key} className="text-center py-2 px-2 font-sans font-medium text-ink3">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { side: "home", team: homeTeam, stats: matchStats.home },
                      { side: "away", team: awayTeam, stats: matchStats.away },
                    ].map(row => {
                      const shots = row.stats["shot_on_goal"] || 0;
                      const goals = (row.stats["goal"] || 0) + (row.stats["penalty_goal"] || 0);
                      const accuracy = shots === 0 ? "—" : `${Math.round((goals / shots) * 100)}%`;
                      return (
                      <tr key={row.side} className="border-b border-line2 last:border-0">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: row.team?.primaryColor || "var(--g300)" }}
                            />
                            <span className="font-sans font-medium text-ink truncate">{row.team?.name || (row.side === "home" ? "Home" : "Away")}</span>
                          </div>
                        </td>
                        {["goal", "foul", "bowl_in", "knock_in", "penalty_goal", "shot_on_goal"].map(key => (
                          <td key={key} className="text-center py-3 px-2 font-mono text-ink2">
                            {row.stats[key] || 0}
                          </td>
                        ))}
                        <td className="text-center py-3 px-2 font-mono text-ink2">
                          {accuracy}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              {matchStats.possession && matchStats.possession.homePercent + matchStats.possession.awayPercent > 0 && (
                <div className="mt-4 pt-4 border-t border-line2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-semibold text-ink">{matchStats.possession.homePercent}%</span>
                    <span className="text-[12px] font-medium text-ink3 uppercase tracking-wider">Possession</span>
                    <span className="text-[13px] font-semibold text-ink">{matchStats.possession.awayPercent}%</span>
                  </div>
                  <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5" style={{ background: "var(--g100)" }}>
                    <div style={{ width: `${matchStats.possession.homePercent}%`, background: homeTeam?.primaryColor || "var(--g500)", borderRadius: 4, transition: "width 0.5s", minWidth: matchStats.possession.homePercent > 0 ? 4 : 0 }} />
                    <div style={{ flex: 1, background: awayTeam?.primaryColor || "#6A1B1A", borderRadius: 4, transition: "width 0.5s", minWidth: matchStats.possession.awayPercent > 0 ? 4 : 0 }} />
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        )}

        {eventList.length > 0 && (() => {
          const goalEvents = rawEvents.filter(e => e.eventType === "goal" || e.eventType === "penalty_goal");
          const scorerMap = new Map<string, { playerId: string | null; name: string; teamName: string | null; teamColor: string | null; goals: number }>();
          for (const evt of goalEvents) {
            if (!evt.playerName) continue;
            const pid = (evt as { playerId?: string | null }).playerId ?? null;
            const key = pid ? `id:${pid}` : `name:${evt.playerName}`;
            if (!scorerMap.has(key)) {
              scorerMap.set(key, { playerId: pid, name: evt.playerName, teamName: evt.teamName, teamColor: evt.teamColor, goals: 0 });
            }
            scorerMap.get(key)!.goals++;
          }
          const topScorers = Array.from(scorerMap.values())
            .sort((a, b) => b.goals - a.goals)
            .slice(0, 3);

          const chukkerMap = new Map<number | null, MatchEvent[]>();
          for (const evt of eventList) {
            const ck = evt.chukker ?? null;
            if (!chukkerMap.has(ck)) chukkerMap.set(ck, []);
            chukkerMap.get(ck)!.push(evt);
          }
          const chukkerGroups = Array.from(chukkerMap.entries())
            .map(([chukker, events]) => ({ chukker, events }))
            .sort((a, b) => {
              if (a.chukker == null) return 1;
              if (b.chukker == null) return -1;
              return (b.chukker) - (a.chukker);
            });
          return (
            <>
              {topScorers.length > 0 && (
                <div className="bg-white rounded-[12px] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
                  <div className="p-5">
                    <h2 className="font-display font-bold text-lg text-ink mb-4">Top Scorers</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px] font-sans">
                        <thead>
                          <tr className="border-b border-line text-ink3 text-left">
                            <th className="pb-2 font-medium">#</th>
                            <th className="pb-2 font-medium">Player</th>
                            <th className="pb-2 font-medium">Team</th>
                            <th className="pb-2 font-medium text-center">Goals</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topScorers.map((scorer, i) => (
                            <tr key={i} className="border-b border-line2 last:border-0">
                              <td className="py-2.5 font-mono text-ink3">{i + 1}</td>
                              <td className="py-2.5 font-medium text-ink">
                                {scorer.playerId ? (
                                  <Link href={`/players/${scorer.playerId}`} className="hover:text-g700 hover:underline">{scorer.name}</Link>
                                ) : (
                                  scorer.name
                                )}
                              </td>
                              <td className="py-2.5 text-ink2">{scorer.teamName || ""}</td>
                              <td className="py-2.5 text-center font-medium">{scorer.goals}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-[12px] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="p-5">
                  <h2 className="font-display font-bold text-lg text-ink mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-g500" />
                    Match Timeline
                  </h2>
                  <div className="space-y-0">
                    {chukkerGroups.map((group, gi) => (
                      <div key={gi}>
                        {group.chukker != null && (
                          <div className={`py-2.5 ${gi > 0 ? "border-t border-line2 mt-2" : ""}`}>
                            <span className="text-[12px] font-semibold text-ink2 uppercase tracking-wide">Chukker {group.chukker}</span>
                          </div>
                        )}
                        <div>
                          {group.events.map((evt: MatchEvent) => {
                            const positiveTeamEvent = !!evt.teamColor && ["bowl_in", "knock_in", "goal", "penalty_goal"].includes(evt.eventType);
                            const isGoal = evt.eventType === "goal" || evt.eventType === "penalty_goal";
                            const teamColor = evt.teamColor as string | null;

                            const evtMs = new Date(evt.createdAt).getTime();
                            let streamOffsetSeconds: number | null = null;
                            let isBeforeStream = false;

                            if (streamAnchorMs !== null) {
                              const diff = (evtMs - streamAnchorMs) / 1000;
                              if (diff >= 0) {
                                streamOffsetSeconds = diff;
                              } else {
                                isBeforeStream = true;
                              }
                            }

                            const isClickable = streamOffsetSeconds !== null && hasVideo;

                            const handleRowActivate = () => {
                              if (isClickable) seekTo(streamOffsetSeconds!);
                            };

                            return (
                              <div
                                key={evt.id}
                                onClick={isClickable ? handleRowActivate : undefined}
                                onKeyDown={
                                  isClickable
                                    ? (e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          handleRowActivate();
                                        }
                                      }
                                    : undefined
                                }
                                role={isClickable ? "button" : undefined}
                                tabIndex={isClickable ? 0 : undefined}
                                title={
                                  isClickable
                                    ? `Jump to ${formatStreamOffset(streamOffsetSeconds!)} in video`
                                    : undefined
                                }
                                className={`relative flex items-start gap-3 py-2.5 pl-3 pr-1 border-b border-line2 last:border-0 ${
                                  isClickable
                                    ? "cursor-pointer hover:bg-g50 focus:bg-g50 focus:outline-none transition-colors"
                                    : ""
                                }`}
                              >
                                {positiveTeamEvent && teamColor ? (
                                  <div
                                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                                    style={{ backgroundColor: teamColor }}
                                  />
                                ) : (
                                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${eventDotColor(evt)}`} />
                                )}
                                <div className="flex-1 min-w-0">
                                  {renderEventLabel(
                                    evt,
                                    positiveTeamEvent && teamColor ? { color: teamColor } : undefined,
                                    `text-[13px] font-sans capitalize ${isGoal ? "font-bold" : "font-medium"} ${positiveTeamEvent ? "" : "text-ink"}`,
                                  )}
                                  {evt.clockSeconds != null && (
                                    <span className="text-[12px] text-ink3 ml-2">
                                      {(() => { const remaining = Math.max(0, 450 - (evt.clockSeconds || 0)); return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`; })()}
                                    </span>
                                  )}
                                </div>
                                {evt.scoreSnapshot && (
                                  <span className="text-[12px] font-mono text-ink2">
                                    {evt.scoreSnapshot.home} - {evt.scoreSnapshot.away}
                                  </span>
                                )}
                                {canManage && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteEvent(evt.id); }}
                                    className="ml-2 p-1 rounded hover:bg-red-50 text-ink3 hover:text-red-600 transition-colors shrink-0"
                                    title="Remove event"
                                    aria-label="Remove event"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {streamAnchorMs !== null && hasVideo && (
                    <p className="mt-3 text-[11px] text-ink3 text-center">
                      Jump-to works best on replays. Live streams may seek to the live edge.
                    </p>
                  )}
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </SpectatorLayout>
  );
}
