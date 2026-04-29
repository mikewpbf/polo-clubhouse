import { useRoute } from "wouter";
import { useGetMyTeamSchedule } from "@workspace/api-client-react";
import { TeamLayout } from "./TeamLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { MapPin } from "lucide-react";
import { MatchClock } from "@/components/MatchClock";

interface ScheduleMatch {
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
  homeTeam?: { id: string; name: string; shortName?: string; primaryColor?: string } | null;
  awayTeam?: { id: string; name: string; shortName?: string; primaryColor?: string } | null;
  field?: { name: string } | null;
  tournament?: { name: string } | null;
}

export function TeamSchedule() {
  const [, params] = useRoute("/my-team/:teamId/schedule");
  const teamId = params?.teamId || "";
  const { data: matches, isLoading } = useGetMyTeamSchedule(teamId, undefined, {
    query: { enabled: !!teamId } as any,
  });

  if (isLoading) return <TeamLayout><PageLoading /></TeamLayout>;

  const matchList = (matches as ScheduleMatch[]) || [];

  return (
    <TeamLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Our Schedule</h1>
          <p className="text-[14px] text-ink2 mt-1">All matches for your team.</p>
        </div>

        {matchList.length === 0 ? (
          <EmptyState title="No matches scheduled" description="Matches will appear here once the draw is published." />
        ) : (
          <div className="space-y-3">
            {matchList.map((m) => {
              const isLive = m.status === "live" || m.status === "halftime";
              const isFinal = m.status === "final";
              return (
                <Card key={m.id} className={`p-4 ${isLive ? "border-live/20 bg-live-dim/5" : ""}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isLive && <div className="w-2 h-2 rounded-full bg-live animate-live-dot" />}
                      <Badge variant={isLive ? "destructive" : isFinal ? "default" : "status"}>
                        {m.status.replace("_", " ").toUpperCase()}
                      </Badge>
                      {m.round && <span className="text-[12px] text-ink3">Round {m.round}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-ink3">
                      {m.field && <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" />{m.field.name}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-sans font-medium text-[15px] text-ink">{m.homeTeam?.name || "TBD"}</div>
                    </div>
                    <div className="px-4 text-center min-w-[80px]">
                      {isFinal || isLive ? (
                        <div className="font-display font-bold text-2xl text-ink">
                          {m.homeScore} - {m.awayScore}
                        </div>
                      ) : (
                        <span className="text-[13px] text-ink3 font-sans">vs</span>
                      )}
                      {isLive && (
                        <MatchClock clockStartedAt={m.clockStartedAt ?? null} clockElapsedSeconds={m.clockElapsedSeconds ?? 0} clockIsRunning={m.clockIsRunning ?? false} status={m.status} />
                      )}
                    </div>
                    <div className="flex-1 text-right">
                      <div className="font-sans font-medium text-[15px] text-ink">{m.awayTeam?.name || "TBD"}</div>
                    </div>
                  </div>

                  {m.scheduledAt && (
                    <div className="mt-2 text-[12px] text-ink3">
                      {formatDate(m.scheduledAt, "EEEE, MMM d · h:mm a")}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </TeamLayout>
  );
}
