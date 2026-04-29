import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListPlayers, useCreatePlayer, useListClubs } from "@workspace/api-client-react";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, ChevronRight } from "lucide-react";

export function AdminPlayers() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, refetch } = useListPlayers(search ? { search } : undefined);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Players</h1>
            <p className="text-[14px] text-ink2 mt-1">Manage player profiles across all clubs.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> New Player
          </Button>
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
          <EmptyState title={search ? "No players match your search" : "No players yet"} description={search ? "" : "Create the first player profile."} />
        ) : (
          <div className="bg-white rounded-[12px] card-shadow divide-y divide-line2">
            {data.map(p => (
              <Link key={p.id} href={`/admin/players/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-bg2 transition-colors">
                <PlayerHeadshot url={p.headshotUrl} name={p.name} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="font-sans font-medium text-[15px] text-ink truncate">{p.name}</div>
                  <div className="text-[12px] text-ink3 flex flex-wrap gap-x-3 mt-0.5">
                    {p.handicap != null && <span>HCP {p.handicap}</span>}
                    {p.homeClubName && <span>{p.homeClubName}</span>}
                    {p.lastMatchDate && <span>Last match: {p.lastMatchDate}</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink3 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <CreatePlayerDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); refetch(); }}
        />
      )}
    </AdminLayout>
  );
}

function CreatePlayerDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState("");
  const [homeClubId, setHomeClubId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data: clubs } = useListClubs();
  const create = useCreatePlayer();

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) { setError("Name is required"); return; }
    try {
      await create.mutateAsync({
        data: {
          name: name.trim(),
          handicap: handicap.trim() || null,
          homeClubId: homeClubId || null,
        },
      });
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to create player");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Player</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" />
          </div>
          <div>
            <Label>Handicap</Label>
            <Input value={handicap} onChange={(e) => setHandicap(e.target.value)} placeholder="e.g. 4" />
          </div>
          <div>
            <Label>Home Club</Label>
            <select className="w-full border border-line rounded-[8px] px-3 py-2 text-[14px]" value={homeClubId} onChange={(e) => setHomeClubId(e.target.value)}>
              <option value="">— None —</option>
              {(clubs as any[] | undefined)?.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {error && <div className="text-[13px] text-red-600">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
