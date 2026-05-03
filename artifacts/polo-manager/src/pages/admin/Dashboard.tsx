import { useState, useEffect } from "react";
import { getStoredToken, useAuth } from "@/hooks/use-auth";
import { AdminLayout } from "./AdminLayout";
import { PageLoading } from "@/components/LoadingBar";
import { Link } from "wouter";
import { Trophy, Users, Calendar, Activity, Building2, ChevronRight, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { snapAndUploadMatchPreview } from "@/lib/matchPreviewSnap";

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getStoredToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
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
  allTournaments: Array<{ id: string; name: string }>;
}

function MatchPreviewMaintenancePanel({ tournaments }: { tournaments: Array<{ id: string; name: string }> }) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string>(tournaments[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handleClick = async () => {
    if (busy || !selectedId) return;
    setBusy(true);
    setProgress(null);
    try {
      const matches = await apiFetch(`/tournaments/${selectedId}/matches`);
      const ids: string[] = Array.isArray(matches) ? matches.map((m: any) => m.id).filter(Boolean) : [];
      if (ids.length === 0) {
        toast({ title: "No matches to refresh", description: "This tournament has no matches yet." });
        return;
      }
      let succeeded = 0;
      let failed = 0;
      for (let i = 0; i < ids.length; i++) {
        setProgress({ done: i, total: ids.length });
        const ok = await snapAndUploadMatchPreview(ids[i]);
        if (ok) succeeded++; else failed++;
      }
      setProgress({ done: ids.length, total: ids.length });
      toast({
        title: failed > 0 ? "Regenerated with errors" : "Previews regenerated",
        description: `${succeeded}/${ids.length} match previews refreshed${failed > 0 ? ` · ${failed} failed` : ""}.`,
        variant: failed > 0 ? "destructive" : "default",
      });
    } catch (err: any) {
      toast({
        title: "Failed to regenerate",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const label = busy
    ? progress ? `Refreshing ${progress.done}/${progress.total}…` : "Loading…"
    : "Regenerate match previews";

  return (
    <div>
      <h2 className="font-display font-bold text-lg text-ink mb-2">Maintenance</h2>
      <p className="text-[13px] text-ink2 mb-4">
        Force-refresh the link-preview thumbnails (iMessage / Facebook unfurls) for every match in a tournament.
        Match previews are normally generated automatically — only use this after a template or branding change.
      </p>
      <div className="bg-white rounded-[12px] p-4 card-shadow flex flex-col sm:flex-row gap-3 sm:items-center">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={busy || tournaments.length === 0}
          className="flex-1 h-10 rounded-[8px] border border-line bg-surface px-3 text-[14px] text-ink"
        >
          {tournaments.length === 0 && <option value="">No tournaments</option>}
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <Button
          onClick={handleClick}
          disabled={busy || !selectedId}
          className="gap-1.5"
          title="Re-renders thumbnails using the Match Graphics template. Keep this tab open until it finishes."
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {label}
        </Button>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const clubName = user?.clubMemberships?.[0]?.clubName;
  const [d, setD] = useState<DashboardData>({
    clubCount: 0, tournamentCount: 0, teamCount: 0,
    upcomingMatches: 0, liveMatches: 0, recentTournaments: [], allTournaments: [],
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
        allTournaments: Array.isArray(tournaments)
          ? tournaments.map((t: any) => ({ id: t.id, name: t.name }))
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

        {isSuperAdmin && <MatchPreviewMaintenancePanel tournaments={d.allTournaments} />}
      </div>
    </AdminLayout>
  );
}
