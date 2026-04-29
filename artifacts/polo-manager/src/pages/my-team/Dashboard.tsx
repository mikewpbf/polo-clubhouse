import { useRoute } from "wouter";
import { useGetMyTeamDashboard } from "@workspace/api-client-react";
import { TeamLayout } from "./TeamLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Calendar, Trophy, Activity } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface DashboardTournament {
  id: string;
  name: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
}

interface DashboardMatch {
  id: string;
  scheduledAt?: string | null;
  status: string;
  homeTeam?: { name: string } | null;
  awayTeam?: { name: string } | null;
  homeScore: number;
  awayScore: number;
}

export function TeamDashboard() {
  const [, params] = useRoute("/my-team/:teamId");
  const teamId = params?.teamId || "";
  const { data, isLoading } = useGetMyTeamDashboard(teamId, {
    query: { enabled: !!teamId } as any,
  });

  if (isLoading) return <TeamLayout><PageLoading /></TeamLayout>;

  const d = (data || {}) as Record<string, unknown>;
  const tournaments = (d.tournaments as DashboardTournament[]) || [];
  const upcomingMatches = (d.upcomingMatches as DashboardMatch[]) || [];
  const teamName = String(d.teamName || "Your Team");

  return (
    <TeamLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{teamName}</h1>
          <p className="text-[14px] text-ink2 mt-1">Team dashboard and overview</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5">
            <Trophy className="w-5 h-5 text-g500 mb-3" />
            <div className="font-display font-bold text-3xl text-ink">{tournaments.length}</div>
            <div className="text-[13px] text-ink2 mt-1">Active Tournaments</div>
          </Card>
          <Card className="p-5">
            <Calendar className="w-5 h-5 text-g500 mb-3" />
            <div className="font-display font-bold text-3xl text-ink">{upcomingMatches.length}</div>
            <div className="text-[13px] text-ink2 mt-1">Upcoming Matches</div>
          </Card>
          <Card className="p-5">
            <Activity className="w-5 h-5 text-g500 mb-3" />
            <div className="font-display font-bold text-3xl text-ink">
              {upcomingMatches.filter((m) => m.status === "live").length}
            </div>
            <div className="text-[13px] text-ink2 mt-1">Live Now</div>
          </Card>
        </div>

        {tournaments.length > 0 && (
          <section>
            <h2 className="font-display font-bold text-lg text-ink mb-4">Tournaments</h2>
            <div className="space-y-2">
              {tournaments.map((t) => (
                <Card key={t.id} className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-sans font-medium text-[15px] text-ink">{t.name}</h3>
                    <span className="text-[12px] text-ink3">
                      {t.startDate ? formatDate(t.startDate, "MMM d") : "TBA"}
                      {t.endDate ? ` - ${formatDate(t.endDate, "MMM d")}` : ""}
                    </span>
                  </div>
                  <Badge variant={t.status === "in_progress" ? "destructive" : "status"}>
                    {t.status.replace("_", " ")}
                  </Badge>
                </Card>
              ))}
            </div>
          </section>
        )}

        {upcomingMatches.length > 0 ? (
          <section>
            <h2 className="font-display font-bold text-lg text-ink mb-4">Upcoming Matches</h2>
            <div className="space-y-2">
              {upcomingMatches.slice(0, 5).map((m) => (
                <Card key={m.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-sans text-[14px] text-ink font-medium">
                        {m.homeTeam?.name || "TBD"} vs {m.awayTeam?.name || "TBD"}
                      </span>
                      {m.scheduledAt && (
                        <div className="text-[12px] text-ink3 mt-1">
                          {formatDate(m.scheduledAt, "MMM d, h:mm a")}
                        </div>
                      )}
                    </div>
                    <Badge variant={m.status === "live" ? "destructive" : "status"}>
                      {m.status.replace("_", " ")}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ) : (
          <EmptyState title="No upcoming matches" description="Matches will appear here once the draw is published." />
        )}

        <div className="pt-4">
          <Link href={`/my-team/${teamId}/out-dates`} className="text-[13px] font-sans font-medium text-g700 hover:underline">
            Manage out dates
          </Link>
        </div>
      </div>
    </TeamLayout>
  );
}
