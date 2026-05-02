import { useState, useEffect, useRef, useCallback } from "react";

interface BroadcastTeam {
  name: string;
  shortName?: string;
  scoreboardName?: string;
  logoUrl?: string;
  jerseyImageUrl?: string;
  primaryColor?: string;
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
  homeTeam: BroadcastTeam | null;
  awayTeam: BroadcastTeam | null;
  tournament: { name: string; chukkersPerMatch: number; logoUrl?: string | null } | null;
  club?: { name: string; logoUrl?: string | null } | null;
}

const CHUKKER_DURATION = 450;

function useClockDisplay(data: BroadcastData | null) {
  const [display, setDisplay] = useState("7:30");
  const elapsedAtPollRef = useRef(0);
  const clientTimeAtPollRef = useRef(Date.now());

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
    const iv = setInterval(compute, 1000);
    return () => clearInterval(iv);
  }, [data?.clockStartedAt, data?.clockElapsedSeconds, data?.clockIsRunning, data?.serverNow]);

  return display;
}

function TeamBadge({
  team,
  display,
  size,
}: {
  team: BroadcastTeam | null;
  display: "logo" | "jersey";
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = display === "jersey"
    ? (team?.jerseyImageUrl || team?.logoUrl || null)
    : (team?.logoUrl || null);

  if (!src || failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: display === "jersey" ? 12 : "50%",
          background: "rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Syne, sans-serif",
          fontWeight: 800,
          fontSize: size * 0.32,
          color: "#fff",
          border: "4px solid rgba(255,255,255,0.18)",
        }}
      >
        {(team?.shortName || team?.name || "?").slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={team?.name || ""}
      onError={() => setFailed(true)}
      style={{
        width: size,
        height: size,
        borderRadius: display === "jersey" ? 12 : "50%",
        objectFit: display === "jersey" ? "contain" : "cover",
        background: display === "jersey" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.2)",
        border: "4px solid rgba(255,255,255,0.18)",
      }}
    />
  );
}

function teamColor(team: BroadcastTeam | null, fallback: string): string {
  return team?.primaryColor || fallback;
}

function TeamPanel({
  team,
  score,
  display,
  align,
}: {
  team: BroadcastTeam | null;
  score: number;
  display: "logo" | "jersey";
  align: "left" | "right";
}) {
  const color = teamColor(team, align === "left" ? "#1B5E20" : "#B71C1C");
  return (
    <div
      style={{
        flex: 1,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 6vw",
        background: `linear-gradient(${align === "left" ? "135deg" : "225deg"}, ${color} 0%, color-mix(in srgb, ${color}, #000 35%) 100%)`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5vh", marginBottom: "2vh" }}>
        <TeamBadge team={team} display={display} size={Math.round(window.innerHeight * 0.16)} />
        <div
          style={{
            fontFamily: "Syne, sans-serif",
            fontWeight: 800,
            fontSize: "3.6vh",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            textAlign: "center",
            color: "#fff",
            lineHeight: 1,
          }}
        >
          {team?.scoreboardName || team?.name || "—"}
        </div>
      </div>
      <div
        style={{
          fontFamily: "Syne, sans-serif",
          fontWeight: 800,
          fontSize: "34vh",
          lineHeight: 0.85,
          letterSpacing: "-0.04em",
          color: "#fff",
          textShadow: "0 0.6vh 2vh rgba(0,0,0,0.45)",
        }}
      >
        {score}
      </div>
    </div>
  );
}

function Banner({ tournament, currentChukker }: { tournament: BroadcastData["tournament"]; currentChukker: number }) {
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <div
      style={{
        height: "16vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "3vw",
        padding: "0 3vw",
        background: "linear-gradient(180deg, #050709 0%, #0f1419 100%)",
        borderBottom: "2px solid rgba(255,255,255,0.08)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "38%",
          height: 3,
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: "2.4vw", minWidth: 0, flex: "1 1 auto" }}>
        <div
          style={{
            width: "13vh",
            height: "13vh",
            borderRadius: "50%",
            background: "#0a0e12",
            border: "4px solid rgba(255,255,255,0.85)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 1.2vh 3vh rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {tournament?.logoUrl && !logoFailed ? (
            <img
              src={tournament.logoUrl}
              alt={tournament.name}
              onError={() => setLogoFailed(true)}
              style={{ width: "78%", height: "78%", borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "78%",
                height: "78%",
                borderRadius: "50%",
                background: "radial-gradient(circle at 30% 30%, #f4d35e 0%, #c19920 60%, #6b4f0a 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Syne, sans-serif",
                fontWeight: 800,
                fontSize: "1.9vh",
                color: "#2a1a00",
                textAlign: "center",
                lineHeight: 1.05,
                padding: "0.6vh",
              }}
            >
              {(tournament?.name || "EVENT").slice(0, 12).toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: "5.5vh",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              lineHeight: 1,
              color: "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {tournament?.name || "Polo Match"}
          </div>
        </div>
      </div>
      <div style={{ flex: "0 0 auto" }}>
        <div
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.18)",
            fontFamily: "Syne, sans-serif",
            fontWeight: 800,
            fontSize: "3vh",
            textTransform: "uppercase",
            letterSpacing: "0.16em",
            padding: "1vh 1.6vw",
            borderRadius: "1vh",
            whiteSpace: "nowrap",
            color: "#fff",
          }}
        >
          Chukker {currentChukker || 1}
        </div>
      </div>
    </div>
  );
}

export function Scoreboard() {
  const [data, setData] = useState<BroadcastData | null>(null);
  const pathname = window.location.pathname;
  const match = pathname.match(/\/scoreboard\/channel\/([^/]+)\/([^/?]+)/);
  const channelClubId = match?.[1] || null;
  const channelName = match?.[2] || null;
  const urlParams = new URLSearchParams(window.location.search);
  const display = (urlParams.get("display") === "jersey" ? "jersey" : "logo") as "logo" | "jersey";

  const fetchData = useCallback(async () => {
    if (!channelClubId || !channelName) return;
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/clubs/${channelClubId}/broadcast/channel/${channelName}`);
      if (!res.ok) throw new Error("fetch failed");
      const raw = await res.json();
      if (raw && raw.assigned === false) {
        setData(null);
        return;
      }
      setData(raw);
    } catch {
    }
  }, [channelClubId, channelName]);

  useEffect(() => {
    fetchData();
    const isLive = data?.status === "live" || data?.status === "halftime";
    const iv = setInterval(fetchData, isLive ? 5000 : 4000);
    return () => clearInterval(iv);
  }, [fetchData, data?.status]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "html, body, #root { background: #000 !important; margin: 0; padding: 0; overflow: hidden; height: 100%; width: 100%; }";
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  const clock = useClockDisplay(data);

  if (!data) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "#0a0e12",
          color: "rgba(255,255,255,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Syne, sans-serif",
          fontWeight: 700,
          fontSize: "5vh",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        Awaiting Match
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0a0e12",
        color: "#fff",
        fontFamily: "Instrument Sans, system-ui, sans-serif",
      }}
    >
      <Banner tournament={data.tournament} currentChukker={data.currentChukker} />
      <div style={{ flex: 1, display: "flex" }}>
        <TeamPanel team={data.homeTeam} score={data.homeScore} display={display} align="left" />
        <TeamPanel team={data.awayTeam} score={data.awayScore} display={display} align="right" />
      </div>
      <div
        style={{
          height: "10vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #0f1419 0%, #050709 100%)",
          borderTop: "2px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 700,
            fontSize: "7vh",
            letterSpacing: "0.04em",
            color: "#fff",
          }}
        >
          {clock}
        </div>
      </div>
    </div>
  );
}
