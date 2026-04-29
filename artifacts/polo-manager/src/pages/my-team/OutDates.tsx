import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { TeamLayout } from "./TeamLayout";
import { PageLoading } from "@/components/LoadingBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CalendarOff, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.VITE_API_BASE || "/api";

function getToken() {
  return sessionStorage.getItem("polo_auth_token");
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((opts.headers as Record<string, string>) || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

interface OutDateEntry {
  id: string;
  outDate: string;
  reason?: string | null;
}

export function OutDates() {
  const [, params] = useRoute("/my-team/:teamId/out-dates");
  const teamId = params?.teamId || "";
  const { toast } = useToast();

  const [outDates, setOutDates] = useState<OutDateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);

  const loadOutDates = useCallback(async () => {
    if (!teamId) return;
    try {
      const data = await apiFetch(`/teams/${teamId}/out-dates`);
      setOutDates(data);
    } catch {} finally { setLoading(false); }
  }, [teamId]);

  useEffect(() => { loadOutDates(); }, [loadOutDates]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast({ title: "Out date added", description: formatDate(newDate) });
    } catch (err: any) {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    } finally { setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/out-dates/${id}`, { method: "DELETE" });
      setOutDates(prev => prev.filter(od => od.id !== id));
    } catch (err: any) {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    }
  };

  if (loading) return <TeamLayout><PageLoading /></TeamLayout>;

  return (
    <TeamLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Out Dates</h1>
          <p className="text-[14px] text-ink2 mt-1">Manage dates your team cannot play. These apply to all tournaments.</p>
        </div>

        <Card className="p-6">
          <div className="space-y-3">
            {outDates.map((od) => (
              <div key={od.id} className="flex items-center gap-3 bg-surface2 border border-line p-3 rounded-[4px]">
                <div className="w-32 font-mono text-[13px] font-medium">{formatDate(od.outDate)}</div>
                <div className="flex-1 text-[13px] text-ink2 truncate">{od.reason || "No reason provided"}</div>
                <button
                  onClick={() => handleDelete(od.id)}
                  className="p-1.5 text-ink3 hover:text-live hover:bg-surface rounded-[4px] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {outDates.length === 0 && (
              <div className="text-center py-6">
                <CalendarOff className="w-8 h-8 text-ink3 mx-auto mb-2" />
                <div className="text-[13px] text-ink3 italic">No out dates set. Your team is available for all days.</div>
              </div>
            )}
          </div>

          <form onSubmit={handleAdd} className="mt-6 pt-6 border-t border-line border-dashed flex items-end gap-3">
            <div className="w-40">
              <label className="block text-[12px] font-medium text-ink2 mb-1.5">Add Date</label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required />
            </div>
            <div className="flex-1">
              <label className="block text-[12px] font-medium text-ink2 mb-1.5">Reason (optional)</label>
              <Input type="text" value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="e.g. Player travel" />
            </div>
            <Button type="submit" disabled={adding || !newDate}>
              {adding ? "Adding..." : "Add"}
            </Button>
          </form>
        </Card>
      </div>
    </TeamLayout>
  );
}
