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

interface TopScorer {
  name: string;
  goals: number;
  teamSide: "home" | "away";
}

interface PossessionData {
  homePercent: number;
  awayPercent: number;
  homeSeconds: number;
  awaySeconds: number;
}

interface StatsOverlayProps {
  homeTeam: BroadcastTeam | null;
  awayTeam: BroadcastTeam | null;
  homeScore: number;
  awayScore: number;
  stats: StatData | null;
  topScorers?: TopScorer[];
  possession?: PossessionData | null;
  tournament?: { name: string; chukkersPerMatch: number } | null;
}

function teamColor(team: BroadcastTeam | null, fallback: string): string {
  return team?.primaryColor || fallback;
}

function TeamLogo({ team, size = 52 }: { team: BroadcastTeam | null; size?: number }) {
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

function teamName(team: BroadcastTeam | null): string {
  if (!team) return "TBD";
  return team.scoreboardName || team.name || "TBD";
}

function teamShort(team: BroadcastTeam | null): string {
  if (!team) return "?";
  return (team.shortName || team.name?.substring(0, 3) || "?").toUpperCase();
}

const STAT_ROWS: { key: string; label: string }[] = [
  { key: "goal", label: "Goals" },
  { key: "shot_on_goal", label: "Shots on Goal" },
  { key: "penalty_goal", label: "Penalty Goals" },
  { key: "foul", label: "Fouls Committed" },
  { key: "bowl_in", label: "Bowl-Ins Won" },
  { key: "knock_in", label: "Knock-Ins" },
];

function shotAccuracyPct(side: Record<string, number> | undefined): number | null {
  const shots = side?.shot_on_goal ?? 0;
  if (shots === 0) return null;
  const goals = (side?.goal ?? 0) + (side?.penalty_goal ?? 0);
  return Math.round((goals / shots) * 100);
}

function formatAccuracy(pct: number | null): string {
  return pct === null ? "—" : `${pct}%`;
}

function StatBar({ homeStat, awayStat, homeColor, awayColor }: { homeStat: number; awayStat: number; homeColor: string; awayColor: string }) {
  const total = homeStat + awayStat;
  if (total === 0) return <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.15)", width: "100%" }} />;
  const homePct = (homeStat / total) * 100;
  return (
    <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", width: "100%", gap: 3 }}>
      <div style={{ width: `${homePct}%`, background: homeColor, borderRadius: 4, transition: "width 0.6s ease", minWidth: homeStat > 0 ? 8 : 0 }} />
      <div style={{ flex: 1, background: awayColor, borderRadius: 4, transition: "width 0.6s ease", minWidth: awayStat > 0 ? 8 : 0 }} />
    </div>
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

export function StatsOverlay({ homeTeam, awayTeam, homeScore, awayScore, stats, topScorers, possession, tournament }: StatsOverlayProps) {
  const hColor = teamColor(homeTeam, "#1B5E20");
  const aColor = teamColor(awayTeam, "#6A1B1A");

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    }}>
      <div style={{
        width: 1030,
        ...PANEL_STYLE,
        display: "flex",
        flexDirection: "column" as const,
      }}>
        <div style={{
          background: "linear-gradient(90deg, " + hColor + "20 0%, transparent 30%, transparent 70%, " + aColor + "20 100%)",
          padding: "20px 38px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}>
          {tournament?.name && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: "#fff", textAlign: "center" }}>
                {tournament.name}
              </span>
            </div>
          )}

          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 4,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 3.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
              Match Stats
            </span>
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, flex: 1 }}>
              <div style={{
                width: 68, height: 68, borderRadius: "50%",
                background: `linear-gradient(135deg, ${hColor}40, ${hColor}20)`,
                border: `2px solid ${hColor}60`,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                <TeamLogo team={homeTeam} size={68} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", letterSpacing: -0.3 }}>{teamName(homeTeam)}</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 18, flex: 1, justifyContent: "flex-end", textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", letterSpacing: -0.3 }}>{teamName(awayTeam)}</div>
              <div style={{
                width: 68, height: 68, borderRadius: "50%",
                background: `linear-gradient(135deg, ${aColor}40, ${aColor}20)`,
                border: `2px solid ${aColor}60`,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                <TeamLogo team={awayTeam} size={68} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 38px 24px", flexShrink: 0 }}>
          {(() => {
            const allRows: { key: string; label: string; hVal: number | string; aVal: number | string; hBar: number; aBar: number }[] = [];
            for (const row of STAT_ROWS) {
              // Use the actual stored score for Goals — it is the authoritative
              // value from the match record, identical to what the scorebug shows.
              const hVal = row.key === "goal" ? homeScore : (stats?.home?.[row.key] ?? 0);
              const aVal = row.key === "goal" ? awayScore : (stats?.away?.[row.key] ?? 0);
              allRows.push({ key: row.key, label: row.label, hVal, aVal, hBar: Number(hVal), aBar: Number(aVal) });
              if (row.key === "shot_on_goal") {
                const hAcc = shotAccuracyPct(stats?.home);
                const aAcc = shotAccuracyPct(stats?.away);
                allRows.push({
                  key: "shot_accuracy",
                  label: "Conversion",
                  hVal: formatAccuracy(hAcc),
                  aVal: formatAccuracy(aAcc),
                  hBar: hAcc ?? 0,
                  aBar: aAcc ?? 0,
                });
                if (possession) {
                  allRows.push({
                    key: "possession",
                    label: "Possession",
                    hVal: `${possession.homePercent}%`,
                    aVal: `${possession.awayPercent}%`,
                    hBar: possession.homeSeconds,
                    aBar: possession.awaySeconds,
                  });
                }
              }
            }
            return allRows.map((row, i) => (
              <div key={row.key} style={{
                display: "flex",
                alignItems: "center",
                padding: "11px 0",
                borderBottom: i < allRows.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}>
                <div style={{
                  width: 62, textAlign: "center",
                  fontSize: 28, fontWeight: 700, color: "#fff",
                  fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                }}>{row.hVal}</div>
                <div style={{ flex: 1, padding: "0 20px" }}>
                  <div style={{
                    fontSize: 15, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase",
                    color: "#fff", textAlign: "center", marginBottom: 6,
                  }}>{row.label}</div>
                  <StatBar homeStat={row.hBar} awayStat={row.aBar} homeColor={hColor} awayColor={aColor} />
                </div>
                <div style={{
                  width: 62, textAlign: "center",
                  fontSize: 28, fontWeight: 700, color: "#fff",
                  fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                }}>{row.aVal}</div>
              </div>
            ));
          })()}
        </div>
      </div>

      {topScorers && topScorers.length > 0 && (
        <div style={{
          width: 1030,
          boxSizing: "border-box",
          ...PANEL_STYLE,
          padding: "12px 38px 14px",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 3.5, textTransform: "uppercase", color: "#fff" }}>
              Top Scorers
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {topScorers.slice(0, 2).map((scorer, i) => {
              const color = scorer.teamSide === "home" ? hColor : aColor;
              const team = scorer.teamSide === "home" ? homeTeam : awayTeam;
              const tName = teamName(team);
              return (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 0",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: `${color}30`,
                      border: `2px solid ${color}50`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: "#fff",
                    }}>
                      {i + 1}
                    </div>
                    <span style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: 0.3 }}>{scorer.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>{tName}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{
                      fontSize: 24, fontWeight: 800, color: "#fff",
                      fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                    }}>{scorer.goals}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>GOAL{scorer.goals !== 1 ? "S" : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
