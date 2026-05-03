import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { StatsOverlay } from "./StatsOverlay";
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
  broadcastVisible: boolean;
  broadcastStyle: string;
  lastGoalScorerName: string | null;
  lastGoalTeamSide: string | null;
  lastGoalTimestamp: string | null;
  lastStoppageEvent: StoppageEvent | null;
  homeTeam: BroadcastTeam | null;
  awayTeam: BroadcastTeam | null;
  tournament: { name: string; chukkersPerMatch: number } | null;
  stats?: { home: Record<string, number>; away: Record<string, number> };
  topScorers?: { name: string; goals: number; teamSide: "home" | "away" }[];
  possession?: { homePercent: number; awayPercent: number; homeSeconds: number; awaySeconds: number } | null;
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

  useEffect(() => {
    if (!data) return;
    const compute = () => {
      let elapsed = data.clockElapsedSeconds || 0;
      if (data.clockIsRunning && data.clockStartedAt) {
        elapsed += Math.floor((Date.now() - new Date(data.clockStartedAt).getTime()) / 1000);
      }
      const rem = Math.max(0, CHUKKER_DURATION - elapsed);
      setRemaining(rem);
      const m = Math.floor(rem / 60);
      const s = rem % 60;
      setDisplay(`${m}:${String(s).padStart(2, "0")}`);
    };
    compute();
    if (!data.clockIsRunning) return;
    const iv = setInterval(compute, 1000);
    return () => clearInterval(iv);
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

function TournamentTitleBar({ name }: { name: string }) {
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
      borderBottom: "2px solid rgba(200, 200, 200, 0.4)",
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

function CompactPremiumBar({ data, clock, clockColor }: { data: BroadcastData; clock: string; clockColor: string }) {
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
      {tournamentName && <TournamentTitleBar name={tournamentName} />}
      <div style={{
        display: "flex",
        alignItems: "stretch",
        height: 56,
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
        <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: 30, fontWeight: 800, color: homeTheme.text, lineHeight: 1, minWidth: 40, textAlign: "center", marginLeft: 10, textShadow: themed(homeTheme, "0 1px 3px rgba(255,255,255,0.55)", "0 1px 3px rgba(0,0,0,0.45)"), flexShrink: 0 }}>
          {data.homeScore}
        </span>
      </div>

      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        padding: "0 14px",
        background: NEAR_BLACK,
        minWidth: 80,
      }}>
        <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
          {data.currentChukker}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: 20, fontWeight: 700, color: data.status === "halftime" ? "#fff" : clockColor, lineHeight: 1, letterSpacing: 0.5 }}>
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
        <span style={{ fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: 30, fontWeight: 800, color: awayTheme.text, lineHeight: 1, minWidth: 40, textAlign: "center", marginRight: 10, textShadow: themed(awayTheme, "0 1px 3px rgba(255,255,255,0.55)", "0 1px 3px rgba(0,0,0,0.45)"), flexShrink: 0 }}>
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
        padding: "8px 20px",
        borderRadius: 6,
        background: bg,
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: theme.text, textShadow: theme.shadow, textTransform: "uppercase" }}>
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
        padding: "8px 24px",
        borderRadius: 6,
        background: bg,
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: theme.text, textShadow: theme.shadow, textTransform: "uppercase" }}>
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
        gap: 12,
        padding: "8px 20px",
        borderRadius: 6,
        background: bgColor,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1.5 }}>
          {label}
        </span>
        {current.playerName && (
          <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
            {current.playerName}
          </span>
        )}
      </div>
    </div>
  );
}

export function ScoreBugOverlay2() {
  const [data, setData] = useState<BroadcastData | null>(null);
  const [goalAlert, setGoalAlert] = useState<GoalAlert | null>(null);
  const [stoppageEvent, setStoppageEvent] = useState<StoppageEvent | null>(null);
  const lastGoalRef = useRef<string | null>(null);
  const lastStoppageRef = useRef<string | null>(null);
  const goalIdCounter = useRef(0);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "html, body, #root { background: transparent !important; margin: 0; padding: 0; overflow: hidden; width: 1920px; height: 1080px; }";
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  const matchId = window.location.pathname.split("/broadcast/scorebug2/")[1]?.split("?")[0];
  const urlParams = new URLSearchParams(window.location.search);
  const styleOverride = urlParams.get("style");

  const fetchData = useCallback(async () => {
    if (!matchId) return;
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/matches/${matchId}/broadcast`);
      if (!res.ok) throw new Error("fetch failed");
      const json: BroadcastData = await res.json();

      if (json.lastGoalTimestamp && json.lastGoalTimestamp !== lastGoalRef.current) {
        const elapsed = Date.now() - new Date(json.lastGoalTimestamp).getTime();
        if (elapsed < 10000) {
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
      }

      setData(json);
    } catch {
    }
  }, [matchId]);

  const TERMINAL_STATUSES = ["final", "cancelled", "completed"];

  useEffect(() => {
    fetchData();
    const isLive = data?.status === "live" || data?.status === "halftime";
    const isTerminal = TERMINAL_STATUSES.includes(data?.status ?? "");
    if (isTerminal) return;
    const pollInterval = isLive ? 5000 : 3000;
    const iv = setInterval(fetchData, pollInterval);
    return () => clearInterval(iv);
  }, [fetchData, data?.status]);

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

  const isVisible = data.broadcastVisible;

  const clockColor = getClockColor(data, remaining, stoppageEvent);
  const hasTournament = !!data.tournament?.name;
  const titleBarHeight = hasTournament ? TITLE_BAR_HEIGHT : 0;

  const style = styleOverride || data.broadcastStyle || "option2";

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
          {...({
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            homeScore: data.homeScore,
            awayScore: data.awayScore,
            currentChukker: data.currentChukker,
            clock,
            clockIsRunning: data.clockIsRunning,
            stats: data.stats ?? null,
            topScorers: data.topScorers,
            possession: data.possession,
            tournament: data.tournament,
          } as any)}
        />
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
      <CompactPremiumBar data={data} clock={clock} clockColor={clockColor} />
      <GoalScorerBar alert={goalAlert} topOffset={120 + titleBarHeight} />
      <StoppageBar event={stoppageEvent} clockIsRunning={data.clockIsRunning} position="left" topOffsetOverride={120 + titleBarHeight} homeTeamName={data.homeTeam?.scoreboardName || data.homeTeam?.shortName || data.homeTeam?.name} awayTeamName={data.awayTeam?.scoreboardName || data.awayTeam?.shortName || data.awayTeam?.name} />
    </div>
  );
}
