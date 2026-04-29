import { useState, useEffect, useCallback, useRef } from "react";
import { AdminLayout } from "./AdminLayout";
import { PageLoading } from "@/components/LoadingBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getStoredToken } from "@/hooks/use-auth";
import { Settings, Save, Shield, X, Search, UserPlus } from "lucide-react";

interface ClubData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  website?: string | null;
  country?: string | null;
  region?: string | null;
  logoUrl?: string | null;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getStoredToken();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
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

function ClubManagersSection({ clubId }: { clubId: string }) {
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
  }, [clubId, toast]);

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

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2">
          <Shield className="w-5 h-5 text-g500" />
          Managers
        </h2>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowSearch(!showSearch)}
        >
          <UserPlus className="w-4 h-4" />
          Add Manager
        </Button>
      </div>

      {showSearch && (
        <div ref={dropdownRef} className="mb-4 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink3" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search users by name or email..."
              className="pl-9"
              autoFocus
            />
          </div>
          {(searchResults.length > 0 || searching) && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-line rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {searching && <div className="px-4 py-3 text-[13px] text-ink3">Searching...</div>}
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleAdd(user.id)}
                  className="w-full px-4 py-2.5 text-left hover:bg-surface2 transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="text-[13px] font-medium text-ink">{user.displayName || "Unnamed"}</div>
                    <div className="text-[12px] text-ink3">{user.email}</div>
                  </div>
                  <UserPlus className="w-4 h-4 text-g500 flex-shrink-0" />
                </button>
              ))}
              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="px-4 py-3 text-[13px] text-ink3">No users found</div>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-[13px] text-ink3">Loading managers...</div>
      ) : managers.length === 0 ? (
        <div className="text-[13px] text-ink3">No managers assigned yet.</div>
      ) : (
        <div className="space-y-2">
          {managers.map((m) => (
            <div key={m.userId} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface2 group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-g50 flex items-center justify-center">
                  <span className="text-[12px] font-medium text-g700">
                    {(m.user?.displayName || "?").substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-[13px] font-medium text-ink">{m.user?.displayName || "Unknown User"}</div>
                  <div className="text-[12px] text-ink3">{m.user?.email || ""}</div>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-g50 text-g700 capitalize">{m.role}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(m.userId)}
                className="opacity-0 group-hover:opacity-100 text-ink3 hover:text-live transition-all p-1"
                title="Remove manager"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function ClubSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [club, setClub] = useState<ClubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    website: "",
    country: "",
    region: "",
  });

  const clubSlug = user?.clubMemberships?.[0]?.clubSlug;
  const clubId = user?.clubMemberships?.[0]?.clubId;

  useEffect(() => {
    if (!clubSlug) { setLoading(false); return; }
    apiFetch(`/clubs/${clubSlug}`)
      .then((data) => {
        setClub(data);
        setForm({
          name: data.name || "",
          slug: data.slug || "",
          description: data.description || "",
          website: data.website || "",
          country: data.country || "",
          region: data.region || "",
        });
      })
      .catch(() => toast({ title: "Error", description: "Failed to load club", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [clubSlug, toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubId) return;
    setSaving(true);
    try {
      const updated = await apiFetch(`/clubs/${clubId}/update`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setClub(updated);
      toast({ title: "Club settings saved" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLayout><PageLoading /></AdminLayout>;

  if (!club && !clubId) {
    return (
      <AdminLayout>
        <div className="py-16 text-center">
          <Settings className="w-10 h-10 text-ink3 mx-auto mb-3" />
          <h3 className="font-display font-bold text-lg text-ink">No Club Assigned</h3>
          <p className="text-[14px] text-ink2 mt-1">You are not associated with a club yet.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Club Settings</h1>
          <p className="text-[14px] text-ink2 mt-1">Manage your club's profile and information.</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[12px] font-medium text-ink2 mb-1.5">Club Name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-ink2 mb-1.5">URL Slug</label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-ink2 mb-1.5">Country</label>
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="e.g. USA" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-ink2 mb-1.5">Region</label>
                <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. Florida" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[12px] font-medium text-ink2 mb-1.5">Website</label>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[12px] font-medium text-ink2 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-[8px] border border-line bg-white px-3 py-2 text-[14px] font-sans text-ink resize-none focus:outline-none focus:ring-2 focus:ring-g300"
                  placeholder="Tell spectators about your club..."
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" className="gap-2" disabled={saving}>
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Card>

        {clubId && <ClubManagersSection clubId={clubId} />}
      </div>
    </AdminLayout>
  );
}
