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

// Mirrors PANEL_STYLE in StatsOverlay.tsx so the two graphics share identical
// chrome (background gradient, blur, radius, border, shadow).
const PANEL_STYLE: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(12,12,16,0.82) 0%, rgba(18,18,24,0.86) 100%)",
  backdropFilter: "blur(24px)",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
  overflow: "hidden",
};

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
  if (handicap === null || handicap === undefined) return "—";
  const n = Number(handicap);
  if (!Number.isFinite(n)) return handicap;
  // Show integers without trailing zeros (e.g. "5"), keep decimals as-is (e.g. "1.5")
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
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, rgba(60,60,70,0.85) 0%, rgba(28,28,34,0.95) 100%)",
        }}
      >
        <span style={{
          fontSize: 64,
          fontWeight: 800,
          color: "rgba(255,255,255,0.7)",
          letterSpacing: 2,
        }}>
          {initials(player.name)}
        </span>
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
        objectPosition: "center 25%",
      }}
    />
  );
}

function PlayerCard({ player, slotNumber }: { player: LineupPlayer | null; slotNumber: number }) {
  if (!player) {
    return (
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px dashed rgba(255,255,255,0.08)",
        borderRadius: 16,
        minHeight: 380,
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

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16,
      overflow: "hidden",
    }}>
      {/* Photo: 4:5 aspect ratio frame */}
      <div style={{
        position: "relative",
        width: "100%",
        aspectRatio: "4 / 5",
        background: "#0d0d12",
        overflow: "hidden",
      }}>
        <PlayerPhoto player={player} />
        {/* Position badge */}
        <div style={{
          position: "absolute",
          top: 12,
          left: 12,
          padding: "5px 11px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.18)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#fff",
        }}>
          No. {slotNumber}
        </div>
        {/* Handicap badge */}
        <div style={{
          position: "absolute",
          top: 12,
          right: 12,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 1,
          padding: "5px 11px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.18)",
        }}>
          <span style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1,
            fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
          }}>
            {formatHandicapValue(player.handicap)}
          </span>
          <span style={{
            fontSize: 8,
            fontWeight: 700,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: 1.5,
          }}>
            GOALS
          </span>
        </div>
      </div>

      {/* Name + meta */}
      <div style={{ padding: "14px 14px 10px" }}>
        {first && (
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 1,
          }}>
            {first}
          </div>
        )}
        <div style={{
          fontSize: 22,
          fontWeight: 800,
          color: "#fff",
          letterSpacing: -0.3,
          lineHeight: 1.05,
        }}>
          {last || player.name}
        </div>
        {metaLine && (
          <div style={{
            marginTop: 7,
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(255,255,255,0.45)",
            letterSpacing: 0.5,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {metaLine}
          </div>
        )}
      </div>

      {/* Stat grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ padding: "10px 14px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)",
          }}>
            Tournament
          </div>
          <div style={{
            marginTop: 2,
            fontSize: 22,
            fontWeight: 800,
            color: "#fff",
            fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
            lineHeight: 1,
          }}>
            {player.tournamentGoals}
          </div>
        </div>
        <div style={{ padding: "10px 14px" }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)",
          }}>
            Avg / Match
          </div>
          <div style={{
            marginTop: 2,
            fontSize: 22,
            fontWeight: 800,
            color: "#fff",
            fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
            lineHeight: 1,
          }}>
            {formatAvg(player.avgGoalsPerMatch)}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamLogoBubble({ team }: { team: LineupTeam }) {
  const [failed, setFailed] = useState(false);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const fallbackText = (team.name?.substring(0, 2) || "?").toUpperCase();

  if (!team.logoUrl || failed) {
    return (
      <span style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{fallbackText}</span>
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
    // Poll on the same cadence other broadcast surfaces use for broadcast data.
    const handle = window.setInterval(load, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [matchId, teamSide]);

  // Pad the player list to exactly 4 slots so the grid never reflows.
  const players = data?.players ?? [];
  const slots: (LineupPlayer | null)[] = [0, 1, 2, 3].map(i => players[i] ?? null);
  const hasAnyPlayer = players.length > 0;

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
      <div style={{
        width: 1280,
        ...PANEL_STYLE,
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "26px 44px 22px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
        }}>
          {data?.tournament?.name && (
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
              marginBottom: 8,
            }}>
              {data.tournament.name}
            </div>
          )}
          <div style={{
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#fff",
          }}>
            Starting Lineup
          </div>
        </div>

        {/* Team identity row */}
        {data?.team && (
          <div style={{
            padding: "20px 44px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              border: "2px solid rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}>
              <TeamLogoBubble team={data.team} />
            </div>
            <div style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: -0.3,
              color: "#fff",
            }}>
              {data.team.name}
            </div>
            <div style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              padding: "8px 18px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}>
              <span style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#fff",
                fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                lineHeight: 1,
              }}>
                {formatTotalHandicap(data.team.totalHandicap)}
              </span>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.55)",
                letterSpacing: 2,
              }}>
                GOALS
              </span>
            </div>
          </div>
        )}

        {/* Player cards or empty state */}
        <div style={{ padding: "26px 44px 36px" }}>
          {error && (
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              color: "rgba(255,200,200,0.85)",
              textAlign: "center",
              padding: "60px 0",
            }}>
              {error}
            </div>
          )}
          {!error && !hasAnyPlayer && (
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 1,
              color: "rgba(255,255,255,0.55)",
              textAlign: "center",
              padding: "60px 0",
            }}>
              No lineup set for this team
            </div>
          )}
          {!error && hasAnyPlayer && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 18,
            }}>
              {slots.map((p, i) => (
                <PlayerCard key={p?.id ?? `slot-${i}`} player={p} slotNumber={i + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
