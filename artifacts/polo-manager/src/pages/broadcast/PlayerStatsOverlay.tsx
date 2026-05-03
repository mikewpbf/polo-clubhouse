import { useEffect, useState } from "react";
import { useRoute } from "wouter";

interface PlayerStatsResponse {
  tournamentName: string | null;
  player: {
    id: string;
    name: string;
    headshotUrl: string | null;
    broadcastImageUrl: string | null;
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
  tournamentRanks?: {
    goalsRank: number | null;
    goalsLeaders: number;
    shotsRank: number | null;
    shotsLeaders: number;
  };
}

const PANEL_STYLE: React.CSSProperties = {
  position: "relative",
  width: 990,
  background: "linear-gradient(180deg, rgba(12,12,16,0.82) 0%, rgba(18,18,24,0.86) 100%)",
  borderRadius: 16,
  boxShadow: "0 12px 36px rgba(0,0,0,0.45)",
  overflow: "visible",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatAvg(value: number): string {
  if (!Number.isFinite(value)) return "0.0";
  return value.toFixed(1);
}

function PlayerHeadshot({ name, broadcastSrc, headshotSrc }: {
  name: string;
  broadcastSrc: string | null;
  headshotSrc: string | null;
}) {
  // Prefer the broadcast (AUX) cutout, fall back to the public headshot, then
  // initials. Mirrors the fallback chain used by the lineup card.
  const initialStage: "primary" | "fallback" | "initials" = broadcastSrc
    ? "primary"
    : headshotSrc
    ? "fallback"
    : "initials";
  const [stage, setStage] = useState<"primary" | "fallback" | "initials">(initialStage);
  const [src, setSrc] = useState<string | null>(broadcastSrc || headshotSrc);

  if (stage === "initials" || !src) {
    return (
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.45)",
        fontSize: 60,
        fontWeight: 800,
        letterSpacing: 3,
      }}>
        {initials(name)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => {
        if (stage === "primary" && headshotSrc) {
          setSrc(headshotSrc);
          setStage("fallback");
        } else {
          setSrc(null);
          setStage("initials");
        }
      }}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  );
}

function TeamLogoBubble({ name, src }: { name: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const fallback = (name.substring(0, 3) || "?").toUpperCase();

  if (!src || failed) {
    return <span>{fallback}</span>;
  }
  const url = src.startsWith("http") ? src : `${base}${src}`;
  return (
    <img
      src={url}
      onError={() => setFailed(true)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
      alt=""
    />
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      gap: 3,
    }}>
      <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
        {value}
      </span>
      <span style={{
        fontSize: 8,
        fontWeight: 700,
        color: "rgba(255,255,255,0.45)",
        letterSpacing: 0.8,
        textTransform: "uppercase",
        lineHeight: 1.2,
        maxWidth: 64,
      }}>
        {label}
      </span>
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
      <div style={PANEL_STYLE}>
        {/* Headshot pops above the top edge of the panel */}
        <div style={{
          position: "absolute",
          left: 24,
          bottom: 16,
          width: 168,
          height: 220,
          borderRadius: 14,
          background: "linear-gradient(180deg, #4a4a4e 0%, #34343a 100%)",
          overflow: "hidden",
          boxShadow: "0 10px 24px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.06)",
          zIndex: 2,
        }}>
          <PlayerHeadshot
            name={data.player.name}
            broadcastSrc={data.player.broadcastImageUrl}
            headshotSrc={data.player.headshotUrl}
          />
          {/* Bottom legibility gradient */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.55) 100%)",
            pointerEvents: "none",
          }} />
        </div>

        {/* Header strip */}
        <div style={{
          background: "rgba(0,0,0,0.25)",
          borderRadius: "16px 16px 0 0",
          padding: "12px 28px",
          textAlign: "center",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: 2.5,
            textTransform: "uppercase",
          }}>
            {data.tournamentName && (
              <>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>{data.tournamentName}</span>
                <span style={{ margin: "0 10px", color: "rgba(255,255,255,0.35)" }}>·</span>
              </>
            )}
            <span>Player Stats</span>
          </span>
        </div>

        {/* Body: 200px placeholder column for the popped headshot, then identity + stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "200px 1fr",
          alignItems: "stretch",
          minHeight: 168,
        }}>
          <div />

          <div style={{
            display: "grid",
            gridTemplateRows: "auto 1fr",
            padding: "14px 28px 16px 24px",
          }}>
            {/* Identity row: name + team only */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              paddingBottom: 10,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              marginBottom: 12,
            }}>
              <span style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#fff",
                textTransform: "uppercase",
                letterSpacing: 0.8,
                lineHeight: 1,
              }}>
                {data.player.name}
              </span>
              {data.team && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginLeft: "auto",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#fff",
                    color: "#2a2a2e",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 800,
                    overflow: "hidden",
                    flexShrink: 0,
                  }}>
                    <TeamLogoBubble name={data.team.name} src={data.team.logoUrl} />
                  </div>
                  <span>{data.team.name}</span>
                </div>
              )}
            </div>

            {/* Stats row: two equal groups separated by hairline divider */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 28,
            }}>
              <div style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}>
                <div style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.4)",
                  letterSpacing: 1.8,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}>
                  This Match
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 6,
                }}>
                  <StatCell label="Goals" value={data.match.goals} />
                  <StatCell label="Shots on Goal" value={data.match.shotsOnGoal} />
                  <StatCell label="Penalty Goals" value={data.match.penaltyGoals} />
                  <StatCell label="Throw-ins Won" value={data.match.throwInsWon} />
                </div>
                {/* Vertical hairline divider to right of left group */}
                <div style={{
                  position: "absolute",
                  top: 4,
                  bottom: 4,
                  right: -14,
                  width: 1,
                  background: "rgba(255,255,255,0.08)",
                }} />
              </div>

              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}>
                <div style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.4)",
                  letterSpacing: 1.8,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}>
                  This Tournament
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 6,
                }}>
                  <StatCell label="Goals" value={data.tournament.goals} />
                  <StatCell label="Avg per Match" value={formatAvg(data.tournament.avgPerMatch)} />
                  <StatCell label="Shots on Goal" value={data.tournament.shotsOnGoal} />
                  <StatCell label="Conversion" value={`${Math.round(data.tournament.conversion)}%`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
