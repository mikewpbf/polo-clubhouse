import { useState } from "react";

interface BroadcastTeam {
  name: string;
  shortName?: string;
  scoreboardName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

interface StatData {
  home: Record<string, number>;
  away: Record<string, number>;
}

interface PossessionData {
  homePercent: number;
  awayPercent: number;
  homeSeconds: number;
  awaySeconds: number;
}

interface MiniStatsOverlayProps {
  homeTeam: BroadcastTeam | null;
  awayTeam: BroadcastTeam | null;
  homeScore: number;
  awayScore: number;
  stats: StatData | null;
  possession?: PossessionData | null;
  tournament?: { name: string; chukkersPerMatch: number } | null;
}

function teamColor(team: BroadcastTeam | null, fallback: string): string {
  return team?.primaryColor || fallback;
}

function teamName(team: BroadcastTeam | null): string {
  if (!team) return "TBD";
  return team.scoreboardName || team.name || "TBD";
}

function teamShort(team: BroadcastTeam | null): string {
  if (!team) return "?";
  return (team.shortName || team.name?.substring(0, 3) || "?").toUpperCase();
}

function TeamLogo({ team, size = 44 }: { team: BroadcastTeam | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const fallbackText = teamShort(team);

  if (!team?.logoUrl || failed) {
    return <span style={{ fontSize: size * 0.38, fontWeight: 800, color: "#fff" }}>{fallbackText}</span>;
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

const PANEL_STYLE: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(12,12,16,0.82) 0%, rgba(18,18,24,0.86) 100%)",
  backdropFilter: "blur(24px)",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
  overflow: "hidden",
};

const STAT_COLS: { key: string; label: string }[] = [
  { key: "goal", label: "Goals" },
  { key: "foul", label: "Fouls" },
  { key: "bowl_in", label: "Bowl Ins" },
  { key: "knock_in", label: "Knock Ins" },
  { key: "penalty_goal", label: "Pen. Goals" },
  { key: "shot_on_goal", label: "Shots" },
  { key: "shot_accuracy", label: "Conversion" },
];

function shotAccuracyDisplay(side: Record<string, number> | undefined): string {
  const shots = side?.shot_on_goal ?? 0;
  if (shots === 0) return "—";
  const goals = (side?.goal ?? 0) + (side?.penalty_goal ?? 0);
  return `${Math.round((goals / shots) * 100)}%`;
}

export function MiniStatsOverlay({ homeTeam, awayTeam, homeScore, awayScore, stats, possession, tournament }: MiniStatsOverlayProps) {
  const hColor = teamColor(homeTeam, "#1B5E20");
  const aColor = teamColor(awayTeam, "#6A1B1A");

  const teamColWidth = 320;
  const statColWidth = 130;
  const panelWidth = teamColWidth + STAT_COLS.length * statColWidth + 80;
  const gridTemplate = `${teamColWidth}px repeat(${STAT_COLS.length}, minmax(0, 1fr))`;

  const renderTeamRow = (team: BroadcastTeam | null, color: string, side: "home" | "away") => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: gridTemplate,
        alignItems: "center",
        padding: "14px 0",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, paddingLeft: 38 }}>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
          }}
        />
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${color}40, ${color}20)`,
            border: `2px solid ${color}60`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <TeamLogo team={team} size={44} />
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: -0.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {teamName(team)}
        </div>
      </div>
      {STAT_COLS.map((col) => {
        const sideStats = side === "home" ? stats?.home : stats?.away;
        const val: string | number =
          col.key === "shot_accuracy"
            ? shotAccuracyDisplay(sideStats)
            // Use the actual stored score for Goals — authoritative value from
            // the match record, same source as the scorebug.
            : col.key === "goal"
              ? (side === "home" ? homeScore : awayScore)
              : (sideStats?.[col.key] ?? 0);
        return (
          <div
            key={col.key}
            style={{
              textAlign: "center",
              fontSize: 30,
              fontWeight: 700,
              color: "#fff",
              fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
            }}
          >
            {val}
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 36,
        display: "flex",
        justifyContent: "center",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: panelWidth,
          maxWidth: "95vw",
          ...PANEL_STYLE,
        }}
      >
        <div
          style={{
            background: "linear-gradient(90deg, " + hColor + "20 0%, transparent 30%, transparent 70%, " + aColor + "20 100%)",
            padding: "14px 38px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 3.5,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            {tournament?.name ? `${tournament.name} \u00B7 Match Stats` : "Match Stats"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: gridTemplate,
            alignItems: "center",
            padding: "12px 0",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 2.5,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
              paddingLeft: 38,
            }}
          >
            Team
          </div>
          {STAT_COLS.map((col) => (
            <div
              key={col.key}
              style={{
                textAlign: "center",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 2.5,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              {col.label}
            </div>
          ))}
        </div>

        {renderTeamRow(homeTeam, hColor, "home")}
        {renderTeamRow(awayTeam, aColor, "away")}

        {possession && (
          <div
            style={{
              padding: "14px 38px 18px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: hColor,
                  fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                  textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                }}
              >
                {possession.homePercent}%
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 3.5,
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.65)",
                }}
              >
                Possession
              </span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: aColor,
                  fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                  textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                }}
              >
                {possession.awayPercent}%
              </span>
            </div>
            <div
              style={{
                display: "flex",
                height: 8,
                borderRadius: 4,
                overflow: "hidden",
                width: "100%",
                gap: 3,
              }}
            >
              {(() => {
                const total = possession.homeSeconds + possession.awaySeconds;
                if (total === 0) {
                  return (
                    <div
                      style={{
                        height: 8,
                        borderRadius: 4,
                        background: "rgba(255,255,255,0.15)",
                        width: "100%",
                      }}
                    />
                  );
                }
                const homePct = (possession.homeSeconds / total) * 100;
                return (
                  <>
                    <div
                      style={{
                        width: `${homePct}%`,
                        background: hColor,
                        borderRadius: 4,
                        transition: "width 0.6s ease",
                        minWidth: possession.homeSeconds > 0 ? 8 : 0,
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        background: aColor,
                        borderRadius: 4,
                        transition: "width 0.6s ease",
                        minWidth: possession.awaySeconds > 0 ? 8 : 0,
                      }}
                    />
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
