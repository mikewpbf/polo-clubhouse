import { useListAllTournaments, useListClubs } from "@workspace/api-client-react";
import { SpectatorLayout } from "@/components/layout/SpectatorLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { formatDate } from "@/lib/utils";
import { Trophy, Calendar, Search, Building2, X, Star } from "lucide-react";
import { useState, useMemo } from "react";

interface ClubInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  logo40Url?: string | null;
  logo96Url?: string | null;
}

interface TournamentItem {
  id: string;
  name: string;
  format?: string | null;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  handicapLevel?: string | null;
  teamCount: number;
  club?: ClubInfo | null;
  sponsored?: boolean | null;
}

export function TournamentsPage() {
  const [search, setSearch] = useState("");
  const [selectedClub, setSelectedClub] = useState<ClubInfo | null>(null);
  const [clubSearch, setClubSearch] = useState("");
  const [showClubDropdown, setShowClubDropdown] = useState(false);

  const { data: tournaments, isLoading } = useListAllTournaments(
    selectedClub ? { clubSlug: selectedClub.slug } : undefined
  );
  const { data: clubs } = useListClubs();

  const filteredClubs = useMemo(() => {
    if (!clubs || !clubSearch.trim()) return [];
    const q = clubSearch.toLowerCase();
    return (clubs as ClubInfo[]).filter((c) =>
      c.name.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [clubs, clubSearch]);

  const filteredTournaments = useMemo(() => {
    if (!tournaments) return [];
    if (!search.trim()) return tournaments as TournamentItem[];
    const q = search.toLowerCase();
    return (tournaments as TournamentItem[]).filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.club?.name?.toLowerCase().includes(q)
    );
  }, [tournaments, search]);

  if (isLoading) return <SpectatorLayout><PageLoading /></SpectatorLayout>;

  return (
    <SpectatorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Tournaments</h1>
          <p className="text-[14px] text-ink2 mt-1">Browse all tournaments across clubs.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tournaments..."
              className="pl-9"
            />
          </div>
          <div className="relative w-full sm:w-64">
            {selectedClub ? (
              <div className="flex items-center gap-2 h-9 px-3 rounded-[8px] border border-g300 bg-g50 text-[14px]">
                <Building2 className="w-3.5 h-3.5 text-g500" />
                <span className="flex-1 truncate text-g900 font-medium">{selectedClub.name}</span>
                <button
                  onClick={() => { setSelectedClub(null); setClubSearch(""); }}
                  className="text-g500 hover:text-g900"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink3" />
                <Input
                  value={clubSearch}
                  onChange={(e) => { setClubSearch(e.target.value); setShowClubDropdown(true); }}
                  onFocus={() => setShowClubDropdown(true)}
                  onBlur={() => setTimeout(() => setShowClubDropdown(false), 200)}
                  placeholder="Filter by club..."
                  className="pl-9"
                />
                {showClubDropdown && filteredClubs.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-line rounded-[8px] z-20 overflow-hidden" style={{ boxShadow: "var(--shadow-md)" }}>
                    {filteredClubs.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 text-[14px] text-ink hover:bg-bg2 flex items-center gap-2 transition-colors"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedClub(c);
                          setClubSearch("");
                          setShowClubDropdown(false);
                        }}
                      >
                        {(c.logo40Url || c.logo96Url || c.logoUrl) ? (
                          <img src={(c.logo40Url || c.logo96Url || c.logoUrl)!} alt="" className="w-5 h-5 rounded-[4px] object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-[4px] bg-g50 flex items-center justify-center">
                            <span className="text-[9px] font-medium text-g500">{c.name.substring(0, 2).toUpperCase()}</span>
                          </div>
                        )}
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {!filteredTournaments.length ? (
          <EmptyState
            title="No tournaments found"
            description={selectedClub ? `No tournaments found for ${selectedClub.name}.` : "There are no published tournaments at this time."}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTournaments.map((t) => (
              <Link key={t.id} href={`/tournaments/${t.id}`} className="block">
                <div className="bg-white rounded-[12px] h-full transition-all cursor-pointer border border-transparent hover:border-g300 card-shadow">
                  <div className="p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${(t.club?.logo40Url || t.club?.logo96Url || t.club?.logoUrl) ? 'bg-white' : 'bg-g50 border border-g100'}`}>
                        {(t.club?.logo40Url || t.club?.logo96Url || t.club?.logoUrl) ? (
                          <img src={(t.club.logo40Url || t.club.logo96Url || t.club.logoUrl)!} alt={t.club.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[11px] font-display font-bold text-g500">{t.club?.name?.substring(0, 2) ?? ""}</span>
                        )}
                      </div>
                    </div>
                    <h3 className="font-display font-bold text-[17px] text-ink mb-1 line-clamp-2">{t.name}</h3>
                    {t.sponsored && (
                      <p className="text-[11px] text-amber-600 flex items-center mb-1 font-medium">
                        <Star className="w-3 h-3 mr-1 shrink-0 fill-amber-400 text-amber-500" />
                        Featured Event
                      </p>
                    )}
                    {t.club && (
                      <p className="text-[13px] font-sans text-ink2 mb-2">{t.club.name}</p>
                    )}
                    {t.startDate && (
                      <div className="flex items-center text-[12px] text-ink3 mb-2">
                        <Calendar className="w-3 h-3 mr-1.5" />
                        {formatDate(t.startDate, "MMM d")} {t.endDate ? `- ${formatDate(t.endDate, "MMM d")}` : ""}
                      </div>
                    )}
                    <div className="mt-auto pt-3 border-t border-line2 flex items-center justify-between text-[12px] font-sans text-ink3">
                      <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> {t.teamCount} Teams</span>
                      <span>{t.handicapLevel || "Open"}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SpectatorLayout>
  );
}
