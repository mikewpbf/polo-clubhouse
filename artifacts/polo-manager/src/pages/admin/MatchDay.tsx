import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useListTodayMatches, useListLiveMatches } from "@workspace/api-client-react";
import { AdminLayout } from "./AdminLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MatchClock } from "@/components/MatchClock";
import { Link } from "wouter";
import { formatDate } from "@/lib/utils";
import { Tv, MapPin, ChevronLeft, ChevronRight, Image as ImageIcon, BarChart3, Sliders } from "lucide-react";
import { getStoredToken } from "@/hooks/use-auth";

interface MatchItem {
  id: string;
  status: string;
  round?: string | number;
  scheduledAt?: string | null;
  homeScore: number;
  awayScore: number;
  currentChukker?: number;
  clockStartedAt?: string | null;
  clockElapsedSeconds?: number;
  clockIsRunning?: boolean;
  homeTeam?: { name: string; shortName?: string; primaryColor?: string } | null;
  awayTeam?: { name: string; shortName?: string; primaryColor?: string } | null;
  field?: { name: string } | null;
  tournament?: { name: string } | null;
}

const PAGE_SIZE = 6;

function useUpcomingPaginated(clubIds: string | undefined) {
  const [page, setPage] = useState(0);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const token = getStoredToken();
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(p * PAGE_SIZE),
        paginated: "true",
      });
      if (clubIds) params.set("clubIds", clubIds);
      const res = await fetch(`/api/matches/upcoming?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
        setTotal(data.total || 0);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [clubIds]);

  useEffect(() => {
    fetchPage(page);
  }, [page, fetchPage]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  return {
    matches,
    loading,
    page,
    totalPages,
    total,
    canPrev,
    canNext,
    goNext: () => setPage((p) => Math.min(p + 1, totalPages - 1)),
    goPrev: () => setPage((p) => Math.max(p - 1, 0)),
  };
}

export function MatchDay() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const clubIds = isSuperAdmin ? undefined : user?.clubMemberships?.map(m => m.clubId).join(",") || undefined;

  const { data: todayMatches, isLoading: todayLoading } = useListTodayMatches(
    { clubIds: clubIds || undefined, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }
  );
  const { data: liveMatches, isLoading: liveLoading } = useListLiveMatches({
    query: { refetchInterval: 3000 } as any,
  });

  const upcoming = useUpcomingPaginated(clubIds);

  if (todayLoading || liveLoading) return <AdminLayout><PageLoading /></AdminLayout>;

  const live = (liveMatches as MatchItem[]) || [];
  const today = ((todayMatches as MatchItem[]) || []).filter((m) =>
    m.status === "scheduled" || m.status === "live" || m.status === "halftime"
  );

  const hasClub = (user?.clubMemberships?.length || 0) > 0;
  const canAccessGraphics = isSuperAdmin || hasClub;

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Match Day</h1>
          <p className="text-[14px] text-ink2 mt-1">Manage live and upcoming matches.</p>
        </div>

        {live.length > 0 && (
          <section>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-live animate-live-dot" />
              <h2 className="font-display font-bold text-lg text-ink">Live Now</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {live.map((m) => (
                <Card key={m.id} className="p-4 border-live/20 bg-live-dim/5">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="destructive">LIVE</Badge>
                    <span className="text-[12px] text-ink3">{m.tournament?.name}</span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <div className="font-sans font-medium text-[15px]">{m.homeTeam?.name}</div>
                      <div className="font-display font-bold text-3xl mt-1" style={{ color: m.homeTeam?.primaryColor || "var(--ink)" }}>{m.homeScore}</div>
                    </div>
                    <div className="px-4 text-center">
                      <MatchClock clockStartedAt={m.clockStartedAt ?? null} clockElapsedSeconds={m.clockElapsedSeconds ?? 0} clockIsRunning={m.clockIsRunning ?? false} status={m.status} />
                      <div className="text-[11px] text-ink3 mt-1">C{m.currentChukker || 1}</div>
                    </div>
                    <div className="flex-1 text-right">
                      <div className="font-sans font-medium text-[15px]">{m.awayTeam?.name}</div>
                      <div className="font-display font-bold text-3xl mt-1" style={{ color: m.awayTeam?.primaryColor || "var(--ink)" }}>{m.awayScore}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="secondary" className="gap-1.5" asChild>
                      <Link href={`/admin/score-control/${m.id}`}>
                        <Tv className="w-3.5 h-3.5" /> Score
                      </Link>
                    </Button>
                    <Button variant="secondary" className="gap-1.5" asChild>
                      <Link href={`/admin/stats-control/${m.id}`}>
                        <BarChart3 className="w-3.5 h-3.5" /> Stats
                      </Link>
                    </Button>
                    <Button variant="secondary" className="gap-1.5" asChild>
                      <Link href={`/admin/gfx-control/${m.id}`}>
                        <Sliders className="w-3.5 h-3.5" /> GFX
                      </Link>
                    </Button>
                  </div>
                  {canAccessGraphics && (
                    <div className="mt-2">
                      <Button variant="outline" size="sm" className="w-full gap-1.5" asChild>
                        <Link href={`/admin/match/${m.id}/graphics`}>
                          <ImageIcon className="w-3.5 h-3.5" /> Graphics
                        </Link>
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display font-bold text-lg text-ink mb-4">Today's Schedule</h2>
          {today.length === 0 && live.length === 0 ? (
            <EmptyState title="No matches today" description="There are no matches scheduled for today." />
          ) : (
            <div className="space-y-3">
              {today.filter(m => m.status === "scheduled").map((m) => (
                <Card key={m.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-sans font-medium text-[14px] text-ink">{m.homeTeam?.name}</span>
                      <span className="text-ink3 text-[13px]">vs</span>
                      <span className="font-sans font-medium text-[14px] text-ink">{m.awayTeam?.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[12px] text-ink3">
                      {m.field && <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" />{m.field.name}</span>}
                      {m.scheduledAt && <span>{formatDate(m.scheduledAt, "h:mm a")}</span>}
                      <span>{m.tournament?.name}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {canAccessGraphics && (
                      <Button variant="outline" size="sm" className="gap-1.5" asChild>
                        <Link href={`/admin/match/${m.id}/graphics`}>
                          <ImageIcon className="w-3.5 h-3.5" /> Graphics
                        </Link>
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/admin/score-control/${m.id}`}>Control</Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg text-ink">Upcoming Matches</h2>
            {upcoming.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={!upcoming.canPrev}
                  onClick={upcoming.goPrev}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-[13px] text-ink3 min-w-[60px] text-center">
                  {upcoming.page + 1} / {upcoming.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={!upcoming.canNext}
                  onClick={upcoming.goNext}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
          {upcoming.loading ? (
            <PageLoading />
          ) : upcoming.matches.length === 0 ? (
            <EmptyState title="No upcoming matches" description="No future matches are scheduled yet." />
          ) : (
            <div className="space-y-3">
              {upcoming.matches.map((m) => (
                <Card key={m.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-sans font-medium text-[14px] text-ink">{m.homeTeam?.name}</span>
                      <span className="text-ink3 text-[13px]">vs</span>
                      <span className="font-sans font-medium text-[14px] text-ink">{m.awayTeam?.name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[12px] text-ink3">
                      {m.field && <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" />{m.field.name}</span>}
                      {m.scheduledAt && <span>{formatDate(m.scheduledAt, "MMM d, h:mm a")}</span>}
                      <span>{m.tournament?.name}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {canAccessGraphics && (
                      <Button variant="outline" size="sm" className="gap-1.5" asChild>
                        <Link href={`/admin/match/${m.id}/graphics`}>
                          <ImageIcon className="w-3.5 h-3.5" /> Graphics
                        </Link>
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/admin/score-control/${m.id}`}>Control</Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
