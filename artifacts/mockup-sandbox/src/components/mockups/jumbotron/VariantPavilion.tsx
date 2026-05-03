import { EventSeal, FrameWrapper, JerseyGraphic, JumboData, JumboTeam, onColor, pastel, SUN_CUP_DATA } from "./_shared";

// Variant — Pavilion.
// Closely matches the Aspen / Singular reference: muted pastel team halves,
// a thin black vertical divider line, the championship seal dead-center on
// the line, the team name dominant on each panel, and small dark pills for
// score (top) and clock (bottom) sitting on the line. The chukker pill is
// chunkier than the reference per the user's note. Each team cell adds the
// stacked jersey graphic between the logo and the score pill so you see the
// team's identity at a glance from the stands.

function ScorePill({ score, side }: { score: number; side: "left" | "right" }) {
  return (
    <div style={{
      position: "absolute",
      top: 0,
      [side === "left" ? "right" : "left"]: "8cqw",
      transform: "translateY(-2cqh)",
      background: "#0a0a0a",
      color: "#fff",
      borderRadius: "0 0 1.4cqh 1.4cqh",
      padding: "1.6cqh 3.4cqw 1.4cqh",
      minWidth: "8cqw",
      textAlign: "center",
      fontFamily: "'JetBrains Mono','SF Mono',monospace",
      fontSize: "11cqh",
      fontWeight: 900,
      lineHeight: 1,
      letterSpacing: "-0.04em",
      boxShadow: "0 1cqh 2cqh rgba(0,0,0,0.35)",
      zIndex: 10,
    }}>
      {score}
    </div>
  );
}

function TeamHalf({ team, side }: { team: JumboTeam; side: "left" | "right" }) {
  return (
    <div style={{
      flex: 1,
      background: pastel(team.primaryColor),
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8cqh 2cqw 5cqh",
      position: "relative",
    }}>
      {/* Team logo */}
      <div style={{
        width: "13cqh",
        height: "13cqh",
        borderRadius: "50%",
        background: team.primaryColor,
        border: "0.4cqh solid rgba(0,0,0,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: onColor(team.primaryColor).text,
        fontWeight: 900,
        fontSize: "5.5cqh",
        letterSpacing: "0.3cqh",
        boxShadow: "0 0.6cqh 1.4cqh rgba(0,0,0,0.18)",
      }}>
        {team.logoText}
      </div>

      {/* Jersey */}
      <JerseyGraphic team={team} sizeCqh={36} />

      {/* Team name dominant at the bottom */}
      <div style={{
        fontSize: "6.4cqh",
        fontWeight: 900,
        color: "#0a0a0a",
        letterSpacing: "0.2cqh",
        textTransform: "uppercase",
        textAlign: "center",
        lineHeight: 1,
        textShadow: "0 1px 0 rgba(255,255,255,0.4)",
      }}>
        {team.name}
      </div>
    </div>
  );
}

function CenterSpine({ data }: { data: JumboData }) {
  return (
    <div style={{
      position: "absolute",
      top: 0,
      bottom: 0,
      left: "50%",
      transform: "translateX(-50%)",
      width: "0.5cqh",
      background: "#0a0a0a",
      zIndex: 5,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      {/* Chukker pill — chunky, sits at very top */}
      <div style={{
        position: "absolute",
        top: 0,
        left: "50%",
        transform: "translate(-50%, -2cqh)",
        background: "#0a0a0a",
        color: "#fff",
        borderRadius: "0 0 1.4cqh 1.4cqh",
        padding: "1.4cqh 2.6cqw 1.6cqh",
        textAlign: "center",
        boxShadow: "0 1cqh 2cqh rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.2cqh",
        minWidth: "10cqw",
      }}>
        <span style={{
          fontSize: "1.6cqh",
          fontWeight: 700,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.5cqh",
          textTransform: "uppercase",
        }}>
          Chukker
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: "9cqh",
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: "-0.03em",
        }}>
          {data.chukker}
          <span style={{ fontSize: "3cqh", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginLeft: "0.3cqw" }}>
            /{data.totalChukkers}
          </span>
        </span>
      </div>

      {/* Seal dead-center on the line */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}>
        <EventSeal data={data} sizeCqh={28} />
      </div>

      {/* Clock pill at bottom */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: "50%",
        transform: "translate(-50%, 2cqh)",
        background: "#0a0a0a",
        color: data.clockRunning ? "#fff" : "#ef4444",
        borderRadius: "1.4cqh 1.4cqh 0 0",
        padding: "1.4cqh 3cqw 1.4cqh",
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: "8cqh",
        fontWeight: 900,
        lineHeight: 1,
        letterSpacing: "0.1cqh",
        boxShadow: "0 -1cqh 2cqh rgba(0,0,0,0.35)",
      }}>
        {data.clock}
      </div>
    </div>
  );
}

export default function VariantPavilion() {
  const data = SUN_CUP_DATA;
  return (
    <FrameWrapper bg="#000">
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "row",
        fontFamily: "'Inter','Helvetica Neue',sans-serif",
      }}>
        <TeamHalf team={data.home} side="left" />
        <TeamHalf team={data.away} side="right" />
        <CenterSpine data={data} />
        {/* Score pills overlap the panels, anchored near the top center */}
        <ScorePill score={data.homeScore} side="left" />
        <ScorePill score={data.awayScore} side="right" />
      </div>
    </FrameWrapper>
  );
}
