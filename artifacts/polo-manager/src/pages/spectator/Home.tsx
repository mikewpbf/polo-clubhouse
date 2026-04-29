import { useListLiveMatches, useListTodayMatches, useListUpcomingMatches, useListAllTournaments, useListTopPlayers } from "@workspace/api-client-react";
import { SpectatorLayout } from "@/components/layout/SpectatorLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { MatchClock } from "@/components/MatchClock";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Trophy, ChevronRight, Calendar, MapPin, Award } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getYouTubeEmbedUrl } from "@/lib/youtube";

const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

function TeamLogo({ url, fallback, size = 30 }: { url?: string | null, fallback: string, size?: number }) {
  if (url) {
    return <img src={url} alt={fallback} style={{ width: size, height: size }} className="rounded-full object-cover border border-line" />;
  }
  return (
    <div 
      style={{ width: size, height: size }} 
      className="rounded-full bg-g50 text-g700 flex items-center justify-center font-display font-bold border border-g100"
    >
      {fallback.substring(0, 2).toUpperCase()}
    </div>
  );
}

function MatchCard({ match, showDate = false, showDetails = false }: { match: Record<string, any>, showDate?: boolean, showDetails?: boolean }) {
  return (
    <Link key={match.id} href={`/match/${match.id}`} className="block">
      <div className="bg-white rounded-[12px] p-5 hover:border-g300 transition-all cursor-pointer border border-transparent group card-shadow">
        <div className="flex justify-between items-start mb-4">
          <div className="text-[12px] font-sans text-ink2">{match.tournament?.name}</div>
          <div className="flex items-center gap-2">
            {showDate && match.scheduledAt && (
              <span className="text-[11px] font-sans text-ink3 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(match.scheduledAt, "EEE, MMM d 'at' h:mm a")}
              </span>
            )}
            {!showDate && <Badge variant="status">{match.status.replace('_', ' ').toUpperCase()}</Badge>}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <TeamLogo url={match.homeTeam?.logoUrl} fallback={match.homeTeam?.name || "T"} size={32} />
            <span className="font-sans font-medium text-[15px]">{match.homeTeam?.shortName || match.homeTeam?.name}</span>
          </div>
          <div className="font-display font-bold text-xl px-4 text-g300 group-hover:text-g500 transition-colors">vs</div>
          <div className="flex items-center space-x-3 flex-row-reverse">
            <TeamLogo url={match.awayTeam?.logoUrl} fallback={match.awayTeam?.name || "T"} size={32} />
            <span className="font-sans font-medium text-[15px] mr-3">{match.awayTeam?.shortName || match.awayTeam?.name}</span>
          </div>
        </div>
        {showDetails && (
          <div className="mt-3 pt-3 border-t border-line2 flex items-center gap-4 text-[11px] font-sans text-ink3">
            {match.scheduledAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(match.scheduledAt, "h:mm a")}
              </span>
            )}
            {match.field?.name && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {match.field.name}
              </span>
            )}
            {match.tournament?.clubName && (
              <span>{match.tournament.clubName}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export function Home() {
  const { data: liveMatches, isLoading: liveLoading } = useListLiveMatches({ query: { refetchInterval: 3000 } });
  const { data: todayMatches, isLoading: todayLoading } = useListTodayMatches({ tz: userTz }, { query: { refetchInterval: 5000 } });
  const { data: upcomingMatches, isLoading: upcomingLoading } = useListUpcomingMatches({ limit: 5 });
  const { data: tournaments, isLoading: tournamentsLoading } = useListAllTournaments({});
  const { data: topPlayers } = useListTopPlayers({ limit: 8 });

  if (liveLoading || todayLoading || upcomingLoading || tournamentsLoading) return <SpectatorLayout><PageLoading /></SpectatorLayout>;

  const hasLive = liveMatches && liveMatches.length > 0;
  const featuredLive = hasLive ? liveMatches[0] : null;
  const otherLive = hasLive && liveMatches.length > 1 ? liveMatches.slice(1) : [];
  const hasToday = todayMatches && todayMatches.length > 0;
  const hasUpcoming = upcomingMatches && upcomingMatches.length > 0;

  return (
    <SpectatorLayout>
      <div className="space-y-12">
        {hasLive && featuredLive && (
          <section className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-live animate-live-dot" />
              <h2 className="font-display font-bold text-xl text-ink">Live Now</h2>
            </div>

            {(() => {
              const embedUrl = getYouTubeEmbedUrl(featuredLive.streamUrl);
              if (!embedUrl) return null;
              return (
                <div className="rounded-t-[12px] overflow-hidden" style={{ aspectRatio: "16/9" }}>
                  <iframe
                    src={embedUrl}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                    title="Live Stream"
                  />
                </div>
              );
            })()}

            <Link href={`/match/${featuredLive.id}`} className="block">
              <div className={`bg-white overflow-hidden border border-g100 card-shadow hover:border-g300 transition-all ${getYouTubeEmbedUrl(featuredLive.streamUrl) ? "rounded-b-[12px]" : "rounded-[12px]"}`}>
                <div className="bg-g50 px-5 py-2.5 flex items-center justify-between border-b border-g100">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-live animate-live-dot" />
                    <span className="text-[12px] font-sans font-bold tracking-wider uppercase text-live">Live</span>
                  </div>
                  <span className="text-[12px] font-sans font-medium text-ink2">
                    {featuredLive.tournament?.name}
                  </span>
                </div>
                
                <div className="p-6 flex items-center justify-between">
                  <div className="flex flex-col items-center flex-1">
                    <TeamLogo 
                      url={featuredLive.homeTeam?.logoUrl} 
                      fallback={featuredLive.homeTeam?.name || "Home"} 
                      size={56} 
                    />
                    <span className="mt-2 font-sans font-medium text-ink text-center text-[14px] line-clamp-1">
                      {featuredLive.homeTeam?.name}
                    </span>
                    <span className="mt-1 font-display font-extrabold text-5xl text-g900">
                      {featuredLive.homeScore}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center px-4">
                    <MatchClock 
                      clockStartedAt={featuredLive.clockStartedAt}
                      clockElapsedSeconds={featuredLive.clockElapsedSeconds}
                      clockIsRunning={featuredLive.clockIsRunning}
                      status={featuredLive.status}
                      size="lg"
                      lastGoalScorerName={featuredLive.lastGoalScorerName}
                      lastGoalTimestamp={featuredLive.lastGoalTimestamp}
                      lastStoppageEvent={featuredLive.lastStoppageEvent}

                    />
                    <div className="mt-1.5 text-[12px] font-sans font-medium text-ink3">
                      Chukker {featuredLive.currentChukker}
                    </div>
                  </div>

                  <div className="flex flex-col items-center flex-1">
                    <TeamLogo 
                      url={featuredLive.awayTeam?.logoUrl} 
                      fallback={featuredLive.awayTeam?.name || "Away"} 
                      size={56} 
                    />
                    <span className="mt-2 font-sans font-medium text-ink text-center text-[14px] line-clamp-1">
                      {featuredLive.awayTeam?.name}
                    </span>
                    <span className="mt-1 font-display font-extrabold text-5xl text-g900">
                      {featuredLive.awayScore}
                    </span>
                  </div>
                </div>

                <div className="px-5 py-2.5 bg-g50 border-t border-g100 flex justify-between items-center">
                  <div className="text-[12px] font-sans text-ink3">
                    {featuredLive.field?.name || "TBA"} &middot; {featuredLive.tournament?.clubName}
                  </div>
                  <div className="text-[11px] font-sans font-medium text-g700 bg-g100 px-2 py-0.5 rounded-[6px]">
                    {featuredLive.round || "Match"}
                  </div>
                </div>
              </div>
            </Link>

            {otherLive.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {otherLive.map((match: Record<string, any>) => (
                  <div key={match.id} className="bg-white rounded-[12px] p-4 flex items-center justify-between border border-live/15" style={{ boxShadow: 'var(--shadow-card)' }}>
                    <div className="flex flex-col space-y-3 flex-1">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <TeamLogo url={match.homeTeam?.logoUrl} fallback={match.homeTeam?.name || "T"} size={24} />
                          <span className="font-sans font-medium text-[14px] text-ink">{match.homeTeam?.name}</span>
                        </div>
                        <span className="font-display font-bold text-lg text-ink">{match.homeScore}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <TeamLogo url={match.awayTeam?.logoUrl} fallback={match.awayTeam?.name || "T"} size={24} />
                          <span className="font-sans font-medium text-[14px] text-ink">{match.awayTeam?.name}</span>
                        </div>
                        <span className="font-display font-bold text-lg text-ink">{match.awayScore}</span>
                      </div>
                    </div>
                    <div className="w-px h-12 bg-line mx-4"></div>
                    <div className="flex flex-col items-end min-w-[80px]">
                      <MatchClock 
                        clockStartedAt={match.clockStartedAt}
                        clockElapsedSeconds={match.clockElapsedSeconds}
                        clockIsRunning={match.clockIsRunning}
                        status={match.status}
                        lastGoalScorerName={match.lastGoalScorerName}
                        lastGoalTimestamp={match.lastGoalTimestamp}
                        lastStoppageEvent={match.lastStoppageEvent}
  
                      />
                      <span className="text-[11px] font-sans text-ink3 mt-1 font-medium">Chukker {match.currentChukker}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          {hasToday ? (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-bold text-xl text-ink">Today's Matches</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {todayMatches.map((match: Record<string, any>) => (
                  <MatchCard key={match.id} match={match} showDetails />
                ))}
              </div>
            </>
          ) : hasUpcoming ? (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-bold text-xl text-ink">Coming Up Next</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {upcomingMatches.map((match: Record<string, any>) => (
                  <MatchCard key={match.id} match={match} showDate />
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-bold text-xl text-ink">Today's Matches</h2>
              </div>
              <div className="bg-white rounded-[12px] p-8 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="w-12 h-12 rounded-full bg-g50 mx-auto mb-3 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-g300" />
                </div>
                <p className="font-display font-bold text-[16px] text-ink">No matches scheduled</p>
                <p className="text-[13px] text-ink2 mt-1">Check the tournaments page for upcoming action.</p>
              </div>
            </>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-xl text-ink">Tournaments</h2>
            <Link href="/tournaments" className="text-[13px] font-sans font-medium text-g500 hover:text-g700 transition-colors flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tournaments
              ?.filter((t: Record<string, any>) => t.status !== "completed" && t.status !== "archived")
              .sort((a: Record<string, any>, b: Record<string, any>) => {
                const aLevel = Number(a.handicapLevel) || 0;
                const bLevel = Number(b.handicapLevel) || 0;
                return bLevel - aLevel;
              })
              .slice(0, 6).map((t: Record<string, any>) => (
              <Link key={t.id} href={`/tournaments/${t.id}`} className="block">
                <div className="bg-white rounded-[12px] h-full hover:border-g300 transition-all cursor-pointer border border-transparent card-shadow">
                  <div className="p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${(t.club?.logo40Url || t.club?.logo96Url || t.club?.logoUrl) ? 'bg-white' : 'bg-g50 border border-g100'}`}>
                        {(t.club?.logo40Url || t.club?.logo96Url || t.club?.logoUrl) ? (
                          <img src={(t.club.logo40Url || t.club.logo96Url || t.club.logoUrl)!} alt={t.club.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[11px] font-display font-bold text-g500">{t.club?.name.substring(0, 2)}</span>
                        )}
                      </div>
                      {t.handicapLevel && <span className="text-[11px] font-sans font-medium text-g700 bg-g50 px-2 py-0.5 rounded-[6px]">{t.handicapLevel}</span>}
                    </div>
                    <h3 className="font-display font-bold text-[17px] text-ink mb-1 line-clamp-2">{t.name}</h3>
                    <p className="text-[13px] font-sans text-ink2 mb-4">{t.club?.name}</p>
                    
                    <div className="mt-auto pt-3 border-t border-line2 flex items-center justify-between text-[12px] font-sans text-ink3">
                      <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> {t.teamCount} Teams</span>
                      <span>{t.format?.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {topPlayers && topPlayers.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-bold text-xl text-ink">Top Players</h2>
              <Link href="/players" className="text-[13px] font-sans font-medium text-g500 hover:text-g700 transition-colors flex items-center gap-1">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {topPlayers.map((p: Record<string, any>) => {
                const hcRaw = p.handicap;
                const hcNum = hcRaw == null ? null : Number(hcRaw);
                const hcLabel = hcNum == null || Number.isNaN(hcNum) ? null : (hcNum > 0 ? `+${hcNum}` : `${hcNum}`);
                return (
                  <Link key={p.id} href={`/players/${p.id}`} className="block">
                    <div className="bg-white rounded-[12px] p-4 card-shadow hover:border-g300 border border-transparent transition-colors text-center">
                      <PlayerHeadshot url={p.headshotUrl} name={p.name} size={64} className="mx-auto" />
                      <div className="mt-2 font-sans font-semibold text-[13px] text-ink truncate">{p.name}</div>
                      {hcLabel && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-g700 bg-g50 px-1.5 py-0.5 rounded-[4px]">
                          <Award className="w-3 h-3" />
                          {hcLabel}
                        </div>
                      )}
                      {p.homeClubName && (
                        <div className="mt-1 text-[11px] font-sans text-ink3 truncate">{p.homeClubName}</div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </SpectatorLayout>
  );
}
