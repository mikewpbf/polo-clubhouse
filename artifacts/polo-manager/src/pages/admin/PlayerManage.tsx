import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import {
  useGetPlayerProfile,
  useUpdatePlayer,
  useDeletePlayer,
  useAddPlayerHorse,
  useRemovePlayerHorse,
  useListClubs,
} from "@workspace/api-client-react";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Trash2, Upload, Plus } from "lucide-react";
import { uploadImageFile } from "@/lib/upload";

export function PlayerManage() {
  const [, params] = useRoute("/admin/players/:id");
  const [, navigate] = useLocation();
  const playerId = params?.id ?? "";
  const { data, isLoading, refetch } = useGetPlayerProfile(playerId, { query: { enabled: !!playerId } as any });
  const { data: clubs } = useListClubs();
  const update = useUpdatePlayer();
  const del = useDeletePlayer();
  const addHorse = useAddPlayerHorse();
  const removeHorse = useRemovePlayerHorse();

  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState("");
  const [homeClubId, setHomeClubId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [bio, setBio] = useState("");
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [showHorseDialog, setShowHorseDialog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (data) {
      setName(data.name);
      setHandicap(data.handicap ?? "");
      setHomeClubId(data.homeClubId ?? "");
      setDateOfBirth(data.dateOfBirth ?? "");
      setBio(data.bio ?? "");
      setHeadshotUrl(data.headshotUrl ?? null);
    }
  }, [data]);

  if (isLoading) return <AdminLayout><PageLoading /></AdminLayout>;
  if (!data) return <AdminLayout><EmptyState title="Player not found" /></AdminLayout>;

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      setHeadshotUrl(url);
    } catch (e: any) {
      alert(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaveMsg(null);
    try {
      await update.mutateAsync({
        playerId,
        data: {
          name: name.trim(),
          handicap: handicap.trim() || null,
          homeClubId: homeClubId || null,
          dateOfBirth: dateOfBirth || null,
          bio: bio || null,
          headshotUrl,
        },
      });
      setSaveMsg("Saved");
      refetch();
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (e: any) {
      setSaveMsg(e?.response?.data?.message || e?.message || "Save failed");
    }
  };

  const handleDelete = async () => {
    try {
      await del.mutateAsync({ playerId });
      navigate("/admin/players");
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Delete failed");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        <Link href="/admin/players" className="text-[13px] text-ink2 hover:text-ink inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Back to Players
        </Link>

        <div className="bg-white rounded-[12px] p-5 card-shadow">
          <h2 className="font-display text-lg font-bold text-ink mb-4">Profile</h2>
          <div className="flex items-start gap-5 mb-5">
            <div className="flex flex-col items-center gap-2">
              <PlayerHeadshot url={headshotUrl} name={name || data.name} size={96} />
              <label className="text-[12px] text-g700 cursor-pointer hover:underline inline-flex items-center gap-1">
                <Upload className="w-3 h-3" />
                {uploading ? "Uploading…" : (headshotUrl ? "Change" : "Upload")}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }} />
              </label>
              {headshotUrl && (
                <button className="text-[11px] text-red-600 hover:underline" onClick={() => setHeadshotUrl(null)}>Remove</button>
              )}
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Handicap</Label>
                <Input value={handicap} onChange={(e) => setHandicap(e.target.value)} placeholder="e.g. 4" />
              </div>
              <div>
                <Label>Home Club</Label>
                <select className="w-full border border-line rounded-[8px] px-3 py-2 text-[14px]" value={homeClubId} onChange={(e) => setHomeClubId(e.target.value)}>
                  <option value="">— None —</option>
                  {(clubs as any[] | undefined)?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Bio</Label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button>
              {saveMsg && <span className="text-[13px] text-ink2">{saveMsg}</span>}
            </div>
            <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-4 h-4 mr-1.5" /> Delete Player
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-[12px] p-5 card-shadow">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-bold text-ink">Horse String ({data.horses.length})</h2>
            <Button size="sm" onClick={() => setShowHorseDialog(true)}><Plus className="w-4 h-4 mr-1" /> Add Horse</Button>
          </div>
          {data.horses.length === 0 ? (
            <p className="text-[13px] text-ink3">No horses in string yet.</p>
          ) : (
            <div className="space-y-2">
              {data.horses.map(h => (
                <div key={h.id} className="flex items-start justify-between bg-bg2 rounded-[8px] p-3">
                  <div>
                    <div className="font-sans font-semibold text-[14px]">{h.horseName}</div>
                    <div className="text-[12px] text-ink3 flex flex-wrap gap-x-3 mt-0.5">
                      {h.age != null && <span>{h.age}y</span>}
                      {h.color && <span>{h.color}</span>}
                      {h.sex && <span>{h.sex}</span>}
                      {h.owner && <span>Owner: {h.owner}</span>}
                    </div>
                  </div>
                  <button className="text-red-600 hover:bg-red-50 p-1.5 rounded" onClick={async () => {
                    if (!confirm(`Remove ${h.horseName}?`)) return;
                    await removeHorse.mutateAsync({ playerId, horseId: h.id });
                    refetch();
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-[12px] p-5 card-shadow">
          <h2 className="font-display text-lg font-bold text-ink mb-3">Public Profile</h2>
          <Link href={`/players/${playerId}`} className="text-g700 hover:underline text-[13px]">View public profile →</Link>
        </div>
      </div>

      {showHorseDialog && (
        <AddHorseDialog
          onClose={() => setShowHorseDialog(false)}
          onAdd={async (data) => {
            await addHorse.mutateAsync({ playerId, data });
            setShowHorseDialog(false);
            refetch();
          }}
        />
      )}

      {confirmDelete && (
        <Dialog open onOpenChange={(o) => !o && setConfirmDelete(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Delete Player</DialogTitle></DialogHeader>
            <p className="text-[14px] text-ink2">Permanently delete <strong>{data.name}</strong>? This will remove their horse string and roster history. Match event history will be retained but anonymized.</p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button onClick={handleDelete} disabled={del.isPending} className="bg-red-600 hover:bg-red-700 text-white">{del.isPending ? "Deleting…" : "Delete"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}

function AddHorseDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (data: any) => Promise<void> }) {
  const [horseName, setHorseName] = useState("");
  const [owner, setOwner] = useState("");
  const [age, setAge] = useState("");
  const [color, setColor] = useState("");
  const [sex, setSex] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Horse</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Horse Name</Label><Input value={horseName} onChange={(e) => setHorseName(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Age</Label><Input type="number" value={age} onChange={(e) => setAge(e.target.value)} /></div>
            <div><Label>Color</Label><Input value={color} onChange={(e) => setColor(e.target.value)} /></div>
            <div><Label>Sex</Label><Input value={sex} onChange={(e) => setSex(e.target.value)} /></div>
          </div>
          <div><Label>Owner</Label><Input value={owner} onChange={(e) => setOwner(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !horseName.trim()} onClick={async () => {
            setBusy(true);
            try {
              await onAdd({
                horseName: horseName.trim(),
                owner: owner.trim() || null,
                age: age ? Number(age) : null,
                color: color.trim() || null,
                sex: sex.trim() || null,
              });
            } catch (e: any) {
              alert(e?.response?.data?.message || e?.message || "Failed to add horse");
            } finally {
              setBusy(false);
            }
          }}>{busy ? "Adding…" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
