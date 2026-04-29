import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListPlayers } from "@workspace/api-client-react";
import { SpectatorLayout } from "@/components/layout/SpectatorLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight } from "lucide-react";

export function PlayersDirectory() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useListPlayers(search ? { search } : undefined);

  return (
    <SpectatorLayout>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Players</h1>
          <p className="text-[14px] text-ink2 mt-1">Browse polo players.</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink3" />
          <Input
            type="text"
            placeholder="Search players by name…"
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        {isLoading ? (
          <PageLoading />
        ) : !data || data.length === 0 ? (
          <EmptyState title={search ? "No players match your search" : "No players found"} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map(p => (
              <Link key={p.id} href={`/players/${p.id}`} className="block">
                <div className="bg-white rounded-[12px] p-4 card-shadow hover:border-g300 border border-transparent transition-colors flex items-center gap-3">
                  <PlayerHeadshot url={p.headshotUrl} name={p.name} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="font-sans font-semibold text-[15px] text-ink truncate">{p.name}</div>
                    <div className="text-[12px] text-ink3 flex flex-wrap gap-x-2 mt-0.5">
                      {p.handicap != null && <span>HCP {p.handicap}</span>}
                      {p.homeClubName && <span className="truncate">· {p.homeClubName}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink3 shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SpectatorLayout>
  );
}
