import { useState, useEffect } from "react";
import { getStoredToken, useAuth } from "@/hooks/use-auth";
import { AdminLayout } from "./AdminLayout";
import { PageLoading } from "@/components/LoadingBar";
import { Link } from "wouter";
import { Trophy, Users, Calendar, Activity, Building2, ChevronRight } from "lucide-react";

async function apiFetch(path: string) {
  const token = getStoredToken();
  const res = await fetch(`/api${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

interface DashboardData {
  clubCount: number;
  tournamentCount: number;
  teamCount: number;
  upcomingMatches: number;
  liveMatches: number;
  recentTournaments: Array<{ id: string; name: string; status: string; teamCount?: number }>;
}

export function AdminDashboard() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const clubName = user?.clubMemberships?.[0]?.clubName;
  const [d, setD] = useState<DashboardData>({
    clubCount: 0, tournamentCount: 0, teamCount: 0,
    upcomingMatches: 0, liveMatches: 0, recentTournaments: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const safeFetch = (path: string) => apiFetch(path).catch(() => []);
    Promise.all([
      safeFetch("/clubs"),
      safeFetch("/tournaments"),
      safeFetch("/teams"),
      safeFetch("/matches/today"),
      safeFetch("/matches/live"),
    ]).then(([clubs, tournaments, teams, todayMatches, liveMatches]) => {
      setD({
        clubCount: Array.isArray(clubs) ? clubs.length : 0,
        tournamentCount: Array.isArray(tournaments) ? tournaments.length : 0,
        teamCount: Array.isArray(teams) ? teams.length : 0,
        upcomingMatches: Array.isArray(todayMatches) ? todayMatches.length : 0,
        liveMatches: Array.isArray(liveMatches) ? liveMatches.length : 0,
        recentTournaments: Array.isArray(tournaments)
          ? tournaments.slice(0, 5).map((t: any) => ({ id: t.id, name: t.name, status: t.status || "draft", teamCount: t.teamCount ?? 0 }))
          : [],
      });
    }).finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <AdminLayout><PageLoading /></AdminLayout>;

  const stats = [
    ...(isSuperAdmin ? [{ label: "Clubs", value: d.clubCount, icon: Building2, href: "/admin/clubs", color: "text-g500" }] : []),
    { label: "Tournaments", value: d.tournamentCount, icon: Trophy, href: "/admin/tournaments", color: "text-g500" },
    { label: "Teams", value: d.teamCount, icon: Users, href: "/admin/teams", color: "text-g500" },
    { label: "Upcoming", value: d.upcomingMatches, icon: Calendar, href: "/admin/matchday", color: "text-g500" },
    { label: "Live Now", value: d.liveMatches, icon: Activity, href: "/admin/matchday", color: "text-live" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Dashboard</h1>
          <p className="text-[14px] text-ink2 mt-1">{isSuperAdmin ? "Platform overview" : (clubName || "Club overview")}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.label} href={s.href} className="block">
                <div className="bg-white rounded-[12px] p-5 transition-all card-shadow hover:border-g300 border border-transparent">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-9 h-9 rounded-[8px] bg-g50 flex items-center justify-center`}>
                      <Icon className={`w-[18px] h-[18px] ${s.color}`} />
                    </div>
                  </div>
                  <div className="font-display font-bold text-3xl text-ink">{s.value}</div>
                  <div className="text-[13px] font-sans text-ink2 mt-1">{s.label}</div>
                </div>
              </Link>
            );
          })}
        </div>

        {d.recentTournaments.length > 0 && (
          <div>
            <h2 className="font-display font-bold text-lg text-ink mb-4">Recent Tournaments</h2>
            <div className="space-y-2">
              {d.recentTournaments.map((t) => (
                <Link key={t.id} href={`/tournament/${t.id}`} className="block">
                  <div className="bg-white rounded-[12px] p-4 transition-all card-shadow hover:border-g300 border border-transparent flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-[8px] bg-g50 flex items-center justify-center">
                        <Trophy className="w-4 h-4 text-g500" />
                      </div>
                      <div>
                        <h3 className="font-sans font-medium text-[15px] text-ink">{t.name}</h3>
                        <span className="text-[12px] text-ink3">{t.teamCount ?? 0} teams</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-sans font-medium text-g700 bg-g50 px-2 py-0.5 rounded-[6px]">
                        {t.status.replace("_", " ")}
                      </span>
                      <ChevronRight className="w-4 h-4 text-ink3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
