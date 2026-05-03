import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useGetTournament, useGetTournamentStandings, useGetTournamentTopScorers } from "@workspace/api-client-react";
import type { TopScorer } from "@workspace/api-client-react";
import { SpectatorLayout } from "@/components/layout/SpectatorLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { MatchClock } from "@/components/MatchClock";
import { Trophy, Calendar, MapPin, Pencil, CalendarPlus, Star, Award } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

function toICSDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function exportCalendar(tournament: any, matches: any[]) {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Polo Clubhouse//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  matches.forEach((m: any) => {
    if (!m.scheduledAt) return;
    const home = m.homeTeam?.name || "TBD";
    const away = m.awayTeam?.name || "TBD";
    const start = toICSDate(m.scheduledAt);
    const endTime = new Date(new Date(m.scheduledAt).getTime() + 2 * 60 * 60 * 1000);
    const end = toICSDate(endTime.toISOString());
    lines.push(
      "BEGIN:VEVENT",
      `UID:match-${m.id}@poloclubhouse`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${home} vs ${away}`,
      `DESCRIPTION:${tournament.name}${m.round ? " - " + m.round : ""}`,
      `LOCATION:${m.field?.name || "TBA"}`,
      "END:VEVENT",
    );
  });

  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${tournament.name.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

interface StandingRow {
  teamId: string;
  team: { id: string; name: string; shortName?: string; primaryColor?: string } | null;
  won: number;
  lost: number;
  goalDifference: number;
  grossGoals: number;
}

interface MatchRow {
  id: string;
  status: string;
  round?: string | number;
  scheduledAt?: string | null;
  homeScore: number;
  awayScore: number;
  homeTeam?: { name: string; shortName?: string; primaryColor?: string; logoUrl?: string | null } | null;
  awayTeam?: { name: string; shortName?: string; primaryColor?: string; logoUrl?: string | null } | null;
  field?: { name: string } | null;
  clockStartedAt?: string | null;
  clockElapsedSeconds?: number;
  clockIsRunning?: boolean;
  currentChukker?: number;
}

interface MvpData {
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamName: string | null;
  gamesPlayed: number;
  goalsScored: number;
}

interface BppData {
  horseId: string;
  horseName?: string;
  playerId?: string | null;
  playerName?: string;
  teamName?: string;
  owner?: string;
  breeder?: string;
  ownedAndBredBy?: string;
  age?: number;
  color?: string;
  sex?: string;
  typeOrBreed?: string;
  sire?: string;
  dam?: string;
  gamesPlayed?: number;
  notes?: string;
  displaySettings: Record<string, boolean>;
}

function MVPDisplay({ tournamentId }: { tournamentId: string }) {
  const [data, setData] = useState<MvpData | null>(null);

  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}/mvp`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {});
  }, [tournamentId]);

  if (!data) return null;

  return (
    <div className="bg-white rounded-[12px] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="p-5">
        <h2 className="font-display font-bold text-lg text-ink mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Most Valuable Player
        </h2>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-yellow-50 border-2 border-yellow-200 flex items-center justify-center">
            <Star className="w-6 h-6 text-yellow-500" />
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-xl text-ink">
              {data.playerId ? (
                <Link href={`/players/${data.playerId}`} className="hover:text-g700 hover:underline">{data.playerName}</Link>
              ) : (
                data.playerName
              )}
            </div>
            {data.teamName && <div className="text-[14px] text-ink2">{data.teamName}</div>}
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <div className="font-display font-bold text-xl text-ink">{data.gamesPlayed}</div>
              <div className="text-[12px] text-ink3">Games</div>
            </div>
            <div>
              <div className="font-display font-bold text-xl text-ink">{data.goalsScored}</div>
              <div className="text-[12px] text-ink3">Goals</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BPPDisplay({ tournamentId }: { tournamentId: string }) {
  const [data, setData] = useState<BppData | null>(null);

  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}/bpp`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {});
  }, [tournamentId]);

  if (!data || !data.horseId) return null;

  const details: { label: string; value: string }[] = [];
  if (data.owner) details.push({ label: "Owner", value: data.owner });
  if (data.breeder) details.push({ label: "Breeder", value: data.breeder });
  if (data.age) details.push({ label: "Age", value: String(data.age) });
  if (data.color) details.push({ label: "Color", value: data.color });
  if (data.sex) details.push({ label: "Sex", value: data.sex });
  if (data.ownedAndBredBy) details.push({ label: "Owned & Bred By", value: data.ownedAndBredBy });
  if (data.typeOrBreed) details.push({ label: "Type / Breed", value: data.typeOrBreed });
  if (data.sire) details.push({ label: "Sire", value: data.sire });
  if (data.dam) details.push({ label: "Dam", value: data.dam });
  if (data.gamesPlayed !== undefined) details.push({ label: "Games Played", value: String(data.gamesPlayed) });

  return (
    <div className="bg-white rounded-[12px] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="p-5">
        <h2 className="font-display font-bold text-lg text-ink mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-600" />
          Best Playing Pony
        </h2>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
            <Award className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            {data.horseName && (
              <div className="font-display font-bold text-xl text-ink">{data.horseName}</div>
            )}
            <div className="flex gap-3 text-[14px] text-ink2">
              {data.playerName && (
                data.playerId ? (
                  <Link href={`/players/${data.playerId}`} className="hover:text-g700 hover:underline">{data.playerName}</Link>
                ) : (
                  <span>{data.playerName}</span>
                )
              )}
              {data.playerName && data.teamName && <span className="text-ink3">·</span>}
              {data.teamName && <span>{data.teamName}</span>}
            </div>
            {details.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
                {details.map((d) => (
                  <div key={d.label} className="text-[13px]">
                    <span className="text-ink3">{d.label}:</span>{" "}
                    <span className="text-ink font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            )}
            {data.notes && (
              <div className="mt-2 text-[13px] text-ink2 italic">{data.notes}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TournamentDetail() {
  const [, params] = useRoute("/tournaments/:id");
  const tournamentId = params?.id || "";

  const { data: tournament, isLoading } = useGetTournament(tournamentId);
  const { data: standings } = useGetTournamentStandings(tournamentId);
  const { data: topScorers } = useGetTournamentTopScorers(tournamentId);
  const { user, isAuthenticated } = useAuth();

  if (isLoading) return <SpectatorLayout><PageLoading /></SpectatorLayout>;
  if (!tournament) return <SpectatorLayout><EmptyState title="Tournament not found" /></SpectatorLayout>;
  const t = tournament as any;
  const matches: MatchRow[] = t.matches || [];
  const standingRows = (standings as StandingRow[] | undefined) || [];
  const scorerRows = (topScorers as TopScorer[] | undefined) || [];
  const clubName: string = t.club?.name || "";
  const canEdit = isAuthenticated && user && (
    user.role === "super_admin" ||
    (user.clubMemberships || []).some((m: any) => m.clubId === t.clubId)
  );

  return (
    <SpectatorLayout>
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant={t.status === "published" ? "default" : "status"}>
              {String(t.status || "").replace("_", " ").toUpperCase()}
            </Badge>
            <span className="text-[12px] text-ink3 font-sans">{String(t.format || "").replace("_", " ")}</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-ink">{String(t.name)}</h1>
          <p className="text-[15px] text-ink2 mt-1">{clubName}</p>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-[13px] text-ink3">
            {t.startDate && (
              <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1.5" />{formatDate(String(t.startDate), "MMM d, yyyy")}{t.endDate ? ` - ${formatDate(String(t.endDate), "MMM d, yyyy")}` : ""}</span>
            )}
            {t.handicapLevel && <span className="flex items-center"><Trophy className="w-3.5 h-3.5 mr-1.5" />{String(t.handicapLevel)}</span>}
            <Button variant="outline" size="sm" className="h-7 text-[12px] gap-1.5" onClick={() => exportCalendar(t, matches)}>
              <CalendarPlus className="w-3.5 h-3.5" />
              Add to Calendar
            </Button>
          </div>
        </div>

        {standingRows.length > 0 && (
          <div className="bg-white rounded-[12px] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="p-5">
              <h2 className="font-display font-bold text-lg text-ink mb-4">Standings</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] font-sans">
                  <thead>
                    <tr className="border-b border-line text-ink3 text-left">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Team</th>
                      <th className="pb-2 font-medium text-center">W</th>
                      <th className="pb-2 font-medium text-center">L</th>
                      <th className="pb-2 font-medium text-center">Net Goals</th>
                      <th className="pb-2 font-medium text-center">GG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standingRows.map((s: StandingRow, i: number) => (
                      <tr key={s.teamId} className="border-b border-line2 last:border-0">
                        <td className="py-2.5 font-mono text-ink3">{i + 1}</td>
                        <td className="py-2.5 font-medium text-ink">{s.team?.name || "Unknown"}</td>
                        <td className="py-2.5 text-center">{s.won}</td>
                        <td className="py-2.5 text-center">{s.lost}</td>
                        <td className="py-2.5 text-center font-medium">{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</td>
                        <td className="py-2.5 text-center">{s.grossGoals ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {scorerRows.length > 0 && (
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
                    {scorerRows.map((s: TopScorer, i: number) => (
                      <tr key={s.playerId || `scorer-${i}`} className="border-b border-line2 last:border-0">
                        <td className="py-2.5 font-mono text-ink3">{i + 1}</td>
                        <td className="py-2.5 font-medium text-ink">
                          {s.playerId ? (
                            <Link href={`/players/${s.playerId}`} className="hover:text-g700 hover:underline">{s.playerName}</Link>
                          ) : (
                            s.playerName
                          )}
                        </td>
                        <td className="py-2.5 text-ink2">{s.teamName}</td>
                        <td className="py-2.5 text-center font-medium">{s.goals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <MVPDisplay tournamentId={tournamentId} />
        <BPPDisplay tournamentId={tournamentId} />

        <div>
          <h2 className="font-display font-bold text-lg text-ink mb-4">Matches</h2>
          {matches.length === 0 ? (
            <EmptyState title="No matches scheduled" description="The draw has not been generated for this tournament yet." />
          ) : (
            <div className="space-y-3">
              {matches.map((m: MatchRow) => {
                const hasScore = m.status === "final" || m.status === "live" || m.status === "completed";
                const card = (
                  <div className={`bg-white rounded-[12px] p-4 hover:border-g300 transition-all cursor-pointer ${m.status === "live" ? "border border-live/20" : "border border-transparent"}`} style={{ boxShadow: 'var(--shadow-card)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {m.status === "live" && <div className="w-2 h-2 rounded-full bg-live animate-live-dot" />}
                        <span className="text-[12px] text-ink3">{m.round || "Match"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-ink3">
                        {m.field && <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" />{m.field.name}</span>}
                        {m.scheduledAt && <span>{formatDate(m.scheduledAt, "MMM d, h:mm a")}</span>}
                        {m.status === "final" || m.status === "completed" ? (
                          <Badge variant="status">Final</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full border bg-g50 flex items-center justify-center overflow-hidden flex-shrink-0" style={{ borderColor: m.homeTeam?.primaryColor || "var(--g100)" }}>
                          {m.homeTeam?.logoUrl ? (
                            <img src={m.homeTeam.logoUrl} alt={m.homeTeam.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-display font-bold text-[11px] text-g700">{m.homeTeam?.shortName || m.homeTeam?.name?.substring(0, 3) || ""}</span>
                          )}
                        </div>
                        <div className="font-sans font-medium text-[15px] text-ink">{m.homeTeam?.name || "TBD"}</div>
                      </div>
                      <div className="px-6 text-center min-w-[80px]">
                        {hasScore ? (
                          <div className="font-display font-bold text-2xl text-ink">
                            {m.homeScore} - {m.awayScore}
                          </div>
                        ) : (
                          <span className="text-[13px] text-g300 font-display font-bold">vs</span>
                        )}
                        {(m.status === "live" || m.status === "halftime") && (
                          <MatchClock
                            clockStartedAt={m.clockStartedAt ?? null}
                            clockElapsedSeconds={m.clockElapsedSeconds ?? 0}
                            clockIsRunning={m.clockIsRunning ?? false}
                            status={m.status}
                            lastGoalScorerName={(m as any).lastGoalScorerName}
                            lastGoalTimestamp={(m as any).lastGoalTimestamp}
                            lastStoppageEvent={(m as any).lastStoppageEvent}

                          />
                        )}
                      </div>
                      <div className="flex-1 text-right flex items-center justify-end gap-2">
                        <div className="font-sans font-medium text-[15px] text-ink">{m.awayTeam?.name || "TBD"}</div>
                        <div className="w-8 h-8 rounded-full border bg-g50 flex items-center justify-center overflow-hidden flex-shrink-0" style={{ borderColor: m.awayTeam?.primaryColor || "var(--g100)" }}>
                          {m.awayTeam?.logoUrl ? (
                            <img src={m.awayTeam.logoUrl} alt={m.awayTeam.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-display font-bold text-[11px] text-g700">{m.awayTeam?.shortName || m.awayTeam?.name?.substring(0, 3) || ""}</span>
                          )}
                        </div>
                        {canEdit && (
                          <Link href={`/admin/match/${m.id}/control`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <div className="w-7 h-7 rounded-[6px] bg-g50 hover:bg-g100 flex items-center justify-center transition-colors">
                              <Pencil className="w-3.5 h-3.5 text-g700" />
                            </div>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
                return (
                  <Link key={m.id} href={`/match/${m.id}`} className="block">
                    {card}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SpectatorLayout>
  );
}
