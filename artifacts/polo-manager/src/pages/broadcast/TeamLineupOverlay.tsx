import { useState } from "react";

interface BroadcastTeam {
  name: string;
  shortName?: string;
  scoreboardName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

interface RosterPlayer {
  id: string;
  name: string;
  handicap: string | null;
  broadcastImageUrl: string | null;
  headshotUrl: string | null;
  homeClubName: string | null;
  matchGoals: number;
}

interface TeamLineupOverlayProps {
  homeTeam: BroadcastTeam | null;
  awayTeam: BroadcastTeam | null;
  homeRoster: RosterPlayer[];
  awayRoster: RosterPlayer[];
  tournament?: { name: string; logoUrl?: string | null } | null;
}

function teamColor(team: BroadcastTeam | null, fallback: string): string {
  return team?.primaryColor || fallback;
}

function PlayerImage({ player, size = 96 }: { player: RosterPlayer; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = player.broadcastImageUrl || player.headshotUrl;
  if (!src || failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          background: "rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.6)",
          fontWeight: 700,
          fontSize: size * 0.35,
          flexShrink: 0,
        }}
      >
        {player.name
          .split(/\s+/)
          .map((p) => p[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={player.name}
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        objectFit: "cover",
        flexShrink: 0,
        background: "rgba(255,255,255,0.06)",
      }}
    />
  );
}

function TeamLogo({ team, size = 64 }: { team: BroadcastTeam | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!team?.logoUrl || failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 800,
          fontSize: size * 0.36,
        }}
      >
        {(team?.shortName || team?.name || "?").slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={team.logoUrl}
      alt={team.name}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
    />
  );
}

function PlayerRow({ player }: { player: RosterPlayer }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 12px",
        background: "rgba(255,255,255,0.06)",
        borderRadius: 10,
      }}
    >
      <PlayerImage player={player} size={72} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "Syne, sans-serif",
            fontWeight: 700,
            fontSize: 22,
            color: "#fff",
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {player.name}
        </div>
        {player.homeClubName && (
          <div
            style={{
              fontFamily: "Instrument Sans, sans-serif",
              fontSize: 13,
              color: "rgba(255,255,255,0.7)",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {player.homeClubName}
          </div>
        )}
      </div>
      <div
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 500,
          fontSize: 18,
          color: "#fff",
          background: "rgba(0,0,0,0.35)",
          padding: "4px 10px",
          borderRadius: 6,
          minWidth: 44,
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {player.handicap ?? "—"}
      </div>
    </div>
  );
}

function TeamColumn({
  team,
  roster,
  align,
}: {
  team: BroadcastTeam | null;
  roster: RosterPlayer[];
  align: "left" | "right";
}) {
  const color = teamColor(team, "#1B5E20");
  return (
    <div
      style={{
        flex: 1,
        background: `linear-gradient(${align === "left" ? "135deg" : "225deg"}, ${color} 0%, rgba(0,0,0,0.85) 70%)`,
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexDirection: align === "left" ? "row" : "row-reverse" }}>
        <TeamLogo team={team} size={72} />
        <div style={{ flex: 1, textAlign: align }}>
          <div
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: 30,
              color: "#fff",
              lineHeight: 1.05,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {team?.name || "—"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {roster.length === 0 ? (
          <div
            style={{
              fontFamily: "Instrument Sans, sans-serif",
              fontSize: 14,
              color: "rgba(255,255,255,0.6)",
              padding: "16px 12px",
              textAlign: "center",
            }}
          >
            No active roster for current season.
          </div>
        ) : (
          roster.map((p) => <PlayerRow key={p.id} player={p} />)
        )}
      </div>
    </div>
  );
}

export function TeamLineupOverlay({
  homeTeam,
  awayTeam,
  homeRoster,
  awayRoster,
  tournament,
}: TeamLineupOverlayProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: 92,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          background: "rgba(0,0,0,0.55)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "0 24px",
        }}
      >
        {tournament?.logoUrl && (
          <img
            src={tournament.logoUrl}
            alt={tournament.name}
            style={{ height: 64, width: 64, objectFit: "contain" }}
          />
        )}
        <div
          style={{
            fontFamily: "Syne, sans-serif",
            fontWeight: 800,
            fontSize: 28,
            color: "#fff",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          {tournament?.name || "Lineup"}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex" }}>
        <TeamColumn team={homeTeam} roster={homeRoster} align="left" />
        <TeamColumn team={awayTeam} roster={awayRoster} align="right" />
      </div>
    </div>
  );
}
