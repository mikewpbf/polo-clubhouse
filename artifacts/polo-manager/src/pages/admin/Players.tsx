import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useListPlayers, useCreatePlayer, useListClubs } from "@workspace/api-client-react";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, ArrowUp, ArrowDown, Wrench } from "lucide-react";
import { useAuth, getStoredToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type CleanupGroup = { name: string; canonicalId: string; mergedDuplicateIds: string[] };
type CleanupSummary = {
  dryRun: boolean;
  executed: boolean;
  mergedGroups: CleanupGroup[];
  duplicatesRemoved: number;
  eventsReassigned: number;
  teamLinksReassigned: number;
  teamLinksDroppedAsConflict: number;
  horsesReassigned: number;
  noEventPlayersRemoved: number;
  noEventPlayerNames: string[];
};

async function callCleanup(dryRun: boolean): Promise<CleanupSummary> {
  const token = getStoredToken();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/admin/players/cleanup?dryRun=${dryRun}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Cleanup failed");
  return data as CleanupSummary;
}

type SortKey = "name" | "handicap" | "homeClubName" | "lastMatchDate";
type SortDir = "asc" | "desc";

type PlayerRow = {
  id: string;
  name: string;
  handicap: string | null;
  headshotUrl: string | null;
  homeClubId: string | null;
  homeClubName: string | null;
  homeClubSlug: string | null;
  lastMatchDate: string | null;
};

export function AdminPlayers() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  // Team managers get a read-only directory view (no create, no per-row drilldown
  // into the manage page). Club admins / super admins retain full management UI.
  const readOnly = user?.role === "team_manager";
  const isSuperAdmin = user?.role === "super_admin";
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, refetch } = useListPlayers(search ? { search } : undefined);

  const rows: PlayerRow[] = useMemo(() => {
    const arr = (data ?? []) as PlayerRow[];
    const sorted = [...arr].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = sortKey === "handicap"
        ? (Number(av) - Number(bv))
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [data, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortHeader = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className={`text-left font-sans font-semibold text-[12px] uppercase tracking-wide text-ink2 hover:text-ink inline-flex items-center gap-1 ${className ?? ""}`}
    >
      {label}
      {sortKey === k && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
    </button>
  );

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Players</h1>
            <p className="text-[14px] text-ink2 mt-1">
              {readOnly
                ? "Read-only roster view of players currently on your teams."
                : "Manage player profiles across all clubs."}
            </p>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <Button variant="outline" onClick={() => setCleanupOpen(true)}>
                  <Wrench className="w-4 h-4 mr-1.5" /> Cleanup
                </Button>
              )}
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> New Player
              </Button>
            </div>
          )}
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
        ) : rows.length === 0 ? (
          <EmptyState title={search ? "No players match your search" : "No players yet"} description={search ? "" : "Create the first player profile."} />
        ) : (
          <div className="bg-white rounded-[12px] card-shadow overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1fr_120px_1fr_140px] items-center gap-3 px-3 py-2 border-b border-line2 bg-bg2/50">
              <SortHeader k="name" label="Player" />
              <SortHeader k="handicap" label="Handicap" />
              <SortHeader k="homeClubName" label="Home Club" />
              <SortHeader k="lastMatchDate" label="Last Match" />
            </div>
            <div className="divide-y divide-line2">
              {rows.map(p => {
                const RowEl = readOnly ? "div" : "button";
                const rowProps = readOnly
                  ? { className: "w-full grid grid-cols-1 sm:grid-cols-[1fr_120px_1fr_140px] items-center gap-3 p-3 text-left" }
                  : {
                      type: "button" as const,
                      onClick: () => navigate(`/admin/players/${p.id}`),
                      className: "w-full grid grid-cols-1 sm:grid-cols-[1fr_120px_1fr_140px] items-center gap-3 p-3 hover:bg-bg2 transition-colors text-left",
                    };
                return (
                  <RowEl key={p.id} {...rowProps}>
                    <div className="flex items-center gap-3 min-w-0">
                      <PlayerHeadshot url={p.headshotUrl} name={p.name} size={40} />
                      <div className="font-sans font-medium text-[15px] text-ink truncate">{p.name}</div>
                    </div>
                    <div className="text-[13px] text-ink2 font-mono">{p.handicap ?? "—"}</div>
                    <div className="text-[13px] text-ink2 truncate">{p.homeClubName ?? "—"}</div>
                    <div className="text-[12px] text-ink3">{p.lastMatchDate ?? "—"}</div>
                  </RowEl>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {createOpen && (
        <CreatePlayerDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); refetch(); }}
        />
      )}

      {cleanupOpen && (
        <CleanupDialog
          onClose={() => setCleanupOpen(false)}
          onDone={() => { setCleanupOpen(false); refetch(); }}
          toast={toast}
        />
      )}
    </AdminLayout>
  );
}

function CleanupDialog({
  onClose,
  onDone,
  toast,
}: {
  onClose: () => void;
  onDone: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [preview, setPreview] = useState<CleanupSummary | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    callCleanup(true)
      .then(s => { if (!cancelled) setPreview(s); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoadingPreview(false); });
    return () => { cancelled = true; };
  }, []);

  const execute = async () => {
    setExecuting(true);
    setError(null);
    try {
      const result = await callCleanup(false);
      toast({
        title: "Cleanup complete",
        description: `Merged ${result.duplicatesRemoved} duplicate(s); removed ${result.noEventPlayersRemoved} no-match player(s).`,
      });
      onDone();
    } catch (e: any) {
      setError(e.message || "Cleanup failed");
      setExecuting(false);
    }
  };

  const nothingToDo = preview && preview.duplicatesRemoved === 0 && preview.noEventPlayersRemoved === 0;

  return (
    <Dialog open onOpenChange={(o) => !o && !executing && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cleanup players</DialogTitle>
          <DialogDescription>
            Merges player records with duplicate names and removes players who have never appeared in a match.
          </DialogDescription>
        </DialogHeader>

        {loadingPreview ? (
          <div className="text-[14px] text-ink2 py-4">Calculating preview…</div>
        ) : error ? (
          <div className="text-[13px] text-red-600 py-4">{error}</div>
        ) : preview ? (
          <div className="space-y-4 text-[14px] max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Duplicate records to merge" value={preview.duplicatesRemoved} />
              <Stat label="No-match players to remove" value={preview.noEventPlayersRemoved} />
              <Stat label="Goal events reassigned" value={preview.eventsReassigned} />
              <Stat label="Roster links reassigned" value={preview.teamLinksReassigned} />
              <Stat label="Roster links dropped (duplicate on same team/season)" value={preview.teamLinksDroppedAsConflict} />
              <Stat label="Horses reassigned" value={preview.horsesReassigned} />
            </div>

            {preview.mergedGroups.length > 0 && (
              <div>
                <div className="font-semibold text-ink mb-1.5">Names being merged</div>
                <ul className="text-[13px] text-ink2 space-y-1 max-h-40 overflow-y-auto border border-line2 rounded-[8px] p-2">
                  {preview.mergedGroups.map(g => (
                    <li key={g.canonicalId}>
                      <span className="font-medium text-ink">{g.name}</span>{" "}
                      — keeping 1, removing {g.mergedDuplicateIds.length} duplicate{g.mergedDuplicateIds.length === 1 ? "" : "s"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.noEventPlayerNames.length > 0 && (
              <div>
                <div className="font-semibold text-ink mb-1.5">Players being removed (no match history)</div>
                <ul className="text-[13px] text-ink2 columns-2 max-h-40 overflow-y-auto border border-line2 rounded-[8px] p-2">
                  {preview.noEventPlayerNames.map((n, i) => (
                    <li key={i} className="break-inside-avoid">{n}</li>
                  ))}
                </ul>
              </div>
            )}

            {nothingToDo && (
              <div className="text-[13px] text-ink2 italic">Nothing to clean up — your player directory is already tidy.</div>
            )}

            {!nothingToDo && (
              <div className="text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded-[8px] p-2.5">
                This operation cannot be undone from the UI. Make sure you have a recent database backup before continuing.
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={executing}>Cancel</Button>
          <Button
            onClick={execute}
            disabled={loadingPreview || executing || !!error || !!nothingToDo}
          >
            {executing ? "Cleaning up…" : "Run cleanup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-bg2/50 rounded-[8px] p-2.5">
      <div className="text-[11px] uppercase tracking-wide text-ink3">{label}</div>
      <div className="text-[20px] font-semibold text-ink">{value}</div>
    </div>
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
