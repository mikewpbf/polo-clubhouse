import { getStoredToken } from "@/hooks/use-auth";
import { useUpdateTeam } from "@workspace/api-client-react";
import { AdminLayout } from "./AdminLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { ImageCropUpload } from "@/components/ImageCropUpload";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useState, useRef, useEffect, useCallback } from "react";
import { Users, Plus, X, Pencil, Trash2, UserPlus, Shield, Search, ChevronDown, ChevronRight, CalendarOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const HORSE_SEX_OPTIONS = ["Mare", "Gelding", "Stallion"] as const;
const HORSE_COLOR_OPTIONS = ["Bay", "Chestnut", "Liver Chestnut", "Gray", "Black", "Paint", "Other"] as const;

interface TeamItem {
  id: string;
  name: string;
  shortName?: string | null;
  scoreboardName?: string | null;
  primaryColor?: string | null;
  handicap?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
  logoUrl?: string | null;
  clubId?: string | null;
}

interface HorseItem {
  id: string;
  playerId: string;
  horseName: string;
  owner?: string | null;
  breeder?: string | null;
  ownedAndBredBy?: string | null;
  sire?: string | null;
  dam?: string | null;
  age?: number | null;
  color?: string | null;
  sex?: string | null;
  typeOrBreed?: string | null;
  notes?: string | null;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getStoredToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return res.json();
}

function LogoUpload({
  currentLogo,
  onLogoChange,
  initials,
}: {
  currentLogo?: string | null;
  onLogoChange: (url: string) => void;
  color: string;
  initials: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <ImageCropUpload
        value={currentLogo ?? null}
        onChange={onLogoChange}
        name={initials}
        shape="circle"
        size={64}
      />
      <span className="text-[11px] text-ink3">Team logo</span>
    </div>
  );
}

interface PlayerItem {
  id: string;
  name: string;
  handicap?: string | null;
  position?: number | null;
  isActive?: boolean;
}

function HorseFormDialog({
  open,
  onOpenChange,
  teamId,
  playerId,
  horse,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  playerId: string;
  horse?: HorseItem | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [horseName, setHorseName] = useState("");
  const [owner, setOwner] = useState("");
  const [breeder, setBreeder] = useState("");
  const [sire, setSire] = useState("");
  const [dam, setDam] = useState("");
  const [age, setAge] = useState("");
  const [color, setColor] = useState("");
  const [sex, setSex] = useState("");
  const [typeOrBreed, setTypeOrBreed] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setHorseName(horse?.horseName || "");
      setOwner(horse?.owner || "");
      setBreeder(horse?.breeder || "");
      setSire(horse?.sire || "");
      setDam(horse?.dam || "");
      setAge(horse?.age != null ? String(horse.age) : "");
      setColor(horse?.color || "");
      setSex(horse?.sex || "");
      setTypeOrBreed(horse?.typeOrBreed || "");
      setNotes(horse?.notes || "");
    }
  }, [open, horse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horseName.trim()) return;
    setSaving(true);
    try {
      const body = {
        horseName: horseName.trim(),
        owner: owner || null,
        breeder: breeder || null,
        sire: sire || null,
        dam: dam || null,
        age: age ? parseInt(age) : null,
        color: color || null,
        sex: sex || null,
        typeOrBreed: typeOrBreed || null,
        notes: notes || null,
      };
      if (horse) {
        await apiFetch(`/teams/${teamId}/players/${playerId}/horses/${horse.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast({ title: "Horse updated" });
      } else {
        await apiFetch(`/teams/${teamId}/players/${playerId}/horses`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast({ title: "Horse added" });
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save horse";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{horse ? "Edit Horse" : "Add Horse"}</DialogTitle>
          <DialogDescription className="sr-only">
            {horse ? "Edit horse details" : "Add a new horse to this player"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">Horse Name *</label>
            <Input value={horseName} onChange={(e) => setHorseName(e.target.value)} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-ink2 mb-1">Sex</label>
              <Select value={sex} onValueChange={setSex}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  {HORSE_SEX_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-ink2 mb-1">Color</label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  {HORSE_COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-ink2 mb-1">Age</label>
              <Input value={age} onChange={(e) => setAge(e.target.value)} type="number" min="0" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-ink2 mb-1">Type / Breed</label>
              <Input value={typeOrBreed} onChange={(e) => setTypeOrBreed(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-ink2 mb-1">Sire</label>
              <Input value={sire} onChange={(e) => setSire(e.target.value)} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-ink2 mb-1">Dam</label>
              <Input value={dam} onChange={(e) => setDam(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">Owner</label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">Breeder</label>
            <Input value={breeder} onChange={(e) => setBreeder(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !horseName.trim()}>
              {saving ? "Saving..." : horse ? "Save Changes" : "Add Horse"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HorsesList({ teamId, playerId }: { teamId: string; playerId: string }) {
  const { toast } = useToast();
  const [horses, setHorses] = useState<HorseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHorse, setEditingHorse] = useState<HorseItem | null>(null);

  const fetchHorses = useCallback(async () => {
    try {
      const data = await apiFetch(`/teams/${teamId}/players/${playerId}/horses`);
      setHorses(data);
    } catch {
      toast({ title: "Error", description: "Failed to load horses", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [teamId, playerId]);

  useEffect(() => { fetchHorses(); }, [fetchHorses]);

  const handleDelete = async (horseId: string) => {
    try {
      await apiFetch(`/teams/${teamId}/players/${playerId}/horses/${horseId}`, { method: "DELETE" });
      toast({ title: "Horse removed" });
      fetchHorses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete horse";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const openAdd = () => {
    setEditingHorse(null);
    setDialogOpen(true);
  };

  const openEdit = (horse: HorseItem) => {
    setEditingHorse(horse);
    setDialogOpen(true);
  };

  if (loading) return <div className="text-[12px] text-ink3 py-2">Loading horses...</div>;

  return (
    <div className="mt-2">
      {horses.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {horses.map((horse) => (
            <div key={horse.id} className="flex items-center gap-2 group py-1 px-2 rounded-lg hover:bg-surface2 transition-colors">
              <div className="flex-1 min-w-0">
                <span className="text-[13px] text-ink font-medium">{horse.horseName}</span>
                <span className="text-[11px] text-ink3 ml-2">
                  {[horse.sex, horse.color, horse.age != null ? `${horse.age}yo` : null, horse.typeOrBreed].filter(Boolean).join(" · ")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => openEdit(horse)}
                className="opacity-0 group-hover:opacity-100 text-ink3 hover:text-ink transition-all p-1"
                title="Edit horse"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(horse.id)}
                className="opacity-0 group-hover:opacity-100 text-ink3 hover:text-live transition-all p-1"
                title="Remove horse"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-[12px]" onClick={openAdd}>
        <Plus className="w-3 h-3" />
        Add Horse
      </Button>
      <HorseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teamId={teamId}
        playerId={playerId}
        horse={editingHorse}
        onSuccess={fetchHorses}
      />
    </div>
  );
}

function PlayerSection({ teamId, player, onUpdate, onDelete }: {
  teamId: string;
  player: PlayerItem;
  onUpdate: () => void;
  onDelete: (id: string) => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(player.name);
  const [editHandicap, setEditHandicap] = useState(player.handicap || "");

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    try {
      await apiFetch(`/teams/${teamId}/players/${player.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          handicap: editHandicap ? parseFloat(editHandicap) : null,
        }),
      });
      setEditing(false);
      onUpdate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update player";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleToggleActive = async () => {
    try {
      await apiFetch(`/teams/${teamId}/players/${player.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !player.isActive }),
      });
      onUpdate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update player";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className={`group border border-line2 rounded-lg ${player.isActive === false ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => handleToggleActive()}
          className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
            player.isActive !== false ? "bg-g500 border-g500" : "border-line hover:border-ink3"
          }`}
          title={player.isActive !== false ? "Mark inactive" : "Mark active"}
        >
          {player.isActive !== false && (
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6l3 3 5-5" /></svg>
          )}
        </button>

        {editing ? (
          <div className="flex-1 flex items-center gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 h-7 text-[13px]"
              autoFocus
            />
            <Input
              value={editHandicap}
              onChange={(e) => setEditHandicap(e.target.value)}
              className="w-16 h-7 text-[13px] text-center"
              placeholder="HC"
              type="number"
              step="0.5"
            />
            <button type="button" onClick={handleSaveEdit} className="text-g500 hover:text-g700 transition-colors p-1">
              <span className="text-[12px] font-medium">Save</span>
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-ink3 hover:text-ink transition-colors p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex-1 flex items-center gap-2 min-w-0 text-left"
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5 text-ink3 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-ink3 flex-shrink-0" />}
              <span className={`text-[13px] truncate ${player.isActive === false ? "text-ink3 line-through" : "text-ink font-medium"}`}>{player.name}</span>
              {player.handicap != null && (
                <span className="text-[11px] text-g700 bg-g50 px-1.5 py-0.5 rounded flex-shrink-0">HC {player.handicap}</span>
              )}
              {player.isActive === false && (
                <span className="text-[10px] text-ink3 bg-surface2 px-1.5 py-0.5 rounded flex-shrink-0">inactive</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setEditName(player.name); setEditHandicap(player.handicap || ""); setEditing(true); }}
              className="opacity-0 group-hover:opacity-100 text-ink3 hover:text-ink transition-all p-1"
              title="Edit player"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(player.id)}
              className="opacity-0 group-hover:opacity-100 text-ink3 hover:text-live transition-all p-1"
              title="Remove player"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {expanded && !editing && (
        <div className="px-3 pb-3 border-t border-line2">
          <HorsesList teamId={teamId} playerId={player.id} />
        </div>
      )}
    </div>
  );
}

function OutDatesSection({ teamId }: { teamId: string }) {
  const { toast } = useToast();
  const [outDates, setOutDates] = useState<{ id: string; outDate: string; reason?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);

  const loadOutDates = useCallback(async () => {
    try {
      const data = await apiFetch(`/teams/${teamId}/out-dates`);
      setOutDates(data);
    } catch {} finally { setLoading(false); }
  }, [teamId]);

  useEffect(() => { loadOutDates(); }, [loadOutDates]);

  const handleAdd = async () => {
    if (!newDate) return;
    setAdding(true);
    try {
      const entry = await apiFetch(`/teams/${teamId}/out-dates`, {
        method: "POST",
        body: JSON.stringify({ outDate: newDate, reason: newReason || undefined }),
      });
      setOutDates(prev => [...prev, entry].sort((a, b) => a.outDate.localeCompare(b.outDate)));
      setNewDate("");
      setNewReason("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add out date";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setAdding(false); }
  };

  const handleRemove = async (id: string) => {
    try {
      await apiFetch(`/out-dates/${id}`, { method: "DELETE" });
      setOutDates(prev => prev.filter(od => od.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="mt-5 pt-4 border-t border-line2">
      <h4 className="font-display font-semibold text-[14px] text-ink flex items-center gap-2 mb-3">
        <CalendarOff className="w-4 h-4 text-ink3" />
        Out Dates
      </h4>
      <p className="text-[12px] text-ink3 mb-3">Dates this team cannot play. Applies to all tournaments.</p>

      {loading ? (
        <div className="text-[13px] text-ink3">Loading...</div>
      ) : (
        <>
          <div className="space-y-2">
            {outDates.map(od => (
              <div key={od.id} className="flex items-center gap-3 bg-surface2 border border-line p-2.5 rounded-[4px]">
                <div className="w-28 font-mono text-[13px] font-medium">{od.outDate}</div>
                <div className="flex-1 text-[13px] text-ink2 truncate">{od.reason || ""}</div>
                <button
                  type="button"
                  onClick={() => handleRemove(od.id)}
                  className="p-1 text-ink3 hover:text-live hover:bg-surface rounded-[4px] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {outDates.length === 0 && (
              <div className="text-[12px] text-ink3 italic py-2">No out dates set.</div>
            )}
          </div>
          <div className="flex items-end gap-2 mt-3">
            <div className="w-36">
              <label className="block text-[12px] font-medium text-ink2 mb-1">Date</label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="block text-[12px] font-medium text-ink2 mb-1">Reason (optional)</label>
              <Input type="text" value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="e.g. Player travel" />
            </div>
            <Button type="button" size="sm" onClick={handleAdd} disabled={adding || !newDate}>
              {adding ? "Adding..." : "Add"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function RosterTab({ teamId }: { teamId: string }) {
  const { toast } = useToast();
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<Array<{ id: string; name: string; handicap: string | null; homeClubName: string | null }>>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPlayers = useCallback(async () => {
    try {
      const data = await apiFetch(`/teams/${teamId}/players`);
      setPlayers(data);
    } catch {
      toast({ title: "Error", description: "Failed to load players", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

  // Debounced search of canonical players for the picker (300ms)
  useEffect(() => {
    if (pickerTimer.current) clearTimeout(pickerTimer.current);
    const q = pickerQuery.trim();
    if (!q) { setPickerResults([]); return; }
    pickerTimer.current = setTimeout(async () => {
      try {
        const rows = await apiFetch(`/players?search=${encodeURIComponent(q)}`);
        const onTeam = new Set(players.map(p => p.id));
        setPickerResults((rows || []).filter((r: any) => !onTeam.has(r.id)).slice(0, 8));
      } catch {
        setPickerResults([]);
      }
    }, 300);
    return () => { if (pickerTimer.current) clearTimeout(pickerTimer.current); };
  }, [pickerQuery, players]);

  const handlePickExisting = async (playerId: string) => {
    setAdding(true);
    try {
      await apiFetch(`/teams/${teamId}/players`, {
        method: "POST",
        body: JSON.stringify({ playerId }),
      });
      setPickerQuery("");
      setPickerResults([]);
      setPickerOpen(false);
      fetchPlayers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add player";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (playerId: string) => {
    try {
      await apiFetch(`/teams/${teamId}/players/${playerId}`, { method: "DELETE" });
      fetchPlayers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove player";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  if (loading) return <div className="text-[12px] text-ink3 py-4">Loading players...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-medium text-ink2 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          Players ({players.filter(p => p.isActive !== false).length} active / {players.length} total)
        </h4>
      </div>

      {players.length > 0 && (
        <div className="space-y-2">
          {[...players].sort((a, b) => (b.isActive !== false ? 1 : 0) - (a.isActive !== false ? 1 : 0)).map((player) => (
            <div key={player.id} className="group">
              <PlayerSection
                teamId={teamId}
                player={player}
                onUpdate={fetchPlayers}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-line2 space-y-2">
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink3 pointer-events-none" />
              <Input
                value={pickerQuery}
                onChange={(e) => { setPickerQuery(e.target.value); setPickerOpen(true); }}
                onFocus={() => setPickerOpen(true)}
                onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
                className="h-8 text-[13px] pl-7"
                placeholder="Search existing players..."
              />
            </div>
          </div>
          {pickerOpen && pickerQuery.trim() && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-line2 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
              {pickerResults.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-ink3">No matches.</div>
              ) : (
                pickerResults.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePickExisting(r.id)}
                    className="w-full text-left px-3 py-2 hover:bg-bg2 flex items-center justify-between text-[13px]"
                  >
                    <span className="text-ink">{r.name}</span>
                    <span className="text-[11px] text-ink3 flex items-center gap-2">
                      {r.homeClubName && <span>{r.homeClubName}</span>}
                      {r.handicap != null && <span className="font-mono">{Number(r.handicap) > 0 ? `+${r.handicap}` : r.handicap}</span>}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <p className="text-[11px] text-ink3">
          Don&apos;t see them? <a href="/admin/players" className="text-g700 hover:underline">Create the player profile in Players</a>, then add them here.
        </p>
      </div>
    </div>
  );
}

interface TeamManagerItem {
  id: string;
  userId: string | null;
  teamId: string;
  status: string;
  user: { id: string; email: string; displayName: string; role: string } | null;
}

interface UserSearchResult {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

function TeamManagersSection({ teamId, clubId }: { teamId: string; clubId: string | null }) {
  const { toast } = useToast();
  const [managers, setManagers] = useState<TeamManagerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadManagers = useCallback(async () => {
    try {
      const data = await apiFetch(`/teams/${teamId}/managers`);
      setManagers(data);
    } catch {
      toast({ title: "Error", description: "Failed to load team managers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [teamId, toast]);

  useEffect(() => { loadManagers(); }, [loadManagers]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSearch(false);
        setSearchResults([]);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current !== null) clearTimeout(searchTimeout.current);
    if (value.length < 2 || !clubId) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await apiFetch(`/clubs/${clubId}/users/search?search=${encodeURIComponent(value)}`);
        const managerIds = new Set(managers.filter(m => m.userId).map(m => m.userId));
        setSearchResults(results.filter((u: UserSearchResult) => !managerIds.has(u.id)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleAdd = async (userId: string) => {
    try {
      await apiFetch(`/teams/${teamId}/managers`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      toast({ title: "Team manager added" });
      setSearchQuery("");
      setSearchResults([]);
      setShowSearch(false);
      loadManagers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add manager";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleRemove = async (assignmentId: string) => {
    try {
      await apiFetch(`/teams/${teamId}/managers/${assignmentId}`, { method: "DELETE" });
      toast({ title: "Team manager removed" });
      loadManagers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove manager";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-line2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-medium text-ink2 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          Team Managers
        </h4>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 gap-1 text-[12px]"
          onClick={() => setShowSearch(!showSearch)}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>

      {showSearch && (
        <div ref={dropdownRef} className="mb-3 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink3" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search users by name or email..."
              className="pl-8 h-8 text-[13px]"
              autoFocus
            />
          </div>
          {(searchResults.length > 0 || searching) && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-line rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {searching && <div className="px-3 py-2 text-[12px] text-ink3">Searching...</div>}
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleAdd(user.id)}
                  className="w-full px-3 py-2 text-left hover:bg-surface2 transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="text-[12px] font-medium text-ink">{user.displayName || "Unnamed"}</div>
                    <div className="text-[11px] text-ink3">{user.email}</div>
                  </div>
                  <UserPlus className="w-3.5 h-3.5 text-g500 flex-shrink-0" />
                </button>
              ))}
              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-ink3">No users found</div>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-[12px] text-ink3">Loading managers...</div>
      ) : managers.length === 0 ? (
        <div className="text-[12px] text-ink3">No team managers assigned.</div>
      ) : (
        <div className="space-y-1.5">
          {managers.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-surface2 group">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-g50 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-g700">
                    {(m.user?.displayName || "?").substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-[12px] font-medium text-ink">{m.user?.displayName || "Unknown"}</div>
                  <div className="text-[11px] text-ink3">{m.user?.email || ""}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(m.id)}
                className="opacity-0 group-hover:opacity-100 text-ink3 hover:text-live transition-all p-1"
                title="Remove manager"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamForm({
  team,
  onClose,
  onSuccess,
}: {
  team?: TeamItem | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const updateMutation = useUpdateTeam();

  const [name, setName] = useState(team?.name || "");
  const [shortName, setShortName] = useState(team?.shortName || "");
  const [scoreboardName, setScoreboardName] = useState(team?.scoreboardName || "");
  const [color, setColor] = useState(team?.primaryColor || "#0e2e14");
  const [logoUrl, setLogoUrl] = useState(team?.logoUrl || "");
  const [contactName, setContactName] = useState(team?.contactName || "");
  const [contactPhone, setContactPhone] = useState(team?.contactPhone || "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!team;
  const initials = (shortName || name || "?").substring(0, 2).toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          teamId: team.id,
          data: {
            name,
            shortName: shortName || undefined,
            scoreboardName: scoreboardName || null,
            primaryColor: color,
            logoUrl: logoUrl || undefined,
            contactName: contactName || undefined,
            contactPhone: contactPhone || undefined,
          },
        });
        toast({ title: "Team updated" });
      } else {
        await apiFetch("/teams", {
          method: "POST",
          body: JSON.stringify({
            name,
            shortName: shortName || undefined,
            scoreboardName: scoreboardName || undefined,
            primaryColor: color,
            logoUrl: logoUrl || undefined,
            contactName: contactName || undefined,
            contactPhone: contactPhone || undefined,
          }),
        });
        toast({ title: "Team created" });
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save team";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!team) return;
    setDeleting(true);
    try {
      await apiFetch(`/teams/${team.id}`, { method: "DELETE" });
      toast({ title: "Team deleted" });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete team";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-[15px] text-ink">
          {isEditing ? "Edit Team" : "New Team"}
        </h3>
        <button onClick={onClose} className="text-ink3 hover:text-ink transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit}>
          <div className="flex gap-6">
            <LogoUpload
              currentLogo={logoUrl}
              onLogoChange={setLogoUrl}
              color={color}
              initials={initials}
            />
            <div className="flex-1 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[12px] font-medium text-ink2 mb-1">Team Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="w-28">
                  <label className="block text-[12px] font-medium text-ink2 mb-1">Short Name</label>
                  <Input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="e.g. BLK" />
                </div>
                <div className="w-20">
                  <label className="block text-[12px] font-medium text-ink2 mb-1">Color</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full h-9 rounded-[4px] border border-line cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-ink2 mb-1">Scoreboard Name</label>
                <Input value={scoreboardName} onChange={(e) => setScoreboardName(e.target.value.slice(0, 12))} placeholder="e.g. Tanakanda" maxLength={12} />
                <span className="text-[11px] text-ink3 mt-0.5 block">{scoreboardName.length}/12 — shown on broadcast scorebug</span>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[12px] font-medium text-ink2 mb-1">Manager / Contact</label>
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" />
                </div>
                <div className="flex-1">
                  <label className="block text-[12px] font-medium text-ink2 mb-1">Phone</label>
                  <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone number" />
                </div>
              </div>
            </div>
          </div>
          <RosterTab teamId={team.id} />
          <OutDatesSection teamId={team.id} />
          {team.clubId && <TeamManagersSection teamId={team.id} clubId={team.clubId} />}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-line2">
            <div>
              {!confirmDelete && (
                <Button type="button" variant="ghost" className="text-live hover:text-live hover:bg-live-dim" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete Team
                </Button>
              )}
              {confirmDelete && (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-live">Are you sure?</span>
                  <Button type="button" variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
                    {deleting ? "Deleting..." : "Yes, Delete"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="flex gap-6">
            <LogoUpload
              currentLogo={logoUrl}
              onLogoChange={setLogoUrl}
              color={color}
              initials={initials}
            />
            <div className="flex-1 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[12px] font-medium text-ink2 mb-1">Team Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="w-28">
                  <label className="block text-[12px] font-medium text-ink2 mb-1">Short Name</label>
                  <Input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="e.g. BLK" />
                </div>
                <div className="w-20">
                  <label className="block text-[12px] font-medium text-ink2 mb-1">Color</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full h-9 rounded-[4px] border border-line cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-ink2 mb-1">Scoreboard Name</label>
                <Input value={scoreboardName} onChange={(e) => setScoreboardName(e.target.value.slice(0, 12))} placeholder="e.g. Tanakanda" maxLength={12} />
                <span className="text-[11px] text-ink3 mt-0.5 block">{scoreboardName.length}/12 — shown on broadcast scorebug</span>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[12px] font-medium text-ink2 mb-1">Manager / Contact</label>
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" />
                </div>
                <div className="flex-1">
                  <label className="block text-[12px] font-medium text-ink2 mb-1">Phone</label>
                  <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone number" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end mt-5 pt-4 border-t border-line2">
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? "Saving..." : "Create Team"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Card>
  );
}

export function AdminTeams() {
  const [teamsList, setTeamsList] = useState<TeamItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamItem | null>(null);

  const loadTeams = useCallback(async () => {
    try {
      const data = await apiFetch("/teams");
      setTeamsList(data);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  if (isLoading) return <AdminLayout><PageLoading /></AdminLayout>;

  const handleEditClick = (team: TeamItem) => {
    setEditingTeam(team);
    setShowForm(true);
  };

  const handleNewClick = () => {
    setEditingTeam(null);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingTeam(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Teams Directory</h1>
            <p className="text-[14px] text-ink2 mt-1">Manage teams in your club.</p>
          </div>
          {!showForm && (
            <Button className="gap-2" onClick={handleNewClick}>
              <Plus className="w-4 h-4" />
              New Team
            </Button>
          )}
        </div>

        {showForm && (
          <TeamForm
            team={editingTeam}
            onClose={handleClose}
            onSuccess={() => loadTeams()}
          />
        )}

        {!teamsList.length ? (
          <EmptyState title="No teams yet" description="Create your first team to get started." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamsList.map((team) => (
              <Card
                key={team.id}
                className="p-5 cursor-pointer hover:border-g300 transition-colors"
                onClick={() => handleEditClick(team)}
              >
                <div className="flex items-center gap-3 mb-3">
                  {team.logoUrl ? (
                    <img
                      src={team.logoUrl}
                      alt={team.name}
                      className="w-10 h-10 rounded-full object-cover border border-line"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full border-2 flex items-center justify-center"
                      style={{ borderColor: team.primaryColor || "var(--line)" }}
                    >
                      <span className="font-medium text-[12px] text-ink2">
                        {(team.shortName || team.name).substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[15px] text-ink flex items-center gap-1.5">
                      <span className="truncate">{team.name}</span>
                      <Pencil className="w-3 h-3 text-ink3 flex-shrink-0" />
                    </h3>
                    {team.shortName && <span className="text-[12px] text-ink3">{team.shortName}</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[12px] text-ink3 border-t border-line2 pt-3">
                  <span className="flex items-center"><Users className="w-3 h-3 mr-1" /> {team.contactName || "No manager"}</span>
                  {team.handicap != null && <span>HC: {team.handicap}</span>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
