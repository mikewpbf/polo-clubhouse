import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, Users, Building2, Trophy, Activity, LogOut, Home, Shield, Sparkles, Settings, UserCircle, Target, BarChart3, ChevronDown, ChevronRight } from "lucide-react";
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

function teamLabel(t: SidebarMatch["homeTeam"]): string {
  return t?.shortName || t?.name || "TBD";
}

function MatchControlMenu({
  label,
  icon: Icon,
  basePath,
  matches,
  isLoading,
  isActive,
  defaultOpen,
}: {
  label: string;
  icon: typeof Target;
  basePath: string;
  matches: SidebarMatch[];
  isLoading: boolean;
  isActive: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [location] = useLocation();
  // Keep the menu open whenever the user is on one of its child routes — a
  // collapse on navigation would feel like the sidebar "lost" the selection.
  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center px-3 py-2.5 rounded-[8px] text-[14px] font-sans font-medium transition-colors ${
          isActive ? "bg-g50 text-g900" : "text-ink2 hover:bg-bg2 hover:text-ink"
        }`}
        aria-expanded={open}
      >
        <Icon className={`w-[18px] h-[18px] mr-3 ${isActive ? "text-g500" : "text-ink3"}`} />
        <span className="flex-1 text-left">{label}</span>
        <Chevron className="w-4 h-4 text-ink3" />
      </button>
      {open && (
        <div className="mt-0.5 ml-2 pl-3 border-l border-line/60 space-y-0.5">
          {isLoading ? (
            <div className="px-3 py-1.5 text-[12px] text-ink3 font-sans">Loading…</div>
          ) : matches.length === 0 ? (
            <div className="px-3 py-1.5 text-[12px] text-ink3 font-sans">No live or upcoming matches</div>
          ) : (
            matches.map((m) => {
              const href = `${basePath}/${m.id}`;
              const matchActive = location === href;
              const isLive = m.status === "live" || m.status === "halftime";
              return (
                <Link
                  key={m.id}
                  href={href}
                  className={`flex items-center px-3 py-1.5 rounded-[6px] text-[12.5px] font-sans transition-colors ${
                    matchActive ? "bg-g50 text-g900 font-medium" : "text-ink2 hover:bg-bg2 hover:text-ink"
                  }`}
                  title={`${teamLabel(m.homeTeam)} vs ${teamLabel(m.awayTeam)}${m.field?.name ? ` · ${m.field.name}` : ""}`}
                >
                  {isLive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-live animate-live-dot mr-2 flex-shrink-0" />
                  )}
                  <span className="truncate">
                    {teamLabel(m.homeTeam)} <span className="text-ink3">vs</span> {teamLabel(m.awayTeam)}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
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

  const { data: todayMatches, isLoading: todayLoading } = useListTodayMatches(
    { clubIds: clubIds || undefined, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } as any,
    { query: { enabled: canControlMatches, refetchInterval: 30000 } as any },
  );
  const { data: liveMatches, isLoading: liveLoading } = useListLiveMatches({
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

  const matchesLoading = canControlMatches && (todayLoading || liveLoading);
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
            // Insert the Score Control + Stats Control collapsible menus
            // immediately after Match Day so the related items cluster
            // together in the nav.
            if (item.href === "/admin/matchday" && canControlMatches) {
              return (
                <div key={item.href}>
                  {link}
                  <MatchControlMenu
                    label="Score Control"
                    icon={Target}
                    basePath="/admin/score-control"
                    matches={sidebarMatches}
                    isLoading={!!matchesLoading}
                    isActive={onScoreControl}
                    defaultOpen={onScoreControl}
                  />
                  <MatchControlMenu
                    label="Stats Control"
                    icon={BarChart3}
                    basePath="/admin/stats-control"
                    matches={sidebarMatches}
                    isLoading={!!matchesLoading}
                    isActive={onStatsControl}
                    defaultOpen={onStatsControl}
                  />
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
