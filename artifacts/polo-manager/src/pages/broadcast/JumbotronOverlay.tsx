import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute } from "wouter";

interface BroadcastTeam {
  name: string;
  shortName?: string;
  scoreboardName?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  jerseyImageUrl?: string | null;
}

interface JumbotronData {
  id: string;
  status: string;
  homeScore: number;
  awayScore: number;
  currentChukker: number;
  clockStartedAt: string | null;
  clockElapsedSeconds: number;
  clockIsRunning: boolean;
  serverNow?: string;
  homeTeam: BroadcastTeam | null;
  awayTeam: BroadcastTeam | null;
  tournament: {
    name: string;
    chukkersPerMatch: number;
    logoUrl?: string | null;
    jumbotronBgColor?: string | null;
  } | null;
  club?: { name: string; logoUrl?: string | null } | null;
}

const CHUKKER_DURATION = 450;

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.startsWith("#") ? hex.slice(1) : hex;
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [Number.isFinite(r) ? r : 128, Number.isFinite(g) ? g : 128, Number.isFinite(b) ? b : 128];
}

function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150;
}

// Mute a saturated team color toward soft pastel by blending with cream.
function pastel(hex: string, mix = 0.55): string {
  const [r, g, b] = hexToRgb(hex);
  const cream = [245, 240, 232];
  const m = (c: number, t: number) => Math.round(c * (1 - mix) + t * mix);
  return `rgb(${m(r, cream[0])}, ${m(g, cream[1])}, ${m(b, cream[2])})`;
}

function onColorText(hex: string): string {
  return isLight(hex) ? "#0b0b0b" : "#ffffff";
}

function useClockDisplay(data: JumbotronData | null) {
  const [display, setDisplay] = useState("7:30");
  const elapsedAtPollRef = useRef<number>(0);
  const clientTimeAtPollRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!data) return;
    let elapsedAtPoll = data.clockElapsedSeconds || 0;
    if (data.clockIsRunning && data.clockStartedAt) {
      const serverNowMs = data.serverNow
        ? new Date(data.serverNow).getTime()
        : new Date(data.clockStartedAt).getTime();
      elapsedAtPoll += (serverNowMs - new Date(data.clockStartedAt).getTime()) / 1000;
    }
    elapsedAtPollRef.current = elapsedAtPoll;
    clientTimeAtPollRef.current = Date.now();

    const compute = () => {
      let elapsed = elapsedAtPollRef.current;
      if (data.clockIsRunning) {
        elapsed += (Date.now() - clientTimeAtPollRef.current) / 1000;
      }
      const rem = Math.max(0, CHUKKER_DURATION - Math.floor(elapsed));
      const m = Math.floor(rem / 60);
      const s = rem % 60;
      setDisplay(`${m}:${String(s).padStart(2, "0")}`);
    };
    compute();
    if (!data.clockIsRunning) return;
    const iv = setInterval(compute, 1000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.clockStartedAt, data?.clockElapsedSeconds, data?.clockIsRunning]);

  return display;
}

// Stylised polo jersey rendered with SVG. Used as the fallback when the team
// has no jersey image uploaded.
function JerseyGraphic({ team, jerseyText, sizeCqh = 32 }: { team: BroadcastTeam; jerseyText: string; sizeCqh?: number }) {
  const color = team.primaryColor || "#1f4e3d";
  const trim = isLight(color) ? "#0b0b0b" : "#ffffff";
  const stripe = isLight(color) ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.35)";
  const text = onColorText(color);
  return (
    <div style={{
      width: `${sizeCqh * 0.85}cqh`,
      height: `${sizeCqh}cqh`,
      filter: "drop-shadow(0 1.5cqh 2.5cqh rgba(0,0,0,0.25))",
    }}>
      <svg viewBox="0 0 200 230" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <path d="M 10 50 L 50 30 L 70 70 L 40 110 L 10 100 Z" fill={color} stroke={trim} strokeWidth="3" />
        <path d="M 190 50 L 150 30 L 130 70 L 160 110 L 190 100 Z" fill={color} stroke={trim} strokeWidth="3" />
        <path d="M 50 30 L 75 25 Q 100 15 125 25 L 150 30 L 145 230 L 55 230 Z" fill={color} stroke={trim} strokeWidth="3" />
        <path d="M 75 25 Q 100 50 125 25 L 115 35 Q 100 45 85 35 Z" fill={trim} />
        <rect x="55" y="80" width="90" height="6" fill={stripe} />
        <rect x="55" y="200" width="90" height="6" fill={stripe} />
        <text x="100" y="170" textAnchor="middle" fontFamily="'Inter',sans-serif" fontWeight="900" fontSize="90" fill={text} stroke={trim} strokeWidth="2">
          {jerseyText}
        </text>
      </svg>
    </div>
  );
}

function TeamLogoDot({ team, sizeCqh }: { team: BroadcastTeam; sizeCqh: number }) {
  const color = team.primaryColor || "#1f4e3d";
  const text = onColorText(color);
  const initials = (team.shortName || team.name || "?").substring(0, 2).toUpperCase();
  return (
    <div style={{
      width: `${sizeCqh}cqh`,
      height: `${sizeCqh}cqh`,
      borderRadius: "50%",
      background: color,
      border: "0.4cqh solid rgba(0,0,0,0.18)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: text,
      fontWeight: 900,
      fontSize: `${sizeCqh * 0.45}cqh`,
      letterSpacing: "0.2cqh",
      boxShadow: "0 0.6cqh 1.2cqh rgba(0,0,0,0.18)",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      {team.logoUrl ? (
        <img src={team.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initials
      )}
    </div>
  );
}

function TeamHalf({ team, score, jerseyMode }: { team: BroadcastTeam; score: number; jerseyMode: boolean }) {
  const color = team.primaryColor || "#1f4e3d";
  const bg = pastel(color);
  const displayName = (team.scoreboardName || team.shortName || team.name || "").toUpperCase();
  const jerseyText = (team.shortName || team.name || "P").substring(0, 2).toUpperCase();

  return (
    <div style={{
      flex: 1,
      background: bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6cqh 3cqw 3cqh",
      position: "relative",
      minWidth: 0,
    }}>
      {jerseyMode ? (
        // Jersey mode: jersey art replaces the logo+name identity block.
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          paddingTop: "4cqh",
        }}>
          {team.jerseyImageUrl ? (
            <div style={{
              height: "52cqh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              filter: "drop-shadow(0 1.5cqh 2.5cqh rgba(0,0,0,0.25))",
            }}>
              <img
                src={team.jerseyImageUrl}
                alt=""
                style={{ height: "100%", width: "auto", objectFit: "contain" }}
              />
            </div>
          ) : (
            <JerseyGraphic team={team} jerseyText={jerseyText} sizeCqh={52} />
          )}
        </div>
      ) : (
        <>
          {/* Team logo top */}
          <TeamLogoDot team={team} sizeCqh={18} />

          {/* Team name caption */}
          <div style={{
            fontSize: "3.4cqh",
            fontWeight: 800,
            color: "rgba(0,0,0,0.7)",
            letterSpacing: "0.6cqh",
            textTransform: "uppercase",
            textAlign: "center",
            maxWidth: "90%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {displayName}
          </div>
        </>
      )}

      {/* Score number — dominant */}
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

function CenterSeal({ data }: { data: JumbotronData }) {
  const tournament = data.tournament;
  const bgColor = tournament?.jumbotronBgColor || "#0c1a35";
  // Logo fallback: tournament event logo → club logo → none (text in seal).
  const sealLogo = tournament?.logoUrl || data.club?.logoUrl || null;
  const hasLogo = !!sealLogo;
  const sizeCqh = 26;

  // The text label inside the seal — use a short version of the tournament
  // name. Long names are wrapped onto two lines via word break.
  const labelRaw = (tournament?.name || "POLO").toUpperCase();

  return (
    <div style={{
      width: `${sizeCqh}cqh`,
      height: `${sizeCqh}cqh`,
      borderRadius: "50%",
      background: hasLogo ? "#fff" : `radial-gradient(circle at 30% 30%, ${bgColor} 0%, ${bgColor} 70%, ${bgColor} 100%)`,
      border: "0.4cqh solid rgba(255,255,255,0.15)",
      boxShadow: "0 0 3cqh rgba(0,0,0,0.5), inset 0 0 1cqh rgba(255,255,255,0.08)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      color: onColorText(bgColor),
      flexShrink: 0,
      position: "relative",
      overflow: "hidden",
    }}>
      {hasLogo ? (
        <img
          src={sealLogo!}
          alt=""
          style={{
            width: "82%",
            height: "82%",
            objectFit: "contain",
            borderRadius: "50%",
          }}
        />
      ) : (
        <div style={{
          padding: "8% 10%",
          fontSize: `${sizeCqh * 0.13}cqh`,
          fontWeight: 900,
          letterSpacing: "0.15cqh",
          textAlign: "center",
          lineHeight: 1.05,
          wordBreak: "break-word",
          overflow: "hidden",
          maxHeight: "100%",
        }}>
          {labelRaw}
        </div>
      )}
    </div>
  );
}

function CenterSpine({ data, clock }: { data: JumbotronData; clock: string }) {
  const chukker = data.currentChukker;

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
      {/* Chukker pill at top — number only, larger than reference */}
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
          {chukker}
        </span>
      </div>

      {/* Seal dead-center */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}>
        <CenterSeal data={data} />
      </div>

      {/* Clock at bottom */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: "50%",
        transform: "translate(-50%, 2cqh)",
        background: "#0a0a0a",
        color: data.clockIsRunning ? "#fff" : "#ef4444",
        borderRadius: "1.4cqh 1.4cqh 0 0",
        padding: "1.4cqh 3cqw",
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: "8cqh",
        fontWeight: 900,
        lineHeight: 1,
        letterSpacing: "0.1cqh",
        boxShadow: "0 -1cqh 2cqh rgba(0,0,0,0.35)",
      }}>
        {clock}
      </div>
    </div>
  );
}

export default function JumbotronOverlay() {
  const [, params] = useRoute("/broadcast/jumbotron/:matchId");
  const matchId = params?.matchId;

  const search = typeof window !== "undefined" ? window.location.search : "";
  const jerseyMode = new URLSearchParams(search).get("jersey") === "1";

  const [data, setData] = useState<JumbotronData | null>(null);

  const fetchData = useCallback(async () => {
    if (!matchId) return;
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/matches/${matchId}/jumbotron`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
    }
  }, [matchId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 3000);
    return () => clearInterval(iv);
  }, [fetchData]);

  useEffect(() => {
    if (!matchId) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const es = new EventSource(`${base}/api/matches/${matchId}/stream`);
    es.addEventListener("update", () => fetchData());
    es.onerror = () => {};
    return () => es.close();
  }, [matchId, fetchData]);

  const clock = useClockDisplay(data);

  if (!data) {
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        color: "#666",
        fontFamily: "'Inter',sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
      }}>
        Loading…
      </div>
    );
  }

  const home = data.homeTeam || { name: "Home", primaryColor: "#1f4e3d" };
  const away = data.awayTeam || { name: "Away", primaryColor: "#b71c1c" };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }}>
      <div style={{
        width: "100vw",
        aspectRatio: "16 / 9",
        maxHeight: "100vh",
        position: "relative",
        background: "#000",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, containerType: "size" }}>
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "row",
            fontFamily: "'Inter','Helvetica Neue',sans-serif",
          }}>
            <TeamHalf team={home} score={data.homeScore || 0} jerseyMode={jerseyMode} />
            <TeamHalf team={away} score={data.awayScore || 0} jerseyMode={jerseyMode} />
            <CenterSpine data={data} clock={clock} />
          </div>
        </div>
      </div>
    </div>
  );
}
