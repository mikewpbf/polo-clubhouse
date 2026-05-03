import { useEffect, useState } from "react";
import { useRoute } from "wouter";

interface LineupTournament {
  id: string;
  name: string;
}

interface LineupTeam {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  totalHandicap: number;
}

interface LineupPlayer {
  id: string;
  name: string;
  position: number | null;
  handicap: string | null;
  dateOfBirth: string | null;
  homeClubName: string | null;
  headshotUrl: string | null;
  broadcastImageUrl: string | null;
  tournamentGoals: number;
  avgGoalsPerMatch: number;
}

interface LineupResponse {
  tournament: LineupTournament | null;
  team: LineupTeam | null;
  players: LineupPlayer[];
}

const PANEL_STYLE: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(12,12,16,0.82) 0%, rgba(18,18,24,0.86) 100%)",
  borderRadius: 24,
  boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 60px rgba(0,0,0,0.25)",
  padding: "32px 48px 40px",
  width: 820,
};

// Convert "#rrggbb" / "#rgb" to "r,g,b". Returns null if unparseable so callers
// can fall back to a neutral tint.
function hexToRgb(hex: string | null): string | null {
  if (!hex) return null;
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function computeAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const m = today.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < dob.getUTCDate())) age--;
  return age >= 0 && age < 150 ? age : null;
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { first: "", last: parts[0] || "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatHandicapValue(handicap: string | null): string {
  if (handicap === null || handicap === undefined) return "0";
  const n = Number(handicap);
  if (!Number.isFinite(n)) return handicap;
  return Number.isInteger(n) ? String(n) : String(n);
}

function formatTotalHandicap(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatAvg(value: number): string {
  if (!Number.isFinite(value)) return "0.0";
  return value.toFixed(1);
}

function PlayerPhoto({ player }: { player: LineupPlayer }) {
  const [src, setSrc] = useState<string | null>(player.broadcastImageUrl || player.headshotUrl);
  const [stage, setStage] = useState<"primary" | "fallback" | "initials">(
    player.broadcastImageUrl ? "primary" : player.headshotUrl ? "fallback" : "initials",
  );

  if (stage === "initials" || !src) {
    return (
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.35)",
        fontSize: 44,
        fontWeight: 800,
        letterSpacing: 2,
      }}>
        {initials(player.name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => {
        if (stage === "primary" && player.headshotUrl) {
          setSrc(player.headshotUrl);
          setStage("fallback");
        } else {
          setStage("initials");
          setSrc(null);
        }
      }}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
      }}
    />
  );
}

function PlayerCard({ player, teamRgb }: { player: LineupPlayer | null; teamRgb: string | null }) {
  if (!player) {
    return (
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px dashed rgba(255,255,255,0.06)",
        borderRadius: 12,
        minHeight: 320,
      }} />
    );
  }

  const { first, last } = splitName(player.name);
  const age = computeAge(player.dateOfBirth);
  const club = player.homeClubName;
  const metaParts: string[] = [];
  if (age !== null) metaParts.push(`Age ${age}`);
  if (club) metaParts.push(club);
  const metaLine = metaParts.join(" · ");

  // Subtle team-color tint: faint vertical wash on the card body + a 2px
  // accent bar between headshot and body. Falls back to neutral if no color.
  const cardBg = teamRgb
    ? `linear-gradient(180deg, rgba(${teamRgb},0.10) 0%, rgba(${teamRgb},0.04) 100%)`
    : "rgba(255,255,255,0.04)";
  const accentBar = teamRgb ? `rgba(${teamRgb},0.85)` : "rgba(255,255,255,0.12)";
  const dividerColor = teamRgb ? `rgba(${teamRgb},0.2)` : "rgba(255,255,255,0.08)";

  return (
    <div style={{
      background: cardBg,
      borderRadius: 12,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Headshot 4:5 — no badges */}
      <div style={{
        position: "relative",
        width: "100%",
        aspectRatio: "4 / 5",
        background: "linear-gradient(180deg, #4a4a4e 0%, #34343a 100%)",
        overflow: "hidden",
      }}>
        <PlayerPhoto player={player} />
        {/* Bottom legibility gradient */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.4) 100%)",
          pointerEvents: "none",
        }} />
      </div>

      {/* Team-color accent bar between photo and body */}
      <div style={{ height: 2, width: "100%", background: accentBar }} />

      {/* Card body — left aligned, flex column so the stats grid pins to the
          bottom regardless of meta-row presence. This keeps the stat row
          aligned across all 4 cards even when one player is missing club/age. */}
      <div style={{
        padding: "12px 12px 14px",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        textAlign: "left",
        gap: 6,
        flex: 1,
      }}>
        {first && (
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            lineHeight: 1.15,
          }}>
            {first}
          </div>
        )}
        <div style={{
          fontSize: 17,
          fontWeight: 800,
          color: "#fff",
          letterSpacing: 0.5,
          textTransform: "uppercase",
          lineHeight: 1.15,
          marginTop: first ? -4 : 0,
        }}>
          {last || player.name}
        </div>

        {/* Handicap — small inline "N GOALS" */}
        <div style={{
          display: "flex",
          alignItems: "baseline",
          gap: 5,
          paddingTop: 2,
        }}>
          <span style={{
            fontSize: 16,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1,
          }}>
            {formatHandicapValue(player.handicap)}
          </span>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            color: "rgba(255,255,255,0.45)",
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}>
            Goals
          </span>
        </div>

        {metaLine && (
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: 0.3,
          }}>
            {metaLine}
          </div>
        )}

        {/* Stats grid — pinned to bottom of card via marginTop:auto so all
            four cards align even when meta row is empty for some players. */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          width: "100%",
          marginTop: "auto",
          paddingTop: 10,
          borderTop: `1px solid ${dividerColor}`,
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 2,
          }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
              {player.tournamentGoals}
            </span>
            <span style={{
              fontSize: 8,
              fontWeight: 700,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: 1,
              textTransform: "uppercase",
              lineHeight: 1.2,
              maxWidth: 64,
              textAlign: "center",
            }}>
              Tournament Goals
            </span>
          </div>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 2,
          }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
              {formatAvg(player.avgGoalsPerMatch)}
            </span>
            <span style={{
              fontSize: 8,
              fontWeight: 700,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: 1,
              textTransform: "uppercase",
              lineHeight: 1.2,
              maxWidth: 64,
              textAlign: "center",
            }}>
              Avg per Match
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamLogoBubble({ team }: { team: LineupTeam }) {
  const [failed, setFailed] = useState(false);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const fallbackText = (team.name?.substring(0, 3) || "?").toUpperCase();

  if (!team.logoUrl || failed) {
    return (
      <span style={{
        fontWeight: 800,
        fontSize: 14,
        letterSpacing: 0.3,
        color: "#2a2a2e",
      }}>
        {fallbackText}
      </span>
    );
  }
  const src = team.logoUrl.startsWith("http") ? team.logoUrl : `${base}${team.logoUrl}`;
  return (
    <img
      src={src}
      onError={() => setFailed(true)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
      alt=""
    />
  );
}

export interface LineupOverlayProps {
  matchId?: string;
  teamSide?: string;
}

export default function LineupOverlay(props: LineupOverlayProps = {}) {
  const [, params] = useRoute<{ matchId: string; teamSide: string }>("/broadcast/lineup/:matchId/:teamSide");
  const matchId = props.matchId ?? params?.matchId;
  const teamSide = props.teamSide ?? params?.teamSide;
  const [data, setData] = useState<LineupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId || !teamSide) return;
    let cancelled = false;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");

    const load = async () => {
      try {
        const res = await fetch(`${base}/api/matches/${matchId}/lineup/${teamSide}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setError(body.message || `Failed to load lineup (${res.status})`);
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load lineup");
      }
    };

    load();
    const handle = window.setInterval(load, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [matchId, teamSide]);

  const players = data?.players ?? [];
  const slots: (LineupPlayer | null)[] = [0, 1, 2, 3].map(i => players[i] ?? null);
  const hasAnyPlayer = players.length > 0;
  const teamRgb = hexToRgb(data?.team?.primaryColor ?? null);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      background: "transparent",
    }}>
      <div style={PANEL_STYLE}>
        {/* Header — tournament name only */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}>
            {data?.tournament?.name || "\u00A0"}
          </div>
        </div>

        {/* Team identity row */}
        {data?.team && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            padding: "22px 0 24px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            marginBottom: 24,
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#fff",
              border: "2px solid rgba(255,255,255,0.95)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}>
              <TeamLogoBubble team={data.team} />
            </div>
            <div style={{
              fontSize: 30,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}>
              {data.team.name}
            </div>
            <div style={{
              fontSize: 14,
              fontWeight: 800,
              color: "rgba(255,255,255,0.6)",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              paddingLeft: 12,
              borderLeft: "1px solid rgba(255,255,255,0.15)",
              marginLeft: 4,
            }}>
              {formatTotalHandicap(data.team.totalHandicap)} Goals
            </div>
          </div>
        )}

        {/* Player cards / empty / error */}
        {error && (
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: "rgba(255,200,200,0.85)",
            textAlign: "center",
            padding: "40px 0",
          }}>
            {error}
          </div>
        )}
        {!error && !hasAnyPlayer && (
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 1,
            color: "rgba(255,255,255,0.55)",
            textAlign: "center",
            padding: "40px 0",
          }}>
            No lineup set for this team
          </div>
        )}
        {!error && hasAnyPlayer && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}>
            {slots.map((p, i) => (
              <PlayerCard key={p?.id ?? `slot-${i}`} player={p} teamRgb={teamRgb} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
