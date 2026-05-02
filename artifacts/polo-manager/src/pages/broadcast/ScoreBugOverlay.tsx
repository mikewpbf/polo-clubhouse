import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { StatsOverlay } from "./StatsOverlay";
import { MiniStatsOverlay } from "./MiniStatsOverlay";
import { FieldBugOverlay } from "./FieldBugOverlay";
import LineupOverlay from "./LineupOverlay";
import { getOnColorTheme, themed } from "../../lib/colorContrast";

interface BroadcastTeam {
  name: string;
  shortName?: string;
  scoreboardName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

interface StoppageEvent {
  eventType: string;
  description: string | null;
  playerName: string | null;
  teamSide: string | null;
  timestamp: string;
}

interface BroadcastData {
  id: string;
  status: string;
  homeScore: number;
  awayScore: number;
  currentChukker: number;
  clockStartedAt: string | null;
  clockElapsedSeconds: number;
  clockIsRunning: boolean;
  serverNow?: string;
  broadcastVisible: boolean;
  broadcastStyle: string;
  broadcastResolution?: string;
  broadcast4kScale?: number;
  broadcast4kOffsetX?: number;
  broadcast4kOffsetY?: number;
  lastGoalScorerName: string | null;
  lastGoalTeamSide: string | null;
  lastGoalTimestamp: string | null;
  lastStoppageEvent: StoppageEvent | null;
  homeTeam: BroadcastTeam | null;
  awayTeam: BroadcastTeam | null;
  tournament: { name: string; chukkersPerMatch: number } | null;
  club?: { name: string; logoUrl?: string | null } | null;
  field?: { id: string; name: string | null; number: number | null; imageUrl: string | null; hasLocation: boolean } | null;
  stats?: { home: Record<string, number>; away: Record<string, number> };
  topScorers?: { name: string; goals: number; teamSide: "home" | "away" }[];
  possession?: { homePercent: number; awayPercent: number; homeSeconds: number; awaySeconds: number } | null;
  scoringLocation?: string;
  broadcastOffsetSeconds?: number;
}

interface GoalAlert {
  playerName: string;
  teamSide: string;
  color: string;
  id: number;
}

const CHUKKER_DURATION = 450;
const NEAR_BLACK = "rgba(0, 0, 0, 0.85)";
const TITLE_BAR_HEIGHT = 28;

function useClockDisplay(data: BroadcastData | null) {
  const [display, setDisplay] = useState("7:30");
  const [remaining, setRemaining] = useState(CHUKKER_DURATION);
  // Refs track the elapsed-at-poll (server-side) and the client time when the
  // poll was received. Together they let the 1-second interval add purely
  // client-side delta, eliminating any clock skew between the OBS machine and
  // the production server.
  const elapsedAtPollRef = useRef<number>(0);
  const clientTimeAtPollRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!data) return;

    // Compute elapsed on the SERVER at the moment it generated this response.
    // serverNow and clockStartedAt are both server timestamps, so their
    // difference is skew-free.
    let elapsedAtPoll = data.clockElapsedSeconds || 0;
    if (data.clockIsRunning && data.clockStartedAt) {
      const serverNowMs = data.serverNow
        ? new Date(data.serverNow).getTime()
        : new Date(data.clockStartedAt).getTime(); // safe fallback
      elapsedAtPoll += (serverNowMs - new Date(data.clockStartedAt).getTime()) / 1000;
    }
    elapsedAtPollRef.current = elapsedAtPoll;
    clientTimeAtPollRef.current = Date.now();

    const compute = () => {
      let elapsed = elapsedAtPollRef.current;
      if (data.clockIsRunning) {
        // Add client-side delta since this poll — no cross-machine skew.
        elapsed += (Date.now() - clientTimeAtPollRef.current) / 1000;
      }
      const rem = Math.max(0, CHUKKER_DURATION - Math.floor(elapsed));
      setRemaining(rem);
      const m = Math.floor(rem / 60);
      const s = rem % 60;
      setDisplay(`${m}:${String(s).padStart(2, "0")}`);
    };
    compute();
    if (!data.clockIsRunning) return;
    const iv = setInterval(compute, 1000);
    return () => clearInterval(iv);
  // NOTE: data?.serverNow is intentionally omitted from deps.
  // It changes on every poll (always a fresh timestamp), which would reset the
  // 1-second interval every 5 s and cause the clock to visually jump.
  // serverNow is only needed to correct the initial anchor when clock STATE
  // changes (start / stop / adjust), which IS covered by the three deps below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.clockStartedAt, data?.clockElapsedSeconds, data?.clockIsRunning]);

  return { display, remaining };
}

function getClockColor(data: BroadcastData, remaining: number, stoppageEvent: StoppageEvent | null): string {
  if (!data.clockIsRunning) {
    if (stoppageEvent) {
      return EVENT_COLORS[stoppageEvent.eventType] || "#fff";
    }
    return "#fff";
  }
  if (remaining <= 30) {
    return "#ef4444";
  }
  return "#fff";
}

function teamDisplayName(team: BroadcastTeam | null): string {
  if (!team) return "TBD";
  const name = team.scoreboardName || team.name || "TBD";
  return name.length > 12 ? name.substring(0, 12) : name;
}

function teamLogoFallback(team: BroadcastTeam | null): string {
  if (!team) return "?";
  return (team.shortName || team.name?.substring(0, 3) || "?").toUpperCase();
}

const EVENT_LABELS: Record<string, string> = {
  penalty: "PENALTY",
  horse_change: "HORSE CHANGE",
  safety: "SAFETY",
  injury_timeout: "INJURY",
};

const EVENT_COLORS: Record<string, string> = {
  penalty: "#b91c1c",
  horse_change: "#0369a1",
  safety: "#ca8a04",
  injury_timeout: "#dc2626",
};

function DelayBadge({ offsetSeconds }: { offsetSeconds: number }) {
  return (
    <div style={{
      position: "fixed",
      top: 16,
      right: 16,
      display: "flex",
      alignItems: "center",
      gap: 6,
      background: "rgba(0,0,0,0.72)",
      border: "1px solid rgba(251,191,36,0.55)",
      borderRadius: 6,
      padding: "5px 10px",
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      pointerEvents: "none",
      zIndex: 9999,
    }}>
      <span style={{ fontSize: 13, color: "#fbbf24" }}>⏱</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", letterSpacing: 1, textTransform: "uppercase" }}>
        DELAY {offsetSeconds}s
      </span>
    </div>
  );
}

const BASE_FONT_SIZE = 12;
const BASE_SPACING = 1.5;
const MAX_SPACING = 12;
const MIN_FONT_SIZE = 9;
const MIN_SPACING = 0.5;

function measureTextWidth(text: string, fontSize: number, letterSpacing: number): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = `600 ${fontSize}px Inter, 'Helvetica Neue', sans-serif`;
  const measured = ctx.measureText(text.toUpperCase());
  return measured.width + (Math.max(text.length - 1, 0) * letterSpacing);
}

function TournamentTitleBar({ name, borderBottom }: { name: string; borderBottom?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [textStyle, setTextStyle] = useState<{ fontSize: number; letterSpacing: number }>({ fontSize: BASE_FONT_SIZE, letterSpacing: BASE_SPACING });

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerW = container.clientWidth - 40;
    if (containerW <= 0) return;

    const naturalW = measureTextWidth(name, BASE_FONT_SIZE, BASE_SPACING);
    if (naturalW <= 0) return;

    if (naturalW < containerW * 0.7) {
      const charCount = name.length;
      if (charCount > 0) {
        const extraSpace = (containerW * 0.9) - naturalW;
        const newSpacing = BASE_SPACING + (extraSpace / charCount);
        setTextStyle({ fontSize: BASE_FONT_SIZE, letterSpacing: Math.min(newSpacing, MAX_SPACING) });
      }
    } else if (naturalW > containerW) {
      const scale = containerW / naturalW;
      const newFontSize = Math.max(BASE_FONT_SIZE * scale, MIN_FONT_SIZE);
      setTextStyle({ fontSize: newFontSize, letterSpacing: Math.max(BASE_SPACING * scale, MIN_SPACING) });
    } else {
      setTextStyle({ fontSize: BASE_FONT_SIZE, letterSpacing: BASE_SPACING });
    }
  }, [name]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div ref={containerRef} style={{
      background: NEAR_BLACK,
      padding: "6px 20px",
      textAlign: "center",
      overflow: "hidden",
      minWidth: 0,
      ...(borderBottom ? { borderBottom } : {}),
    }}>
      <span style={{
        color: "#fff",
        fontSize: textStyle.fontSize,
        fontWeight: 600,
        letterSpacing: textStyle.letterSpacing,
        textTransform: "uppercase",
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        whiteSpace: "nowrap",
      }}>
        {name}
      </span>
    </div>
  );
}

function CompactPremiumBar({ data, clock, clockColor, titleBarBorderBottom }: { data: BroadcastData; clock: string; clockColor: string; titleBarBorderBottom?: string }) {
  const home = data.homeTeam;
  const away = data.awayTeam;
  const homeColor = home?.primaryColor || "#374151";
  const awayColor = away?.primaryColor || "#374151";
  const homeTheme = getOnColorTheme(homeColor);
  const awayTheme = getOnColorTheme(awayColor);
  const tournamentName = data.tournament?.name;

  return (
    <div style={{
      position: "fixed",
      top: 40,
      left: 40,
      display: "flex",
      flexDirection: "column",
      borderRadius: 8,
      overflow: "hidden",
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    }}>
      {tournamentName && <TournamentTitleBar name={tournamentName} borderBottom={titleBarBorderBottom} />}
      <div style={{
        display: "flex",
        alignItems: "stretch",
        height: 64,
      }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        background: `linear-gradient(135deg, ${homeColor}dd, ${homeColor}bb)`,
        width: 270,
        height: "100%",
        boxSizing: "border-box",
      }}>
        {home?.logoUrl ? (
          <img src={home.logoUrl} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: homeTheme.logoBorder, flexShrink: 0 }} />
        ) : (
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: homeTheme.bubbleBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: homeTheme.text, flexShrink: 0 }}>
            {teamLogoFallback(home)}
          </div>
        )}
        <div style={{ width: 6, flexShrink: 0 }} />
        <span style={{ color: homeTheme.text, fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", textTransform: "uppercase", textShadow: homeTheme.shadow, overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
          {teamDisplayName(home)}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: 34, fontWeight: 800, color: homeTheme.text, lineHeight: 1, minWidth: 40, textAlign: "center", marginLeft: 10, textShadow: themed(homeTheme, "0 1px 3px rgba(255,255,255,0.55)", "0 1px 3px rgba(0,0,0,0.45)"), flexShrink: 0 }}>
          {data.homeScore}
        </span>
      </div>

      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "3px 14px 8px",
        background: NEAR_BLACK,
        minWidth: 80,
      }}>
        <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
          {data.currentChukker}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: 22, fontWeight: 700, color: data.status === "halftime" ? "#fff" : clockColor, lineHeight: 1, letterSpacing: 0.5 }}>
          {data.status === "halftime" ? "HT" : clock}
        </span>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        background: `linear-gradient(135deg, ${awayColor}bb, ${awayColor}dd)`,
        width: 270,
        height: "100%",
        boxSizing: "border-box",
      }}>
        <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: 34, fontWeight: 800, color: awayTheme.text, lineHeight: 1, minWidth: 40, textAlign: "center", marginRight: 10, textShadow: themed(awayTheme, "0 1px 3px rgba(255,255,255,0.55)", "0 1px 3px rgba(0,0,0,0.45)"), flexShrink: 0 }}>
          {data.awayScore}
        </span>
        <span style={{ color: awayTheme.text, fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", textTransform: "uppercase", textShadow: awayTheme.shadow, overflow: "hidden", textOverflow: "ellipsis", flex: 1, textAlign: "right" }}>
          {teamDisplayName(away)}
        </span>
        <div style={{ width: 6, flexShrink: 0 }} />
        {away?.logoUrl ? (
          <img src={away.logoUrl} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: awayTheme.logoBorder, flexShrink: 0 }} />
        ) : (
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: awayTheme.bubbleBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: awayTheme.text, flexShrink: 0 }}>
            {teamLogoFallback(away)}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function CenterBlockScoreboard({ data, clock, clockColor }: { data: BroadcastData; clock: string; clockColor: string }) {
  const home = data.homeTeam;
  const away = data.awayTeam;
  const homeColor = home?.primaryColor || "#1e3a5f";
  const awayColor = away?.primaryColor || "#5f1e1e";
  const homeTheme = getOnColorTheme(homeColor);
  const awayTheme = getOnColorTheme(awayColor);
  const tournamentName = data.tournament?.name;

  return (
    <div style={{
      position: "fixed",
      top: 30,
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      flexDirection: "column",
      borderRadius: 6,
      overflow: "hidden",
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    }}>
      {tournamentName && <TournamentTitleBar name={tournamentName} />}
      <div style={{
        display: "flex",
        alignItems: "stretch",
        height: 56,
      }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 16px",
        background: homeColor,
        width: 220,
      }}>
        {home?.logoUrl ? (
          <img src={home.logoUrl} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: homeTheme.logoBorder }} />
        ) : (
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: themed(homeTheme, homeTheme.bubbleBg, "rgba(255,255,255,0.15)"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: homeTheme.text }}>
            {teamLogoFallback(home)}
          </div>
        )}
        <span style={{ color: homeTheme.text, fontSize: 16, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: themed(homeTheme, "0 1px 3px rgba(255,255,255,0.5)", "0 1px 3px rgba(0,0,0,0.4)") }}>
          {teamDisplayName(home)}
        </span>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 10px",
        background: NEAR_BLACK,
        minWidth: 50,
      }}>
        <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: 34, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
          {data.homeScore}
        </span>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 10px",
        background: "#f8fafc",
        minWidth: 90,
        gap: 8,
      }}>
        <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: 28, fontWeight: 700, color: data.status === "halftime" ? NEAR_BLACK : clockColor, letterSpacing: 1 }}>
          {data.status === "halftime" ? "HT" : clock}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: 28, fontWeight: 700, color: "#374151", lineHeight: 1 }}>
          {data.currentChukker}
        </span>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 10px",
        background: NEAR_BLACK,
        minWidth: 50,
      }}>
        <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: 34, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
          {data.awayScore}
        </span>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 16px",
        background: awayColor,
        flexDirection: "row-reverse",
        width: 220,
      }}>
        {away?.logoUrl ? (
          <img src={away.logoUrl} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: awayTheme.logoBorder }} />
        ) : (
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: themed(awayTheme, awayTheme.bubbleBg, "rgba(255,255,255,0.15)"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: awayTheme.text }}>
            {teamLogoFallback(away)}
          </div>
        )}
        <span style={{ color: awayTheme.text, fontSize: 16, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: themed(awayTheme, "0 1px 3px rgba(255,255,255,0.5)", "0 1px 3px rgba(0,0,0,0.4)") }}>
          {teamDisplayName(away)}
        </span>
      </div>
      </div>
    </div>
  );
}

function GoalScorerBar({ alert, topOffset = 120 }: { alert: GoalAlert | null; topOffset?: number }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<GoalAlert | null>(null);

  useEffect(() => {
    if (!alert) return;
    setCurrent(alert);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [alert?.id]);

  if (!current) return null;

  const bg = current.color || "#374151";
  const theme = getOnColorTheme(bg);

  return (
    <div style={{
      position: "fixed",
      top: topOffset,
      left: 40,
      transition: "opacity 0.5s ease, transform 0.5s ease",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(-10px)",
      pointerEvents: "none",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 24px",
        borderRadius: 8,
        background: bg,
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      }}>
        <span style={{ fontSize: 19, fontWeight: 700, color: theme.text, textShadow: theme.shadow, textTransform: "uppercase" }}>
          GOAL: {current.playerName}
        </span>
      </div>
    </div>
  );
}

function GoalScorerBarCenter({ alert, topOffset = 110 }: { alert: GoalAlert | null; topOffset?: number }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<GoalAlert | null>(null);

  useEffect(() => {
    if (!alert) return;
    setCurrent(alert);
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [alert?.id]);

  if (!current) return null;

  const bg = current.color || "#374151";
  const theme = getOnColorTheme(bg);

  return (
    <div style={{
      position: "fixed",
      top: topOffset,
      left: "50%",
      transform: visible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(-10px)",
      transition: "opacity 0.5s ease, transform 0.5s ease",
      opacity: visible ? 1 : 0,
      pointerEvents: "none",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 24px",
        borderRadius: 8,
        background: bg,
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      }}>
        <span style={{ fontSize: 19, fontWeight: 700, color: theme.text, textShadow: theme.shadow, textTransform: "uppercase" }}>
          GOAL: {current.playerName}
        </span>
      </div>
    </div>
  );
}

function StoppageBar({ event, clockIsRunning, position, topOffsetOverride, homeTeamName, awayTeamName }: { event: StoppageEvent | null; clockIsRunning: boolean; position: "left" | "center"; topOffsetOverride?: number; homeTeamName?: string; awayTeamName?: string }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<StoppageEvent | null>(null);
  const lastTimestampRef = useRef<string | null>(null);

  useEffect(() => {
    if (event && event.timestamp !== lastTimestampRef.current) {
      lastTimestampRef.current = event.timestamp;
      setCurrent(event);
      setVisible(true);
    }
  }, [event?.timestamp]);

  useEffect(() => {
    if (clockIsRunning && visible) {
      setVisible(false);
    }
  }, [clockIsRunning]);

  if (!current || !visible) return null;

  let label = current.description || EVENT_LABELS[current.eventType] || current.eventType.toUpperCase();
  if (current.eventType === "penalty" && current.teamSide) {
    const teamName = current.teamSide === "home" ? homeTeamName : awayTeamName;
    if (teamName) {
      label = `${teamName} \u2013 ${label}`;
    }
  }
  const bgColor = EVENT_COLORS[current.eventType] || "#374151";

  const topOffset = topOffsetOverride ?? (position === "left" ? 120 : 110);

  return (
    <div style={{
      position: "fixed",
      top: topOffset,
      ...(position === "left" ? { left: 40 } : { left: "50%", transform: "translateX(-50%)" }),
      transition: "opacity 0.5s ease, transform 0.5s ease",
      opacity: 1,
      pointerEvents: "none",
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 24px",
        borderRadius: 8,
        background: bgColor,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 1.5 }}>
          {label}
        </span>
        {current.playerName && (
          <span style={{ fontSize: 19, fontWeight: 700, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
            {current.playerName}
          </span>
        )}
      </div>
    </div>
  );
}

export function ScoreBugOverlay() {
  const [data, setData] = useState<BroadcastData | null>(null);
  const [goalAlert, setGoalAlert] = useState<GoalAlert | null>(null);
  const [stoppageEvent, setStoppageEvent] = useState<StoppageEvent | null>(null);
  const lastGoalRef = useRef<string | null>(null);
  const lastStoppageRef = useRef<string | null>(null);
  const goalIdCounter = useRef(0);
  const broadcastQueueRef = useRef<{ payload: BroadcastData; fireAt: number }[]>([]);

  const pathname = window.location.pathname;
  const channelMatch = pathname.match(/\/broadcast\/channel\/([^/]+)\/([^/?]+)/);
  const isChannelMode = !!channelMatch;
  const channelClubId = channelMatch?.[1] || null;
  const channelName = channelMatch?.[2] || null;
  const pathMatchId = !isChannelMode ? pathname.split("/broadcast/scorebug/")[1]?.split("?")[0] : null;
  const matchId = isChannelMode ? (data?.id || null) : pathMatchId;
  const urlParams = new URLSearchParams(window.location.search);
  const styleOverride = urlParams.get("style");
  const resOverride = urlParams.get("res");
  const scaleOverride = urlParams.get("scale");
  const oxOverride = urlParams.get("ox");
  const oyOverride = urlParams.get("oy");
  const hideDelay = urlParams.get("hideDelay") === "1";

  const effectiveResolution = resOverride || data?.broadcastResolution || "4k";
  const is4K = effectiveResolution === "4k";

  const parseNumOverride = (v: string | null, fallback: number) => {
    if (v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const rawScale = parseNumOverride(scaleOverride, data?.broadcast4kScale ?? 100);
  const rawOffsetX = parseNumOverride(oxOverride, data?.broadcast4kOffsetX ?? 0);
  const rawOffsetY = parseNumOverride(oyOverride, data?.broadcast4kOffsetY ?? 0);
  const tweakScale = is4K ? Math.min(110, Math.max(90, rawScale)) : 100;
  const tweakOffsetX = is4K ? Math.min(500, Math.max(-500, rawOffsetX)) : 0;
  const tweakOffsetY = is4K ? Math.min(500, Math.max(-500, rawOffsetY)) : 0;

  useEffect(() => {
    const style = document.createElement("style");
    const baseRules = "html, body, #root { background: transparent !important; margin: 0; padding: 0; overflow: hidden; width: 1920px; height: 1080px; }";
    let scaleRules = "";
    if (is4K) {
      const finalScale = 2 * (tweakScale / 100);
      scaleRules = ` html { transform: translate(${tweakOffsetX}px, ${tweakOffsetY}px) scale(${finalScale}); transform-origin: top left; }`;
    }
    style.textContent = baseRules + scaleRules;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [is4K, tweakScale, tweakOffsetX, tweakOffsetY]);

  const applyData = useCallback((json: BroadcastData) => {
    if (json.lastGoalTimestamp && json.lastGoalTimestamp !== lastGoalRef.current) {
      const serverNowMs = json.serverNow ? new Date(json.serverNow).getTime() : Date.now();
      const elapsed = serverNowMs - new Date(json.lastGoalTimestamp).getTime();
      if (elapsed < 45000) {
        const teamColor = json.lastGoalTeamSide === "home"
          ? json.homeTeam?.primaryColor || "#374151"
          : json.awayTeam?.primaryColor || "#374151";
        goalIdCounter.current++;
        setGoalAlert({
          playerName: json.lastGoalScorerName || "Goal",
          teamSide: json.lastGoalTeamSide || "home",
          color: teamColor,
          id: goalIdCounter.current,
        });
      }
      lastGoalRef.current = json.lastGoalTimestamp;
    }

    if (json.lastStoppageEvent && json.lastStoppageEvent.timestamp !== lastStoppageRef.current) {
      lastStoppageRef.current = json.lastStoppageEvent.timestamp;
      setStoppageEvent(json.lastStoppageEvent);
    } else if (json.clockIsRunning) {
      setStoppageEvent(null);
    }

    setData(json);
  }, []);

  const fetchData = useCallback(async () => {
    if (!isChannelMode && !matchId) return;
    if (isChannelMode && (!channelClubId || !channelName)) return;
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const url = isChannelMode
        ? `${base}/api/clubs/${channelClubId}/broadcast/channel/${channelName}`
        : `${base}/api/matches/${matchId}/broadcast`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const raw = await res.json();
      if (isChannelMode && raw && raw.assigned === false) {
        setData(null);
        return;
      }
      const json: BroadcastData = raw;

      const isFieldSide = json.scoringLocation === "field";
      const delayMs = isFieldSide && json.broadcastOffsetSeconds
        ? Math.max(0, Number(json.broadcastOffsetSeconds) * 1000)
        : 0;

      if (delayMs > 0) {
        broadcastQueueRef.current.push({ payload: json, fireAt: Date.now() + delayMs });
      } else {
        // Switching to immediate mode (studio): discard any queued delayed payloads
        // so stale field-side entries don't overwrite newer studio state.
        broadcastQueueRef.current = [];
        applyData(json);
      }
    } catch {
    }
  }, [matchId, applyData]);

  const TERMINAL_STATUSES = ["final", "cancelled", "completed"];

  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const queue = broadcastQueueRef.current;
      const ready = queue.filter(item => item.fireAt <= now);
      if (ready.length > 0) {
        broadcastQueueRef.current = queue.filter(item => item.fireAt > now);
        const latest = ready[ready.length - 1];
        applyData(latest.payload);
      }
    }, 200);
    return () => clearInterval(iv);
  }, [applyData]);

  useEffect(() => {
    fetchData();
    const isLive = data?.status === "live" || data?.status === "halftime";
    const isTerminal = TERMINAL_STATUSES.includes(data?.status ?? "");
    if (isTerminal && !isChannelMode) return;
    const pollInterval = isChannelMode ? (isLive ? 5000 : 4000) : (isLive ? 5000 : 3000);
    const iv = setInterval(fetchData, pollInterval);
    return () => clearInterval(iv);
  }, [fetchData, data?.status, isChannelMode]);

  useEffect(() => {
    if (!matchId) return;
    const isLive = data?.status === "live" || data?.status === "halftime";
    if (!isLive) return;

    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const es = new EventSource(`${base}/api/matches/${matchId}/stream`);
    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "update") {
          fetchData();
        } else if (msg.type === "match_ended") {
          fetchData();
          es.close();
        }
      } catch {}
    };
    es.onerror = () => {};
    return () => es.close();
  }, [matchId, data?.status, fetchData]);

  const { display: clock, remaining } = useClockDisplay(data);

  if (!data) return null;

  const style = styleOverride || data.broadcastStyle || "option1";
  const isVisible = data.broadcastVisible;
  const delayOffsetSeconds = data.scoringLocation === "field" && data.broadcastOffsetSeconds && data.broadcastOffsetSeconds > 0
    ? data.broadcastOffsetSeconds
    : null;
  const showDelayBadge = !hideDelay && delayOffsetSeconds !== null;

  const clockColor = getClockColor(data, remaining, stoppageEvent);
  const hasTournament = !!data.tournament?.name;
  const titleBarHeight = hasTournament ? TITLE_BAR_HEIGHT : 0;

  if (style === "stats") {
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        transition: "opacity 0.6s ease",
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none",
      }}>
        <StatsOverlay
          homeTeam={data.homeTeam}
          awayTeam={data.awayTeam}
          homeScore={data.homeScore}
          awayScore={data.awayScore}
          stats={data.stats ?? null}
          topScorers={data.topScorers}
          possession={data.possession}
          tournament={data.tournament}
        />
        {showDelayBadge && <DelayBadge offsetSeconds={delayOffsetSeconds!} />}
      </div>
    );
  }

  if (style === "stats_mini") {
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        transition: "opacity 0.6s ease",
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none",
      }}>
        <MiniStatsOverlay
          homeTeam={data.homeTeam}
          awayTeam={data.awayTeam}
          homeScore={data.homeScore}
          awayScore={data.awayScore}
          stats={data.stats ?? null}
          possession={data.possession}
          tournament={data.tournament}
        />
        {showDelayBadge && <DelayBadge offsetSeconds={delayOffsetSeconds!} />}
      </div>
    );
  }

  if (style === "lineup_home" || style === "lineup_away") {
    const teamSide = style === "lineup_home" ? "home" : "away";
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        transition: "opacity 0.6s ease",
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none",
      }}>
        <LineupOverlay matchId={data.id} teamSide={teamSide} />
        {showDelayBadge && <DelayBadge offsetSeconds={delayOffsetSeconds!} />}
      </div>
    );
  }

  if (style === "field") {
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        transition: "opacity 0.6s ease",
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none",
      }}>
        <FieldBugOverlay field={data.field ?? null} club={data.club ?? null} showClock />
        {showDelayBadge && <DelayBadge offsetSeconds={delayOffsetSeconds!} />}
      </div>
    );
  }

  return (
    <div style={{
      transition: "opacity 0.6s ease, transform 0.6s ease",
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? "translateY(0)" : "translateY(-12px)",
      pointerEvents: isVisible ? "auto" : "none",
    }}>
      {showDelayBadge && <DelayBadge offsetSeconds={delayOffsetSeconds!} />}
      {style === "option2" ? (
        <>
          <CompactPremiumBar data={data} clock={clock} clockColor={clockColor} titleBarBorderBottom="1px solid rgba(255, 255, 255, 0.08)" />
          <GoalScorerBar alert={goalAlert} topOffset={120 + titleBarHeight} />
          <StoppageBar event={stoppageEvent} clockIsRunning={data.clockIsRunning} position="left" topOffsetOverride={120 + titleBarHeight} homeTeamName={data.homeTeam?.scoreboardName || data.homeTeam?.shortName || data.homeTeam?.name} awayTeamName={data.awayTeam?.scoreboardName || data.awayTeam?.shortName || data.awayTeam?.name} />
        </>
      ) : (
        <>
          <CompactPremiumBar data={data} clock={clock} clockColor={clockColor} />
          <GoalScorerBar alert={goalAlert} topOffset={120 + titleBarHeight} />
          <StoppageBar event={stoppageEvent} clockIsRunning={data.clockIsRunning} position="left" topOffsetOverride={120 + titleBarHeight} homeTeamName={data.homeTeam?.scoreboardName || data.homeTeam?.shortName || data.homeTeam?.name} awayTeamName={data.awayTeam?.scoreboardName || data.awayTeam?.shortName || data.awayTeam?.name} />
        </>
      )}
    </div>
  );
}
