import { EventSeal, FrameWrapper, JerseyGraphic, JumboData, JumboTeam, onColor, pastel, SUN_CUP_DATA } from "./_shared";

// Variant — Pavilion Stack.
// Same elegant aesthetic as Pavilion (pastel halves, thin black center line,
// championship seal dead-center, chunky chukker pill on top, clock pill on
// bottom) but each team cell is a clean vertical stack: small team logo at
// the top, jersey in the middle, and the score number rendered LARGE in
// black as the dominant element below. Team name sits in a thin caption
// strip above the jersey.

function TeamHalf({ team, score, side }: { team: JumboTeam; score: number; side: "left" | "right" }) {
  return (
    <div style={{
      flex: 1,
      background: pastel(team.primaryColor),
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6cqh 3cqw 3cqh",
      position: "relative",
    }}>
      {/* Team logo top */}
      <div style={{
        width: "11cqh",
        height: "11cqh",
        borderRadius: "50%",
        background: team.primaryColor,
        border: "0.4cqh solid rgba(0,0,0,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: onColor(team.primaryColor).text,
        fontWeight: 900,
        fontSize: "5cqh",
        letterSpacing: "0.3cqh",
        boxShadow: "0 0.6cqh 1.2cqh rgba(0,0,0,0.18)",
      }}>
        {team.logoText}
      </div>

      {/* Team name caption */}
      <div style={{
        fontSize: "2.6cqh",
        fontWeight: 800,
        color: "rgba(0,0,0,0.65)",
        letterSpacing: "0.6cqh",
        textTransform: "uppercase",
        textAlign: "center",
        marginTop: "-2cqh",
      }}>
        {team.name}
      </div>

      {/* Jersey */}
      <JerseyGraphic team={team} sizeCqh={32} />

      {/* Score number — dominant, low on the panel */}
      <div style={{
        fontFamily: "'JetBrains Mono','SF Mono',monospace",
        fontSize: "26cqh",
        fontWeight: 900,
        color: "#0a0a0a",
        lineHeight: 0.85,
        letterSpacing: "-0.04em",
        textShadow: "0 2px 0 rgba(255,255,255,0.4)",
      }}>
        {score}
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
    }}>
      {/* Chukker pill at top */}
      <div style={{
        position: "absolute",
        top: 0,
        left: "50%",
        transform: "translate(-50%, -2cqh)",
        background: "#0a0a0a",
        color: "#fff",
        borderRadius: "0 0 1.4cqh 1.4cqh",
        padding: "1.4cqh 3cqw 1.6cqh",
        textAlign: "center",
        boxShadow: "0 1cqh 2cqh rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.3cqh",
        minWidth: "11cqw",
      }}>
        <span style={{
          fontSize: "1.7cqh",
          fontWeight: 700,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.6cqh",
          textTransform: "uppercase",
        }}>
          Chukker
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: "11cqh",
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: "-0.04em",
        }}>
          {data.chukker}
          <span style={{ fontSize: "3.4cqh", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginLeft: "0.3cqw" }}>
            /{data.totalChukkers}
          </span>
        </span>
      </div>

      {/* Seal dead-center */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}>
        <EventSeal data={data} sizeCqh={26} />
      </div>

      {/* Clock at bottom */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: "50%",
        transform: "translate(-50%, 2cqh)",
        background: "#0a0a0a",
        color: data.clockRunning ? "#fff" : "#ef4444",
        borderRadius: "1.4cqh 1.4cqh 0 0",
        padding: "1.4cqh 3cqw",
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

export default function VariantPavilionStack() {
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
        <TeamHalf team={data.home} score={data.homeScore} side="left" />
        <TeamHalf team={data.away} score={data.awayScore} side="right" />
        <CenterSpine data={data} />
      </div>
    </FrameWrapper>
  );
}
