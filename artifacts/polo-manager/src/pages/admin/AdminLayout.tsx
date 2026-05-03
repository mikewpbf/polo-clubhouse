import { ReactNode, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, Users, Building2, Trophy, Activity, LogOut, Home, Shield, Sparkles, Settings, UserCircle, Target, BarChart3, KeyRound } from "lucide-react";
import { triggerAdminPreviewAutoBackfill } from "@/lib/matchPreviewSnap";
import { useListTodayMatches, useListLiveMatches } from "@workspace/api-client-react";

// Shape of the match items returned by /matches/today and /matches/live —
// kept loose because the sidebar only needs id/status/teams/field for labels.
interface SidebarMatch {
  id: string;
  status: string;
  scheduledAt?: string | null;
  homeTeam?: { name?: string; shortName?: string } | null;
  awayTeam?: { name?: string; shortName?: string } | null;
  field?: { name?: string } | null;
  tournament?: { name?: string } | null;
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  // Auto-resnap: any admin opening any admin page kicks off a one-pass
  // background backfill of matches whose preview was nulled out by an
  // upstream edit (team logo/name/color, tournament name, field name).
  // Once-per-session and idle-scheduled — see matchPreviewSnap.tsx.
  useEffect(() => {
    if (!user) return;
    const isAdmin = user.role === "super_admin" || (user.clubMemberships?.length ?? 0) > 0;
    if (isAdmin) triggerAdminPreviewAutoBackfill();
  }, [user]);

  const hasClub = (user?.clubMemberships?.length ?? 0) > 0;
  const isSuperAdmin = user?.role === "super_admin";
  // Mirrors the server-side requireMatchWrite gate: super admins and club
  // admins can score/stat any of their club's matches. Spectators and
  // pure team managers don't get the in-sidebar shortcuts (the dedicated
  // Team Manager portal handles their flows).
  const canControlMatches = isSuperAdmin || hasClub;

  // Same scoping rule MatchDay uses: super admins see all clubs; club admins
  // see only matches in clubs they manage. Passing `undefined` to the API
  // means "no filter" (super admin); a CSV string means "filter to these".
  const clubIds = isSuperAdmin
    ? undefined
    : user?.clubMemberships?.map((m: { clubId: string }) => m.clubId).join(",") || undefined;

  const { data: todayMatches } = useListTodayMatches(
    { clubIds: clubIds || undefined, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } as any,
    { query: { enabled: canControlMatches, refetchInterval: 30000 } as any },
  );
  const { data: liveMatches } = useListLiveMatches({
    query: { enabled: canControlMatches, refetchInterval: 10000 } as any,
  });

  // Merge live + today, dedupe by id, drop finished/cancelled, sort live
  // first then by scheduledAt. Live polls more often so it shows up quickly.
  //
  // Authz scope: /matches/live currently returns ALL live matches with no
  // club filter, while /matches/today is already club-scoped server-side.
  // For a club admin we therefore intersect live with the club-scoped
  // today set so they never see out-of-club matches in their sidebar.
  // Super admins are exempt — they're allowed to control any match.
  const sidebarMatches = useMemo<SidebarMatch[]>(() => {
    if (!canControlMatches) return [];
    const today = ((todayMatches as SidebarMatch[]) || []);
    const live = ((liveMatches as SidebarMatch[]) || []);
    const todayIds = new Set(today.map(m => m.id));
    const scopedLive = isSuperAdmin ? live : live.filter(m => todayIds.has(m.id));
    const all = [...scopedLive, ...today].filter(m => m.status !== "final" && m.status !== "cancelled");
    const seen = new Set<string>();
    const dedup: SidebarMatch[] = [];
    for (const m of all) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      dedup.push(m);
    }
    return dedup.sort((a, b) => {
      const liveOrder = (s: string) => (s === "live" || s === "halftime" ? 0 : 1);
      const lo = liveOrder(a.status) - liveOrder(b.status);
      if (lo !== 0) return lo;
      const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bt = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return at - bt;
    });
  }, [canControlMatches, isSuperAdmin, liveMatches, todayMatches]);

  const onScoreControl = location.startsWith("/admin/score-control");
  const onStatsControl = location.startsWith("/admin/stats-control");

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: Activity },
    ...(isSuperAdmin ? [{ href: "/admin/clubs", label: "Clubs", icon: Building2 }] : []),
    ...(hasClub ? [{ href: "/admin/club-settings", label: "Club Settings", icon: Settings }] : []),
    { href: "/admin/tournaments", label: "Tournaments", icon: Trophy },
    { href: "/admin/teams", label: "Teams Directory", icon: Users },
    { href: "/admin/players", label: "Players", icon: UserCircle },
    { href: "/admin/matchday", label: "Match Day", icon: Calendar },
    ...(isSuperAdmin ? [
      { href: "/admin/users", label: "Users", icon: Shield },
      { href: "/admin/api-keys", label: "Client Apps", icon: KeyRound },
      { href: "/admin/ai-wizard", label: "AI Wizard", icon: Sparkles },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-bg flex w-full">
      <aside className="w-64 border-r border-line/60 bg-white hidden md:flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <div className="h-16 flex items-center px-5 border-b border-line/60">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Polo Clubhouse" className="w-8 h-8 rounded-[6px]" />
            <span className="font-display font-bold text-[15px] text-g900 tracking-tight">Polo Clubhouse</span>
          </Link>
        </div>
        
        <div className="p-4 border-b border-line/60">
          <div className="text-[11px] font-sans font-semibold text-ink3 uppercase tracking-wider mb-1">Signed in as</div>
          <div className="font-sans font-medium text-[14px] truncate">{user?.displayName}</div>
          <div className="text-[12px] font-sans text-g500">{user?.role === 'super_admin' ? 'Super Admin' : (user?.clubMemberships?.[0]?.clubName || "Admin")}</div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== '/admin' && location.startsWith(item.href));
            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2.5 rounded-[8px] text-[14px] font-sans font-medium transition-colors ${
                  isActive ? "bg-g50 text-g900" : "text-ink2 hover:bg-bg2 hover:text-ink"
                }`}
              >
                <Icon className={`w-[18px] h-[18px] mr-3 ${isActive ? "text-g500" : "text-ink3"}`} />
                {item.label}
              </Link>
            );
            // Insert Score Control + Stats Control as plain nav links right
            // after Match Day. Per user preference, no sidebar dropdown — the
            // pages themselves expose a match-picker dropdown. We default to
            // the first live/upcoming match in the user's club scope, or fall
            // back to Match Day when there is nothing scoreable.
            if (item.href === "/admin/matchday" && canControlMatches) {
              const defaultMatchId = sidebarMatches[0]?.id;
              const scoreHref = defaultMatchId ? `/admin/score-control/${defaultMatchId}` : "/admin/matchday";
              const statsHref = defaultMatchId ? `/admin/stats-control/${defaultMatchId}` : "/admin/matchday";
              return (
                <div key={item.href}>
                  {link}
                  <Link
                    href={scoreHref}
                    className={`flex items-center px-3 py-2.5 rounded-[8px] text-[14px] font-sans font-medium transition-colors ${
                      onScoreControl ? "bg-g50 text-g900" : "text-ink2 hover:bg-bg2 hover:text-ink"
                    }`}
                  >
                    <Target className={`w-[18px] h-[18px] mr-3 ${onScoreControl ? "text-g500" : "text-ink3"}`} />
                    Score Control
                  </Link>
                  <Link
                    href={statsHref}
                    className={`flex items-center px-3 py-2.5 rounded-[8px] text-[14px] font-sans font-medium transition-colors ${
                      onStatsControl ? "bg-g50 text-g900" : "text-ink2 hover:bg-bg2 hover:text-ink"
                    }`}
                  >
                    <BarChart3 className={`w-[18px] h-[18px] mr-3 ${onStatsControl ? "text-g500" : "text-ink3"}`} />
                    Stats Control
                  </Link>
                </div>
              );
            }
            return link;
          })}
        </nav>

        <div className="p-3 border-t border-line/60">
          <Link 
            href="/"
            className="flex items-center px-3 py-2 rounded-[8px] text-[13px] font-sans font-medium text-ink3 hover:bg-bg2 hover:text-ink transition-colors mb-1"
          >
            <Home className="w-4 h-4 mr-3" />
            Back to Home
          </Link>
          <button 
            onClick={logout}
            className="flex w-full items-center px-3 py-2 rounded-[8px] text-[13px] font-sans font-medium text-ink3 hover:bg-bg2 hover:text-live transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-bg">
        <header className="md:hidden h-14 border-b border-line/60 bg-white flex items-center px-4 sticky top-0 z-30">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="w-6 h-6 rounded-[4px]" />
            <span className="font-display font-bold text-[15px] text-g900 tracking-tight">Admin</span>
          </Link>
          <div className="ml-auto flex space-x-2">
            <Link href="/admin/tournaments" className="text-[13px] font-sans font-medium text-g500">Draws</Link>
            <Link href="/admin/matchday" className="text-[13px] font-sans font-medium text-g500">Matches</Link>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
