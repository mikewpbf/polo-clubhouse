export interface GraphicTeam {
  name: string;
  shortName?: string;
  logoUrl?: string | null;
  logoBase64?: string | null;
  primaryColor?: string;
  score?: number;
}

export interface GraphicData {
  headline: string;
  subheadline: string;
  date: string;
  time: string;
  location: string;
  badge: string;
  accentColor: string;
  textColor: string;
  homeTeam: GraphicTeam;
  awayTeam: GraphicTeam;
}

export type TemplateName = "bold-diagonal" | "sports-poster";
export type GraphicOrientation = "horizontal" | "vertical";

interface TemplateProps {
  data: GraphicData;
  orientation: GraphicOrientation;
}

function getDimensions(orientation: GraphicOrientation): { w: number; h: number } {
  return orientation === "horizontal" ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 };
}

function TeamLogo({ team, size, shadow }: { team: GraphicTeam; size: number; shadow?: string }) {
  const logo = team.logoBase64;
  const shadowStyle = shadow || `0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)`;
  if (logo) {
    return (
      <img
        src={logo}
        alt={team.name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: `5px solid rgba(255,255,255,0.25)`,
          boxShadow: shadowStyle,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${team.primaryColor || "#2E7D32"}, ${team.primaryColor || "#2E7D32"}cc)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `5px solid rgba(255,255,255,0.25)`,
        boxShadow: shadowStyle,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: "#fff",
          fontWeight: 800,
          fontSize: Math.round(size * 0.3),
          letterSpacing: "0.02em",
          fontFamily: "'Inter', system-ui, sans-serif",
          textShadow: "0 2px 4px rgba(0,0,0,0.3)",
        }}
      >
        {team.shortName || team.name.substring(0, 3).toUpperCase()}
      </span>
    </div>
  );
}

export function BoldDiagonal({ data, orientation }: TemplateProps) {
  const { w, h } = getDimensions(orientation);
  const isVert = orientation === "vertical";
  const accent = data.accentColor || "#1B5E20";
  const homeColor = data.homeTeam.primaryColor || accent;
  const awayColor = data.awayTeam.primaryColor || "#374151";

  const homeClip = isVert
    ? "polygon(0 0, 100% 0, 100% 40%, 0 60%)"
    : "polygon(0 0, 60% 0, 40% 100%, 0 100%)";
  const awayClip = isVert
    ? "polygon(0 60%, 100% 40%, 100% 100%, 0 100%)"
    : "polygon(60% 0, 100% 0, 100% 100%, 40% 100%)";

  const logoSize = isVert ? 300 : 280;
  const vsSize = isVert ? 80 : 70;

  return (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        background: awayColor,
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: homeColor, clipPath: homeClip }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.08) 100%)", clipPath: homeClip }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(315deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.08) 100%)", clipPath: awayClip }} />

      <div
        style={{
          position: "absolute",
          left: isVert ? "50%" : "25%",
          top: isVert ? "30%" : "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: isVert ? 20 : 16,
        }}
      >
        <TeamLogo
          team={data.homeTeam}
          size={logoSize}
          shadow="0 8px 40px rgba(0,0,0,0.3)"
        />
        <div
          style={{
            color: "#fff",
            fontWeight: 800,
            fontSize: isVert ? 38 : 34,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            textShadow: "0 3px 12px rgba(0,0,0,0.4)",
            maxWidth: isVert ? 400 : 360,
            lineHeight: 1.15,
          }}
        >
          {data.homeTeam.name}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: isVert ? "50%" : "75%",
          top: isVert ? "70%" : "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: isVert ? 20 : 16,
        }}
      >
        <TeamLogo
          team={data.awayTeam}
          size={logoSize}
          shadow="0 8px 40px rgba(0,0,0,0.3)"
        />
        <div
          style={{
            color: "#fff",
            fontWeight: 800,
            fontSize: isVert ? 38 : 34,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            textShadow: "0 3px 12px rgba(0,0,0,0.4)",
            maxWidth: isVert ? 400 : 360,
            lineHeight: 1.15,
          }}
        >
          {data.awayTeam.name}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 4,
          width: vsSize,
          height: vsSize,
          borderRadius: "50%",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        }}
      >
        <span
          style={{
            color: "#333",
            fontWeight: 800,
            fontSize: isVert ? 26 : 22,
            letterSpacing: "0.04em",
          }}
        >
          vs
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          top: isVert ? "6%" : "15%",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 5,
          textAlign: "center",
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: isVert ? 20 : 16,
          padding: isVert ? "32px 56px" : "28px 50px",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {data.badge && (
          <div style={{ marginBottom: isVert ? 14 : 10 }}>
            <span
              style={{
                background: accent,
                color: "#fff",
                fontWeight: 800,
                fontSize: isVert ? 18 : 16,
                letterSpacing: "0.22em",
                padding: isVert ? "8px 30px" : "6px 24px",
                textTransform: "uppercase",
                borderRadius: 4,
              }}
            >
              {data.badge}
            </span>
          </div>
        )}
        <div
          style={{
            fontSize: isVert ? 44 : 44,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "0.05em",
            lineHeight: 1.1,
            textTransform: "uppercase",
            whiteSpace: isVert ? "nowrap" : undefined,
          }}
        >
          {data.headline}
        </div>
        {data.subheadline && (
          <div
            style={{
              fontSize: isVert ? 24 : 20,
              fontWeight: 500,
              color: "rgba(255,255,255,0.7)",
              letterSpacing: "0.08em",
              marginTop: 8,
              textTransform: "uppercase",
            }}
          >
            {data.subheadline}
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: isVert ? "3%" : "4%",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 5,
          display: "flex",
          flexDirection: isVert ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: isVert ? 8 : 36,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: isVert ? 20 : 16,
          padding: isVert ? "20px 40px" : "16px 40px",
          border: "1px solid rgba(255,255,255,0.1)",
          whiteSpace: "nowrap",
        }}
      >
        {data.date && (
          <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 800, fontSize: isVert ? 22 : 20, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {data.date}
          </span>
        )}
        {data.time && (
          <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 800, fontSize: isVert ? 22 : 20, letterSpacing: "0.06em" }}>
            {data.time}
          </span>
        )}
        {data.location && (
          <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 800, fontSize: isVert ? 22 : 20, letterSpacing: "0.06em" }}>
            {data.location}
          </span>
        )}
      </div>
    </div>
  );
}

export function SportsPoster({ data, orientation }: TemplateProps) {
  const { w, h } = getDimensions(orientation);
  const isVert = orientation === "vertical";
  const accent = data.accentColor || "#1B5E20";
  const txtColor = data.textColor || "#ffffff";
  const homeColor = data.homeTeam.primaryColor || accent;
  const awayColor = data.awayTeam.primaryColor || "#374151";

  return (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        background: `linear-gradient(135deg, ${homeColor} 0%, #111 50%, ${awayColor} 100%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: `linear-gradient(90deg, ${homeColor}, ${accent}, ${awayColor})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: `linear-gradient(90deg, ${homeColor}, ${accent}, ${awayColor})`,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: isVert ? "6%" : "15%",
          left: 0,
          right: 0,
          zIndex: 5,
          textAlign: "center",
          padding: isVert ? "0 70px" : "0 100px",
        }}
      >
        {data.badge && (
          <div style={{ marginBottom: isVert ? 24 : 16 }}>
            <span
              style={{
                background: accent,
                color: "#fff",
                fontWeight: 800,
                fontSize: isVert ? 20 : 17,
                letterSpacing: "0.2em",
                padding: isVert ? "12px 40px" : "10px 32px",
                borderRadius: 6,
                textTransform: "uppercase",
              }}
            >
              {data.badge}
            </span>
          </div>
        )}
        <div
          style={{
            fontSize: isVert ? 68 : 52,
            fontWeight: 800,
            color: txtColor,
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
            textTransform: "uppercase",
            textShadow: "0 4px 24px rgba(0,0,0,0.5)",
          }}
        >
          {data.headline}
        </div>
        {data.subheadline && (
          <div
            style={{
              fontSize: isVert ? 26 : 22,
              fontWeight: 500,
              color: "rgba(255,255,255,0.55)",
              letterSpacing: "0.06em",
              marginTop: 12,
            }}
          >
            {data.subheadline}
          </div>
        )}
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: isVert ? "90px 70px" : "60px 100px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: isVert ? 60 : 90,
            flexDirection: isVert ? "column" : "row",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: isVert ? 28 : 22 }}>
            <TeamLogo
              team={data.homeTeam}
              size={isVert ? 300 : 250}
              shadow={`0 0 0 8px ${homeColor}44, 0 20px 60px rgba(0,0,0,0.5)`}
            />
            <div
              style={{
                color: txtColor,
                fontWeight: 700,
                fontSize: isVert ? 44 : 38,
                textAlign: "center",
                maxWidth: isVert ? 500 : 400,
                lineHeight: 1.15,
                textShadow: "0 3px 12px rgba(0,0,0,0.4)",
              }}
            >
              {data.homeTeam.name}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: isVert ? 100 : 90,
                height: isVert ? 100 : 90,
                borderRadius: "50%",
                border: `4px solid ${accent}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 40px ${accent}44`,
                background: "rgba(0,0,0,0.3)",
              }}
            >
              <span
                style={{
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: isVert ? 34 : 30,
                  letterSpacing: "0.05em",
                }}
              >
                VS
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: isVert ? 28 : 22 }}>
            <TeamLogo
              team={data.awayTeam}
              size={isVert ? 300 : 250}
              shadow={`0 0 0 8px ${awayColor}44, 0 20px 60px rgba(0,0,0,0.5)`}
            />
            <div
              style={{
                color: txtColor,
                fontWeight: 700,
                fontSize: isVert ? 44 : 38,
                textAlign: "center",
                maxWidth: isVert ? 500 : 400,
                lineHeight: 1.15,
                textShadow: "0 3px 12px rgba(0,0,0,0.4)",
              }}
            >
              {data.awayTeam.name}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: isVert ? "3%" : "4%",
          left: 0,
          right: 0,
          zIndex: 5,
          display: "flex",
          flexDirection: isVert ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: isVert ? 10 : 40,
        }}
      >
          {data.date && (
            <div style={{ color: "rgba(255,255,255,0.85)", fontWeight: 800, fontSize: isVert ? 26 : 22, letterSpacing: "0.04em" }}>
              {data.date}
            </div>
          )}
          {data.time && (
            <div style={{ color: "rgba(255,255,255,0.85)", fontWeight: 800, fontSize: isVert ? 26 : 22 }}>
              {data.time}
            </div>
          )}
          {data.location && (
            <div style={{ color: "rgba(255,255,255,0.85)", fontWeight: 800, fontSize: isVert ? 26 : 22 }}>
              {data.location}
            </div>
          )}
      </div>
    </div>
  );
}

export const TEMPLATES: { id: TemplateName; label: string; component: React.FC<TemplateProps> }[] = [
  { id: "bold-diagonal", label: "Diagonal", component: BoldDiagonal },
  { id: "sports-poster", label: "Sports Poster", component: SportsPoster },
];
