import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, Users, Building2, Trophy, Activity, LogOut, Home, Shield, Sparkles, Settings } from "lucide-react";

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const hasClub = (user?.clubMemberships?.length ?? 0) > 0;
  const isSuperAdmin = user?.role === "super_admin";
  const navItems = [
    { href: "/admin", label: "Dashboard", icon: Activity },
    ...(isSuperAdmin ? [{ href: "/admin/clubs", label: "Clubs", icon: Building2 }] : []),
    ...(hasClub ? [{ href: "/admin/club-settings", label: "Club Settings", icon: Settings }] : []),
    { href: "/admin/tournaments", label: "Tournaments", icon: Trophy },
    { href: "/admin/teams", label: "Teams Directory", icon: Users },
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
            return (
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
            )
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
