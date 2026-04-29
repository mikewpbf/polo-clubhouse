import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Home, Trophy, Building2, Users, UserCircle } from "lucide-react";
import { useGetMyLinkedPlayer, getGetMyLinkedPlayerQueryKey } from "@workspace/api-client-react";

export function SpectatorLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const { data: linkedPlayer } = useGetMyLinkedPlayer({
    query: { enabled: isAuthenticated, queryKey: getGetMyLinkedPlayerQueryKey() },
  });
  const hasLinkedPlayer = !!(linkedPlayer && linkedPlayer.id);

  const navLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/tournaments", label: "Tournaments", icon: Trophy },
    { href: "/clubs", label: "Clubs", icon: Building2 },
    { href: "/players", label: "Players", icon: Users },
    ...(hasLinkedPlayer ? [{ href: "/my-profile", label: "My Profile", icon: UserCircle }] : []),
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="sticky top-0 z-40 w-full bg-white border-b border-line/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Polo Clubhouse" className="w-8 h-8 rounded-[6px]" />
              <span className="font-display font-bold text-lg text-g900 tracking-tight">Polo Clubhouse</span>
            </Link>
            
            <nav className="hidden md:flex space-x-1">
              {navLinks.map(link => (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className={`text-[14px] font-sans font-medium px-3 py-1.5 rounded-[8px] transition-colors ${
                    isActive(link.href)
                      ? "text-g700 bg-g50" 
                      : "text-ink2 hover:text-ink hover:bg-bg2"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                {(user?.role === 'admin' || user?.role === 'super_admin' || (user?.clubMemberships?.length ?? 0) > 0) && (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/admin">Dashboard</Link>
                  </Button>
                )}
                {user?.role === 'team_manager' && (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/my-team">My Team</Link>
                  </Button>
                )}
                <span className="text-[13px] font-sans text-ink2 hidden sm:block">{user?.displayName}</span>
                <Button variant="ghost" size="sm" onClick={logout}>Sign Out</Button>
              </div>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Log In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
        {children}
      </main>

      <footer className="hidden md:block border-t border-line/60 bg-white py-8 mt-auto">
        <div className="container mx-auto px-4 flex items-center justify-center gap-2">
          <img src="/logo.png" alt="" className="w-5 h-5 rounded-[4px] opacity-40" />
          <p className="text-[13px] font-sans text-ink3">
            Polo Clubhouse
          </p>
        </div>
      </footer>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-line/60 safe-bottom">
        <div className="flex items-center justify-around h-16">
          {navLinks.map(link => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  active ? "text-g700" : "text-ink3"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span className={`text-[11px] font-sans mt-1 ${active ? "font-semibold" : "font-medium"}`}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
