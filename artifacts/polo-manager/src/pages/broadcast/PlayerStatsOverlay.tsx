import { useEffect, useState } from "react";
import { useRoute } from "wouter";

interface PlayerStatsResponse {
  tournamentName: string | null;
  player: {
    id: string;
    name: string;
    headshotUrl: string | null;
    teamSide: "home" | "away" | null;
  };
  team: {
    id: string;
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
  } | null;
  match: {
    goals: number;
    shotsOnGoal: number;
    penaltyGoals: number;
    throwInsWon: number;
  };
  tournament: {
    goals: number;
    avgPerMatch: number;
    shotsOnGoal: number;
    conversion: number;
  };
}

// Mirrors PANEL_STYLE in StatsOverlay / MiniStatsOverlay / LineupOverlay so the
// graphics share identical chrome (background gradient, blur, radius, border,
// shadow). Single source of truth visually.
const PANEL_STYLE: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(12,12,16,0.82) 0%, rgba(18,18,24,0.86) 100%)",
  backdropFilter: "blur(24px)",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
  overflow: "hidden",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { first: "", last: parts[0] || "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function formatAvg(value: number): string {
  if (!Number.isFinite(value)) return "0.0";
  return value.toFixed(1);
}

function PlayerHeadshot({ name, src }: { name: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, rgba(60,60,70,0.85) 0%, rgba(28,28,34,0.95) 100%)",
      }}>
        <span style={{
          fontSize: 60,
          fontWeight: 800,
          color: "rgba(255,255,255,0.45)",
          letterSpacing: 2,
        }}>
          {initials(name)}
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
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

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      padding: "10px 14px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.5)",
      }}>
        {label}
      </div>
      <div style={{
        marginTop: 3,
        fontSize: 26,
        fontWeight: 800,
        color: "#fff",
        fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
        lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  );
}

function StatGroup({ title, accent, cells }: {
  title: string;
  accent: string;
  cells: { label: string; value: string | number }[];
}) {
  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "8px 14px",
        background: `linear-gradient(90deg, ${accent}30 0%, transparent 100%)`,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 2.5,
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.85)",
      }}>
        {title}
      </div>
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
      }}>
        {cells.map((c, i) => (
          <div
            key={c.label}
            style={{
              borderRight: i % 2 === 0 ? "1px solid rgba(255,255,255,0.06)" : undefined,
              borderTop: i >= 2 ? "1px solid rgba(255,255,255,0.06)" : undefined,
            }}
          >
            <StatCell label={c.label} value={c.value} />
          </div>
        ))}
      </div>
    </div>
  );
}

export interface PlayerStatsOverlayProps {
  matchId?: string;
  playerId?: string;
}

export default function PlayerStatsOverlay(props: PlayerStatsOverlayProps = {}) {
  const [, params] = useRoute<{ matchId: string; playerId: string }>("/broadcast/player-stats/:matchId/:playerId");
  const matchId = props.matchId ?? params?.matchId;
  const playerId = props.playerId ?? params?.playerId;
  const [data, setData] = useState<PlayerStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId || !playerId) return;
    let cancelled = false;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");

    const load = async () => {
      try {
        const res = await fetch(`${base}/api/matches/${matchId}/player-stats/${playerId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setError(body.message || `Failed to load player stats (${res.status})`);
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load player stats");
      }
    };

    load();
    // Same poll cadence as other broadcast surfaces. SSE pushes updates faster
    // when available, so the interval is the safety-net only.
    const handle = window.setInterval(load, 5_000);

    let es: EventSource | null = null;
    try {
      es = new EventSource(`${base}/api/matches/${matchId}/stream`);
      es.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg?.type === "update" || msg?.type === "event") load();
        } catch {}
      };
    } catch {}

    return () => {
      cancelled = true;
      window.clearInterval(handle);
      if (es) es.close();
    };
  }, [matchId, playerId]);

  if (error) {
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      }}>
        <div style={{ padding: 20, color: "rgba(255,200,200,0.85)" }}>{error}</div>
      </div>
    );
  }
  if (!data) return null;

  const accent = data.team?.primaryColor || "#888";
  const { first, last } = splitName(data.player.name);

  // Lower-third positioned with the same bottom offset as MiniStats so it
  // shares the broadcast safe area.
  return (
    <div style={{
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 36,
      display: "flex",
      justifyContent: "center",
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      <div style={{
        width: 990,
        maxWidth: "95vw",
        ...PANEL_STYLE,
        display: "flex",
        gap: 0,
      }}>
        {/* Headshot panel: 168×220, fixed aspect to keep the graphic stable */}
        <div style={{
          position: "relative",
          width: 168,
          height: 220,
          background: "#0d0d12",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}>
          <PlayerHeadshot name={data.player.name} src={data.player.headshotUrl} />
          <div style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 6,
            background: accent,
          }} />
        </div>

        {/* Right column: identity header + stat groups */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{
            padding: "16px 22px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: `linear-gradient(90deg, ${accent}25 0%, transparent 60%)`,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {first && (
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.55)",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  marginBottom: 2,
                }}>
                  {first}
                </div>
              )}
              <div style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: -0.3,
                lineHeight: 1.05,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {last || data.player.name}
              </div>
              {data.team && (
                <div style={{
                  marginTop: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.7)",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}>
                  {data.team.name}
                  {data.tournamentName ? <span style={{ color: "rgba(255,255,255,0.35)" }}> &middot; {data.tournamentName}</span> : null}
                </div>
              )}
            </div>
          </div>

          <div style={{
            padding: 14,
            display: "flex",
            gap: 12,
            flex: 1,
          }}>
            <StatGroup
              title="This Match"
              accent={accent}
              cells={[
                { label: "Goals", value: data.match.goals },
                { label: "Shots on Goal", value: data.match.shotsOnGoal },
                { label: "Penalty Goals", value: data.match.penaltyGoals },
                { label: "Throw-ins Won", value: data.match.throwInsWon },
              ]}
            />
            <StatGroup
              title="This Tournament"
              accent={accent}
              cells={[
                { label: "Goals", value: data.tournament.goals },
                { label: "Avg / Match", value: formatAvg(data.tournament.avgPerMatch) },
                { label: "Shots on Goal", value: data.tournament.shotsOnGoal },
                { label: "Conversion", value: `${data.tournament.conversion}%` },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
