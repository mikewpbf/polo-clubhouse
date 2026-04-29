import './_group.css';
import { useState, useLayoutEffect, useEffect, useRef, useCallback } from 'react';

// ── Color utilities ───────────────────────────────────────────────────────────
interface OnColorTheme { text: string; shadow: string; bubbleBg: string; logoBorder: string; isLight: boolean }
const DARK_THEME: OnColorTheme = { text: '#ffffff', shadow: '0 1px 2px rgba(0,0,0,0.3)', bubbleBg: 'rgba(255,255,255,0.2)', logoBorder: '2px solid rgba(255,255,255,0.3)', isLight: false };
const LIGHT_THEME: OnColorTheme = { text: '#0b0b0b', shadow: '0 1px 2px rgba(255,255,255,0.45)', bubbleBg: 'rgba(0,0,0,0.12)', logoBorder: '2px solid rgba(0,0,0,0.25)', isLight: true };
function isLightColor(hex: string): boolean {
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return (r*299+g*587+b*114)/1000 >= 150;
}
const getOnColorTheme = (hex: string) => isLightColor(hex) ? LIGHT_THEME : DARK_THEME;
const themed = <T,>(theme: OnColorTheme, light: T, dark: T): T => theme.isLight ? light : dark;

const NEAR_BLACK = 'rgba(0, 0, 0, 0.85)';
const BASE_FONT_SIZE = 12;
const BASE_SPACING = 1.5;
const MAX_SPACING = 12;
const MIN_FONT_SIZE = 9;
const MIN_SPACING = 0.5;

function measureTextWidth(text: string, fontSize: number, letterSpacing: number): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = `600 ${fontSize}px Inter, 'Helvetica Neue', sans-serif`;
  return ctx.measureText(text.toUpperCase()).width + (Math.max(text.length-1,0)*letterSpacing);
}
function teamDisplayName(team: { name: string; scoreboardName?: string } | null): string {
  if (!team) return 'TBD';
  const n = team.scoreboardName || team.name || 'TBD';
  return n.length > 12 ? n.slice(0,12) : n;
}
function teamLogoFallback(team: { name: string; shortName?: string } | null): string {
  if (!team) return '?';
  return (team.shortName || team.name?.slice(0,3) || '?').toUpperCase();
}
function TournamentTitleBar({ name, borderBottom }: { name: string; borderBottom?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [textStyle, setTextStyle] = useState({ fontSize: BASE_FONT_SIZE, letterSpacing: BASE_SPACING });
  const measure = useCallback(() => {
    const el = containerRef.current; if (!el) return;
    const w = el.clientWidth - 40; if (w <= 0) return;
    const nat = measureTextWidth(name, BASE_FONT_SIZE, BASE_SPACING); if (nat <= 0) return;
    if (nat < w * 0.7) { const extra = (w * 0.9) - nat; setTextStyle({ fontSize: BASE_FONT_SIZE, letterSpacing: Math.min(BASE_SPACING + extra/name.length, MAX_SPACING) }); }
    else if (nat > w) { const scale = w/nat; setTextStyle({ fontSize: Math.max(BASE_FONT_SIZE*scale, MIN_FONT_SIZE), letterSpacing: Math.max(BASE_SPACING*scale, MIN_SPACING) }); }
    else { setTextStyle({ fontSize: BASE_FONT_SIZE, letterSpacing: BASE_SPACING }); }
  }, [name]);
  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => { const el = containerRef.current; if (!el) return; const ob = new ResizeObserver(measure); ob.observe(el); return () => ob.disconnect(); }, [measure]);
  return (
    <div ref={containerRef} style={{ background: NEAR_BLACK, padding: '6px 20px', textAlign: 'center', overflow: 'hidden', ...(borderBottom ? { borderBottom } : {}) }}>
      <span style={{ color: '#fff', fontSize: textStyle.fontSize, fontWeight: 600, letterSpacing: textStyle.letterSpacing, textTransform: 'uppercase', fontFamily: "'Inter','Helvetica Neue',sans-serif", whiteSpace: 'nowrap' }}>{name}</span>
    </div>
  );
}

// ── Score Bug (updated sizes) ─────────────────────────────────────────────────
interface BroadcastTeam { name: string; shortName?: string; scoreboardName?: string; logoUrl?: string; primaryColor?: string }
interface MockData {
  homeTeam: BroadcastTeam | null; awayTeam: BroadcastTeam | null;
  homeScore: number; awayScore: number; currentChukker: number;
  clock: string; status: string; tournament: { name: string } | null;
}

function ScoreBug({ data }: { data: MockData }) {
  const home = data.homeTeam;
  const away = data.awayTeam;
  const homeColor = home?.primaryColor || '#374151';
  const awayColor = away?.primaryColor || '#374151';
  const homeTheme = getOnColorTheme(homeColor);
  const awayTheme = getOnColorTheme(awayColor);
  const BAR_H = 64;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 8, overflow: 'hidden', fontFamily: "'Inter','Helvetica Neue',sans-serif", boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
      {data.tournament?.name && <TournamentTitleBar name={data.tournament.name} />}
      <div style={{ display: 'flex', alignItems: 'stretch', height: BAR_H }}>
        {/* Home */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: `linear-gradient(135deg, ${homeColor}dd, ${homeColor}bb)`, width: 270, height: '100%', boxSizing: 'border-box' }}>
          {home?.logoUrl
            ? <img src={home.logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: homeTheme.logoBorder, flexShrink: 0 }} />
            : <div style={{ width: 32, height: 32, borderRadius: '50%', background: homeTheme.bubbleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: homeTheme.text, flexShrink: 0 }}>{teamLogoFallback(home)}</div>
          }
          <div style={{ width: 8, flexShrink: 0 }} />
          <span style={{ color: homeTheme.text, fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap', textTransform: 'uppercase', textShadow: homeTheme.shadow, overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{teamDisplayName(home)}</span>
          <span style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: 34, fontWeight: 800, color: homeTheme.text, lineHeight: 1, minWidth: 44, textAlign: 'center', marginLeft: 8, textShadow: themed(homeTheme, '0 1px 3px rgba(255,255,255,0.55)', '0 1px 3px rgba(0,0,0,0.45)'), flexShrink: 0 }}>{data.homeScore}</span>
        </div>
        {/* Center: clock */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '3px 16px 8px', background: NEAR_BLACK, minWidth: 96 }}>
          <span style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{data.currentChukker}</span>
          <span style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1, letterSpacing: 0.5 }}>{data.status === 'halftime' ? 'HT' : data.clock}</span>
        </div>
        {/* Away */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: `linear-gradient(135deg, ${awayColor}bb, ${awayColor}dd)`, width: 270, height: '100%', boxSizing: 'border-box' }}>
          <span style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: 34, fontWeight: 800, color: awayTheme.text, lineHeight: 1, minWidth: 44, textAlign: 'center', marginRight: 8, textShadow: themed(awayTheme, '0 1px 3px rgba(255,255,255,0.55)', '0 1px 3px rgba(0,0,0,0.45)'), flexShrink: 0 }}>{data.awayScore}</span>
          <span style={{ color: awayTheme.text, fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap', textTransform: 'uppercase', textShadow: awayTheme.shadow, overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'right' }}>{teamDisplayName(away)}</span>
          <div style={{ width: 8, flexShrink: 0 }} />
          {away?.logoUrl
            ? <img src={away.logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: awayTheme.logoBorder, flexShrink: 0 }} />
            : <div style={{ width: 32, height: 32, borderRadius: '50%', background: awayTheme.bubbleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: awayTheme.text, flexShrink: 0 }}>{teamLogoFallback(away)}</div>
          }
        </div>
      </div>
    </div>
  );
}

// ── Status bar: Goal ─────────────────────────────────────────────────────────
function GoalBar({ color, playerName, visible }: { color: string; playerName: string; visible: boolean }) {
  const theme = getOnColorTheme(color);
  return (
    <div style={{ transition: 'opacity 0.4s ease, transform 0.4s ease', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-8px)', pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', borderRadius: 8, background: color, fontFamily: "'Inter','Helvetica Neue',sans-serif", boxShadow: '0 4px 16px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 19, fontWeight: 700, color: theme.text, textTransform: 'uppercase', textShadow: theme.shadow }}>GOAL: {playerName}</span>
      </div>
    </div>
  );
}

// ── Status bar: Stoppage (penalty / timeout) ──────────────────────────────────
function StoppageBar({ label, playerName, color, visible }: { label: string; playerName?: string; color: string; visible: boolean }) {
  return (
    <div style={{ transition: 'opacity 0.4s ease, transform 0.4s ease', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-8px)', pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 24px', borderRadius: 8, background: color, fontFamily: "'Inter','Helvetica Neue',sans-serif", boxShadow: '0 4px 16px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1.5 }}>{label}</span>
        {playerName && <span style={{ fontSize: 19, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{playerName}</span>}
      </div>
    </div>
  );
}

const MOCK_DATA = {
  homeTeam: { name: 'Valiente', shortName: 'VAL', primaryColor: '#1e3a5f' },
  awayTeam: { name: 'Dutta Corp', shortName: 'DUT', primaryColor: '#7c3f00' },
  homeScore: 8, awayScore: 7, currentChukker: 5, clock: '5:47', status: 'live',
  tournament: { name: 'USPA Gold Cup 2025' },
};

type AlertKind = 'goal-home' | 'goal-away' | 'penalty' | 'timeout' | null;

export function VariantFull() {
  const [homeColor, setHomeColor] = useState(MOCK_DATA.homeTeam.primaryColor);
  const [awayColor, setAwayColor] = useState(MOCK_DATA.awayTeam.primaryColor);
  const [homeScore, setHomeScore] = useState(MOCK_DATA.homeScore);
  const [awayScore, setAwayScore] = useState(MOCK_DATA.awayScore);
  const [chukker, setChukker] = useState(MOCK_DATA.currentChukker);
  const [clock, setClock] = useState(MOCK_DATA.clock);
  const [showTournament, setShowTournament] = useState(true);
  const [activeAlert, setActiveAlert] = useState<AlertKind>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function fire(kind: AlertKind) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActiveAlert(kind);
    timerRef.current = setTimeout(() => setActiveAlert(null), 4500);
  }

  const data: MockData = {
    ...MOCK_DATA,
    homeTeam: { ...MOCK_DATA.homeTeam, primaryColor: homeColor },
    awayTeam: { ...MOCK_DATA.awayTeam, primaryColor: awayColor },
    homeScore, awayScore, currentChukker: chukker, clock,
    tournament: showTournament ? MOCK_DATA.tournament : null,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Simulated broadcast frame */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: 'linear-gradient(160deg, #1a2635 0%, #0d1a12 40%, #1a1208 70%, #201010 100%)', flexShrink: 0, overflow: 'hidden' }}>

        {/* Simulated pitch texture */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0px, transparent 1px, transparent 80px, rgba(255,255,255,0.015) 81px)', opacity: 0.6 }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.01) 0px, transparent 1px, transparent 60px, rgba(255,255,255,0.01) 61px)', opacity: 0.6 }} />

        {/* Overlay label */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'rgba(255,255,255,0.06)', fontSize: 32, fontWeight: 800, letterSpacing: 6, textTransform: 'uppercase', userSelect: 'none', pointerEvents: 'none' }}>Live Broadcast</div>

        {/* ── Score bug — top left ── */}
        <div style={{ position: 'absolute', top: 28, left: 28 }}>
          <ScoreBug data={data} />
        </div>

        {/* ── Status bars — appear below the score bug ── */}
        <div style={{ position: 'absolute', top: 136, left: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GoalBar
            color={homeColor}
            playerName="Juan M. Harriott"
            visible={activeAlert === 'goal-home'}
          />
          <GoalBar
            color={awayColor}
            playerName="F. Pieres"
            visible={activeAlert === 'goal-away'}
          />
          <StoppageBar
            label="Valiente – Penalty"
            playerName="Juan M. Harriott"
            color="#b45309"
            visible={activeAlert === 'penalty'}
          />
          <StoppageBar
            label="Timeout"
            color="#1d4ed8"
            visible={activeAlert === 'timeout'}
          />
        </div>

        {/* LIVE badge */}
        <div style={{ position: 'absolute', top: 28, right: 28, background: '#dc2626', borderRadius: 4, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', opacity: 0.9 }} />
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }}>LIVE</span>
        </div>
      </div>

      {/* Controls panel */}
      <div style={{ background: '#141414', borderTop: '1px solid #222', padding: '20px 28px', display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-end' }}>

        {/* Fire buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: '#555', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Fire alert</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([
              { kind: 'goal-home', label: '⚽ Home Goal', bg: homeColor },
              { kind: 'goal-away', label: '⚽ Away Goal', bg: awayColor },
              { kind: 'penalty',   label: '🟨 Penalty',   bg: '#b45309' },
              { kind: 'timeout',   label: '⏱ Timeout',    bg: '#1d4ed8' },
            ] as const).map(({ kind, label, bg }) => (
              <button
                key={kind}
                onClick={() => fire(kind)}
                style={{ background: activeAlert === kind ? bg : 'rgba(255,255,255,0.08)', border: `1px solid ${activeAlert === kind ? bg : '#333'}`, color: activeAlert === kind ? '#fff' : '#aaa', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Colour pickers */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ color: '#aaa', fontSize: 12 }}><div style={{ marginBottom: 4 }}>Home colour</div><input type="color" value={homeColor} onChange={e => setHomeColor(e.target.value)} style={{ height: 32, width: 56, cursor: 'pointer', borderRadius: 4, border: 'none' }} /></label>
          <label style={{ color: '#aaa', fontSize: 12 }}><div style={{ marginBottom: 4 }}>Away colour</div><input type="color" value={awayColor} onChange={e => setAwayColor(e.target.value)} style={{ height: 32, width: 56, cursor: 'pointer', borderRadius: 4, border: 'none' }} /></label>
        </div>

        {/* Score / chukker / clock */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ color: '#aaa', fontSize: 12 }}><div style={{ marginBottom: 4 }}>Home</div><input type="number" min={0} max={99} value={homeScore} onChange={e => setHomeScore(Number(e.target.value))} style={{ width: 52, height: 32, borderRadius: 4, border: '1px solid #333', background: '#1e1e1e', color: '#fff', fontSize: 14, textAlign: 'center' }} /></label>
          <label style={{ color: '#aaa', fontSize: 12 }}><div style={{ marginBottom: 4 }}>Away</div><input type="number" min={0} max={99} value={awayScore} onChange={e => setAwayScore(Number(e.target.value))} style={{ width: 52, height: 32, borderRadius: 4, border: '1px solid #333', background: '#1e1e1e', color: '#fff', fontSize: 14, textAlign: 'center' }} /></label>
          <label style={{ color: '#aaa', fontSize: 12 }}><div style={{ marginBottom: 4 }}>Chukker</div><input type="number" min={1} max={8} value={chukker} onChange={e => setChukker(Number(e.target.value))} style={{ width: 52, height: 32, borderRadius: 4, border: '1px solid #333', background: '#1e1e1e', color: '#fff', fontSize: 14, textAlign: 'center' }} /></label>
          <label style={{ color: '#aaa', fontSize: 12 }}><div style={{ marginBottom: 4 }}>Clock</div><input type="text" value={clock} onChange={e => setClock(e.target.value)} style={{ width: 64, height: 32, borderRadius: 4, border: '1px solid #333', background: '#1e1e1e', color: '#fff', fontSize: 14, textAlign: 'center' }} /></label>
          <label style={{ color: '#aaa', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={showTournament} onChange={e => setShowTournament(e.target.checked)} style={{ width: 16, height: 16 }} />Tournament bar</label>
        </div>

      </div>
    </div>
  );
}
