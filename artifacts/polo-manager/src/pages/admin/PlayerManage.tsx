import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import {
  useGetPlayerProfile,
  getGetPlayerProfileQueryKey,
  useUpdatePlayer,
  useDeletePlayer,
  useAddPlayerHorse,
  useRemovePlayerHorse,
  useListClubs,
  type PlayerProfile,
  type Club,
} from "@workspace/api-client-react";

import { AdminLayout } from "@/pages/admin/AdminLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { ImageCropUpload } from "@/components/ImageCropUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Trash2, Plus, Search, Link2, X } from "lucide-react";
import { useAuth, getStoredToken } from "@/hooks/use-auth";

interface PlayerProfileWithUser extends PlayerProfile {
  managedByUser?: { id: string; email?: string; displayName?: string } | null;
}

export function PlayerManage() {
  const [, params] = useRoute("/admin/players/:id");
  const [, navigate] = useLocation();
  const playerId = params?.id ?? "";
  const { data: rawData, isLoading, refetch } = useGetPlayerProfile(playerId, { query: { enabled: !!playerId, queryKey: getGetPlayerProfileQueryKey(playerId) } });
  const data = rawData as PlayerProfileWithUser | undefined;
  const { data: clubs } = useListClubs();
  const update = useUpdatePlayer();
  const del = useDeletePlayer();
  const addHorse = useAddPlayerHorse();
  const removeHorse = useRemovePlayerHorse();

  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  // The player's home-club admins (and super_admins) may change the link.
  // Mirrors backend `userCanEditPlayerFull`: super_admin OR club_admin of the
  // player's canonical home club. Team managers and other roles cannot link.
  const playerHomeClubId = data?.homeClubId ?? null;
  const userClubMemberships: Array<{ clubId: string }> = user?.clubMemberships ?? [];
  const canManageLink = isSuperAdmin || (
    !!playerHomeClubId && userClubMemberships.some(m => m.clubId === playerHomeClubId)
  );

  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState("");
  const [homeClubId, setHomeClubId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [bio, setBio] = useState("");
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [broadcastImageUrl, setBroadcastImageUrl] = useState<string | null>(null);
  const [managedByUserId, setManagedByUserId] = useState<string | null>(null);
  const [linkedUserLabel, setLinkedUserLabel] = useState<string | null>(null);

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
      setBroadcastImageUrl(data.broadcastImageUrl ?? null);
      const muid = data?.managedByUserId ?? null;
      setManagedByUserId(muid);
      const linkedUser = data?.managedByUser;
      if (linkedUser) {
        setLinkedUserLabel(`${linkedUser.displayName ?? linkedUser.email ?? "User"} (${linkedUser.email ?? ""})`);
      } else {
        setLinkedUserLabel(null);
      }
    }
  }, [data]);

  if (isLoading) return <AdminLayout><PageLoading /></AdminLayout>;
  if (!data) return <AdminLayout><EmptyState title="Player not found" /></AdminLayout>;

  const handleSave = async () => {
    setSaveMsg(null);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        handicap: handicap.trim() || null,
        homeClubId: homeClubId || null,
        dateOfBirth: dateOfBirth || null,
        bio: bio || null,
        headshotUrl,
        broadcastImageUrl,
      };
      // Only super_admins or this player's home club admins may mutate the link.
      if (canManageLink) payload.managedByUserId = managedByUserId || null;
      await update.mutateAsync({ playerId, data: payload });
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
              <ImageCropUpload value={headshotUrl} onChange={setHeadshotUrl} name={name || data.name} size={96} />
              <div className="text-[11px] text-ink3">Profile photo</div>
              {headshotUrl && (
                <button className="text-[11px] text-red-600 hover:underline" onClick={() => setHeadshotUrl(null)}>Remove</button>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <ImageCropUpload value={broadcastImageUrl} onChange={setBroadcastImageUrl} name={name || data.name} size={96} />
              <div className="text-[11px] text-ink3 text-center">Broadcast image<br /><span className="text-[10px]">(not publicly visible)</span></div>
              {broadcastImageUrl && (
                <button className="text-[11px] text-red-600 hover:underline" onClick={() => setBroadcastImageUrl(null)}>Remove</button>
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
                  {(clubs as Club[] | undefined)?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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

        {canManageLink && (
          <div className="bg-white rounded-[12px] p-5 card-shadow">
            <h2 className="font-display text-lg font-bold text-ink mb-3 flex items-center gap-2">
              <Link2 className="w-4 h-4" /> Linked User Account
            </h2>
            <p className="text-[12px] text-ink3 mb-3">
              When a user account is linked, that user can edit this player's public profile from
              {" "}<span className="font-mono">/my-profile</span>. Super admins and this player's
              home-club admins can change this link.
            </p>
            {managedByUserId ? (
              <div className="flex items-center justify-between bg-bg2 rounded-[8px] px-3 py-2.5">
                <div className="text-[13px] text-ink">{linkedUserLabel ?? `User: ${managedByUserId}`}</div>
                <Button variant="ghost" size="sm" className="h-7 text-red-600" onClick={() => { setManagedByUserId(null); setLinkedUserLabel(null); }}>
                  <X className="w-3.5 h-3.5 mr-1" /> Unlink
                </Button>
              </div>
            ) : (
              <UserLinkPicker onPick={(u) => { setManagedByUserId(u.id); setLinkedUserLabel(`${u.displayName ?? u.email ?? "User"} (${u.email ?? ""})`); }} />
            )}
            <p className="text-[11px] text-ink3 mt-2">Don't forget to click <strong>Save</strong> above to apply the change.</p>
          </div>
        )}

        {data.teams && data.teams.length > 0 && (() => {
          const currentYear = new Date().getUTCFullYear();
          const currentTeams = data.teams.filter(t => t.isActive && t.seasonYear >= currentYear);
          const pastTeams = data.teams.filter(t => !t.isActive || t.seasonYear < currentYear);
          return (
            <div className="bg-white rounded-[12px] p-5 card-shadow">
              <h2 className="font-display text-lg font-bold text-ink mb-3">Team Memberships</h2>
              {currentTeams.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink3 mb-2">Active</div>
                  <div className="space-y-1.5">
                    {currentTeams.map(t => (
                      <div key={`${t.teamId}-${t.seasonYear}`} className="flex items-center gap-3 bg-g50 rounded-[8px] px-3 py-2">
                        {t.teamLogoUrl ? (
                          <img src={t.teamLogoUrl} alt={t.teamName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-g100 flex items-center justify-center text-[10px] font-display font-bold text-g600 flex-shrink-0">
                            {t.teamName.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-sans font-medium text-ink">{t.teamName}</div>
                          <div className="text-[11px] text-ink3">{t.seasonYear} season</div>
                        </div>
                        <span className="text-[11px] text-emerald-600 font-semibold">Active</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pastTeams.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink3 mb-2">Past / Inactive</div>
                  <div className="space-y-1.5">
                    {pastTeams.map(t => (
                      <div key={`${t.teamId}-${t.seasonYear}`} className="flex items-center gap-3 rounded-[8px] px-3 py-2 border border-line">
                        {t.teamLogoUrl ? (
                          <img src={t.teamLogoUrl} alt={t.teamName} className="w-7 h-7 rounded-full object-cover flex-shrink-0 opacity-60" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-bg2 flex items-center justify-center text-[10px] font-display font-bold text-ink3 flex-shrink-0">
                            {t.teamName.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-sans font-medium text-ink2">{t.teamName}</div>
                          <div className="text-[11px] text-ink3">{t.seasonYear} season</div>
                        </div>
                        <span className="text-[11px] text-ink3">Past</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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

function UserLinkPicker({ onPick }: { onPick: (u: { id: string; email: string | null; displayName: string | null }) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ id: string; email: string | null; displayName: string | null; role: string }>>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (!term) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const token = getStoredToken();
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(term)}&limit=8`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (r.ok) {
          const rows = await r.json();
          setResults(rows || []);
        } else {
          setResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink3 pointer-events-none" />
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search users by name or email..."
          className="h-9 pl-7"
        />
      </div>
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-line2 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
          {searching ? (
            <div className="px-3 py-2 text-[12px] text-ink3">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-ink3">No users match.</div>
          ) : (
            results.map(u => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onPick(u); setQ(""); setOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-bg2 text-[13px]"
              >
                <div className="text-ink">{u.displayName ?? u.email ?? "Unnamed"}</div>
                <div className="text-[11px] text-ink3">{u.email} · {u.role}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
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
