import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "./AdminLayout";
import { PageLoading } from "@/components/LoadingBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getStoredToken } from "@/hooks/use-auth";
import { UserPlus, Trash2, Shield, Search, X, Copy } from "lucide-react";

interface UserItem {
  id: string;
  email: string;
  displayName: string;
  phone?: string | null;
  role: string;
  createdAt: string;
}

const ROLES = ["spectator", "team_manager", "admin", "super_admin"] as const;

const ROLE_LABELS: Record<string, string> = {
  spectator: "Spectator",
  team_manager: "Team Manager",
  admin: "Club Admin",
  super_admin: "Super Admin",
};

const ROLE_COLORS: Record<string, string> = {
  spectator: "bg-bg2 text-ink2",
  team_manager: "bg-blue-50 text-blue-700",
  admin: "bg-g50 text-g700",
  super_admin: "bg-amber-50 text-amber-700",
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

export function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("spectator");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviting, setInviting] = useState(false);
  const [createdUser, setCreatedUser] = useState<{ email: string; tempPassword: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      const data = await apiFetch(`/admin/users?${params.toString()}`);
      setUsers(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load users";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await apiFetch(`/admin/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: newRole }),
      });
      toast({ title: "Role updated" });
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update role";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await apiFetch(`/admin/users/${userId}`, { method: "DELETE" });
      toast({ title: "User deleted" });
      setConfirmDelete(null);
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete user";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const data = await apiFetch("/admin/users/invite", {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail,
          displayName: inviteName || undefined,
          role: inviteRole,
          password: invitePassword || undefined,
        }),
      });
      setCreatedUser({ email: data.email, tempPassword: data.tempPassword });
      setInviteEmail("");
      setInviteName("");
      setInviteRole("spectator");
      setInvitePassword("");
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create user";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  if (loading) return <AdminLayout><PageLoading /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Users</h1>
            <p className="text-[14px] text-ink2 mt-1">{users.length} total user{users.length !== 1 ? "s" : ""} on the platform.</p>
          </div>
          <Button className="gap-2" onClick={() => { setShowInvite(!showInvite); setCreatedUser(null); }}>
            {showInvite ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {showInvite ? "Cancel" : "Add User"}
          </Button>
        </div>

        {showInvite && (
          <Card className="p-5">
            {createdUser ? (
              <div className="space-y-3">
                <h3 className="font-display font-bold text-lg text-ink">User Created</h3>
                <p className="text-[14px] text-ink2">Share these credentials with the user:</p>
                <div className="bg-bg2 rounded-[8px] p-4 space-y-2 font-mono text-[13px]">
                  <div className="flex items-center justify-between">
                    <span><span className="text-ink3">Email:</span> {createdUser.email}</span>
                    <button onClick={() => { navigator.clipboard.writeText(createdUser.email); toast({ title: "Copied" }); }} className="text-ink3 hover:text-ink">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span><span className="text-ink3">Password:</span> {createdUser.tempPassword}</span>
                    <button onClick={() => { navigator.clipboard.writeText(createdUser.tempPassword); toast({ title: "Copied" }); }} className="text-ink3 hover:text-ink">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <Button variant="secondary" onClick={() => { setCreatedUser(null); setShowInvite(false); }}>Done</Button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <h3 className="font-display font-bold text-lg text-ink">Create New User</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-ink2 mb-1.5">Email</label>
                    <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" required />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-ink2 mb-1.5">Display Name</label>
                    <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Optional" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-ink2 mb-1.5">Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full h-9 rounded-[8px] border border-line bg-white px-3 text-[14px] font-sans text-ink"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-ink2 mb-1.5">Password</label>
                    <Input value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} placeholder="Auto-generated if blank" />
                  </div>
                </div>
                <Button type="submit" disabled={inviting}>{inviting ? "Creating..." : "Create User"}</Button>
              </form>
            )}
          </Card>
        )}

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-9"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 rounded-[8px] border border-line bg-white px-3 text-[14px] font-sans text-ink"
          >
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-full bg-g50 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-g500" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-sans font-medium text-[15px] text-ink truncate">{u.displayName || "No name"}</div>
                    <div className="text-[12px] text-ink3 truncate">{u.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className={`h-8 rounded-[6px] border-0 px-2.5 text-[12px] font-sans font-medium cursor-pointer ${ROLE_COLORS[u.role] || "bg-bg2 text-ink2"}`}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>

                  {confirmDelete === u.id ? (
                    <div className="flex items-center gap-1.5">
                      <Button variant="danger" size="sm" onClick={() => handleDelete(u.id)}>Confirm</Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(u.id)}
                      className="p-1.5 rounded-[6px] text-ink3 hover:text-live hover:bg-red-50 transition-colors"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {users.length === 0 && (
            <div className="py-16 text-center border border-dashed border-line rounded-[8px]">
              <Shield className="w-10 h-10 text-ink3 mx-auto mb-3" />
              <h3 className="font-display font-bold text-lg text-ink">No users found</h3>
              <p className="text-[14px] text-ink2 mt-1">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
