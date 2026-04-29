import { useListClubs } from "@workspace/api-client-react";
import { SpectatorLayout } from "@/components/layout/SpectatorLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { Link } from "wouter";
import { MapPin, ChevronRight, Star } from "lucide-react";

interface ClubItem {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  state?: string | null;
  logoUrl?: string | null;
  logo40Url?: string | null;
  logo96Url?: string | null;
  sponsored?: boolean | null;
}

export function ClubsPage() {
  const { data: clubs, isLoading } = useListClubs();

  if (isLoading) return <SpectatorLayout><PageLoading /></SpectatorLayout>;

  return (
    <SpectatorLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Clubs</h1>
          <p className="text-[14px] text-ink2 mt-1">Browse polo clubs.</p>
        </div>

        {!(clubs as ClubItem[] | undefined)?.length ? (
          <EmptyState title="No clubs found" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(clubs as ClubItem[]).map((club) => (
              <Link key={club.id} href={`/clubs/${club.slug}`} className="block">
                <div className="bg-white rounded-[12px] p-5 h-full transition-all cursor-pointer border border-transparent hover:border-g300 card-shadow">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden shrink-0 ${(club.logo40Url || club.logo96Url || club.logoUrl) ? 'bg-white' : 'bg-g50 border border-g100'}`}>
                      {(club.logo40Url || club.logo96Url || club.logoUrl) ? (
                        <img src={(club.logo40Url || club.logo96Url || club.logoUrl)!} alt={club.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[13px] font-display font-bold text-g500">{club.name.substring(0, 2)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-[16px] text-ink">{club.name}</h3>
                      {club.sponsored && (
                        <p className="text-[11px] text-amber-600 flex items-center mt-0.5 font-medium">
                          <Star className="w-3 h-3 mr-1 shrink-0 fill-amber-400 text-amber-500" />
                          Featured Club
                        </p>
                      )}
                      {(club.city || club.state) && (
                        <p className="text-[13px] text-ink3 flex items-center mt-1">
                          <MapPin className="w-3 h-3 mr-1 shrink-0" />
                          {[club.city, club.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-ink3 shrink-0" />
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
