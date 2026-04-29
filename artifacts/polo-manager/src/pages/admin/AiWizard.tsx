import { useState } from "react";
import { useAuth, getStoredToken } from "@/hooks/use-auth";
import { AdminLayout } from "./AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Building2,
  Users,
  Trophy,
  MapPin,
  Check,
  AlertCircle,
  Loader2,
  Calendar,
  UserCircle,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

interface ParsedPlayer {
  name: string;
  handicap?: number | null;
}

interface ParsedClub {
  name: string;
  slug: string;
  description?: string | null;
  website?: string | null;
  country?: string | null;
  region?: string | null;
}

interface ParsedTeam {
  name: string;
  clubName: string;
  shortName?: string | null;
  primaryColor?: string | null;
  handicap?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
  players?: ParsedPlayer[];
  tournamentNames?: string[];
}

interface ParsedTournament {
  name: string;
  clubName: string;
  format?: string | null;
  handicapLevel?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  chukkersPerMatch?: number | null;
  teamNames?: string[];
}

interface ParsedField {
  name: string;
  clubName: string;
  number?: number | null;
  surfaceType?: string | null;
}

interface ParsedMatch {
  tournamentName: string;
  homeTeamName: string;
  awayTeamName: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  fieldName?: string | null;
  round?: string | null;
}

interface ParsedData {
  clubs: ParsedClub[];
  teams: ParsedTeam[];
  tournaments: ParsedTournament[];
  fields: ParsedField[];
  matches: ParsedMatch[];
  warnings: string[];
}

interface CreateResults {
  clubs: { created: number; errors: string[] };
  teams: { created: number; errors: string[] };
  players: { created: number; errors: string[] };
  tournaments: { created: number; errors: string[] };
  fields: { created: number; errors: string[] };
  tournamentTeams: { created: number; errors: string[] };
  matches: { created: number; errors: string[] };
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

const FORMAT_LABELS: Record<string, string> = {
  round_robin: "Round Robin",
  single_elim: "Single Elimination",
  double_elim: "Double Elimination",
  swiss: "Swiss",
  group_knockout: "Group + Knockout",
};

const FORMAT_OPTIONS = Object.entries(FORMAT_LABELS);

function CollapsibleSection({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: any;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div className="border border-line rounded-[12px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-bg2 hover:bg-bg3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-g500" />
          <span className="font-medium text-[14px] text-ink">{title}</span>
          <span className="text-[12px] text-ink3 bg-white border border-line px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-ink3" /> : <ChevronDown className="w-4 h-4 text-ink3" />}
      </button>
      {open && <div className="divide-y divide-line">{children}</div>}
    </div>
  );
}

const inputCls = "w-full rounded-[6px] border border-line px-2.5 py-1.5 text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-g300 text-ink";
const labelCls = "text-[11px] font-medium text-ink3 mb-0.5 block";

function EditClubRow({ club, onChange, onRemove }: { club: ParsedClub; onChange: (c: ParsedClub) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const set = (key: keyof ParsedClub, val: string) => onChange({ ...club, [key]: val || null });

  if (!editing) {
    return (
      <div className="px-4 py-3 flex items-center justify-between hover:bg-bg group">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditing(true)}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-[14px] text-ink">{club.name}</span>
            <span className="text-[12px] text-ink3">/{club.slug}</span>
            <Pencil className="w-3 h-3 text-ink3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-[12px] text-ink3 mt-0.5">
            {[club.region, club.country].filter(Boolean).join(", ") || "No location"}
            {club.website && ` | ${club.website}`}
          </div>
        </div>
        <button onClick={onRemove} className="p-1 text-ink3 hover:text-live transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-bg">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Name</label>
          <input className={inputCls} value={club.name} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Slug</label>
          <input className={inputCls} value={club.slug} onChange={e => set("slug", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Region</label>
          <input className={inputCls} value={club.region || ""} onChange={e => set("region", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Country</label>
          <input className={inputCls} value={club.country || ""} onChange={e => set("country", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Website</label>
          <input className={inputCls} value={club.website || ""} onChange={e => set("website", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input className={inputCls} value={club.description || ""} onChange={e => set("description", e.target.value)} />
        </div>
      </div>
      <div className="flex justify-between mt-3">
        <button onClick={onRemove} className="text-[12px] text-live hover:underline flex items-center gap-1">
          <Trash2 className="w-3 h-3" /> Remove
        </button>
        <Button variant="secondary" size="sm" className="h-7 text-[12px]" onClick={() => setEditing(false)}>Done</Button>
      </div>
    </div>
  );
}

function EditTeamRow({ team, onChange, onRemove }: { team: ParsedTeam; onChange: (t: ParsedTeam) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const set = (key: keyof ParsedTeam, val: string | number | null | ParsedPlayer[] | string[]) => onChange({ ...team, [key]: val });

  const updatePlayer = (pi: number, key: keyof ParsedPlayer, val: string | number | null) => {
    const players = [...(team.players || [])];
    players[pi] = { ...players[pi], [key]: val };
    onChange({ ...team, players });
  };
  const removePlayer = (pi: number) => {
    onChange({ ...team, players: (team.players || []).filter((_, i) => i !== pi) });
  };
  const addPlayer = () => {
    onChange({ ...team, players: [...(team.players || []), { name: "", handicap: null }] });
  };

  if (!editing) {
    return (
      <div className="px-4 py-3 hover:bg-bg group">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditing(true)}>
            <div className="flex items-center gap-2">
              {team.primaryColor && (
                <div className="w-3 h-3 rounded-full border border-line" style={{ backgroundColor: team.primaryColor }} />
              )}
              <span className="font-medium text-[14px] text-ink">{team.name}</span>
              {team.shortName && <span className="text-[12px] text-ink3">{team.shortName}</span>}
              {team.handicap != null && (
                <span className="text-[11px] text-g700 bg-g50 px-1.5 py-0.5 rounded">HC {team.handicap}</span>
              )}
              <Pencil className="w-3 h-3 text-ink3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-[12px] text-ink3 mt-0.5">
              Club: {team.clubName}
              {team.contactName && ` | ${team.contactName}`}
              {team.contactPhone && ` ${team.contactPhone}`}
            </div>
          </div>
          <button onClick={onRemove} className="p-1 text-ink3 hover:text-live transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {team.players && team.players.length > 0 && (
          <div className="mt-2 ml-5 flex flex-wrap gap-2">
            {team.players.map((p, pi) => (
              <span key={pi} className="inline-flex items-center gap-1 text-[12px] bg-bg2 border border-line px-2 py-0.5 rounded-full">
                <UserCircle className="w-3 h-3 text-ink3" />
                <span className="text-ink">{p.name}</span>
                {p.handicap != null && <span className="text-g700 font-medium">({p.handicap})</span>}
              </span>
            ))}
          </div>
        )}
        {team.tournamentNames && team.tournamentNames.length > 0 && (
          <div className="mt-1.5 ml-5 flex flex-wrap gap-1.5">
            {team.tournamentNames.map((tn, ti) => (
              <span key={ti} className="inline-flex items-center gap-1 text-[11px] text-g700 bg-g50 px-2 py-0.5 rounded">
                <Link2 className="w-3 h-3" />
                {tn}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-bg">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Team Name</label>
          <input className={inputCls} value={team.name} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Short Name</label>
          <input className={inputCls} value={team.shortName || ""} onChange={e => set("shortName", e.target.value || null)} />
        </div>
        <div>
          <label className={labelCls}>Club</label>
          <input className={inputCls} value={team.clubName} onChange={e => set("clubName", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Primary Color</label>
          <div className="flex gap-2">
            <input className={inputCls} value={team.primaryColor || ""} onChange={e => set("primaryColor", e.target.value || null)} />
            {team.primaryColor && <div className="w-8 h-8 rounded border border-line shrink-0" style={{ backgroundColor: team.primaryColor }} />}
          </div>
        </div>
        <div>
          <label className={labelCls}>Team Handicap</label>
          <input className={inputCls} type="number" value={team.handicap ?? ""} onChange={e => set("handicap", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label className={labelCls}>Contact Name</label>
          <input className={inputCls} value={team.contactName || ""} onChange={e => set("contactName", e.target.value || null)} />
        </div>
        <div>
          <label className={labelCls}>Contact Phone</label>
          <input className={inputCls} value={team.contactPhone || ""} onChange={e => set("contactPhone", e.target.value || null)} />
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelCls}>Players</label>
          <button onClick={addPlayer} className="text-[11px] text-g700 hover:text-g900 flex items-center gap-0.5">
            <Plus className="w-3 h-3" /> Add Player
          </button>
        </div>
        {(team.players || []).length > 0 && (
          <div className="grid grid-cols-[1fr_80px_26px] gap-2 mb-1">
            <span className="text-[10px] text-ink3 uppercase tracking-wide">Name</span>
            <span className="text-[10px] text-ink3 uppercase tracking-wide text-center">Handicap</span>
            <span />
          </div>
        )}
        <div className="space-y-1.5">
          {(team.players || []).map((p, pi) => (
            <div key={pi} className="grid grid-cols-[1fr_80px_26px] gap-2 items-center">
              <input className="rounded-[6px] border border-line px-2.5 py-1.5 text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-g300 text-ink min-w-0" placeholder="Player name" value={p.name || ""} onChange={e => updatePlayer(pi, "name", e.target.value)} />
              <input className="rounded-[6px] border border-line px-2.5 py-1.5 text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-g300 text-ink text-center min-w-0" type="number" placeholder="HC" value={p.handicap ?? ""} onChange={e => updatePlayer(pi, "handicap", e.target.value ? Number(e.target.value) : null)} />
              <button onClick={() => removePlayer(pi)} className="p-1 text-ink3 hover:text-live transition-colors shrink-0 justify-self-center">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between mt-3">
        <button onClick={onRemove} className="text-[12px] text-live hover:underline flex items-center gap-1">
          <Trash2 className="w-3 h-3" /> Remove
        </button>
        <Button variant="secondary" size="sm" className="h-7 text-[12px]" onClick={() => setEditing(false)}>Done</Button>
      </div>
    </div>
  );
}

function EditTournamentRow({ tournament: t, onChange, onRemove }: { tournament: ParsedTournament; onChange: (t: ParsedTournament) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const set = (key: keyof ParsedTournament, val: string | number | null | string[]) => onChange({ ...t, [key]: val });

  const updateTeamName = (ti: number, val: string) => {
    const names = [...(t.teamNames || [])];
    names[ti] = val;
    onChange({ ...t, teamNames: names });
  };
  const removeTeamName = (ti: number) => {
    onChange({ ...t, teamNames: (t.teamNames || []).filter((_, i) => i !== ti) });
  };
  const addTeamName = () => {
    onChange({ ...t, teamNames: [...(t.teamNames || []), ""] });
  };

  if (!editing) {
    return (
      <div className="px-4 py-3 hover:bg-bg group">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditing(true)}>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[14px] text-ink">{t.name}</span>
              {t.format && (
                <span className="text-[11px] text-g700 bg-g50 px-1.5 py-0.5 rounded">
                  {FORMAT_LABELS[t.format] || t.format}
                </span>
              )}
              <Pencil className="w-3 h-3 text-ink3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-[12px] text-ink3 mt-0.5">
              Club: {t.clubName}
              {t.handicapLevel && ` | ${t.handicapLevel}`}
              {t.startDate && ` | ${t.startDate}`}
              {t.endDate && ` - ${t.endDate}`}
              {t.chukkersPerMatch && ` | ${t.chukkersPerMatch} chukkers`}
            </div>
          </div>
          <button onClick={onRemove} className="p-1 text-ink3 hover:text-live transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {t.teamNames && t.teamNames.length > 0 && (
          <div className="mt-2 ml-5 flex flex-wrap gap-1.5">
            {t.teamNames.map((tn, ti) => (
              <span key={ti} className="inline-flex items-center gap-1 text-[11px] text-ink2 bg-bg2 border border-line px-2 py-0.5 rounded-full">
                <Users className="w-3 h-3" />
                {tn}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-bg">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Tournament Name</label>
          <input className={inputCls} value={t.name} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Club</label>
          <input className={inputCls} value={t.clubName} onChange={e => set("clubName", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Format</label>
          <select className={inputCls} value={t.format || ""} onChange={e => set("format", e.target.value || null)}>
            <option value="">-- None --</option>
            {FORMAT_OPTIONS.map(([val, lab]) => (
              <option key={val} value={val}>{lab}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Handicap Level</label>
          <input className={inputCls} value={t.handicapLevel || ""} onChange={e => set("handicapLevel", e.target.value || null)} />
        </div>
        <div>
          <label className={labelCls}>Start Date</label>
          <input className={inputCls} type="date" value={t.startDate || ""} onChange={e => set("startDate", e.target.value || null)} />
        </div>
        <div>
          <label className={labelCls}>End Date</label>
          <input className={inputCls} type="date" value={t.endDate || ""} onChange={e => set("endDate", e.target.value || null)} />
        </div>
        <div>
          <label className={labelCls}>Chukkers per Match</label>
          <input className={inputCls} type="number" value={t.chukkersPerMatch ?? ""} onChange={e => set("chukkersPerMatch", e.target.value ? Number(e.target.value) : null)} />
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelCls}>Teams in Tournament</label>
          <button onClick={addTeamName} className="text-[11px] text-g700 hover:text-g900 flex items-center gap-0.5">
            <Plus className="w-3 h-3" /> Add Team
          </button>
        </div>
        <div className="space-y-1.5">
          {(t.teamNames || []).map((tn, ti) => (
            <div key={ti} className="flex items-center gap-2">
              <input className={`${inputCls} flex-1`} value={tn} onChange={e => updateTeamName(ti, e.target.value)} />
              <button onClick={() => removeTeamName(ti)} className="p-1 text-ink3 hover:text-live transition-colors shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between mt-3">
        <button onClick={onRemove} className="text-[12px] text-live hover:underline flex items-center gap-1">
          <Trash2 className="w-3 h-3" /> Remove
        </button>
        <Button variant="secondary" size="sm" className="h-7 text-[12px]" onClick={() => setEditing(false)}>Done</Button>
      </div>
    </div>
  );
}

function EditFieldRow({ field: f, onChange, onRemove }: { field: ParsedField; onChange: (f: ParsedField) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const set = (key: keyof ParsedField, val: string | number | null) => onChange({ ...f, [key]: val });

  if (!editing) {
    return (
      <div className="px-4 py-3 flex items-center justify-between hover:bg-bg group">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditing(true)}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-[14px] text-ink">{f.name}</span>
            {f.number && <span className="text-[12px] text-ink3">#{f.number}</span>}
            <Pencil className="w-3 h-3 text-ink3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-[12px] text-ink3 mt-0.5">
            Club: {f.clubName}
            {f.surfaceType && ` | ${f.surfaceType}`}
          </div>
        </div>
        <button onClick={onRemove} className="p-1 text-ink3 hover:text-live transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-bg">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Field Name</label>
          <input className={inputCls} value={f.name} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Club</label>
          <input className={inputCls} value={f.clubName} onChange={e => set("clubName", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Number</label>
          <input className={inputCls} type="number" value={f.number ?? ""} onChange={e => set("number", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div>
          <label className={labelCls}>Surface Type</label>
          <input className={inputCls} value={f.surfaceType || ""} onChange={e => set("surfaceType", e.target.value || null)} />
        </div>
      </div>
      <div className="flex justify-between mt-3">
        <button onClick={onRemove} className="text-[12px] text-live hover:underline flex items-center gap-1">
          <Trash2 className="w-3 h-3" /> Remove
        </button>
        <Button variant="secondary" size="sm" className="h-7 text-[12px]" onClick={() => setEditing(false)}>Done</Button>
      </div>
    </div>
  );
}

function EditMatchRow({ match: m, onChange, onRemove }: { match: ParsedMatch; onChange: (m: ParsedMatch) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const set = (key: keyof ParsedMatch, val: string | null) => onChange({ ...m, [key]: val });

  if (!editing) {
    return (
      <div className="px-4 py-3 flex items-center justify-between hover:bg-bg group">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditing(true)}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-[14px] text-ink">{m.homeTeamName} vs {m.awayTeamName}</span>
            {m.round && (
              <span className="text-[11px] text-g700 bg-g50 px-1.5 py-0.5 rounded">{m.round}</span>
            )}
            <Pencil className="w-3 h-3 text-ink3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="text-[12px] text-ink3 mt-0.5">
            {m.tournamentName}
            {m.scheduledDate && ` | ${m.scheduledDate}`}
            {m.scheduledTime && ` at ${m.scheduledTime}`}
            {m.fieldName && ` | ${m.fieldName}`}
          </div>
        </div>
        <button onClick={onRemove} className="p-1 text-ink3 hover:text-live transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-bg">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Home Team</label>
          <input className={inputCls} value={m.homeTeamName} onChange={e => set("homeTeamName", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Away Team</label>
          <input className={inputCls} value={m.awayTeamName} onChange={e => set("awayTeamName", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Tournament</label>
          <input className={inputCls} value={m.tournamentName} onChange={e => set("tournamentName", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Round</label>
          <input className={inputCls} value={m.round || ""} onChange={e => set("round", e.target.value || null)} />
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input className={inputCls} type="date" value={m.scheduledDate || ""} onChange={e => set("scheduledDate", e.target.value || null)} />
        </div>
        <div>
          <label className={labelCls}>Time</label>
          <input className={inputCls} type="time" value={m.scheduledTime || ""} onChange={e => set("scheduledTime", e.target.value || null)} />
        </div>
        <div>
          <label className={labelCls}>Field</label>
          <input className={inputCls} value={m.fieldName || ""} onChange={e => set("fieldName", e.target.value || null)} />
        </div>
      </div>
      <div className="flex justify-between mt-3">
        <button onClick={onRemove} className="text-[12px] text-live hover:underline flex items-center gap-1">
          <Trash2 className="w-3 h-3" /> Remove
        </button>
        <Button variant="secondary" size="sm" className="h-7 text-[12px]" onClick={() => setEditing(false)}>Done</Button>
      </div>
    </div>
  );
}

export function AiWizard() {
  const { user } = useAuth();
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [parseError, setParseError] = useState("");
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [results, setResults] = useState<CreateResults | null>(null);

  if (user?.role !== "super_admin") {
    return (
      <AdminLayout>
        <div className="py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">Access Denied</h1>
          <p className="text-[14px] text-ink2 mt-2">This feature is only available to super admins.</p>
        </div>
      </AdminLayout>
    );
  }

  const handleParse = async () => {
    setParsing(true);
    setParseError("");
    setParsed(null);
    setResults(null);
    try {
      const data = await apiFetch("/admin/ai/parse-setup", {
        method: "POST",
        body: JSON.stringify({ text: rawText }),
      });
      setParsed(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to parse text";
      setParseError(msg);
    } finally {
      setParsing(false);
    }
  };

  const updateClub = (idx: number, club: ParsedClub) => {
    if (!parsed) return;
    const clubs = [...parsed.clubs];
    clubs[idx] = club;
    setParsed({ ...parsed, clubs });
  };

  const removeClub = (idx: number) => {
    if (!parsed) return;
    setParsed({ ...parsed, clubs: parsed.clubs.filter((_, i) => i !== idx) });
  };

  const updateTeam = (idx: number, team: ParsedTeam) => {
    if (!parsed) return;
    const teams = [...parsed.teams];
    teams[idx] = team;
    setParsed({ ...parsed, teams });
  };

  const removeTeam = (idx: number) => {
    if (!parsed) return;
    setParsed({ ...parsed, teams: parsed.teams.filter((_, i) => i !== idx) });
  };

  const updateTournament = (idx: number, tournament: ParsedTournament) => {
    if (!parsed) return;
    const tournaments = [...parsed.tournaments];
    tournaments[idx] = tournament;
    setParsed({ ...parsed, tournaments });
  };

  const removeTournament = (idx: number) => {
    if (!parsed) return;
    setParsed({ ...parsed, tournaments: parsed.tournaments.filter((_, i) => i !== idx) });
  };

  const updateField = (idx: number, field: ParsedField) => {
    if (!parsed) return;
    const fields = [...parsed.fields];
    fields[idx] = field;
    setParsed({ ...parsed, fields });
  };

  const removeField = (idx: number) => {
    if (!parsed) return;
    setParsed({ ...parsed, fields: parsed.fields.filter((_, i) => i !== idx) });
  };

  const updateMatch = (idx: number, match: ParsedMatch) => {
    if (!parsed) return;
    const matches = [...parsed.matches];
    matches[idx] = match;
    setParsed({ ...parsed, matches });
  };

  const removeMatch = (idx: number) => {
    if (!parsed) return;
    setParsed({ ...parsed, matches: parsed.matches.filter((_, i) => i !== idx) });
  };

  const totalPlayers = parsed ? parsed.teams.reduce((sum, t) => sum + (t.players?.length || 0), 0) : 0;
  const totalItems = parsed
    ? parsed.clubs.length + parsed.teams.length + parsed.tournaments.length + parsed.fields.length + (parsed.matches?.length || 0) + totalPlayers
    : 0;

  const handleExecute = async () => {
    if (!parsed) return;
    setCreating(true);
    setParseError("");
    setProgress({ current: 0, total: totalItems, label: "Starting..." });

    const steps: { label: string; fraction: number }[] = [];
    if (parsed.clubs.length > 0) steps.push({ label: `Creating ${parsed.clubs.length} club(s)...`, fraction: parsed.clubs.length });
    if (parsed.teams.length > 0) steps.push({ label: `Creating ${parsed.teams.length} team(s) with players...`, fraction: parsed.teams.length + totalPlayers });
    if (parsed.tournaments.length > 0) steps.push({ label: `Creating ${parsed.tournaments.length} tournament(s) & linking teams...`, fraction: parsed.tournaments.length });
    if (parsed.fields.length > 0) steps.push({ label: `Creating ${parsed.fields.length} field(s)...`, fraction: parsed.fields.length });
    if (parsed.matches?.length > 0) steps.push({ label: `Creating ${parsed.matches.length} match(es)...`, fraction: parsed.matches.length });

    let done = 0;
    for (const step of steps) {
      setProgress({ current: done, total: totalItems, label: step.label });
      await new Promise(r => setTimeout(r, 200));
      done += step.fraction;
    }
    setProgress({ current: done, total: totalItems, label: "Saving to database..." });

    try {
      const data = await apiFetch("/admin/ai/execute-setup", {
        method: "POST",
        body: JSON.stringify({
          clubs: parsed.clubs,
          teams: parsed.teams,
          tournaments: parsed.tournaments,
          fields: parsed.fields,
          matches: parsed.matches || [],
        }),
      });
      setProgress({ current: totalItems, total: totalItems, label: "Complete" });
      setResults(data);
      setParsed(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create records";
      setParseError(msg);
    } finally {
      setCreating(false);
    }
  };

  const totalCreated = results
    ? results.clubs.created + results.teams.created + (results.players?.created || 0) + results.tournaments.created + results.fields.created + (results.tournamentTeams?.created || 0) + (results.matches?.created || 0)
    : 0;

  const totalErrors = results
    ? results.clubs.errors.length + results.teams.errors.length + (results.players?.errors?.length || 0) + results.tournaments.errors.length + results.fields.errors.length + (results.tournamentTeams?.errors?.length || 0) + (results.matches?.errors?.length || 0)
    : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-g500" />
            AI Setup Wizard
          </h1>
          <p className="text-[14px] text-ink2 mt-1">
            Paste raw text about clubs, teams, tournaments, or fields. AI will parse it and create records automatically.
          </p>
        </div>

        <Card className="p-6">
          <label className="block text-[13px] font-medium text-ink2 mb-2">
            Paste your data below
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="w-full rounded-[8px] border border-line px-4 py-3 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-g300 resize-none font-mono"
            rows={10}
            placeholder={`Example:\n\nWellington Polo Club - Wellington, FL\nTeams:\n  Black Watch (HC 22): Facundo Pieres 10, Hilario Ulloa 10, Juan Nero 10, Santiago Toccalino 9\n  Pilot (HC 20): Adolfo Cambiaso 10, David Stirling 8\nSpring Cup 2026 - March 15 to April 5, 4 chukkers, 0-4 goals\nSchedule:\n  March 15: Black Watch vs Pilot (Field 1, Preliminary)\nFields: Field 1 (grass), Field 2 (grass)`}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-[12px] text-ink3">
              {rawText.length > 0 ? `${rawText.length} characters` : ""}
            </span>
            <Button
              onClick={handleParse}
              disabled={parsing || rawText.trim().length < 10}
              className="gap-2"
            >
              {parsing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Process with AI
                </>
              )}
            </Button>
          </div>
        </Card>

        {parseError && (
          <Card className="p-4 border-live/30 bg-live/5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-live mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[14px] font-medium text-live">Error</p>
                <p className="text-[13px] text-ink2 mt-0.5">{parseError}</p>
              </div>
            </div>
          </Card>
        )}

        {parsed && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-ink">
                  Preview ({totalItems} items to create)
                </h2>
                <p className="text-[12px] text-ink3 mt-0.5">Click any item to edit its details before creating</p>
              </div>
              {!creating && (
                <Button
                  onClick={handleExecute}
                  disabled={totalItems === 0}
                  className="gap-2"
                >
                  <Check className="w-4 h-4" />
                  Confirm & Create
                </Button>
              )}
            </div>

            {creating && (
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 className="w-4 h-4 animate-spin text-g500" />
                  <span className="text-[14px] font-medium text-ink">{progress.label}</span>
                </div>
                <div className="w-full bg-bg3 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-g500 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
                <div className="text-[12px] text-ink3 mt-1.5">
                  {progress.current} of {progress.total} items
                </div>
              </Card>
            )}

            {parsed.warnings.length > 0 && (
              <Card className="p-4 border-yellow-300/50 bg-yellow-50">
                <p className="text-[13px] font-medium text-yellow-800 mb-1">Warnings</p>
                <ul className="text-[13px] text-yellow-700 space-y-0.5">
                  {parsed.warnings.map((w, i) => (
                    <li key={i}>- {w}</li>
                  ))}
                </ul>
              </Card>
            )}

            <CollapsibleSection title="Clubs" icon={Building2} count={parsed.clubs.length}>
              {parsed.clubs.map((club, i) => (
                <EditClubRow key={i} club={club} onChange={c => updateClub(i, c)} onRemove={() => removeClub(i)} />
              ))}
            </CollapsibleSection>

            <CollapsibleSection title="Teams" icon={Users} count={parsed.teams.length}>
              {parsed.teams.map((team, i) => (
                <EditTeamRow key={i} team={team} onChange={t => updateTeam(i, t)} onRemove={() => removeTeam(i)} />
              ))}
            </CollapsibleSection>

            <CollapsibleSection title="Tournaments" icon={Trophy} count={parsed.tournaments.length}>
              {parsed.tournaments.map((t, i) => (
                <EditTournamentRow key={i} tournament={t} onChange={val => updateTournament(i, val)} onRemove={() => removeTournament(i)} />
              ))}
            </CollapsibleSection>

            <CollapsibleSection title="Fields" icon={MapPin} count={parsed.fields.length}>
              {parsed.fields.map((f, i) => (
                <EditFieldRow key={i} field={f} onChange={val => updateField(i, val)} onRemove={() => removeField(i)} />
              ))}
            </CollapsibleSection>

            <CollapsibleSection title="Schedule" icon={Calendar} count={parsed.matches?.length || 0} defaultOpen={true}>
              {parsed.matches?.map((m, i) => (
                <EditMatchRow key={i} match={m} onChange={val => updateMatch(i, val)} onRemove={() => removeMatch(i)} />
              ))}
            </CollapsibleSection>
          </div>
        )}

        {results && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Check className="w-5 h-5 text-g500" />
              <h2 className="font-display text-lg font-bold text-ink">Setup Complete</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              {[
                { label: "Clubs", created: results.clubs.created, errors: results.clubs.errors.length },
                { label: "Teams", created: results.teams.created, errors: results.teams.errors.length },
                { label: "Players", created: results.players?.created || 0, errors: results.players?.errors?.length || 0 },
                { label: "Tournaments", created: results.tournaments.created, errors: results.tournaments.errors.length },
                { label: "Fields", created: results.fields.created, errors: results.fields.errors.length },
                { label: "Team Links", created: results.tournamentTeams?.created || 0, errors: results.tournamentTeams?.errors?.length || 0 },
                { label: "Matches", created: results.matches?.created || 0, errors: results.matches?.errors?.length || 0 },
              ].filter(item => item.created > 0 || item.errors > 0).map((item) => (
                <div key={item.label} className="rounded-[8px] border border-line p-3 text-center">
                  <div className="text-[24px] font-bold text-g700">{item.created}</div>
                  <div className="text-[12px] text-ink3">{item.label}</div>
                  {item.errors > 0 && (
                    <div className="text-[11px] text-live mt-0.5">{item.errors} skipped</div>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[14px] text-ink2 mb-2">
              {totalCreated} records created successfully.
              {totalErrors > 0 && ` ${totalErrors} items were skipped due to errors.`}
            </p>

            {totalErrors > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-[13px] font-medium text-ink2 mb-1">Skipped items:</p>
                <ul className="text-[12px] text-ink3 space-y-0.5">
                  {[
                    ...results.clubs.errors,
                    ...results.teams.errors,
                    ...(results.players?.errors || []),
                    ...results.tournaments.errors,
                    ...results.fields.errors,
                    ...(results.tournamentTeams?.errors || []),
                    ...(results.matches?.errors || []),
                  ].map((err, i) => (
                    <li key={i}>- {err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-line">
              <Button
                variant="secondary"
                onClick={() => {
                  setResults(null);
                  setRawText("");
                }}
              >
                Add More Data
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
