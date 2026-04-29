import { useRoute } from "wouter";
import { useGetMatch, useListMatchEvents } from "@workspace/api-client-react";
import { SpectatorLayout } from "@/components/layout/SpectatorLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { Badge } from "@/components/ui/badge";
import { MatchClock } from "@/components/MatchClock";
import { formatDate } from "@/lib/utils";
import { MapPin, Calendar, BarChart3, Clock } from "lucide-react";
import { getYouTubeEmbedUrl } from "@/lib/youtube";
import { useState, useEffect } from "react";
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

function formatEventLabel(evt: MatchEvent): string {
  if (evt.eventType === "goal") {
    const parts = ["Goal"];
    if (evt.teamName) parts.push(evt.teamName);
    if (evt.playerName) parts.push(evt.playerName);
    return parts.join(" \u2014 ");
  }
  if (evt.eventType === "penalty") return evt.description || "Penalty";
  if (evt.eventType === "horse_change") return "Horse Change";
  if (evt.eventType === "bowl_in") return `Bowl In${evt.teamName ? ` — ${evt.teamName}` : ""}`;
  if (evt.eventType === "knock_in") return `Knock In${evt.teamName ? ` — ${evt.teamName}` : ""}`;
  if (evt.eventType === "foul") return `Foul${evt.teamName ? ` — ${evt.teamName}` : ""}`;
  if (evt.eventType === "penalty_goal") return `Penalty Goal${evt.teamName ? ` — ${evt.teamName}` : ""}`;
  if (evt.eventType === "shot_on_goal") return `Shot on Goal${evt.teamName ? ` — ${evt.teamName}` : ""}`;
  return evt.eventType.replace(/_/g, " ");
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

export function MatchDetail() {
  const [, params] = useRoute("/match/:id");
  const matchId = params?.id || "";

  const { data: match, isLoading } = useGetMatch(matchId, {
    query: { refetchInterval: 3000 },
  });
  const { data: events, refetch: refetchEvents } = useListMatchEvents(matchId, {
    query: { refetchInterval: 3000 },
  });
  const { user } = useAuth();
  const canManage = user?.role === "super_admin" || user?.role === "admin";

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

  if (isLoading) return <SpectatorLayout><PageLoading /></SpectatorLayout>;
  if (!match) return <SpectatorLayout><EmptyState title="Match not found" /></SpectatorLayout>;

  const m = match as any;
  const homeTeam = m.homeTeam;
  const awayTeam = m.awayTeam;
  const field = m.field;
  const tournament = m.tournament;
  const rawEvents: MatchEvent[] = (m.events || events || []);
  const eventList = rawEvents
    .filter(e => VISIBLE_EVENT_TYPES.has(e.eventType))
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const isLive = m.status === "live";
  const isHalftime = m.status === "halftime";
  const showClock = isLive || isHalftime;

  const liveEmbedUrl = (isLive || isHalftime) ? getYouTubeEmbedUrl(m.streamUrl) : null;
  const replayEmbedUrl = (m.status === "final" && m.streamUrl) ? getYouTubeEmbedUrl(m.streamUrl)?.replace("autoplay=1&mute=1&", "") : null;

  return (
    <SpectatorLayout>
      <div className="space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {isLive && <div className="w-2 h-2 rounded-full bg-live animate-live-dot" />}
            <Badge variant={isLive ? "destructive" : m.status === "final" ? "default" : "status"}>
              {String(m.status || "").replace("_", " ").toUpperCase()}
            </Badge>
          </div>
          {tournament && (
            <p className="text-[14px] text-ink2 font-medium">{tournament.name}</p>
          )}
        </div>

        {liveEmbedUrl && (
          <div className="rounded-[12px] overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <iframe
              src={liveEmbedUrl}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
              title="Live Stream"
            />
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
                {Number(m.homeScore || 0)}
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
                    clockStartedAt={m.clockStartedAt ?? null}
                    clockElapsedSeconds={m.clockElapsedSeconds ?? 0}
                    clockIsRunning={m.clockIsRunning ?? false}
                    status={m.status}
                    size="lg"
                    lastGoalScorerName={m.lastGoalScorerName}
                    lastGoalTimestamp={m.lastGoalTimestamp}
                    lastStoppageEvent={m.lastStoppageEvent}

                  />
                  {!isHalftime && (
                    <div className="mt-2 text-[13px] text-ink3">
                      Chukker {Number(m.currentChukker || 1)}
                    </div>
                  )}
                </>
              )}
              {m.status === "scheduled" && (
                <span className="text-2xl font-display font-bold text-g300">vs</span>
              )}
              {m.status === "final" && (
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
                {Number(m.awayScore || 0)}
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
            {m.scheduledAt && <span className="flex items-center"><Calendar className="w-4 h-4 mr-1.5" />{formatDate(String(m.scheduledAt), "MMM d, h:mm a")}</span>}
            {m.round && <span>{String(m.round)}</span>}
          </div>
        </div>

        {replayEmbedUrl && (
          <div className="rounded-[12px] overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <iframe
              src={replayEmbedUrl}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
              title="Match Replay"
            />
          </div>
        )}

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
            const pid = (evt as any).playerId ?? null;
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
                            return (
                              <div
                                key={evt.id}
                                className="relative flex items-start gap-3 py-2.5 pl-3 pr-1 border-b border-line2 last:border-0"
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
                                  <span
                                    className={`text-[13px] font-sans capitalize ${isGoal ? "font-bold" : "font-medium"} ${positiveTeamEvent ? "" : "text-ink"}`}
                                    style={positiveTeamEvent && teamColor ? { color: teamColor } : undefined}
                                  >
                                    {formatEventLabel(evt)}
                                  </span>
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
                                    onClick={() => handleDeleteEvent(evt.id)}
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
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </SpectatorLayout>
  );
}
