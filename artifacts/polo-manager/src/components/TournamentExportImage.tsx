import { useState, useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getStoredToken } from "@/hooks/use-auth";
const APP_LOGO_BASE64 = "data:image/png;base64,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";

interface Player {
  id: string;
  name: string;
  handicap?: number | null;
  position?: number | null;
}

interface TeamWithPlayers {
  teamId: string;
  name: string;
  shortName?: string;
  primaryColor?: string;
  logoUrl?: string | null;
  players: Player[];
}

interface MatchInfo {
  id: string;
  status: string;
  round?: string | number;
  scheduledAt?: string | null;
  homeScore: number;
  awayScore: number;
  homeTeam?: { name: string; shortName?: string; id?: string } | null;
  awayTeam?: { name: string; shortName?: string; id?: string } | null;
  homeTeamId?: string;
  awayTeamId?: string;
  field?: { name: string } | null;
}

interface ExportData {
  tournament: any;
  matches: MatchInfo[];
  teams: TeamWithPlayers[];
  club: any;
  clubLogoBase64: string | null;
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function imageToBase64(url: string): Promise<string | null> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const headers: Record<string, string> = {};
  if (url.startsWith("/api") || url.startsWith(`${base}/api`)) {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { headers });
    if (response.ok) {
      const result = await blobToDataUrl(await response.blob());
      if (result) return result;
    }
  } catch {}

  if (!url.startsWith("/api") && !url.startsWith(`${base}/api`)) {
    try {
      const proxyUrl = `${base}/api/image-proxy?url=${encodeURIComponent(url)}`;
      const token = getStoredToken();
      const proxyHeaders: Record<string, string> = {};
      if (token) proxyHeaders["Authorization"] = `Bearer ${token}`;
      const response = await fetch(proxyUrl, { headers: proxyHeaders });
      if (response.ok) {
        const result = await blobToDataUrl(await response.blob());
        if (result) return result;
      }
    } catch {}
  }

  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch {
    return null;
  }
}

async function apiFetchJson(path: string) {
  const token = getStoredToken();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  return res.json();
}

async function loadExportData(tournamentId: string): Promise<ExportData | null> {
  const t = await apiFetchJson(`/tournaments/${tournamentId}`);
  if (!t) return null;

  const tournamentTeams: any[] = t.teams || [];
  const teamsWithPlayers: TeamWithPlayers[] = await Promise.all(
    tournamentTeams.map(async (entry: any) => {
      const team = entry.team || {};
      const players = (await apiFetchJson(`/teams/${entry.teamId}/players`)) || [];
      const logoSrc = team.logoUrl || null;
      const logoBase64 = logoSrc ? await imageToBase64(logoSrc) : null;
      return {
        teamId: entry.teamId,
        name: team.name || entry.teamName || "Unknown",
        shortName: team.shortName || "",
        primaryColor: team.primaryColor || "",
        logoUrl: logoBase64 || logoSrc,
        players: players
          .filter((p: any) => p.isActive !== false)
          .sort((a: any, b: any) => (a.position || 99) - (b.position || 99)),
      };
    })
  );

  const club = t.club || {};
  const clubLogoSrc = club.logo96Url || club.logoUrl || null;

  const clubLogoBase64 = clubLogoSrc ? await imageToBase64(clubLogoSrc) : null;

  return {
    tournament: t,
    matches: t.matches || [],
    teams: teamsWithPlayers.sort((a, b) => a.name.localeCompare(b.name)),
    club,
    clubLogoBase64,
  };
}

export function TournamentExportButton({ tournamentId }: { tournamentId: string }) {
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [exportData, setExportData] = useState<ExportData | null>(null);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);

    try {
      const data = await loadExportData(tournamentId);
      if (!data) {
        setExporting(false);
        return;
      }

      setExportData(data);
      await new Promise((r) => setTimeout(r, 800));

      if (!containerRef.current) {
        setExporting(false);
        setExportData(null);
        return;
      }

      const pngOpts = {
        width: 1700,
        pixelRatio: 1,
        backgroundColor: "#ffffff",
        cacheBust: true,
        skipFonts: true,
        includeQueryParams: true,
      };
      await toPng(containerRef.current, pngOpts);
      await new Promise(r => setTimeout(r, 100));
      const dataUrl = await toPng(containerRef.current, pngOpts);

      const link = document.createElement("a");
      link.download = `${String(data.tournament.name || "tournament").replace(/[^a-zA-Z0-9]/g, "_")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
      setExportData(null);
    }
  }, [tournamentId, exporting]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-[12px] gap-1.5"
        onClick={handleExport}
        disabled={exporting}
      >
        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {exporting ? "Generating..." : "Download Image"}
      </Button>

      {exportData && (
        <ExportLayout
          ref={containerRef}
          tournament={exportData.tournament}
          matches={exportData.matches}
          teams={exportData.teams}
          club={exportData.club}
          clubLogoBase64={exportData.clubLogoBase64}
        />
      )}
    </>
  );
}

import { forwardRef } from "react";

function TeamBubble({ logo, short, color, size }: { logo: string | null; short: string; color: string; size: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", border: `2px solid ${color}`,
      backgroundColor: "#f0fdf0", display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", flexShrink: 0,
    }}>
      {logo ? (
        <img src={logo} alt={short} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontWeight: 700, fontSize: Math.round(size * 0.35), color: "#2E7D32" }}>{short}</span>
      )}
    </div>
  );
}

interface ExportLayoutProps {
  tournament: any;
  matches: MatchInfo[];
  teams: TeamWithPlayers[];
  club: any;
  clubLogoBase64: string | null;
}

const ExportLayout = forwardRef<HTMLDivElement, ExportLayoutProps>(
  ({ tournament: t, matches, teams, club, clubLogoBase64 }, ref) => {

    const teamLogoMap: Record<string, string | null> = {};
    const teamShortMap: Record<string, string> = {};
    const teamColorMap: Record<string, string> = {};
    teams.forEach((team) => {
      const logo = team.logoUrl || null;
      teamLogoMap[team.teamId] = logo;
      teamLogoMap[team.name] = logo;
      teamShortMap[team.teamId] = team.shortName || team.name.substring(0, 3);
      teamShortMap[team.name] = team.shortName || team.name.substring(0, 3);
      teamColorMap[team.teamId] = team.primaryColor || "#d1d5db";
      teamColorMap[team.name] = team.primaryColor || "#d1d5db";
    });

    const getTeamLogo = (teamName?: string, teamId?: string) => {
      if (teamId && teamLogoMap[teamId]) return teamLogoMap[teamId];
      if (teamName && teamLogoMap[teamName]) return teamLogoMap[teamName];
      return null;
    };
    const getTeamShort = (teamName?: string, teamId?: string) => {
      if (teamId && teamShortMap[teamId]) return teamShortMap[teamId];
      if (teamName && teamShortMap[teamName]) return teamShortMap[teamName];
      return teamName?.substring(0, 3) || "?";
    };
    const getTeamColor = (teamName?: string, teamId?: string) => {
      if (teamId && teamColorMap[teamId]) return teamColorMap[teamId];
      if (teamName && teamColorMap[teamName]) return teamColorMap[teamName];
      return "#d1d5db";
    };

    return (
      <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}>
        <div
          ref={ref}
          style={{
            width: 1700,
            minHeight: 2200,
            backgroundColor: "#ffffff",
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            padding: 80,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            {clubLogoBase64 && (
              <img
                src={clubLogoBase64}
                alt={club.name}
                style={{ width: 96, height: 96, borderRadius: 16, objectFit: "cover", margin: "0 auto 16px", display: "block", marginLeft: "auto", marginRight: "auto" }}
              />
            )}
            <div style={{ fontSize: 28, fontWeight: 600, color: "#374151", letterSpacing: "-0.01em" }}>
              {club.name || ""}
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: "#1B5E20", letterSpacing: "-0.02em", marginBottom: 8 }}>
              {String(t.name)}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 32, fontSize: 20, color: "#6b7280" }}>
              {t.startDate && (
                <span>{formatDate(String(t.startDate), "MMM d, yyyy")}{t.endDate ? ` - ${formatDate(String(t.endDate), "MMM d, yyyy")}` : ""}</span>
              )}
              {t.format && <span>{String(t.format).replace("_", " ")}</span>}
              {t.handicapLevel && <span>{String(t.handicapLevel)}</span>}
            </div>
          </div>

          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#1B5E20", marginBottom: 24 }}>Teams & Rosters</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {teams.map((team) => (
                <div
                  key={team.teamId}
                  style={{
                    backgroundColor: "#f9fafb",
                    borderRadius: 16,
                    padding: 28,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                    <TeamBubble logo={team.logoUrl || null} short={team.shortName || team.name.substring(0, 3)} color={team.primaryColor || "#d1d5db"} size={52} />
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{team.name}</div>
                      {team.players.length > 0 && (
                        <div style={{ fontSize: 16, color: "#6b7280" }}>
                          Team Hdcp: {team.players.reduce((sum, p) => sum + (Number(p.handicap) || 0), 0)}
                        </div>
                      )}
                    </div>
                  </div>
                  {team.players.length > 0 && (
                    <div>
                      {team.players.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 0",
                            borderBottom: "1px solid #e5e7eb",
                            fontSize: 18,
                          }}
                        >
                          <span style={{ color: "#374151" }}>{p.name}</span>
                          {p.handicap != null && (
                            <span
                              style={{
                                fontSize: 15,
                                fontFamily: "monospace",
                                backgroundColor: "#f0fdf0",
                                color: "#6b7280",
                                padding: "2px 10px",
                                borderRadius: 6,
                              }}
                            >
                              {Number(p.handicap) > 0 ? `+${p.handicap}` : p.handicap}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#1B5E20", marginBottom: 24 }}>Schedule</div>
            <div style={{ backgroundColor: "#f9fafb", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              {matches.map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "20px 28px",
                    borderBottom: i < matches.length - 1 ? "1px solid #e5e7eb" : "none",
                  }}
                >
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
                    <TeamBubble logo={getTeamLogo(m.homeTeam?.name, m.homeTeamId || m.homeTeam?.id)} short={getTeamShort(m.homeTeam?.name, m.homeTeamId || m.homeTeam?.id)} color={getTeamColor(m.homeTeam?.name, m.homeTeamId || m.homeTeam?.id)} size={36} />
                    <div style={{ fontSize: 20, fontWeight: 600, color: "#111827" }}>
                      {m.homeTeam?.name || "TBD"}
                    </div>
                    <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 18 }}>vs</span>
                    <TeamBubble logo={getTeamLogo(m.awayTeam?.name, m.awayTeamId || m.awayTeam?.id)} short={getTeamShort(m.awayTeam?.name, m.awayTeamId || m.awayTeam?.id)} color={getTeamColor(m.awayTeam?.name, m.awayTeamId || m.awayTeam?.id)} size={36} />
                    <div style={{ fontSize: 20, fontWeight: 600, color: "#111827" }}>
                      {m.awayTeam?.name || "TBD"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 17, color: "#6b7280" }}>
                    {m.round && <span>{m.round}</span>}
                    {m.field && <span>{m.field.name}</span>}
                    {m.scheduledAt && <span>{formatDate(m.scheduledAt, "MMM d, h:mm a")}</span>}
                    {(m.status === "final" || m.status === "completed") && (
                      <span style={{ fontWeight: 600, color: "#111827" }}>{m.homeScore} - {m.awayScore}</span>
                    )}
                  </div>
                </div>
              ))}
              {matches.length === 0 && (
                <div style={{ padding: "32px 28px", textAlign: "center", fontSize: 18, color: "#9ca3af" }}>
                  No matches scheduled yet
                </div>
              )}
            </div>
          </div>

          <div style={{ flexGrow: 1 }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 40, borderTop: "1px solid #e5e7eb" }}>
            <img
              src={APP_LOGO_BASE64}
              alt="Polo Clubhouse"
              style={{ width: 28, height: 28, borderRadius: 6 }}
            />
            <span style={{ fontSize: 18, fontWeight: 600, color: "#374151" }}>Polo Clubhouse</span>
          </div>
        </div>
      </div>
    );
  }
);
