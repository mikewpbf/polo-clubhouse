import { useAuth, getStoredToken } from "@/hooks/use-auth";
import { ImageCropUpload } from "@/components/ImageCropUpload";
import { AdminLayout } from "./AdminLayout";
import { PageLoading, EmptyState } from "@/components/LoadingBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, X, Building2, Pencil, Globe, MapPin, Trash2, Landmark, Shield, UserPlus, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ClubItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  website?: string | null;
  country?: string | null;
  region?: string | null;
  logoUrl?: string | null;
  logoInitials?: string | null;
  sponsored?: boolean | null;
  sponsoredRank?: number | null;
}

interface FieldItem {
  id: string;
  clubId: string;
  name: string | null;
  number: number | null;
  surfaceType: string | null;
  isActive: boolean | null;
  imageUrl?: string | null;
  zipcode?: string | null;
  lat?: string | null;
  lng?: string | null;
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

function ClubLogoUpload({
  currentLogo,
  onLogoChange,
  initials,
}: {
  currentLogo?: string | null;
  onLogoChange: (url: string) => void;
  initials: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <ImageCropUpload value={currentLogo ?? null} onChange={onLogoChange} name={initials} shape="square" size={80} />
      <span className="text-[11px] text-ink3">Club logo</span>
    </div>
  );
}

interface ManagerItem {
  userId: string;
  clubId: string;
  role: string;
  user: { id: string; email: string; displayName: string; role: string } | null;
}

interface UserSearchResult {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

function ClubManagersPanel({ clubId }: { clubId: string }) {
  const { toast } = useToast();
  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadManagers = useCallback(async () => {
    try {
      const data = await apiFetch(`/clubs/${clubId}/managers`);
      setManagers(data);
    } catch {
      toast({ title: "Error", description: "Failed to load managers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    setManagers([]);
    setLoading(true);
    loadManagers();
  }, [loadManagers]);

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
    if (value.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await apiFetch(`/clubs/${clubId}/users/search?search=${encodeURIComponent(value)}`);
        const managerIds = new Set(managers.map(m => m.userId));
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
      await apiFetch(`/clubs/${clubId}/managers`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      toast({ title: "Manager added" });
      setSearchQuery("");
      setSearchResults([]);
      setShowSearch(false);
      loadManagers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add manager";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await apiFetch(`/clubs/${clubId}/managers/${userId}`, { method: "DELETE" });
      toast({ title: "Manager removed" });
      loadManagers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove manager";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  if (loading) return <div className="text-[13px] text-ink3">Loading managers...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-medium text-ink flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          Managers
        </h4>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[12px]" onClick={() => setShowSearch(!showSearch)}>
          <UserPlus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>

      {showSearch && (
        <div ref={dropdownRef} className="relative">
          <Input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search users by name or email..."
            className="h-8 text-[13px]"
            autoFocus
          />
          {(searchResults.length > 0 || searching) && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-line rounded-[8px] shadow-lg max-h-40 overflow-y-auto">
              {searching && <div className="px-3 py-2 text-[12px] text-ink3">Searching...</div>}
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleAdd(u.id)}
                  className="w-full px-3 py-2 text-left hover:bg-surface2 transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="text-[13px] font-medium text-ink">{u.displayName || "Unnamed"}</div>
                    <div className="text-[11px] text-ink3">{u.email}</div>
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

      {managers.length === 0 ? (
        <div className="text-[12px] text-ink3">No managers assigned yet.</div>
      ) : (
        <div className="space-y-1.5">
          {managers.map((m) => (
            <div key={m.userId} className="flex items-center gap-2 bg-bg rounded-[8px] px-3 py-2 group">
              <div className="w-6 h-6 rounded-full bg-g50 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-medium text-g700">
                  {(m.user?.displayName || "?").substring(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-ink truncate">{m.user?.displayName || "Unknown"}</div>
                <div className="text-[11px] text-ink3 truncate">{m.user?.email || ""}</div>
              </div>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-g50 text-g700 capitalize">{m.role}</span>
              <button
                type="button"
                onClick={() => handleRemove(m.userId)}
                className="opacity-0 group-hover:opacity-100 text-ink3 hover:text-live transition-all"
                title="Remove manager"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <ImageCropUpload
        value={value || null}
        onChange={onChange}
        shape="square"
        size={72}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-[11px] text-ink3 hover:text-live transition-colors"
        >
          Remove
        </button>
      )}
    </div>
  );
}

function FieldRow({ field, onUpdated, onDeleted }: { field: FieldItem; onUpdated: () => void; onDeleted: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(field.name || "");
  const [surface, setSurface] = useState(field.surfaceType || "");
  const [imageUrl, setImageUrl] = useState(field.imageUrl || "");
  const [zipcode, setZipcode] = useState(field.zipcode || "");
  const [lat, setLat] = useState(field.lat || "");
  const [lng, setLng] = useState(field.lng || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(field.name || "");
    setSurface(field.surfaceType || "");
    setImageUrl(field.imageUrl || "");
    setZipcode(field.zipcode || "");
    setLat(field.lat || "");
    setLng(field.lng || "");
  }, [field.id, field.name, field.surfaceType, field.imageUrl, field.zipcode, field.lat, field.lng]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/fields/${field.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim(),
          surfaceType: surface.trim() || null,
          imageUrl: imageUrl.trim() || null,
          zipcode: zipcode.trim() || null,
          lat: lat.trim() || null,
          lng: lng.trim() || null,
        }),
      });
      setOpen(false);
      onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiFetch(`/fields/${field.id}`, { method: "DELETE" });
      onDeleted();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="bg-bg rounded-[8px] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        {field.imageUrl ? (
          <img src={field.imageUrl} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded bg-g50 flex items-center justify-center flex-shrink-0">
            <Landmark className="w-3.5 h-3.5 text-ink3" />
          </div>
        )}
        <span className="text-[13px] text-ink font-medium flex-1">{field.name || "Unnamed"}</span>
        {field.surfaceType && <span className="text-[11px] text-ink3 bg-g50 px-1.5 py-0.5 rounded">{field.surfaceType}</span>}
        {(field.lat && field.lng) || field.zipcode ? (
          <span className="text-[10px] text-g700 bg-g50 px-1.5 py-0.5 rounded uppercase tracking-wider" title="Weather location set">Weather</span>
        ) : null}
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-ink3 hover:text-ink transition-colors" title="Edit">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={handleDelete} className="text-ink3 hover:text-live transition-colors" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && (
        <div className="border-t border-line px-3 py-3 space-y-2.5 bg-white">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-ink3 mb-1">Field name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-7 text-[13px]" placeholder="Field 1" />
            </div>
            <div>
              <label className="block text-[11px] text-ink3 mb-1">Surface</label>
              <Input value={surface} onChange={(e) => setSurface(e.target.value)} className="h-7 text-[13px]" placeholder="Grass" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-ink3 mb-1">Field photo (used in broadcast Field bug)</label>
            <FieldImageUpload value={imageUrl} onChange={setImageUrl} />
          </div>
          <div>
            <label className="block text-[11px] text-ink3 mb-1">Weather location</label>
            <div className="grid grid-cols-3 gap-2">
              <Input value={zipcode} onChange={(e) => setZipcode(e.target.value)} className="h-7 text-[13px]" placeholder="ZIP / Postal" />
              <Input value={lat} onChange={(e) => setLat(e.target.value)} className="h-7 text-[13px]" placeholder="Latitude" />
              <Input value={lng} onChange={(e) => setLng(e.target.value)} className="h-7 text-[13px]" placeholder="Longitude" />
            </div>
            <p className="text-[10px] text-ink3 mt-1">Provide a ZIP or lat/lng to enable live weather. ZIP is geocoded automatically on first use.</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button type="button" size="sm" className="h-7 text-[12px]" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-[12px]" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldsManager({ clubId }: { clubId: string }) {
  const { toast } = useToast();
  const [fields, setFields] = useState<FieldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldSurface, setNewFieldSurface] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchFields = useCallback(async () => {
    try {
      const data = await apiFetch(`/clubs/${clubId}/fields`);
      setFields(data);
    } catch {
      toast({ title: "Error", description: "Failed to load fields", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    setFields([]);
    setLoading(true);
    fetchFields();
  }, [fetchFields]);

  const handleAdd = async () => {
    if (!newFieldName.trim()) return;
    setAdding(true);
    try {
      await apiFetch(`/clubs/${clubId}/fields`, {
        method: "POST",
        body: JSON.stringify({ name: newFieldName.trim(), surfaceType: newFieldSurface.trim() || null, isActive: true }),
      });
      setNewFieldName("");
      setNewFieldSurface("");
      fetchFields();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add field";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <div className="text-[13px] text-ink3">Loading fields...</div>;

  return (
    <div className="space-y-3">
      <h4 className="text-[13px] font-medium text-ink flex items-center gap-1.5">
        <Landmark className="w-3.5 h-3.5" />
        Fields / Pitches
      </h4>
      {fields.length > 0 && (
        <div className="space-y-1.5">
          {fields.map((f) => (
            <FieldRow key={f.id} field={f} onUpdated={fetchFields} onDeleted={fetchFields} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={newFieldName}
          onChange={(e) => setNewFieldName(e.target.value)}
          placeholder="Field name (e.g. Field 1)"
          className="h-8 text-[13px] flex-1"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
        />
        <Input
          value={newFieldSurface}
          onChange={(e) => setNewFieldSurface(e.target.value)}
          placeholder="Surface (optional)"
          className="h-8 text-[13px] w-32"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
        />
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={handleAdd} disabled={adding || !newFieldName.trim()}>
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

function ClubForm({
  club,
  onClose,
  onSuccess,
}: {
  club?: ClubItem | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdminUser = user?.role === "super_admin";
  const isEditing = !!club;

  const [name, setName] = useState(club?.name || "");
  const [slug, setSlug] = useState(club?.slug || "");
  const [description, setDescription] = useState(club?.description || "");
  const [website, setWebsite] = useState(club?.website || "");
  const [country, setCountry] = useState(club?.country || "");
  const [region, setRegion] = useState(club?.region || "");
  const [logoUrl, setLogoUrl] = useState(club?.logoUrl || "");
  const [sponsored, setSponsored] = useState(club?.sponsored || false);
  const [sponsoredRank, setSponsoredRank] = useState(club?.sponsoredRank || 0);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initials = name ? name.substring(0, 2).toUpperCase() : "?";

  const autoSlug = (val: string) =>
    val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing) setSlug(autoSlug(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, any> = { name, slug, description, website, country, region, logoUrl: logoUrl || undefined };
      if (isSuperAdminUser) {
        payload.sponsored = sponsored;
        payload.sponsoredRank = sponsored ? sponsoredRank : 0;
      }
      if (isEditing) {
        await apiFetch(`/clubs/${club.id}/update`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast({ title: "Club updated" });
      } else {
        await apiFetch("/clubs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast({ title: "Club created" });
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!club) return;
    setDeleting(true);
    try {
      await apiFetch(`/clubs/${club.id}`, { method: "DELETE" });
      toast({ title: "Club deleted" });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete club";
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
          {isEditing ? "Edit Club" : "New Club"}
        </h3>
        <button onClick={onClose} className="text-ink3 hover:text-ink transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-6">
          <ClubLogoUpload
            currentLogo={logoUrl}
            onLogoChange={setLogoUrl}
            initials={initials}
          />
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-ink2 mb-1">Club Name</label>
                <Input value={name} onChange={(e) => handleNameChange(e.target.value)} required />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-ink2 mb-1">URL Slug</label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="e.g. wellington-polo" />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-ink2 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-[8px] border border-line px-3 py-2 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-g300 resize-none"
                rows={2}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">Country</label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. USA" />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">Region / State</label>
            <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Florida" />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">Website</label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        {isSuperAdminUser && isEditing && (
          <div className="pt-2 border-t border-line2">
            <h4 className="text-[13px] font-medium text-ink flex items-center gap-1.5 mb-3">
              <Star className="w-3.5 h-3.5" />
              Featured / Sponsored
            </h4>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sponsored}
                  onChange={(e) => setSponsored(e.target.checked)}
                  className="w-4 h-4 rounded border-line text-g500 focus:ring-g300"
                />
                <span className="text-[13px] text-ink">Featured Club</span>
              </label>
              {sponsored && (
                <div className="flex items-center gap-2">
                  <label className="text-[12px] text-ink2">Rank</label>
                  <select
                    value={sponsoredRank}
                    onChange={(e) => setSponsoredRank(Number(e.target.value))}
                    className="h-7 rounded-[6px] border border-line px-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-g300"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <span className="text-[11px] text-ink3">(10 = highest priority)</span>
                </div>
              )}
            </div>
          </div>
        )}
        {isEditing && club && (
          <div className="pt-2 border-t border-line2">
            <ClubManagersPanel clubId={club.id} />
          </div>
        )}
        {isEditing && club && (
          <div className="pt-2 border-t border-line2">
            <FieldsManager clubId={club.id} />
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-line2">
          <div>
            {isEditing && !confirmDelete && (
              <Button type="button" variant="ghost" className="text-live hover:text-live hover:bg-live-dim" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete Club
              </Button>
            )}
            {isEditing && confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-live">Delete club and all its data?</span>
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
            <Button type="submit" disabled={saving || !name.trim() || !slug.trim()}>
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Club"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

export function AdminClubs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === "super_admin";

  const [clubs, setClubs] = useState<ClubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClub, setEditingClub] = useState<ClubItem | null>(null);

  const fetchClubs = useCallback(async () => {
    try {
      const data = await apiFetch("/clubs");
      setClubs(data);
    } catch {
      toast({ title: "Error", description: "Failed to load clubs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClubs(); }, [fetchClubs]);

  if (loading) return <AdminLayout><PageLoading /></AdminLayout>;

  const handleEdit = (club: ClubItem) => {
    setEditingClub(club);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingClub(null);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingClub(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Clubs</h1>
            <p className="text-[14px] text-ink2 mt-1">
              {isSuperAdmin ? "Manage all clubs on the platform." : "View and manage your clubs."}
            </p>
          </div>
          {!showForm && (
            <Button className="gap-2" onClick={handleNew}>
              <Plus className="w-4 h-4" />
              New Club
            </Button>
          )}
        </div>

        {showForm && (
          <ClubForm
            club={editingClub}
            onClose={handleClose}
            onSuccess={() => { fetchClubs(); }}
          />
        )}

        {!clubs.length ? (
          <EmptyState title="No clubs yet" description="Create your first club to get started." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubs.map((club) => (
              <Card
                key={club.id}
                className="p-5 cursor-pointer hover:border-g300 transition-colors"
                onClick={() => handleEdit(club)}
              >
                <div className="flex items-center gap-3 mb-3">
                  {club.logoUrl ? (
                    <img src={club.logoUrl} alt={club.name} className="w-10 h-10 rounded-[8px] object-cover border border-line" />
                  ) : (
                    <div className="w-10 h-10 rounded-[8px] bg-g50 border border-g100 flex items-center justify-center">
                      <span className="font-medium text-[12px] text-g500">
                        {club.logoInitials || club.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[15px] text-ink truncate flex items-center gap-1.5">
                      {club.name}
                      <Pencil className="w-3 h-3 text-ink3 flex-shrink-0" />
                    </h3>
                    <span className="text-[12px] text-ink3">/{club.slug}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[12px] text-ink3 border-t border-line2 pt-3">
                  {(club.region || club.country) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {[club.region, club.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {club.website && (
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      Website
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
