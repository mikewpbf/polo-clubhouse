import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, Activity, LogOut, Info, CalendarOff, Home } from "lucide-react";
import { useGetMyTeamAssignments } from "@workspace/api-client-react";
import { PageLoading } from "@/components/LoadingBar";

export function TeamLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { data: assignments, isLoading } = useGetMyTeamAssignments();

  if (isLoading) return <PageLoading />;
  
  const activeAssignment = assignments?.[0];
  const teamId = activeAssignment?.teamId;

  if (!teamId) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="bg-white rounded-[12px] p-8 max-w-md text-center" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="w-14 h-14 rounded-full bg-g50 mx-auto mb-4 flex items-center justify-center">
            <img src="/logo.png" alt="" className="w-8 h-8 rounded-[6px]" />
          </div>
          <h2 className="font-display text-xl font-bold mb-2">No Active Teams</h2>
          <p className="text-[14px] text-ink2 mb-6">You haven't been assigned to manage any teams yet. Check your email for invitations from your club admin.</p>
          <button onClick={logout} className="text-g500 text-[13px] font-medium hover:text-g700 transition-colors">Sign out</button>
        </div>
      </div>
    );
  }

  const basePath = `/my-team/${teamId}`;

  const navItems = [
    { href: basePath, label: "Dashboard", icon: Activity },
    { href: `${basePath}/out-dates`, label: "Out Dates", icon: CalendarOff },
    { href: `${basePath}/schedule`, label: "Our Schedule", icon: Calendar },
    { href: `${basePath}/profile`, label: "Team Profile", icon: Info },
  ];

  return (
    <div className="min-h-screen bg-bg flex w-full">
      <aside className="w-64 border-r border-line/60 bg-white hidden md:flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <div className="h-16 flex items-center px-5 border-b border-line/60">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Polo Clubhouse" className="w-8 h-8 rounded-[6px]" />
            <span className="font-display font-bold text-[15px] text-g900 tracking-tight">My Team</span>
          </Link>
        </div>
        
        <div className="p-4 border-b border-line/60">
          <div className="flex items-center space-x-3 mb-2">
            {activeAssignment.teamLogoUrl ? (
              <img src={activeAssignment.teamLogoUrl} className="w-9 h-9 rounded-full border border-g100 object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-g50 border border-g100 flex items-center justify-center text-[11px] font-bold text-g700">
                {activeAssignment.teamName.substring(0,2)}
              </div>
            )}
            <div>
              <div className="font-sans font-medium text-[14px] truncate">{activeAssignment.teamName}</div>
              <div className="text-[12px] font-sans text-g500">{activeAssignment.clubName}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === basePath ? location === basePath : location.startsWith(item.href);
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

      <main className="flex-1 min-w-0 bg-bg flex flex-col">
        <header className="md:hidden h-14 border-b border-line/60 bg-white flex items-center px-4 sticky top-0 z-30">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="w-6 h-6 rounded-[4px]" />
            <span className="font-display font-bold text-[15px] text-g900 tracking-tight truncate">
              {activeAssignment.teamName}
            </span>
          </Link>
          <div className="ml-auto flex space-x-3">
            <Link href={`${basePath}/out-dates`} className="text-[13px] font-sans font-medium text-g500">Out Dates</Link>
            <Link href={`${basePath}/schedule`} className="text-[13px] font-sans font-medium text-g500">Schedule</Link>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
