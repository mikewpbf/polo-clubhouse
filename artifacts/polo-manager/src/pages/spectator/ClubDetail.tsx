import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useGetClubBySlug } from "@workspace/api-client-react";
import type { ClubDetail as ClubDetailType, Tournament } from "@workspace/api-client-react";
import { SpectatorLayout } from "@/components/layout/SpectatorLayout";
import { Trophy, ChevronRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function getYear(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.getFullYear();
}

export function ClubDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: club, isLoading } = useGetClubBySlug(slug || "", {
    query: { enabled: !!slug } as any,
  });
  const [yearFilter, setYearFilter] = useState<string>("all");

  const c = club as ClubDetailType | undefined;
  const allTournaments: Tournament[] = useMemo(() => {
    if (!c?.tournaments) return [];
    return c.tournaments.filter((t: Tournament) => t.status !== "draft");
  }, [c]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allTournaments.forEach((t: Tournament) => {
      const y = getYear((t as any).startDate || (t as any).endDate);
      if (y) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allTournaments]);

  const filtered = useMemo(() => {
    if (yearFilter === "all") return allTournaments;
    const y = parseInt(yearFilter);
    return allTournaments.filter((t: Tournament) => {
      const ty = getYear((t as any).startDate || (t as any).endDate);
      return ty === y;
    });
  }, [allTournaments, yearFilter]);

  const active = filtered.filter((t: Tournament) => t.status === "in_progress" || t.status === "published");
  const past = filtered.filter((t: Tournament) => t.status === "completed" || t.status === "final");

  if (isLoading) {
    return (
      <SpectatorLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-ink2 text-[14px]">Loading club...</div>
        </div>
      </SpectatorLayout>
    );
  }

  if (!c) {
    return (
      <SpectatorLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-ink2 text-[14px]">Club not found</div>
        </div>
      </SpectatorLayout>
    );
  }

  return (
    <SpectatorLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          {c.logoUrl ? (
            <img src={c.logoUrl} alt={c.name} className="w-16 h-16 rounded-[12px] object-cover" style={{ boxShadow: 'var(--shadow-md)' }} />
          ) : (
            <div className="w-16 h-16 rounded-[12px] bg-g50 border border-g100 flex items-center justify-center" style={{ boxShadow: 'var(--shadow-md)' }}>
              <span className="font-display text-xl text-g500">{c.logoInitials || c.name.substring(0, 2).toUpperCase()}</span>
            </div>
          )}
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">{c.name}</h1>
            {c.region && <p className="text-ink2 text-[14px]">{c.region}{c.country ? `, ${c.country}` : ""}</p>}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-ink">Tournaments</h2>
            {availableYears.length > 0 && (
              <div className="relative">
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="appearance-none bg-white border border-g200 rounded-[8px] pl-3 pr-8 py-1.5 text-[13px] font-sans text-ink cursor-pointer hover:border-g300 transition-colors focus:outline-none focus:ring-2 focus:ring-g500/20 focus:border-g500"
                >
                  <option value="all">All Years</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink3 pointer-events-none" />
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-[12px] p-8 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="w-12 h-12 rounded-full bg-g50 mx-auto mb-3 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-g300" />
              </div>
              <p className="text-ink2 text-[14px]">
                {yearFilter !== "all" ? `No tournaments in ${yearFilter}.` : "No tournaments yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {active.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[13px] font-sans font-medium text-ink3 uppercase tracking-wider">Active</h3>
                  {active.map((t: Tournament) => (
                    <TournamentCard key={t.id} tournament={t} />
                  ))}
                </div>
              )}

              {past.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[13px] font-sans font-medium text-ink3 uppercase tracking-wider">Past</h3>
                  {past.map((t: Tournament) => (
                    <TournamentCard key={t.id} tournament={t} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </SpectatorLayout>
  );
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const t = tournament as any;
  const startDate = t.startDate ? new Date(t.startDate) : null;
  const endDate = t.endDate ? new Date(t.endDate) : null;
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const statusLabel = t.status === "in_progress" ? "In Progress" :
    t.status === "completed" || t.status === "final" ? "Completed" :
    t.status === "published" ? "Published" : t.status.replace(/_/g, " ");

  const statusColor = t.status === "in_progress" ? "bg-live/10 text-live" :
    t.status === "completed" || t.status === "final" ? "bg-ink3/10 text-ink3" :
    "bg-g50 text-g700";

  return (
    <Link href={`/tournaments/${t.id}`}>
      <div className="bg-white rounded-[12px] p-5 transition-all cursor-pointer border border-transparent hover:border-g300 card-shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-[8px] bg-g50 flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4 text-g500" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-[16px] font-bold text-ink truncate">{t.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {t.format && <span className="text-ink2 text-[13px]">{t.format.replace(/_/g, " ")}</span>}
                {startDate && (
                  <>
                    <span className="text-ink3 text-[11px]">&middot;</span>
                    <span className="text-ink3 text-[12px]">
                      {fmt(startDate)}{endDate ? ` - ${fmt(endDate)}` : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <span className={`text-[11px] font-sans font-medium px-2 py-0.5 rounded-[6px] ${statusColor}`}>
              {statusLabel}
            </span>
            <ChevronRight className="w-4 h-4 text-ink3" />
          </div>
        </div>
      </div>
    </Link>
  );
}
