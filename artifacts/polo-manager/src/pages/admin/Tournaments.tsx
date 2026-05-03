import { useState, useEffect, useCallback } from "react";

import { useAuth, getStoredToken } from "@/hooks/use-auth";
import { useUpdateTournament } from "@workspace/api-client-react";
import { AdminLayout } from "./AdminLayout";
import { PageLoading } from "@/components/LoadingBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Trophy, Calendar, X, Trash2, Pencil, Users, Sparkles, Check, Loader2, CalendarOff, CalendarCheck, ChevronDown, ChevronRight, BarChart3, RotateCcw, Star, Award, ImageIcon } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { TournamentExportButton } from "@/components/TournamentExportImage";
import { ImageCropUpload } from "@/components/ImageCropUpload";
import { snapMatchPreviewInBackground, snapAndUploadMatchPreview } from "@/lib/matchPreviewSnap";

interface TournamentItem {
  id: string;
  name: string;
  format?: string | null;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  handicapLevel?: string | null;
  chukkersPerMatch?: number | null;
  description?: string | null;
  clubId?: string | null;
  sponsored?: boolean | null;
  sponsoredRank?: number | null;
  logoUrl?: string | null;
  jumbotronBgColor?: string | null;
}

interface TeamOption {
  id: string;
  name: string;
  logoPath?: string | null;
}

interface TournamentTeamEntry {
  tournamentId: string;
  teamId: string;
  seed?: number | null;
  groupLabel?: string | null;
  team?: TeamOption | null;
}

interface OutDateEntry {
  id: string;
  teamId: string;
  tournamentId: string;
  outDate: string;
  reason?: string | null;
}

interface AiRecommendation {
  recommended_format: string;
  reason: string;
  total_matches?: number;
  notes?: string;
}

interface AiScheduleResult {
  matches: { round: string; homeTeamName: string; awayTeamName: string; suggestedDate?: string; fieldName?: string }[];
  summary: string;
  notes?: string;
  createdCount?: number;
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

const FORMAT_OPTIONS = [
  { value: "round_robin", label: "Round Robin" },
  { value: "single_elim", label: "Single Elimination" },
  { value: "double_elim", label: "Double Elimination" },
  { value: "swiss", label: "Swiss" },
  { value: "group_knockout", label: "Group + Knockout" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "test", label: "Test (admins only)" },
  { value: "published", label: "Published" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

function formatLabel(value: string) {
  return FORMAT_OPTIONS.find(f => f.value === value)?.label || value.replace(/_/g, " ");
}

function TeamOutDates({
  tournamentId,
  teamId,
  teamName,
}: {
  tournamentId: string;
  teamId: string;
  teamName: string;
}) {
  const { toast } = useToast();
  const [outDates, setOutDates] = useState<OutDateEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);

  const loadOutDates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/teams/${teamId}/out-dates`);
      setOutDates(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (expanded) loadOutDates();
  }, [expanded, loadOutDates]);

  const handleAdd = async () => {
    if (!newDate) return;
    setAdding(true);
    try {
      const entry = await apiFetch(`/teams/${teamId}/out-dates`, {
        method: "POST",
        body: JSON.stringify({ outDate: newDate, reason: newReason || undefined }),
      });
      setOutDates(prev => [...prev, entry]);
      setNewDate("");
      setNewReason("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add out date";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (outDateId: string) => {
    try {
      await apiFetch(`/out-dates/${outDateId}`, { method: "DELETE" });
      setOutDates(prev => prev.filter(od => od.id !== outDateId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="ml-8 mt-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[11px] text-ink3 hover:text-ink2 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <CalendarOff className="w-3 h-3" />
        Out Dates{outDates.length > 0 && ` (${outDates.length})`}
      </button>

      {expanded && (
        <div className="mt-1.5 pl-1 space-y-1">
          {loading && <span className="text-[11px] text-ink3">Loading...</span>}

          {outDates.map((od) => (
            <div key={od.id} className="group flex items-center gap-2 text-[12px]">
              <CalendarOff className="w-3 h-3 text-live shrink-0" />
              <span className="text-ink2">{formatDate(od.outDate, "MMM d, yyyy")}</span>
              {od.reason && <span className="text-ink3 truncate max-w-[120px]">- {od.reason}</span>}
              <button
                type="button"
                onClick={() => handleRemove(od.id)}
                className="opacity-0 group-hover:opacity-100 text-ink3 hover:text-live transition-all ml-auto"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          <div className="flex items-center gap-1.5 mt-1">
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="h-6 text-[11px] px-1.5 w-[130px]"
            />
            <Input
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Reason"
              className="h-6 text-[11px] px-1.5 w-[100px]"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAdd}
              disabled={!newDate || adding}
              className="h-6 px-2 text-[11px]"
            >
              {adding ? "..." : "Add"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TournamentTeamsSection({
  tournamentId,
  currentFormat,
  onFormatChange,
}: {
  tournamentId: string;
  currentFormat: string;
  onFormatChange: (format: string) => void;
}) {
  const { toast } = useToast();
  const [tournamentTeams, setTournamentTeams] = useState<TournamentTeamEntry[]>([]);
  const [allClubTeams, setAllClubTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiRecommendation | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<AiScheduleResult | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [teams, allTeams] = await Promise.all([
        apiFetch(`/tournaments/${tournamentId}/teams`),
        apiFetch(`/teams`),
      ]);
      setTournamentTeams(teams);
      setAllClubTeams(allTeams);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load teams";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { loadData(); }, [loadData]);

  const enrolledIds = new Set(tournamentTeams.map(tt => tt.teamId));
  const availableTeams = allClubTeams.filter(t => !enrolledIds.has(t.id));

  const handleAdd = async () => {
    if (!selectedTeamId) return;
    setAdding(true);
    try {
      const result = await apiFetch(`/tournaments/${tournamentId}/teams`, {
        method: "POST",
        body: JSON.stringify({ teamId: selectedTeamId }),
      });
      setTournamentTeams(prev => [...prev, result]);
      setSelectedTeamId("");
      toast({ title: "Team added to tournament" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add team";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (teamId: string) => {
    try {
      await apiFetch(`/tournaments/${tournamentId}/teams/${teamId}`, { method: "DELETE" });
      setTournamentTeams(prev => prev.filter(tt => tt.teamId !== teamId));
      toast({ title: "Team removed" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove team";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleAiFormat = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await apiFetch(`/tournaments/${tournamentId}/ai-format`, {
        method: "POST",
      });
      setAiResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to get AI recommendation";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyFormat = () => {
    if (aiResult?.recommended_format) {
      onFormatChange(aiResult.recommended_format);
      toast({ title: "Format updated", description: `Changed to ${formatLabel(aiResult.recommended_format)}` });
      setAiResult(null);
    }
  };

  const handleAiSchedule = async () => {
    setScheduleLoading(true);
    setScheduleResult(null);
    try {
      const result = await apiFetch(`/tournaments/${tournamentId}/ai-schedule`, {
        method: "POST",
      });
      setScheduleResult(result);
      if (result.createdCount) {
        toast({ title: "Schedule generated", description: `${result.createdCount} matches created` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate schedule";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setScheduleLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-4">
        <div className="flex items-center gap-2 text-ink3 text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading teams...
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-[14px] text-ink flex items-center gap-2">
          <Users className="w-4 h-4 text-g700" />
          Teams ({tournamentTeams.length})
        </h4>
        <div className="flex gap-1.5">
          {tournamentTeams.length >= 2 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAiFormat}
                disabled={aiLoading}
                className="gap-1.5"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Format
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAiSchedule}
                disabled={scheduleLoading}
                className="gap-1.5"
              >
                {scheduleLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <CalendarCheck className="w-3.5 h-3.5" />
                    AI Schedule
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {aiResult && (
        <div className="mb-3 p-3 bg-[#f0f7f0] border border-g300 rounded-[8px]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-g700" />
                <span className="font-medium text-[13px] text-g900">
                  Recommended: {formatLabel(aiResult.recommended_format)}
                </span>
                {aiResult.total_matches ? (
                  <span className="text-[12px] text-ink3">
                    ({aiResult.total_matches} matches)
                  </span>
                ) : null}
              </div>
              <p className="text-[12px] text-ink2 leading-relaxed">{aiResult.reason}</p>
              {aiResult.notes && (
                <p className="text-[11px] text-ink3 mt-1">{aiResult.notes}</p>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              {aiResult.recommended_format !== currentFormat && (
                <Button type="button" size="sm" onClick={handleApplyFormat} className="gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Apply
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => setAiResult(null)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {scheduleResult && (
        <div className="mb-3 p-3 bg-[#f0f7f0] border border-g300 rounded-[8px]">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-3.5 h-3.5 text-g700" />
              <span className="font-medium text-[13px] text-g900">
                Schedule Generated
                {scheduleResult.createdCount ? ` (${scheduleResult.createdCount} matches)` : ""}
              </span>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setScheduleResult(null)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-[12px] text-ink2 mb-2">{scheduleResult.summary}</p>
          {scheduleResult.notes && (
            <p className="text-[11px] text-ink3 mb-2">{scheduleResult.notes}</p>
          )}
          {scheduleResult.matches.length > 0 && (
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {scheduleResult.matches.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px] py-1 px-2 rounded bg-white/60">
                  <span className="text-ink3 w-[80px] shrink-0 truncate">{m.round}</span>
                  <span className="text-ink font-medium truncate">{m.homeTeamName}</span>
                  <span className="text-ink3">vs</span>
                  <span className="text-ink font-medium truncate">{m.awayTeamName}</span>
                  {m.suggestedDate && (
                    <span className="text-ink3 ml-auto shrink-0">{formatDate(m.suggestedDate, "MMM d")}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tournamentTeams.length > 0 && (
        <div className="space-y-0 mb-3">
          {tournamentTeams.map((tt) => (
            <div key={tt.teamId}>
              <div className="group flex items-center justify-between px-3 py-2 rounded-[6px] hover:bg-surface2 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-g50 flex items-center justify-center text-[11px] font-medium text-g700">
                    {(tt.team?.name || "?")[0].toUpperCase()}
                  </div>
                  <span className="text-[13px] text-ink">{tt.team?.name || "Unknown Team"}</span>
                  {tt.seed && (
                    <span className="text-[11px] bg-surface2 text-ink3 px-1.5 py-0.5 rounded">
                      Seed {tt.seed}
                    </span>
                  )}
                  {tt.groupLabel && (
                    <span className="text-[11px] bg-surface2 text-ink3 px-1.5 py-0.5 rounded">
                      Group {tt.groupLabel}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(tt.teamId)}
                  className="opacity-0 group-hover:opacity-100 text-ink3 hover:text-live transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <TeamOutDates
                tournamentId={tournamentId}
                teamId={tt.teamId}
                teamName={tt.team?.name || "Unknown"}
              />
            </div>
          ))}
        </div>
      )}

      {availableTeams.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="flex-1 h-8 rounded-[6px] border border-line px-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-g300"
          >
            <option value="">Select a team to add...</option>
            {availableTeams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAdd}
            disabled={!selectedTeamId || adding}
          >
            {adding ? "Adding..." : "Add"}
          </Button>
        </div>
      )}

      {availableTeams.length === 0 && allClubTeams.length > 0 && tournamentTeams.length > 0 && (
        <p className="text-[12px] text-ink3">All club teams have been added.</p>
      )}

      {allClubTeams.length === 0 && (
        <p className="text-[12px] text-ink3">No teams in this club yet. Create teams first in the Teams Directory.</p>
      )}
    </div>
  );
}

interface MatchItem {
  id: string;
  round?: string | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeTeam?: { id: string; name: string } | null;
  awayTeam?: { id: string; name: string } | null;
  scheduledAt?: string | null;
  status?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  fieldId?: string | null;
  field?: { id: string; name: string } | null;
}

interface FieldItem {
  id: string;
  name: string;
}

interface EnrolledTeam {
  teamId: string;
  team: { id: string; name: string } | null;
}

function parseScheduledAt(scheduledAt?: string | null) {
  if (!scheduledAt) return { date: "", time: "" };
  const d = new Date(scheduledAt);
  const date = d.toISOString().split("T")[0];
  const time = d.toTimeString().slice(0, 5);
  return { date, time };
}

function MatchForm({
  match,
  tournamentId,
  teams,
  fields,
  onSave,
  onCancel,
}: {
  match?: MatchItem | null;
  tournamentId: string;
  teams: EnrolledTeam[];
  fields: FieldItem[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const parsed = parseScheduledAt(match?.scheduledAt);
  const [homeTeamId, setHomeTeamId] = useState(match?.homeTeamId || "");
  const [awayTeamId, setAwayTeamId] = useState(match?.awayTeamId || "");
  const [date, setDate] = useState(parsed.date);
  const [time, setTime] = useState(parsed.time);
  const [fieldId, setFieldId] = useState(match?.fieldId || "");
  const [round, setRound] = useState(match?.round || "");
  const [streamUrl, setStreamUrl] = useState((match as any)?.streamUrl || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const scheduledAt = date ? new Date(`${date}T${time || "00:00"}:00`).toISOString() : null;
      const body: Record<string, unknown> = {
        homeTeamId: homeTeamId || null,
        awayTeamId: awayTeamId || null,
        fieldId: fieldId || null,
        scheduledAt,
        round: round || null,
        streamUrl: streamUrl || null,
      };
      let savedMatchId: string | null = null;
      if (match) {
        await apiFetch(`/matches/${match.id}`, { method: "PUT", body: JSON.stringify(body) });
        savedMatchId = match.id;
      } else {
        const created = await apiFetch(`/tournaments/${tournamentId}/matches`, { method: "POST", body: JSON.stringify(body) });
        savedMatchId = (created && typeof created === "object" && "id" in created) ? String((created as { id: unknown }).id) : null;
      }
      toast({ title: match ? "Match updated" : "Match added" });
      // Refresh the per-match link-preview PNG used by OG cards in
      // iMessage/WhatsApp/Slack/Discord. Fire-and-forget — never blocks the
      // user-visible save flow, and silently no-ops on failure.
      if (savedMatchId) snapMatchPreviewInBackground(savedMatchId);
      onSave();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save match";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "w-full h-8 rounded-[8px] border border-line px-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-g300";
  const inputClass = "w-full h-8 rounded-[8px] border border-line px-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-g300";

  return (
    <div className="bg-surface2 rounded-[8px] p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-ink3 mb-0.5">Home Team</label>
          <select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)} className={selectClass}>
            <option value="">TBD</option>
            {teams.map((t) => (
              <option key={t.teamId} value={t.teamId}>{t.team?.name || t.teamId}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-ink3 mb-0.5">Away Team</label>
          <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)} className={selectClass}>
            <option value="">TBD</option>
            {teams.map((t) => (
              <option key={t.teamId} value={t.teamId}>{t.team?.name || t.teamId}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] text-ink3 mb-0.5">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-[11px] text-ink3 mb-0.5">Time</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-[11px] text-ink3 mb-0.5">Field</label>
          <select value={fieldId} onChange={(e) => setFieldId(e.target.value)} className={selectClass}>
            <option value="">No field</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[11px] text-ink3 mb-0.5">Round</label>
        <select value={round} onChange={(e) => setRound(e.target.value)} className={selectClass}>
          <option value="">Select round...</option>
          <option value="Preliminary">Preliminary</option>
          <option value="Semifinals">Semifinals</option>
          <option value="Consolation">Consolation</option>
          <option value="Final">Final</option>
        </select>
      </div>
      <div>
        <label className="block text-[11px] text-ink3 mb-0.5">Stream URL (YouTube)</label>
        <input
          type="url"
          value={streamUrl}
          onChange={(e) => setStreamUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=... or embed URL"
          className={inputClass}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          {match ? "Update" : "Add Match"}
        </Button>
      </div>
    </div>
  );
}

function ScheduleSection({ tournamentId }: { tournamentId: string }) {
  const { toast } = useToast();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [teams, setTeams] = useState<EnrolledTeam[]>([]);
  const [fields, setFields] = useState<FieldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMatch, setEditingMatch] = useState<MatchItem | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await apiFetch(`/tournaments/${tournamentId}`);
      setMatches(data.matches || []);
      setTeams(data.teams || []);
      if (data.clubId) {
        try {
          const clubFields = await apiFetch(`/clubs/${data.clubId}/fields`);
          setFields(clubFields || []);
        } catch { /* no fields */ }
      }
    } catch {
      toast({ title: "Error", description: "Failed to load schedule", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeleteMatch = async (matchId: string) => {
    try {
      await apiFetch(`/matches/${matchId}`, { method: "DELETE" });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete match";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleFormSave = () => {
    setShowAddForm(false);
    setEditingMatch(null);
    loadData();
  };

  if (loading) {
    return (
      <div className="border-t border-line pt-4">
        <div className="flex items-center gap-2 text-ink3 text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading schedule...
        </div>
      </div>
    );
  }

  const formatMatchDate = (scheduledAt?: string | null) => {
    if (!scheduledAt) return null;
    const d = new Date(scheduledAt);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatMatchTime = (scheduledAt?: string | null) => {
    if (!scheduledAt) return null;
    const d = new Date(scheduledAt);
    const h = d.getHours();
    const m = d.getMinutes();
    if (h === 0 && m === 0) return null;
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2"
        >
          <h4 className="font-medium text-[14px] text-ink flex items-center gap-2">
            <Calendar className="w-4 h-4 text-g700" />
            Schedule ({matches.length} match{matches.length !== 1 ? "es" : ""})
          </h4>
          {expanded ? <ChevronDown className="w-4 h-4 text-ink3" /> : <ChevronRight className="w-4 h-4 text-ink3" />}
        </button>
        {expanded && !showAddForm && !editingMatch && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Match
          </Button>
        )}
      </div>

      {expanded && (
        <>
          {showAddForm && (
            <div className="mb-3">
              <MatchForm
                tournamentId={tournamentId}
                teams={teams}
                fields={fields}
                onSave={handleFormSave}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}

          {matches.length === 0 && !showAddForm ? (
            <p className="text-[12px] text-ink3 py-2">No matches scheduled yet. Add teams and use AI Schedule or the Add Match button above.</p>
          ) : (
            <div className="space-y-1">
              {matches.map((m) =>
                editingMatch?.id === m.id ? (
                  <MatchForm
                    key={m.id}
                    match={m}
                    tournamentId={tournamentId}
                    teams={teams}
                    fields={fields}
                    onSave={handleFormSave}
                    onCancel={() => setEditingMatch(null)}
                  />
                ) : (
                  <div key={m.id} className="group flex items-center gap-2 px-3 py-2 rounded-[6px] hover:bg-surface2 transition-colors">
                    {m.round && (
                      <span className="text-[11px] text-ink3 w-[70px] shrink-0 truncate">{m.round}</span>
                    )}
                    <span className="text-[13px] text-ink font-medium truncate flex-1">{m.homeTeam?.name || "TBD"}</span>
                    <span className="text-[11px] text-ink3">vs</span>
                    <span className="text-[13px] text-ink font-medium truncate flex-1">{m.awayTeam?.name || "TBD"}</span>
                    {formatMatchDate(m.scheduledAt) && (
                      <span className="text-[11px] text-ink3 shrink-0">{formatMatchDate(m.scheduledAt)}</span>
                    )}
                    {formatMatchTime(m.scheduledAt) && (
                      <span className="text-[11px] text-ink3 shrink-0">{formatMatchTime(m.scheduledAt)}</span>
                    )}
                    {m.field && (
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded shrink-0">{m.field.name}</span>
                    )}
                    {m.status && m.status !== "scheduled" && (
                      <span className="text-[10px] bg-g50 text-g700 px-1.5 py-0.5 rounded shrink-0">{m.status}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingMatch(m)}
                      className="opacity-0 group-hover:opacity-100 text-ink3 hover:text-g700 transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMatch(m.id)}
                      className="opacity-0 group-hover:opacity-100 text-ink3 hover:text-live transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface StandingEntry {
  teamId: string;
  team: { id: string; name: string } | null;
  won: number;
  lost: number;
  goalDifference: number;
  grossGoals: number;
  isManual: boolean;
}

function StandingsSection({ tournamentId }: { tournamentId: string }) {
  const { toast } = useToast();
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [editValues, setEditValues] = useState<Record<string, { wins: string; losses: string; netGoals: string; grossGoals: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);

  const loadStandings = useCallback(async () => {
    try {
      const data = await apiFetch(`/tournaments/${tournamentId}/standings`);
      setStandings(data);
      const vals: Record<string, { wins: string; losses: string; netGoals: string; grossGoals: string }> = {};
      for (const s of data) {
        vals[s.teamId] = {
          wins: String(s.won),
          losses: String(s.lost),
          netGoals: String(s.goalDifference),
          grossGoals: String(s.grossGoals ?? 0),
        };
      }
      setEditValues(vals);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { loadStandings(); }, [loadStandings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = standings.map((s) => ({
        teamId: s.teamId,
        wins: parseInt(editValues[s.teamId]?.wins || "0") || 0,
        losses: parseInt(editValues[s.teamId]?.losses || "0") || 0,
        netGoals: parseInt(editValues[s.teamId]?.netGoals || "0") || 0,
        grossGoals: parseInt(editValues[s.teamId]?.grossGoals || "0") || 0,
      }));
      await apiFetch(`/tournaments/${tournamentId}/standings`, {
        method: "PUT",
        body: JSON.stringify({ standings: payload }),
      });
      toast({ title: "Standings saved" });
      setEditing(false);
      loadStandings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save standings";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await apiFetch(`/tournaments/${tournamentId}/standings`, { method: "DELETE" });
      toast({ title: "Standings reset to auto-calculate" });
      setEditing(false);
      loadStandings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset standings";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (teamId: string, field: "wins" | "losses" | "netGoals" | "grossGoals", value: string) => {
    setEditValues(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], [field]: value },
    }));
  };

  if (loading) {
    return (
      <div className="border-t border-line pt-4">
        <div className="flex items-center gap-2 text-ink3 text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading standings...
        </div>
      </div>
    );
  }

  if (standings.length === 0) return null;

  const hasManual = standings.some(s => s.isManual);

  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-2">
          <h4 className="font-medium text-[14px] text-ink flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-g700" />
            Standings
          </h4>
          {expanded ? <ChevronDown className="w-4 h-4 text-ink3" /> : <ChevronRight className="w-4 h-4 text-ink3" />}
        </button>
        {expanded && (
          <div className="flex gap-1.5">
            {editing ? (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); loadStandings(); }}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="gap-1">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save
                </Button>
              </>
            ) : (
              <>
                {hasManual && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={saving} className="gap-1 text-ink3">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1">
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-ink3 text-left">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Team</th>
                <th className="pb-2 font-medium text-center w-[70px]">W</th>
                <th className="pb-2 font-medium text-center w-[70px]">L</th>
                <th className="pb-2 font-medium text-center w-[90px]">Net Goals</th>
                <th className="pb-2 font-medium text-center w-[70px]">GG</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.teamId} className="border-b border-line2 last:border-0">
                  <td className="py-2 font-mono text-ink3 w-[30px]">{i + 1}</td>
                  <td className="py-2 font-medium text-ink">{s.team?.name || "Unknown"}</td>
                  {editing ? (
                    <>
                      <td className="py-1.5 text-center">
                        <input
                          type="number"
                          value={editValues[s.teamId]?.wins || "0"}
                          onChange={(e) => updateField(s.teamId, "wins", e.target.value)}
                          className="w-[50px] h-7 text-center rounded-[6px] border border-line text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-g300"
                          min="0"
                        />
                      </td>
                      <td className="py-1.5 text-center">
                        <input
                          type="number"
                          value={editValues[s.teamId]?.losses || "0"}
                          onChange={(e) => updateField(s.teamId, "losses", e.target.value)}
                          className="w-[50px] h-7 text-center rounded-[6px] border border-line text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-g300"
                          min="0"
                        />
                      </td>
                      <td className="py-1.5 text-center">
                        <input
                          type="number"
                          value={editValues[s.teamId]?.netGoals || "0"}
                          onChange={(e) => updateField(s.teamId, "netGoals", e.target.value)}
                          className="w-[50px] h-7 text-center rounded-[6px] border border-line text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-g300 mx-auto"
                        />
                      </td>
                      <td className="py-1.5 text-center">
                        <input
                          type="number"
                          value={editValues[s.teamId]?.grossGoals || "0"}
                          onChange={(e) => updateField(s.teamId, "grossGoals", e.target.value)}
                          className="w-[50px] h-7 text-center rounded-[6px] border border-line text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-g300 mx-auto"
                          min="0"
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 text-center">{s.won}</td>
                      <td className="py-2 text-center">{s.lost}</td>
                      <td className="py-2 text-center font-medium">{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</td>
                      <td className="py-2 text-center">{s.grossGoals ?? 0}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {hasManual && !editing && (
            <p className="text-[11px] text-ink3 mt-2">Standings manually set. Reset to auto-calculate from match results.</p>
          )}
        </div>
      )}
    </div>
  );
}

interface TopScorerEntry {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  goals: number;
}

function TopScorersSection({ tournamentId }: { tournamentId: string }) {
  const [scorers, setScorers] = useState<TopScorerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const loadScorers = useCallback(async () => {
    try {
      const data = await apiFetch(`/tournaments/${tournamentId}/top-scorers`);
      setScorers(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { loadScorers(); }, [loadScorers]);

  if (loading) {
    return (
      <div className="border-t border-line pt-4">
        <div className="flex items-center gap-2 text-ink3 text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading top scorers...
        </div>
      </div>
    );
  }

  if (scorers.length === 0) return null;

  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-2">
          <h4 className="font-medium text-[14px] text-ink flex items-center gap-2">
            <Trophy className="w-4 h-4 text-g700" />
            Top Scorers
          </h4>
          {expanded ? <ChevronDown className="w-4 h-4 text-ink3" /> : <ChevronRight className="w-4 h-4 text-ink3" />}
        </button>
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-ink3 text-left">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Player</th>
                <th className="pb-2 font-medium">Team</th>
                <th className="pb-2 font-medium text-center w-[70px]">Goals</th>
              </tr>
            </thead>
            <tbody>
              {scorers.map((s, i) => (
                <tr key={s.playerId || `scorer-${i}`} className="border-b border-line2 last:border-0">
                  <td className="py-2 font-mono text-ink3 w-[30px]">{i + 1}</td>
                  <td className="py-2 font-medium text-ink">{s.playerName}</td>
                  <td className="py-2 text-ink2">{s.teamName}</td>
                  <td className="py-2 text-center font-medium">{s.goals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface PlayerOption {
  id: string;
  name: string;
  teamId: string;
}

interface HorseOption {
  id: string;
  horseName: string;
  owner?: string | null;
  breeder?: string | null;
  ownedAndBredBy?: string | null;
  age?: number | null;
  color?: string | null;
  sex?: string | null;
  typeOrBreed?: string | null;
  sire?: string | null;
  dam?: string | null;
  notes?: string | null;
}

function MVPSection({ tournamentId }: { tournamentId: string }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teams, setTeams] = useState<{ teamId: string; team: { id: string; name: string } | null }[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [gamesOverride, setGamesOverride] = useState("");
  const [goalsOverride, setGoalsOverride] = useState("");
  const [autoGames, setAutoGames] = useState(0);
  const [autoGoals, setAutoGoals] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [teamsData, mvpData] = await Promise.all([
        apiFetch(`/tournaments/${tournamentId}/teams`),
        apiFetch(`/tournaments/${tournamentId}/mvp`),
      ]);
      setTeams(teamsData);
      if (mvpData) {
        setSelectedTeamId(mvpData.teamId || "");
        setSelectedPlayerId(mvpData.playerId || "");
        setGamesOverride(mvpData.gamesPlayed !== mvpData.autoGamesPlayed ? String(mvpData.gamesPlayed) : "");
        setGoalsOverride(mvpData.goalsScored !== mvpData.autoGoalsScored ? String(mvpData.goalsScored) : "");
        setAutoGames(mvpData.autoGamesPlayed || 0);
        setAutoGoals(mvpData.autoGoalsScored || 0);
        if (mvpData.teamId) {
          const playersData = await apiFetch(`/teams/${mvpData.teamId}/players`);
          setPlayers(playersData);
        }
      }
    } catch {} finally { setLoading(false); }
  }, [tournamentId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTeamChange = async (teamId: string) => {
    setSelectedTeamId(teamId);
    setSelectedPlayerId("");
    setPlayers([]);
    if (teamId) {
      try {
        const playersData = await apiFetch(`/teams/${teamId}/players`);
        setPlayers(playersData);
      } catch {}
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/tournaments/${tournamentId}/mvp`, {
        method: "PUT",
        body: JSON.stringify({
          teamId: selectedTeamId || null,
          playerId: selectedPlayerId || null,
          gamesOverride: gamesOverride || null,
          goalsOverride: goalsOverride || null,
        }),
      });
      toast({ title: "MVP saved" });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save MVP";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await apiFetch(`/tournaments/${tournamentId}/mvp`, {
        method: "PUT",
        body: JSON.stringify({ teamId: null, playerId: null, gamesOverride: null, goalsOverride: null }),
      });
      setSelectedTeamId("");
      setSelectedPlayerId("");
      setGamesOverride("");
      setGoalsOverride("");
      toast({ title: "MVP cleared" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to clear";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="border-t border-line pt-4">
        <div className="flex items-center gap-2 text-ink3 text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading MVP...
        </div>
      </div>
    );
  }

  const selectClass = "w-full h-8 rounded-[6px] border border-line px-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-g300";

  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-2">
          <h4 className="font-medium text-[14px] text-ink flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            MVP (Most Valuable Player)
          </h4>
          {expanded ? <ChevronDown className="w-4 h-4 text-ink3" /> : <ChevronRight className="w-4 h-4 text-ink3" />}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-ink3 mb-0.5">Team</label>
              <select value={selectedTeamId} onChange={(e) => handleTeamChange(e.target.value)} className={selectClass}>
                <option value="">Select team...</option>
                {teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>{t.team?.name || t.teamId}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-ink3 mb-0.5">Player</label>
              <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} className={selectClass} disabled={!selectedTeamId}>
                <option value="">Select player...</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-ink3 mb-0.5">Games Played (auto: {autoGames})</label>
              <Input
                type="number"
                value={gamesOverride}
                onChange={(e) => setGamesOverride(e.target.value)}
                placeholder={String(autoGames)}
                className="h-8 text-[13px]"
                min="0"
              />
            </div>
            <div>
              <label className="block text-[11px] text-ink3 mb-0.5">Goals Scored (auto: {autoGoals})</label>
              <Input
                type="number"
                value={goalsOverride}
                onChange={(e) => setGoalsOverride(e.target.value)}
                placeholder={String(autoGoals)}
                className="h-8 text-[13px]"
                min="0"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            {selectedPlayerId && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={saving}>
                Clear
              </Button>
            )}
            <Button type="button" size="sm" onClick={handleSave} disabled={saving || !selectedPlayerId} className="gap-1">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save MVP
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const BPP_DISPLAY_OPTIONS = [
  { key: "showHorseName", label: "Horse Name" },
  { key: "showPlayerName", label: "Player Name" },
  { key: "showTeamName", label: "Team Name" },
  { key: "showOwner", label: "Owner" },
  { key: "showBreeder", label: "Breeder" },
  { key: "showAge", label: "Age" },
  { key: "showColor", label: "Color" },
  { key: "showSex", label: "Sex" },
  { key: "showBreed", label: "Type / Breed" },
  { key: "showSireDam", label: "Sire & Dam" },
  { key: "showGamesPlayed", label: "Games Played" },
  { key: "showNotes", label: "Notes" },
];

function BPPSection({ tournamentId }: { tournamentId: string }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teams, setTeams] = useState<{ teamId: string; team: { id: string; name: string } | null }[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [horses, setHorses] = useState<HorseOption[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedHorseId, setSelectedHorseId] = useState("");
  const [displaySettings, setDisplaySettings] = useState<Record<string, boolean>>({
    showHorseName: true,
    showPlayerName: true,
    showTeamName: true,
  });
  const [gamesOverride, setGamesOverride] = useState("");
  const [autoGames, setAutoGames] = useState(0);
  const [addingHorse, setAddingHorse] = useState(false);
  const [newHorseName, setNewHorseName] = useState("");
  const [newHorseOwner, setNewHorseOwner] = useState("");
  const [newHorseBreeder, setNewHorseBreeder] = useState("");
  const [newHorseAge, setNewHorseAge] = useState("");
  const [newHorseColor, setNewHorseColor] = useState("");
  const [newHorseSex, setNewHorseSex] = useState("");
  const [newHorseBreed, setNewHorseBreed] = useState("");
  const [newHorseSire, setNewHorseSire] = useState("");
  const [newHorseDam, setNewHorseDam] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [teamsData, bppData] = await Promise.all([
        apiFetch(`/tournaments/${tournamentId}/teams`),
        apiFetch(`/tournaments/${tournamentId}/bpp`),
      ]);
      setTeams(teamsData);
      if (bppData && bppData.horseId) {
        const tournament = await apiFetch(`/tournaments/${tournamentId}`);
        const t = tournament as any;
        setSelectedTeamId(t.bppTeamId || "");
        setSelectedPlayerId(t.bppPlayerId || "");
        setSelectedHorseId(t.bppHorseId || "");
        setDisplaySettings(bppData.displaySettings || { showHorseName: true });
        setAutoGames(bppData.autoGamesPlayed || 0);
        if (bppData.displaySettings?.showGamesPlayed && bppData.gamesPlayed !== bppData.autoGamesPlayed) {
          setGamesOverride(String(bppData.gamesPlayed));
        }
        if (t.bppTeamId) {
          const playersData = await apiFetch(`/teams/${t.bppTeamId}/players`);
          setPlayers(playersData);
        }
        if (t.bppPlayerId) {
          const horsesData = await apiFetch(`/players/${t.bppPlayerId}/horses`);
          setHorses(horsesData);
        }
      }
    } catch {} finally { setLoading(false); }
  }, [tournamentId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTeamChange = async (teamId: string) => {
    setSelectedTeamId(teamId);
    setSelectedPlayerId("");
    setSelectedHorseId("");
    setPlayers([]);
    setHorses([]);
    if (teamId) {
      try {
        const playersData = await apiFetch(`/teams/${teamId}/players`);
        setPlayers(playersData);
      } catch {}
    }
  };

  const handlePlayerChange = async (playerId: string) => {
    setSelectedPlayerId(playerId);
    setSelectedHorseId("");
    setHorses([]);
    if (playerId) {
      try {
        const horsesData = await apiFetch(`/players/${playerId}/horses`);
        setHorses(horsesData);
      } catch {}
    }
  };

  const toggleDisplay = (key: string) => {
    setDisplaySettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/tournaments/${tournamentId}/bpp`, {
        method: "PUT",
        body: JSON.stringify({
          teamId: selectedTeamId || null,
          playerId: selectedPlayerId || null,
          horseId: selectedHorseId || null,
          displaySettings,
          gamesOverride: gamesOverride || null,
        }),
      });
      toast({ title: "Best Playing Pony saved" });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save BPP";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await apiFetch(`/tournaments/${tournamentId}/bpp`, {
        method: "PUT",
        body: JSON.stringify({ teamId: null, playerId: null, horseId: null, displaySettings: {}, gamesOverride: null }),
      });
      setSelectedTeamId("");
      setSelectedPlayerId("");
      setSelectedHorseId("");
      setDisplaySettings({ showHorseName: true, showPlayerName: true, showTeamName: true });
      setGamesOverride("");
      toast({ title: "BPP cleared" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to clear";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleAddHorse = async () => {
    if (!newHorseName || !selectedPlayerId) return;
    try {
      const horse = await apiFetch(`/players/${selectedPlayerId}/horses`, {
        method: "POST",
        body: JSON.stringify({
          horseName: newHorseName,
          owner: newHorseOwner || undefined,
          breeder: newHorseBreeder || undefined,
          age: newHorseAge ? Number(newHorseAge) : undefined,
          color: newHorseColor || undefined,
          sex: newHorseSex || undefined,
          typeOrBreed: newHorseBreed || undefined,
          sire: newHorseSire || undefined,
          dam: newHorseDam || undefined,
        }),
      });
      setHorses(prev => [...prev, horse]);
      setSelectedHorseId(horse.id);
      setAddingHorse(false);
      setNewHorseName("");
      setNewHorseOwner("");
      setNewHorseBreeder("");
      setNewHorseAge("");
      setNewHorseColor("");
      setNewHorseSex("");
      setNewHorseBreed("");
      setNewHorseSire("");
      setNewHorseDam("");
      toast({ title: "Horse added" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add horse";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="border-t border-line pt-4">
        <div className="flex items-center gap-2 text-ink3 text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading BPP...
        </div>
      </div>
    );
  }

  const selectClass = "w-full h-8 rounded-[6px] border border-line px-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-g300";

  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-2">
          <h4 className="font-medium text-[14px] text-ink flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-600" />
            Best Playing Pony
          </h4>
          {expanded ? <ChevronDown className="w-4 h-4 text-ink3" /> : <ChevronRight className="w-4 h-4 text-ink3" />}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] text-ink3 mb-0.5">Team</label>
              <select value={selectedTeamId} onChange={(e) => handleTeamChange(e.target.value)} className={selectClass}>
                <option value="">Select team...</option>
                {teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>{t.team?.name || t.teamId}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-ink3 mb-0.5">Player</label>
              <select value={selectedPlayerId} onChange={(e) => handlePlayerChange(e.target.value)} className={selectClass} disabled={!selectedTeamId}>
                <option value="">Select player...</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-ink3 mb-0.5">Horse</label>
              <div className="flex gap-1">
                <select value={selectedHorseId} onChange={(e) => setSelectedHorseId(e.target.value)} className={selectClass} disabled={!selectedPlayerId}>
                  <option value="">Select horse...</option>
                  {horses.map((h) => (
                    <option key={h.id} value={h.id}>{h.horseName}</option>
                  ))}
                </select>
                {selectedPlayerId && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAddingHorse(!addingHorse)} className="h-8 px-2 shrink-0">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {addingHorse && selectedPlayerId && (
            <div className="bg-surface2 rounded-[8px] p-3 space-y-2">
              <h5 className="text-[12px] font-medium text-ink mb-1">Add New Horse</h5>
              <div className="grid grid-cols-2 gap-2">
                <Input value={newHorseName} onChange={(e) => setNewHorseName(e.target.value)} placeholder="Horse name *" className="h-7 text-[12px]" />
                <Input value={newHorseOwner} onChange={(e) => setNewHorseOwner(e.target.value)} placeholder="Owner" className="h-7 text-[12px]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={newHorseBreeder} onChange={(e) => setNewHorseBreeder(e.target.value)} placeholder="Breeder" className="h-7 text-[12px]" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Input type="number" value={newHorseAge} onChange={(e) => setNewHorseAge(e.target.value)} placeholder="Age" className="h-7 text-[12px]" min="0" />
                <Input value={newHorseColor} onChange={(e) => setNewHorseColor(e.target.value)} placeholder="Color" className="h-7 text-[12px]" />
                <select value={newHorseSex} onChange={(e) => setNewHorseSex(e.target.value)} className="h-7 rounded-[6px] border border-line px-1.5 text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-g300">
                  <option value="">Sex...</option>
                  <option value="Stallion">Stallion</option>
                  <option value="Mare">Mare</option>
                  <option value="Gelding">Gelding</option>
                </select>
                <Input value={newHorseBreed} onChange={(e) => setNewHorseBreed(e.target.value)} placeholder="Breed" className="h-7 text-[12px]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={newHorseSire} onChange={(e) => setNewHorseSire(e.target.value)} placeholder="Sire" className="h-7 text-[12px]" />
                <Input value={newHorseDam} onChange={(e) => setNewHorseDam(e.target.value)} placeholder="Dam" className="h-7 text-[12px]" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddingHorse(false)} className="h-7 text-[12px]">Cancel</Button>
                <Button type="button" size="sm" onClick={handleAddHorse} disabled={!newHorseName} className="h-7 text-[12px]">Add Horse</Button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] text-ink3 mb-1.5">Display Settings (what spectators see)</label>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
              {BPP_DISPLAY_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-1.5 text-[12px] text-ink2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!displaySettings[opt.key]}
                    onChange={() => toggleDisplay(opt.key)}
                    className="rounded border-line text-g700 focus:ring-g300 w-3.5 h-3.5"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {displaySettings.showGamesPlayed && (
            <div className="max-w-[200px]">
              <label className="block text-[11px] text-ink3 mb-0.5">Games Played Override (auto: {autoGames})</label>
              <Input
                type="number"
                value={gamesOverride}
                onChange={(e) => setGamesOverride(e.target.value)}
                placeholder={String(autoGames)}
                className="h-8 text-[13px]"
                min="0"
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            {selectedHorseId && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={saving}>
                Clear
              </Button>
            )}
            <Button type="button" size="sm" onClick={handleSave} disabled={saving || !selectedHorseId} className="gap-1">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save BPP
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TournamentForm({
  tournament,
  onClose,
  onSuccess,
}: {
  tournament?: TournamentItem | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdminUser = user?.role === "super_admin";
  const updateMutation = useUpdateTournament();

  const isEditing = !!tournament;
  const [name, setName] = useState(tournament?.name || "");
  const [clubId, setClubId] = useState(tournament?.clubId || "");
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [format, setFormat] = useState(tournament?.format || "round_robin");
  const [status, setStatus] = useState(tournament?.status || "draft");
  const [startDate, setStartDate] = useState(tournament?.startDate?.split("T")[0] || "");
  const [endDate, setEndDate] = useState(tournament?.endDate?.split("T")[0] || "");
  const [handicapLevel, setHandicapLevel] = useState(tournament?.handicapLevel || "");
  const [chukkersPerMatch, setChukkersPerMatch] = useState(tournament?.chukkersPerMatch?.toString() || "6");
  const [description, setDescription] = useState(tournament?.description || "");
  const [logoUrl, setLogoUrl] = useState(tournament?.logoUrl || "");
  const [jumbotronBgColor, setJumbotronBgColor] = useState(tournament?.jumbotronBgColor || "#0c1a35");
  const [sponsored, setSponsored] = useState(tournament?.sponsored || false);
  const [sponsoredRank, setSponsoredRank] = useState(tournament?.sponsoredRank || 0);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiFetch("/clubs").then((data: any[]) => setClubs(data)).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data: Record<string, any> = {
        name,
        clubId: clubId || null,
        format,
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        handicapLevel: handicapLevel || undefined,
        chukkersPerMatch: chukkersPerMatch ? parseInt(chukkersPerMatch) : undefined,
        description: description || undefined,
        logoUrl: logoUrl || null,
        jumbotronBgColor: jumbotronBgColor || null,
      };
      if (isSuperAdminUser) {
        data.sponsored = sponsored;
        data.sponsoredRank = sponsored ? sponsoredRank : 0;
      }
      if (isEditing) {
        await updateMutation.mutateAsync({
          tournamentId: tournament.id,
          data,
        });
        toast({ title: "Tournament updated" });
        onSuccess();
      } else {
        await apiFetch("/tournaments", {
          method: "POST",
          body: JSON.stringify(data),
        });
        toast({ title: "Tournament created" });
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tournament) return;
    setDeleting(true);
    try {
      await apiFetch(`/tournaments/${tournament.id}`, { method: "DELETE" });
      toast({ title: "Tournament deleted" });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-[15px] text-ink">
          {isEditing ? "Edit Tournament" : "New Tournament"}
        </h3>
        <button onClick={onClose} className="text-ink3 hover:text-ink transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">Tournament Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">Host Club</label>
            <select
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              className="w-full h-9 rounded-[8px] border border-line px-3 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-g300"
            >
              <option value="">No host club</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full h-9 rounded-[8px] border border-line px-3 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-g300"
            >
              {FORMAT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">Start Date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">End Date</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">Handicap Level</label>
            <Input value={handicapLevel} onChange={(e) => setHandicapLevel(e.target.value)} placeholder="e.g. 0-4 goals" />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">Chukkers/Match</label>
            <Input type="number" value={chukkersPerMatch} onChange={(e) => setChukkersPerMatch(e.target.value)} min="1" max="8" />
          </div>
        </div>
        {isEditing && (
          <div>
            <label className="block text-[12px] font-medium text-ink2 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full h-9 rounded-[8px] border border-line px-3 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-g300"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-[12px] font-medium text-ink2 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-[8px] border border-line px-3 py-2 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-g300 resize-none"
            rows={2}
            placeholder="Optional description..."
          />
        </div>

        <div className="pt-2 border-t border-line2">
          <h4 className="text-[13px] font-medium text-ink mb-3">Jumbotron / Scoreboard</h4>
          <div className="flex items-start gap-6">
            <div className="flex flex-col items-center gap-1.5">
              <ImageCropUpload
                value={logoUrl || null}
                onChange={(url) => setLogoUrl(url || "")}
                name={(name || "?").substring(0, 2).toUpperCase()}
                shape="circle"
                size={80}
              />
              <span className="text-[11px] text-ink3 text-center max-w-[100px] leading-tight">
                Event logo<br />(fits inside center seal)
              </span>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-ink2 mb-1">Center Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={jumbotronBgColor || "#0c1a35"}
                    onChange={(e) => setJumbotronBgColor(e.target.value)}
                    className="w-12 h-9 rounded-[4px] border border-line cursor-pointer"
                  />
                  <Input
                    value={jumbotronBgColor || ""}
                    onChange={(e) => setJumbotronBgColor(e.target.value)}
                    placeholder="#0c1a35"
                    className="w-32 h-9"
                  />
                  <span className="text-[11px] text-ink3 leading-tight">
                    Used as the background of the center seal when no event logo is uploaded.
                  </span>
                </div>
              </div>
            </div>
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
                <span className="text-[13px] text-ink">Featured Event</span>
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

        {isEditing && tournament && (
          <>
            <TournamentTeamsSection
              tournamentId={tournament.id}
              currentFormat={format}
              onFormatChange={setFormat}
            />
            <ScheduleSection tournamentId={tournament.id} />
            <StandingsSection tournamentId={tournament.id} />
            <TopScorersSection tournamentId={tournament.id} />
            <MVPSection tournamentId={tournament.id} />
            <BPPSection tournamentId={tournament.id} />
          </>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-line2">
          <div>
            {isEditing && !confirmDelete && (
              <Button type="button" variant="ghost" className="text-live hover:text-live hover:bg-live-dim" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete Tournament
              </Button>
            )}
            {isEditing && confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-live">Delete all matches and data?</span>
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
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Tournament"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

function RegeneratePreviewsButton({ tournamentId }: { tournamentId: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    setProgress(null);
    try {
      // Fetch every match in this tournament, then run the high-fidelity
      // client-side snap (BoldDiagonal template -> html-to-image -> R2)
      // sequentially. Sequential because each snap mounts a 1920x1080
      // off-screen renderer; doing many at once would peg the main thread.
      const matches = await apiFetch(`/tournaments/${tournamentId}/matches`);
      const ids: string[] = Array.isArray(matches) ? matches.map((m: any) => m.id).filter(Boolean) : [];
      if (ids.length === 0) {
        toast({ title: "No matches to refresh", description: "This tournament has no matches yet." });
        return;
      }

      let succeeded = 0;
      let failed = 0;
      for (let i = 0; i < ids.length; i++) {
        setProgress({ done: i, total: ids.length });
        const ok = await snapAndUploadMatchPreview(ids[i]);
        if (ok) succeeded++; else failed++;
      }
      setProgress({ done: ids.length, total: ids.length });

      toast({
        title: failed > 0 ? "Regenerated with errors" : "Previews regenerated",
        description: `${succeeded}/${ids.length} match previews refreshed${failed > 0 ? ` · ${failed} failed` : ""}.`,
        variant: failed > 0 ? "destructive" : "default",
      });
    } catch (err: any) {
      toast({
        title: "Failed to regenerate",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const label = busy
    ? progress
      ? `Refreshing ${progress.done}/${progress.total}…`
      : "Loading…"
    : "Previews";

  return (
    <Button
      variant="ghost"
      size="sm"
      className="bg-surface border-line gap-1.5"
      onClick={handleClick}
      disabled={busy}
      title="Re-render link-preview thumbnails for every match in this tournament using the Match Graphics template"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
      {label}
    </Button>
  );
}

export function AdminTournaments() {
  const [tournamentsList, setTournamentsList] = useState<TournamentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTournament, setEditingTournament] = useState<TournamentItem | null>(null);

  const loadTournaments = useCallback(async () => {
    try {
      const data = await apiFetch("/tournaments");
      setTournamentsList(data);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadTournaments(); }, [loadTournaments]);

  if (isLoading) return <AdminLayout><PageLoading /></AdminLayout>;

  const handleEdit = (t: TournamentItem) => {
    setEditingTournament(t);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingTournament(null);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingTournament(null);
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Tournaments</h1>
          <p className="text-[14px] text-ink2 mt-1">Manage draws, schedules, and entered teams.</p>
        </div>
        {!showForm && (
          <Button className="gap-2" onClick={handleNew}>
            <Plus className="w-4 h-4" /> Create Tournament
          </Button>
        )}
      </div>

      {showForm && (
        <TournamentForm
          tournament={editingTournament}
          onClose={handleClose}
          onSuccess={() => loadTournaments()}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tournamentsList?.map((t: Record<string, any>) => (
          <Card key={t.id} className="flex flex-col">
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start mb-3">
                <Badge variant={
                  t.status === 'published' ? 'default' :
                  t.status === 'in_progress' ? 'destructive' :
                  'status'
                }>
                  {t.status.replace('_', ' ').toUpperCase()}
                </Badge>
                <div className="text-[12px] font-sans font-medium text-g700 bg-g50 px-2 py-0.5 rounded-[2px]">
                  {t.format?.replace('_', ' ') || 'Format TBA'}
                </div>
              </div>
              <h3 className="font-display font-bold text-lg leading-tight mb-2 line-clamp-2">{t.name}</h3>
              <div className="flex items-center text-[13px] text-ink2 mt-3">
                <Calendar className="w-3.5 h-3.5 mr-2 text-ink3" />
                {t.startDate ? formatDate(t.startDate, 'MMM d') : 'TBA'} – {t.endDate ? formatDate(t.endDate, 'MMM d') : 'TBA'}
              </div>
              <div className="flex items-center text-[13px] text-ink2 mt-1.5">
                <Trophy className="w-3.5 h-3.5 mr-2 text-ink3" />
                {t.handicapLevel || 'Open Handicap'}
              </div>
            </div>

            <div className="border-t border-line bg-surface2 p-3 flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1 bg-surface border-line" onClick={() => handleEdit(t as TournamentItem)}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
              <TournamentExportButton tournamentId={t.id} />
              <RegeneratePreviewsButton tournamentId={t.id} />
            </div>
          </Card>
        ))}

        {tournamentsList?.length === 0 && !showForm && (
          <div className="col-span-full py-16 text-center border border-dashed border-line rounded-[4px]">
            <Trophy className="w-10 h-10 text-ink3 mx-auto mb-3" />
            <h3 className="font-display font-bold text-lg text-ink">No tournaments yet</h3>
            <p className="text-[14px] text-ink2 mt-1 mb-4">Create your first tournament to start managing draws.</p>
            <Button variant="secondary" onClick={handleNew}>Create Tournament</Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
