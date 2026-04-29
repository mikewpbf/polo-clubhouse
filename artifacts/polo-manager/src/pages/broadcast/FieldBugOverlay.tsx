import { useEffect, useState } from "react";

interface FieldData {
  id: string;
  name: string | null;
  number: number | null;
  imageUrl: string | null;
  hasLocation: boolean;
}

interface ClubData {
  name: string;
  logoUrl?: string | null;
}

interface WeatherData {
  temperatureF: number | null;
  windGustMph: number | null;
  weatherCode: number | null;
  condition: string | null;
  timezone?: string | null;
  stale?: boolean;
  fetchedAt?: string | null;
}

interface FieldBugOverlayProps {
  field: FieldData | null;
  club: ClubData | null;
}

const NEAR_BLACK = "rgba(0, 0, 0, 0.85)";
const PANEL_BG = "rgba(255, 255, 255, 0.92)";
const BORDER_LINE = "1px solid rgba(255,255,255,0.08)";

function fieldLabel(field: FieldData | null): string {
  if (!field) return "FIELD";
  const hasName = !!(field.name && field.name.trim());
  const hasNumber = field.number != null;
  if (hasName && hasNumber) return `Field ${field.number} \u00B7 ${field.name}`;
  if (hasName) return field.name as string;
  if (hasNumber) return `Field ${field.number}`;
  return "FIELD";
}

function clubFontSize(name: string): number {
  const len = name.length;
  if (len <= 14) return 22;
  if (len <= 18) return 19;
  if (len <= 22) return 17;
  if (len <= 28) return 15;
  if (len <= 34) return 13;
  return 12;
}

function WeatherIcon({ code, size = 44 }: { code: number | null; size?: number }) {
  const sun = "#f59e0b";
  const sunStroke = "#b45309";
  const cloud = "#d1d5db";
  const cloudStroke = "#6b7280";
  const rainBlue = "#2563eb";
  const lightning = "#facc15";
  const snow = "#bae6fd";
  const fogLine = "#9ca3af";

  const c = code;

  // Fog
  if (c !== null && (c === 45 || c === 48)) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <line x1="8" y1="22" x2="56" y2="22" stroke={fogLine} strokeWidth="4" strokeLinecap="round" />
        <line x1="6" y1="32" x2="58" y2="32" stroke={fogLine} strokeWidth="4" strokeLinecap="round" />
        <line x1="10" y1="42" x2="54" y2="42" stroke={fogLine} strokeWidth="4" strokeLinecap="round" />
        <line x1="14" y1="52" x2="50" y2="52" stroke={fogLine} strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }
  // Overcast
  if (c !== null && c === 3) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <path d="M16 44 Q8 44 8 36 Q8 28 18 28 Q20 18 32 18 Q44 18 46 28 Q56 28 56 36 Q56 44 48 44 Z" fill={cloud} stroke={cloudStroke} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  // Partly cloudy (1, 2)
  if (c !== null && (c === 1 || c === 2)) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <circle cx="22" cy="22" r="9" fill={sun} stroke={sunStroke} strokeWidth="1.5" />
        <line x1="22" y1="6" x2="22" y2="11" stroke={sunStroke} strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="22" x2="11" y2="22" stroke={sunStroke} strokeWidth="2" strokeLinecap="round" />
        <line x1="10" y1="10" x2="14" y2="14" stroke={sunStroke} strokeWidth="2" strokeLinecap="round" />
        <line x1="33" y1="11" x2="29" y2="15" stroke={sunStroke} strokeWidth="2" strokeLinecap="round" />
        <path d="M22 50 Q14 50 14 42 Q14 34 24 34 Q26 26 36 26 Q46 26 48 34 Q56 34 56 42 Q56 50 48 50 Z" fill={cloud} stroke={cloudStroke} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  // Drizzle / rain / showers
  if (c !== null && ((c >= 51 && c <= 67) || (c >= 80 && c <= 82))) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <path d="M16 36 Q8 36 8 28 Q8 20 18 20 Q20 10 32 10 Q44 10 46 20 Q56 20 56 28 Q56 36 48 36 Z" fill={cloud} stroke={cloudStroke} strokeWidth="2" strokeLinejoin="round" />
        <line x1="20" y1="42" x2="16" y2="54" stroke={rainBlue} strokeWidth="3" strokeLinecap="round" />
        <line x1="32" y1="42" x2="28" y2="54" stroke={rainBlue} strokeWidth="3" strokeLinecap="round" />
        <line x1="44" y1="42" x2="40" y2="54" stroke={rainBlue} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  // Snow
  if (c !== null && ((c >= 71 && c <= 77) || c === 85 || c === 86)) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <path d="M16 36 Q8 36 8 28 Q8 20 18 20 Q20 10 32 10 Q44 10 46 20 Q56 20 56 28 Q56 36 48 36 Z" fill={cloud} stroke={cloudStroke} strokeWidth="2" strokeLinejoin="round" />
        <circle cx="20" cy="48" r="3" fill={snow} stroke={cloudStroke} strokeWidth="1" />
        <circle cx="32" cy="52" r="3" fill={snow} stroke={cloudStroke} strokeWidth="1" />
        <circle cx="44" cy="48" r="3" fill={snow} stroke={cloudStroke} strokeWidth="1" />
      </svg>
    );
  }
  // Thunderstorm
  if (c !== null && (c === 95 || c === 96 || c === 99)) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <path d="M16 32 Q8 32 8 24 Q8 16 18 16 Q20 8 32 8 Q44 8 46 16 Q56 16 56 24 Q56 32 48 32 Z" fill={cloud} stroke={cloudStroke} strokeWidth="2" strokeLinejoin="round" />
        <polygon points="30,36 22,52 30,50 26,60 42,42 32,44 36,36" fill={lightning} stroke={cloudStroke} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  }
  // Default / clear (code 0 or unknown)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="13" fill={sun} stroke={sunStroke} strokeWidth="2" />
      <line x1="32" y1="6" x2="32" y2="14" stroke={sunStroke} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="32" y1="50" x2="32" y2="58" stroke={sunStroke} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="6" y1="32" x2="14" y2="32" stroke={sunStroke} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="50" y1="32" x2="58" y2="32" stroke={sunStroke} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="13" y1="13" x2="19" y2="19" stroke={sunStroke} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="45" y1="45" x2="51" y2="51" stroke={sunStroke} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="45" y1="19" x2="51" y2="13" stroke={sunStroke} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="13" y1="51" x2="19" y2="45" stroke={sunStroke} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function PlaceholderField() {
  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: "linear-gradient(180deg, #c5d8a8 0%, #6e9b3f 60%, #4d7a26 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <svg width="120" height="120" viewBox="0 0 64 64" fill="none">
        <rect x="6" y="20" width="52" height="28" rx="2" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <line x1="32" y1="20" x2="32" y2="48" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <circle cx="32" cy="34" r="4" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export function FieldBugOverlay({ field, club }: FieldBugOverlayProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoaded, setWeatherLoaded] = useState(false);

  useEffect(() => {
    if (!field?.id || !field.hasLocation) {
      setWeather(null);
      setWeatherLoaded(true);
      return;
    }
    setWeatherLoaded(false);
    let cancelled = false;
    const fetchWeather = async () => {
      try {
        const base = import.meta.env.BASE_URL.replace(/\/$/, "");
        const r = await fetch(`${base}/api/fields/${field.id}/weather`);
        if (!r.ok) {
          if (!cancelled) { setWeather(null); setWeatherLoaded(true); }
          return;
        }
        const j: WeatherData = await r.json();
        if (!cancelled) { setWeather(j); setWeatherLoaded(true); }
      } catch {
        if (!cancelled) { setWeather(null); setWeatherLoaded(true); }
      }
    };
    fetchWeather();
    const iv = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [field?.id, field?.hasLocation]);

  if (!field) return null;
  // Wait for the first weather load to complete before rendering, so the
  // bug doesn't visibly grow as data arrives.
  if (!weatherLoaded) return null;

  const clubName = (club?.name || "FIELD").toUpperCase();
  const fName = fieldLabel(field);
  const hasWeather = weather && (weather.temperatureF !== null || weather.condition);
  const clubSize = clubFontSize(clubName);

  const PANEL_W = 340;

  return (
    <div style={{
      position: "fixed",
      bottom: 40,
      left: 40,
      width: PANEL_W,
      borderRadius: 4,
      overflow: "hidden",
      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    }}>
      {/* Club header */}
      <div style={{
        background: NEAR_BLACK,
        padding: "9px 14px",
        textAlign: "center",
        borderBottom: BORDER_LINE,
      }}>
        <span style={{
          color: "#fff",
          fontSize: clubSize,
          fontWeight: 800,
          letterSpacing: 1.1,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "block",
          lineHeight: 1.15,
        }}>
          {clubName}
        </span>
      </div>

      {/* Field image — fully opaque */}
      <div style={{
        width: "100%",
        height: 180,
        background: "#1a1a1a",
        position: "relative",
      }}>
        {field.imageUrl ? (
          <img
            src={field.imageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <PlaceholderField />
        )}
      </div>

      {/* Field name/number */}
      <div style={{
        background: NEAR_BLACK,
        padding: "7px 14px",
        textAlign: "center",
        borderTop: BORDER_LINE,
        borderBottom: hasWeather ? BORDER_LINE : "none",
      }}>
        <span style={{
          color: "#fff",
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: 0.5,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "block",
        }}>
          {fName}
        </span>
      </div>

      {/* Weather row — only if available */}
      {hasWeather && (
        <div style={{
          background: PANEL_BG,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            <WeatherIcon code={weather!.weatherCode} size={42} />
          </div>
          <div style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#1a1a1a",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              lineHeight: 1.15,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {weather!.condition || ""}
            </div>
            {weather!.windGustMph !== null && (
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#4b5563",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                lineHeight: 1.15,
              }}>
                Gust {weather!.windGustMph} mph
              </div>
            )}
          </div>
          <div style={{
            flexShrink: 0,
            fontSize: 30,
            fontWeight: 800,
            color: "#1a1a1a",
            lineHeight: 1,
            letterSpacing: -0.5,
          }}>
            {weather!.temperatureF !== null ? (
              <>
                {weather!.temperatureF}<span style={{ fontSize: 18, verticalAlign: "top", marginLeft: 1 }}>°</span>
              </>
            ) : "—"}
          </div>
        </div>
      )}
    </div>
  );
}
