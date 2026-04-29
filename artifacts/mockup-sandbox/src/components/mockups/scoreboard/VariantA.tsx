import './_group.css';
import { useState, useLayoutEffect, useEffect, useRef, useCallback } from 'react';

// ── Inline color-contrast utilities ──────────────────────────────────────────
interface OnColorTheme {
  text: string; shadow: string; bubbleBg: string; logoBorder: string; isLight: boolean;
}
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

interface BroadcastTeam { name: string; shortName?: string; scoreboardName?: string; logoUrl?: string; primaryColor?: string }
interface MockData {
  homeTeam: BroadcastTeam | null; awayTeam: BroadcastTeam | null;
  homeScore: number; awayScore: number; currentChukker: number;
  clock: string; status: string; tournament: { name: string } | null;
}

// ── VARIANT A: Bigger clock, closer to panel edges ────────────────────────────
// Changes vs Current:
//   • Panel height: 56px → 68px (taller to give clock room)
//   • Clock font: 20px → 28px
//   • Chukker font: 24px → 30px
//   • Center: justify-content space-between + padding 8px 16px (fills top/bottom)
//   • Center min-width: 80px → 96px
//   • Score font: 30px → 34px
function VariantScoreBug({ data }: { data: MockData }) {
  const home = data.homeTeam;
  const away = data.awayTeam;
  const homeColor = home?.primaryColor || '#374151';
  const awayColor = away?.primaryColor || '#374151';
  const homeTheme = getOnColorTheme(homeColor);
  const awayTheme = getOnColorTheme(awayColor);

  // ↑ Bar height — 64px (between original 56 and previous 72)
  const BAR_H = 64;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 8, overflow: 'hidden', fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
      {data.tournament?.name && <TournamentTitleBar name={data.tournament.name} />}
      <div style={{ display: 'flex', alignItems: 'stretch', height: BAR_H }}>

        {/* Home team */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: `linear-gradient(135deg, ${homeColor}dd, ${homeColor}bb)`, width: 270, height: '100%', boxSizing: 'border-box' }}>
          {home?.logoUrl
            ? <img src={home.logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: homeTheme.logoBorder, flexShrink: 0 }} />
            : <div style={{ width: 32, height: 32, borderRadius: '50%', background: homeTheme.bubbleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: homeTheme.text, flexShrink: 0 }}>{teamLogoFallback(home)}</div>
          }
          <div style={{ width: 8, flexShrink: 0 }} />
          <span style={{ color: homeTheme.text, fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap', textTransform: 'uppercase', textShadow: homeTheme.shadow, overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {teamDisplayName(home)}
          </span>
          {/* ↑ Bigger score, pulled toward center panel edge */}
          <span style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: 34, fontWeight: 800, color: homeTheme.text, lineHeight: 1, minWidth: 44, textAlign: 'center', marginLeft: 8, textShadow: themed(homeTheme, '0 1px 3px rgba(255,255,255,0.55)', '0 1px 3px rgba(0,0,0,0.45)'), flexShrink: 0 }}>
            {data.homeScore}
          </span>
        </div>

        {/* ↑ Center: chukker high, clock low, good separation via asymmetric padding */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '3px 16px 8px', background: NEAR_BLACK, minWidth: 96 }}>
          <span style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
            {data.currentChukker}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1, letterSpacing: 0.5 }}>
            {data.status === 'halftime' ? 'HT' : data.clock}
          </span>
        </div>

        {/* Away team */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: `linear-gradient(135deg, ${awayColor}bb, ${awayColor}dd)`, width: 270, height: '100%', boxSizing: 'border-box' }}>
          {/* ↑ Bigger score, pulled toward center panel edge */}
          <span style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: 34, fontWeight: 800, color: awayTheme.text, lineHeight: 1, minWidth: 44, textAlign: 'center', marginRight: 8, textShadow: themed(awayTheme, '0 1px 3px rgba(255,255,255,0.55)', '0 1px 3px rgba(0,0,0,0.45)'), flexShrink: 0 }}>
            {data.awayScore}
          </span>
          <span style={{ color: awayTheme.text, fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap', textTransform: 'uppercase', textShadow: awayTheme.shadow, overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'right' }}>
            {teamDisplayName(away)}
          </span>
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

const MOCK_DATA: MockData = {
  homeTeam: { name: 'Valiente', shortName: 'VAL', primaryColor: '#1e3a5f' },
  awayTeam: { name: 'Dutta Corp', shortName: 'DUT', primaryColor: '#7c3f00' },
  homeScore: 8, awayScore: 7, currentChukker: 5, clock: '5:47', status: 'live',
  tournament: { name: 'USPA Gold Cup 2025' },
};

export function VariantA() {
  const [showTournament, setShowTournament] = useState(true);
  const [homeColor, setHomeColor] = useState(MOCK_DATA.homeTeam!.primaryColor!);
  const [awayColor, setAwayColor] = useState(MOCK_DATA.awayTeam!.primaryColor!);
  const [homeScore, setHomeScore] = useState(MOCK_DATA.homeScore);
  const [awayScore, setAwayScore] = useState(MOCK_DATA.awayScore);
  const [chukker, setChukker] = useState(MOCK_DATA.currentChukker);
  const [clock, setClock] = useState(MOCK_DATA.clock);

  const data: MockData = {
    ...MOCK_DATA,
    homeTeam: { ...MOCK_DATA.homeTeam!, primaryColor: homeColor },
    awayTeam: { ...MOCK_DATA.awayTeam!, primaryColor: awayColor },
    homeScore, awayScore, currentChukker: chukker, clock,
    tournament: showTournament ? MOCK_DATA.tournament : null,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', padding: 40, gap: 24, fontFamily: "'Inter', sans-serif" }}>

      {/* Label */}
      <div style={{ color: '#666', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5 }}>
        Variant — Bigger clock, closer to edges
      </div>

      <VariantScoreBug data={data} />

      {/* Diff callouts */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {['Clock: 20 → 28px', 'Chukker: 24 → 30px', 'Score: 30 → 34px', 'Bar height: 56 → 80px', 'Chukker shifted up'].map(label => (
          <span key={label} style={{ background: 'rgba(99,213,128,0.12)', border: '1px solid rgba(99,213,128,0.3)', color: '#5dba7d', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{label}</span>
        ))}
      </div>

      {/* ── Status bars ──────────────────────────────────────────────────── */}
      <div style={{ color: '#666', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 8 }}>
        Status bars — current vs larger
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* GOAL bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: '#555', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Goal scorer</div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Current */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ color: '#444', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Current</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', borderRadius: 6, background: homeColor, fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: getOnColorTheme(homeColor).text, textTransform: 'uppercase' }}>
                  GOAL: Juan M. Harriott
                </span>
              </div>
            </div>
            {/* Larger */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ color: '#5dba7d', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Larger ✦</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 28px', borderRadius: 8, background: homeColor, fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: getOnColorTheme(homeColor).text, textTransform: 'uppercase' }}>
                  GOAL: Juan M. Harriott
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PENALTY bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: '#555', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Penalty / Timeout</div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Current */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ color: '#444', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Current</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', borderRadius: 6, background: '#b45309', fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Valiente – Penalty</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Juan M. Harriott</span>
              </div>
            </div>
            {/* Larger */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ color: '#5dba7d', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Larger ✦</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 28px', borderRadius: 8, background: '#b45309', fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Valiente – Penalty</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Juan M. Harriott</span>
              </div>
            </div>
          </div>
        </div>

        {/* TIMEOUT bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: '#555', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Timeout</div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Current */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ color: '#444', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Current</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', borderRadius: 6, background: '#1d4ed8', fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Timeout</span>
              </div>
            </div>
            {/* Larger */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ color: '#5dba7d', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Larger ✦</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 28px', borderRadius: 8, background: '#1d4ed8', fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Timeout</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Controls */}
      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end' }}>
        <label style={{ color: '#aaa', fontSize: 12 }}><div style={{ marginBottom: 4 }}>Home colour</div><input type="color" value={homeColor} onChange={e => setHomeColor(e.target.value)} style={{ height: 32, width: 56, cursor: 'pointer', borderRadius: 4, border: 'none' }} /></label>
        <label style={{ color: '#aaa', fontSize: 12 }}><div style={{ marginBottom: 4 }}>Away colour</div><input type="color" value={awayColor} onChange={e => setAwayColor(e.target.value)} style={{ height: 32, width: 56, cursor: 'pointer', borderRadius: 4, border: 'none' }} /></label>
        <label style={{ color: '#aaa', fontSize: 12 }}><div style={{ marginBottom: 4 }}>Home score</div><input type="number" min={0} max={99} value={homeScore} onChange={e => setHomeScore(Number(e.target.value))} style={{ width: 60, height: 32, borderRadius: 4, border: '1px solid #444', background: '#222', color: '#fff', fontSize: 14, textAlign: 'center' }} /></label>
        <label style={{ color: '#aaa', fontSize: 12 }}><div style={{ marginBottom: 4 }}>Away score</div><input type="number" min={0} max={99} value={awayScore} onChange={e => setAwayScore(Number(e.target.value))} style={{ width: 60, height: 32, borderRadius: 4, border: '1px solid #444', background: '#222', color: '#fff', fontSize: 14, textAlign: 'center' }} /></label>
        <label style={{ color: '#aaa', fontSize: 12 }}><div style={{ marginBottom: 4 }}>Chukker</div><input type="number" min={1} max={8} value={chukker} onChange={e => setChukker(Number(e.target.value))} style={{ width: 60, height: 32, borderRadius: 4, border: '1px solid #444', background: '#222', color: '#fff', fontSize: 14, textAlign: 'center' }} /></label>
        <label style={{ color: '#aaa', fontSize: 12 }}><div style={{ marginBottom: 4 }}>Clock</div><input type="text" value={clock} onChange={e => setClock(e.target.value)} style={{ width: 70, height: 32, borderRadius: 4, border: '1px solid #444', background: '#222', color: '#fff', fontSize: 14, textAlign: 'center' }} /></label>
        <label style={{ color: '#aaa', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={showTournament} onChange={e => setShowTournament(e.target.checked)} style={{ width: 16, height: 16 }} />Tournament bar</label>
      </div>

    </div>
  );
}
