import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "./AdminLayout";
import { PageLoading } from "@/components/LoadingBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getStoredToken } from "@/hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";
import { KeyRound, Plus, Trash2, Copy, X, Smartphone, Monitor, Tv, Video, Globe } from "lucide-react";

interface ApiKey {
  id: string;
  clientName: string;
  clientKind: string;
  keyPrefix: string;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

interface CreatedKey {
  id: string;
  key: string;
  prefix: string;
  clientName: string;
  clientKind: string;
}

const CLIENT_KINDS = ["ios", "android", "tvos", "obs"] as const;

const KIND_LABELS: Record<string, string> = {
  ios: "iOS",
  android: "Android",
  tvos: "tvOS",
  obs: "OBS Bridge",
  web: "Web",
};

const KIND_ICONS: Record<string, typeof Smartphone> = {
  ios: Smartphone,
  android: Smartphone,
  tvos: Tv,
  obs: Video,
  web: Globe,
};

const KIND_COLORS: Record<string, string> = {
  ios: "bg-blue-50 text-blue-700",
  android: "bg-green-50 text-green-700",
  tvos: "bg-purple-50 text-purple-700",
  obs: "bg-amber-50 text-amber-700",
  web: "bg-bg2 text-ink2",
};

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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function AdminApiKeys() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<string>("ios");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const isSuperAdmin = user?.role === "super_admin";

  const fetchKeys = useCallback(async () => {
    try {
      const data = await apiFetch("/admin/api-keys");
      const sorted = [...data].sort((a: ApiKey, b: ApiKey) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setKeys(sorted);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load API keys";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && isSuperAdmin) fetchKeys();
    else if (!authLoading) setLoading(false);
  }, [authLoading, isSuperAdmin, fetchKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const data = await apiFetch("/admin/api-keys", {
        method: "POST",
        body: JSON.stringify({ clientName: newName, clientKind: newKind }),
      });
      setCreatedKey(data);
      setNewName("");
      setNewKind("ios");
      fetchKeys();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create API key";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await apiFetch(`/admin/api-keys/${id}`, { method: "DELETE" });
      toast({ title: "API key revoked" });
      setConfirmRevoke(null);
      fetchKeys();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke key";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  if (authLoading || loading) return <AdminLayout><PageLoading /></AdminLayout>;

  if (!isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="py-16 text-center">
          <KeyRound className="w-10 h-10 text-ink3 mx-auto mb-3" />
          <h3 className="font-display font-bold text-lg text-ink">Super admins only</h3>
          <p className="text-[14px] text-ink2 mt-1">You don't have access to manage client API keys.</p>
        </div>
      </AdminLayout>
    );
  }

  const active = keys.filter(k => !k.revokedAt);
  const revoked = keys.filter(k => k.revokedAt);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Client Apps</h1>
            <p className="text-[14px] text-ink2 mt-1">
              {active.length} active key{active.length !== 1 ? "s" : ""} for native iOS, Android, tvOS and OBS clients.
            </p>
          </div>
          <Button className="gap-2" onClick={() => { setShowCreate(!showCreate); setCreatedKey(null); }}>
            {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showCreate ? "Cancel" : "New API Key"}
          </Button>
        </div>

        {showCreate && (
          <Card className="p-5">
            {createdKey ? (
              <div className="space-y-3">
                <h3 className="font-display font-bold text-lg text-ink">API Key Created</h3>
                <p className="text-[14px] text-ink2">
                  Copy this key now — it won't be shown again. Store it securely in the {KIND_LABELS[createdKey.clientKind]} client.
                </p>
                <div className="bg-bg2 rounded-[8px] p-4 font-mono text-[13px] break-all flex items-start justify-between gap-3">
                  <span className="min-w-0">{createdKey.key}</span>
                  <button
                    onClick={() => copy(createdKey.key, "API key")}
                    className="text-ink3 hover:text-ink flex-shrink-0"
                    title="Copy key"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <Button variant="secondary" onClick={() => { setCreatedKey(null); setShowCreate(false); }}>Done</Button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <h3 className="font-display font-bold text-lg text-ink">Create New API Key</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-ink2 mb-1.5">Client Name</label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Polo iOS App"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-ink2 mb-1.5">Client Kind</label>
                    <select
                      value={newKind}
                      onChange={(e) => setNewKind(e.target.value)}
                      className="w-full h-9 rounded-[8px] border border-line bg-white px-3 text-[14px] font-sans text-ink"
                    >
                      {CLIENT_KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                    </select>
                  </div>
                </div>
                <Button type="submit" disabled={creating || !newName.trim()}>
                  {creating ? "Creating..." : "Create Key"}
                </Button>
              </form>
            )}
          </Card>
        )}

        <div className="space-y-2">
          {active.map((k) => {
            const Icon = KIND_ICONS[k.clientKind] || Monitor;
            return (
              <Card key={k.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-g50 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-g500" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-sans font-medium text-[15px] text-ink truncate">{k.clientName}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium ${KIND_COLORS[k.clientKind] || "bg-bg2 text-ink2"}`}>
                          {KIND_LABELS[k.clientKind] || k.clientKind}
                        </span>
                        <span className="font-mono text-[11px] text-ink3 truncate">{k.keyPrefix}…</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:flex flex-col items-end text-[12px] text-ink3 flex-shrink-0">
                    <span>Created {formatDate(k.createdAt)}</span>
                    <span>Last used {formatDate(k.lastUsedAt)}</span>
                  </div>

                  {confirmRevoke === k.id ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button variant="danger" size="sm" onClick={() => handleRevoke(k.id)}>Revoke</Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmRevoke(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRevoke(k.id)}
                      className="p-1.5 rounded-[6px] text-ink3 hover:text-live hover:bg-red-50 transition-colors flex-shrink-0"
                      title="Revoke key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="md:hidden text-[12px] text-ink3 mt-2 pt-2 border-t border-line/60 flex justify-between">
                  <span>Created {formatDate(k.createdAt)}</span>
                  <span>Last used {formatDate(k.lastUsedAt)}</span>
                </div>
              </Card>
            );
          })}

          {active.length === 0 && (
            <div className="py-16 text-center border border-dashed border-line rounded-[8px]">
              <KeyRound className="w-10 h-10 text-ink3 mx-auto mb-3" />
              <h3 className="font-display font-bold text-lg text-ink">No active API keys</h3>
              <p className="text-[14px] text-ink2 mt-1">Mint a key for a native client to get started.</p>
            </div>
          )}
        </div>

        {revoked.length > 0 && (
          <div className="space-y-2 pt-4">
            <h2 className="font-display font-bold text-[15px] text-ink2">Revoked</h2>
            {revoked.map((k) => {
              const Icon = KIND_ICONS[k.clientKind] || Monitor;
              return (
                <Card key={k.id} className="p-4 opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-bg2 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-ink3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-sans font-medium text-[14px] text-ink2 truncate line-through">{k.clientName}</div>
                      <div className="text-[12px] text-ink3 mt-0.5">
                        {KIND_LABELS[k.clientKind] || k.clientKind} · revoked {formatDate(k.revokedAt)}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
