export interface JumboTeam {
  name: string;
  shortName: string;
  primaryColor: string;
  logoText: string;
  jerseyText: string;
}

export interface JumboData {
  home: JumboTeam;
  away: JumboTeam;
  homeScore: number;
  awayScore: number;
  chukker: number;
  totalChukkers: number;
  clock: string;
  tournament: string;
  eventLogoText: string;
  clockRunning: boolean;
}

export const SUN_CUP_DATA: JumboData = {
  home: {
    name: "Aspen Valley",
    shortName: "ASV",
    primaryColor: "#1f4e3d",
    logoText: "AV",
    jerseyText: "4",
  },
  away: {
    name: "Boca Raton",
    shortName: "BOC",
    primaryColor: "#b71c1c",
    logoText: "BR",
    jerseyText: "2",
  },
  homeScore: 7,
  awayScore: 4,
  chukker: 4,
  totalChukkers: 6,
  clock: "5:23",
  tournament: "Sun Cup",
  eventLogoText: "SUN\u00A0CUP",
  clockRunning: true,
};

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.startsWith("#") ? hex.slice(1) : hex;
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150;
}

// Mute a saturated team color toward a soft pastel by blending with cream.
// Used for the jumbotron panel backgrounds — keeps team identity while
// reading as elegantly muted (matches the reference style).
export function pastel(hex: string, mix = 0.55): string {
  const [r, g, b] = hexToRgb(hex);
  const cream = [245, 240, 232];
  const m = (c: number, t: number) => Math.round(c * (1 - mix) + t * mix);
  return `rgb(${m(r, cream[0])}, ${m(g, cream[1])}, ${m(b, cream[2])})`;
}

export function onColor(hex: string) {
  const light = isLight(hex);
  return {
    text: light ? "#0b0b0b" : "#ffffff",
    subtle: light ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)",
    line: light ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.22)",
    bubbleBg: light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)",
    shadow: light
      ? "0 1px 2px rgba(255,255,255,0.4)"
      : "0 2px 6px rgba(0,0,0,0.45)",
  };
}

export function FrameWrapper({ children, bg = "#0a0a0a" }: { children: React.ReactNode; bg?: string }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: bg,
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
        <div style={{
          position: "absolute",
          inset: 0,
          containerType: "size",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Stylised polo jersey rendered with SVG. Body fills with team color, has a
// contrasting collar/cuffs and a big number on the chest.
export function JerseyGraphic({ team, sizeCqh = 40 }: { team: JumboTeam; sizeCqh?: number }) {
  const c = onColor(team.primaryColor);
  const trim = c.text === "#ffffff" ? "#ffffff" : "#0b0b0b";
  const stripe = c.text === "#ffffff" ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)";
  return (
    <div style={{
      width: `${sizeCqh * 0.85}cqh`,
      height: `${sizeCqh}cqh`,
      filter: "drop-shadow(0 1.5cqh 2.5cqh rgba(0,0,0,0.25))",
    }}>
      <svg viewBox="0 0 200 230" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <path d="M 10 50 L 50 30 L 70 70 L 40 110 L 10 100 Z" fill={team.primaryColor} stroke={trim} strokeWidth="3" />
        <path d="M 190 50 L 150 30 L 130 70 L 160 110 L 190 100 Z" fill={team.primaryColor} stroke={trim} strokeWidth="3" />
        <path d="M 50 30 L 75 25 Q 100 15 125 25 L 150 30 L 145 230 L 55 230 Z" fill={team.primaryColor} stroke={trim} strokeWidth="3" />
        <path d="M 75 25 Q 100 50 125 25 L 115 35 Q 100 45 85 35 Z" fill={trim} />
        <rect x="55" y="80" width="90" height="6" fill={stripe} />
        <rect x="55" y="200" width="90" height="6" fill={stripe} />
        <text
          x="100"
          y="170"
          textAnchor="middle"
          fontFamily="'Inter',sans-serif"
          fontWeight="900"
          fontSize="90"
          fill={c.text}
          stroke={trim}
          strokeWidth="2"
        >
          {team.jerseyText}
        </text>
      </svg>
    </div>
  );
}

// Round event/championship seal styled to feel like the Aspen reference.
export function EventSeal({ data, sizeCqh = 26 }: { data: JumboData; sizeCqh?: number }) {
  return (
    <div style={{
      width: `${sizeCqh}cqh`,
      height: `${sizeCqh}cqh`,
      borderRadius: "50%",
      background: "radial-gradient(circle at 30% 30%, #1e3a5f 0%, #0c1a35 70%, #050d1f 100%)",
      border: "0.4cqh solid rgba(255,255,255,0.15)",
      boxShadow: "0 0 3cqh rgba(0,0,0,0.5), inset 0 0 1cqh rgba(255,255,255,0.08)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      color: "#fff",
      flexShrink: 0,
      position: "relative",
    }}>
      {/* Top arc text */}
      <svg viewBox="0 0 100 100" width="92%" height="92%" style={{ position: "absolute", inset: "4%" }}>
        <defs>
          <path id="eventArcTop" d="M 14 50 A 36 36 0 0 1 86 50" fill="none" />
          <path id="eventArcBot" d="M 16 56 A 34 34 0 0 0 84 56" fill="none" />
        </defs>
        <circle cx="50" cy="50" r="46" fill="none" stroke="#c9a35a" strokeWidth="0.6" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="#c9a35a" strokeWidth="0.4" opacity="0.6" />
        <text fill="#fff" fontSize="6.4" fontWeight="700" letterSpacing="0.6" fontFamily="'Inter',sans-serif">
          <textPath href="#eventArcTop" startOffset="50%" textAnchor="middle">
            POLO CHAMPIONSHIP
          </textPath>
        </text>
        <text fill="#c9a35a" fontSize="5" fontWeight="600" letterSpacing="0.8" fontFamily="'Inter',sans-serif">
          <textPath href="#eventArcBot" startOffset="50%" textAnchor="middle">
            EST · 2026
          </textPath>
        </text>
      </svg>
      {/* Center content */}
      <div style={{
        fontSize: `${sizeCqh * 0.16}cqh`,
        fontWeight: 900,
        letterSpacing: "0.1cqh",
        textAlign: "center",
        lineHeight: 1,
        color: "#f5f0e8",
        zIndex: 1,
      }}>
        {data.eventLogoText}
      </div>
      <div style={{
        fontSize: `${sizeCqh * 0.07}cqh`,
        fontWeight: 600,
        color: "#c9a35a",
        letterSpacing: "0.3cqh",
        marginTop: "0.4cqh",
        zIndex: 1,
      }}>
        ASPEN
      </div>
    </div>
  );
}
