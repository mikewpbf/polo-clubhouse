import { useRoute, Link } from "wouter";
import { useGetPlayerProfile } from "@workspace/api-client-react";
import { SpectatorLayout } from "@/components/layout/SpectatorLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Trophy, Award, Calendar, MapPin } from "lucide-react";

export function PlayerProfile() {
  const [, params] = useRoute("/players/:id");
  const playerId = params?.id ?? "";
  const { data, isLoading, error } = useGetPlayerProfile(playerId, {
    query: { enabled: !!playerId } as any,
  });

  if (isLoading) return <SpectatorLayout><PageLoading /></SpectatorLayout>;
  if (error || !data) {
    return <SpectatorLayout><EmptyState title="Player not found" description="This player profile does not exist." /></SpectatorLayout>;
  }

  const currentYear = new Date().getUTCFullYear();
  const currentTeams = data.teams.filter(t => t.seasonYear === currentYear);
  const pastTeams = data.teams.filter(t => t.seasonYear !== currentYear);

  return (
    <SpectatorLayout>
      <div className="space-y-6">
        <div className="bg-white rounded-[12px] p-6 card-shadow">
          <div className="flex items-start gap-5">
            <PlayerHeadshot url={data.headshotUrl} name={data.name} size={96} />
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-bold text-ink">{data.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-ink2">
                {data.handicap != null && (
                  <Badge variant="status">Handicap {data.handicap}</Badge>
                )}
                {data.age != null && <span>Age {data.age}</span>}
                {data.homeClubSlug && data.homeClubName && (
                  <Link href={`/clubs/${data.homeClubSlug}`} className="flex items-center gap-1 text-g700 hover:underline">
                    <MapPin className="w-3 h-3" />
                    {data.homeClubName}
                  </Link>
                )}
              </div>
              {data.bio && <p className="mt-3 text-[14px] text-ink2 leading-relaxed whitespace-pre-line">{data.bio}</p>}
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-ink mb-3">Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Goals (Season)" value={data.stats.seasonGoals} />
            <StatCard label="Wins (Season)" value={data.stats.seasonWins} />
            <StatCard label="Goals (Career)" value={data.stats.careerGoals} />
            <StatCard label="Wins (Career)" value={data.stats.careerWins} />
            <StatCard label="MVP Awards" value={data.stats.mvpAwards} icon={<Trophy className="w-3 h-3" />} />
            <StatCard label="BPP Awards" value={data.stats.bppAwards} icon={<Award className="w-3 h-3" />} />
          </div>
        </div>

        {currentTeams.length > 0 && (
          <div>
            <h2 className="font-display text-lg font-bold text-ink mb-3">Current Team{currentTeams.length > 1 ? "s" : ""}</h2>
            <div className="space-y-2">
              {currentTeams.map(t => (
                <div key={`${t.teamId}-${t.seasonYear}`} className="bg-white rounded-[10px] p-4 card-shadow flex items-center gap-3">
                  {t.teamLogoUrl ? (
                    <img src={t.teamLogoUrl} alt={t.teamName} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-g50 border border-g100 flex items-center justify-center text-[12px] font-display font-bold text-g500">
                      {t.teamName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-sans font-medium text-[15px]">{t.teamName}</div>
                    <div className="text-[12px] text-ink3">{t.seasonYear} season</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.horses.length > 0 && (
          <div>
            <h2 className="font-display text-lg font-bold text-ink mb-3">Horse String</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.horses.map(h => (
                <div key={h.id} className="bg-white rounded-[10px] p-4 card-shadow">
                  <div className="font-sans font-semibold text-[15px] text-ink">{h.horseName}</div>
                  <div className="mt-1 text-[12px] text-ink3 flex flex-wrap gap-x-3 gap-y-1">
                    {h.age != null && <span>{h.age}y</span>}
                    {h.color && <span>{h.color}</span>}
                    {h.sex && <span>{h.sex}</span>}
                    {h.typeOrBreed && <span>{h.typeOrBreed}</span>}
                  </div>
                  {(h.owner || h.breeder) && (
                    <div className="mt-2 text-[12px] text-ink2">
                      {h.owner && <div>Owner: {h.owner}</div>}
                      {h.breeder && <div>Breeder: {h.breeder}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {pastTeams.length > 0 && (
          <div>
            <h2 className="font-display text-lg font-bold text-ink mb-3">Team History</h2>
            <div className="space-y-1.5">
              {pastTeams.map(t => (
                <div key={`${t.teamId}-${t.seasonYear}`} className="bg-white rounded-[8px] py-2 px-4 card-shadow flex items-center justify-between text-[13px]">
                  <span className="font-sans font-medium">{t.teamName}</span>
                  <span className="text-ink3 flex items-center gap-1"><Calendar className="w-3 h-3" />{t.seasonYear}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SpectatorLayout>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[10px] p-3 card-shadow text-center">
      <div className="font-display font-bold text-2xl text-ink flex items-center justify-center gap-1">
        {icon}{value}
      </div>
      <div className="mt-0.5 text-[11px] text-ink3 font-sans">{label}</div>
    </div>
  );
}
