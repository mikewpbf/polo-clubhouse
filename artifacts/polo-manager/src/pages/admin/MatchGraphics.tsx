import { useRoute, useLocation } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import { PageLoading } from "@/components/LoadingBar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, Image as ImageIcon } from "lucide-react";
import { getStoredToken, useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import {
  TEMPLATES,
  type TemplateName,
  type GraphicOrientation,
  type GraphicData,
  type GraphicTeam,
} from "@/components/MatchGraphicTemplates";

async function apiFetch(path: string) {
  const token = getStoredToken();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function imageToBase64(url: string): Promise<string | null> {
  const headers: Record<string, string> = {};
  if (url.startsWith("/api")) {
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

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
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

interface MatchData {
  id: string;
  homeScore: number;
  awayScore: number;
  homeTeam: { id: string; name: string; shortName?: string; logoUrl?: string; primaryColor?: string } | null;
  awayTeam: { id: string; name: string; shortName?: string; logoUrl?: string; primaryColor?: string } | null;
  field: { name: string } | null;
  tournament: { id: string; name: string; clubName?: string } | null;
  status: string;
  scheduledAt?: string | null;
  round: string | null;
}

const BADGE_PRESETS = ["", "LIVE", "UPCOMING", "TODAY", "FINAL", "MATCH DAY"];

export function MatchGraphics() {
  const [, params] = useRoute("/admin/match/:id/graphics");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const matchId = params?.id;

  const isSuperAdmin = user?.role === "super_admin";
  const hasClub = (user?.clubMemberships?.length || 0) > 0;
  const authorized = isSuperAdmin || hasClub;

  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<TemplateName>("bold-diagonal");
  const [orientation, setOrientation] = useState<GraphicOrientation>("horizontal");
  const [exporting, setExporting] = useState(false);

  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [locationStr, setLocationStr] = useState("");
  const [badge, setBadge] = useState("");
  const [accentColor, setAccentColor] = useState("#1B5E20");
  const [textColor, setTextColor] = useState("#ffffff");

  const [homeTeamData, setHomeTeamData] = useState<GraphicTeam>({ name: "Home", score: 0 });
  const [awayTeamData, setAwayTeamData] = useState<GraphicTeam>({ name: "Away", score: 0 });

  const previewRef = useRef<HTMLDivElement>(null); // visible preview
  const { toast } = useToast();

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      try {
        const data = await apiFetch(`/matches/${matchId}`);
        setMatch(data);

        setHeadline(data.tournament?.name || "Match Day");
        setSubheadline("");

        if (data.scheduledAt) {
          setDateStr(formatDate(String(data.scheduledAt), "MMM d, yyyy"));
          setTimeStr(formatDate(String(data.scheduledAt), "h:mm a"));
        }

        const venue = data.field?.name || "";
        const clubName = data.tournament?.clubName || "";
        setLocationStr([venue, clubName].filter(Boolean).join(" - "));

        if (data.status === "final" || data.status === "completed") {
          setBadge("FINAL");
        } else if (data.status === "live") {
          setBadge("LIVE");
        } else {
          setBadge("UPCOMING");
        }

        const homeColor = data.homeTeam?.primaryColor || "#1B5E20";
        setAccentColor(homeColor);

        const buildTeam = async (team: MatchData["homeTeam"], score: number): Promise<GraphicTeam> => {
          let logoBase64: string | null = null;
          if (team?.logoUrl) {
            logoBase64 = await imageToBase64(team.logoUrl);
          }
          return {
            name: team?.name || "TBD",
            shortName: team?.shortName,
            logoBase64,
            primaryColor: team?.primaryColor,
            score,
          };
        };

        const [home, away] = await Promise.all([
          buildTeam(data.homeTeam, data.homeScore),
          buildTeam(data.awayTeam, data.awayScore),
        ]);
        setHomeTeamData(home);
        setAwayTeamData(away);
      } catch {
        toast({ title: "Failed to load match data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId]);

  const graphicData: GraphicData = {
    headline,
    subheadline,
    date: dateStr,
    time: timeStr,
    location: locationStr,
    badge,
    accentColor,
    textColor,
    homeTeam: homeTeamData,
    awayTeam: awayTeamData,
  };

  const horizontalRef = useRef<HTMLDivElement>(null);
  const verticalRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async (dlOrientation: GraphicOrientation) => {
    const ref = dlOrientation === "horizontal" ? horizontalRef : verticalRef;
    if (!ref.current || exporting) return;
    setExporting(true);
    try {
      const dims = dlOrientation === "horizontal" ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 };
      const opts = {
        width: dims.w,
        height: dims.h,
        pixelRatio: 1,
        skipFonts: true,
      };
      await toPng(ref.current, opts);
      await new Promise(r => setTimeout(r, 100));
      const dataUrl = await toPng(ref.current, opts);
      const link = document.createElement("a");
      const safeName = (match?.homeTeam?.name || "home").replace(/[^a-zA-Z0-9]/g, "_");
      const safeAway = (match?.awayTeam?.name || "away").replace(/[^a-zA-Z0-9]/g, "_");
      link.download = `${safeName}_vs_${safeAway}_${dlOrientation}_${template}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: `${dlOrientation === "horizontal" ? "Horizontal" : "Vertical"} graphic downloaded` });
    } catch (err) {
      console.error("Export failed:", err);
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, [template, match, exporting]);

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center"><PageLoading /></div>;
  if (!authorized) return <div className="min-h-screen bg-bg flex items-center justify-center text-ink2">Access denied. Admin or club membership required.</div>;
  if (!match) return <div className="min-h-screen bg-bg flex items-center justify-center text-ink2">Match not found</div>;

  const TemplateComponent = TEMPLATES.find(t => t.id === template)?.component;

  const dims = orientation === "horizontal" ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 };
  const previewScale = orientation === "horizontal" ? Math.min(1, 680 / 1920) : Math.min(1, 400 / 1080);

  const inputCls = "w-full h-9 px-3 rounded-[8px] border border-g200 bg-white text-[13px] text-ink font-sans focus:outline-none focus:ring-1 focus:ring-g500 focus:border-g500";
  const labelCls = "text-[11px] font-sans font-semibold text-ink3 uppercase tracking-wider mb-1 block";

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/admin/matchday")}
            className="w-9 h-9 rounded-[8px] bg-white border border-g200 flex items-center justify-center hover:border-g300 transition-colors card-shadow"
          >
            <ArrowLeft className="w-4 h-4 text-ink" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold text-ink">Match Graphics</h1>
            <p className="text-[13px] text-ink2 truncate">
              {match.homeTeam?.name || "Home"} vs {match.awayTeam?.name || "Away"}
              {match.tournament ? ` - ${match.tournament.name}` : ""}
            </p>
          </div>
        </div>

        <div className="flex gap-6 flex-col lg:flex-row">
          <div className="lg:w-[320px] shrink-0 space-y-4">
            <div className="bg-white rounded-[12px] p-4 card-shadow space-y-3">
              {TEMPLATES.length > 1 && (
                <div>
                  <label className={labelCls}>Template</label>
                  <div className="flex gap-1.5">
                    {TEMPLATES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTemplate(t.id)}
                        className={`flex-1 py-2 px-2 rounded-[8px] text-[11px] font-sans font-semibold transition-colors ${
                          template === t.id
                            ? "bg-g700 text-white"
                            : "bg-g50 text-ink2 hover:bg-g100"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Orientation</label>
                <div className="flex gap-1.5">
                  {(["horizontal", "vertical"] as const).map(o => (
                    <button
                      key={o}
                      onClick={() => setOrientation(o)}
                      className={`flex-1 py-2 px-2 rounded-[8px] text-[11px] font-sans font-semibold transition-colors capitalize ${
                        orientation === o
                          ? "bg-g700 text-white"
                          : "bg-g50 text-ink2 hover:bg-g100"
                      }`}
                    >
                      {o === "horizontal" ? "Horizontal (1920x1080)" : "Vertical (1080x1920)"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[12px] p-4 card-shadow space-y-3">
              <div>
                <label className={labelCls}>Headline</label>
                <input className={inputCls} value={headline} onChange={e => setHeadline(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Subheadline</label>
                <input className={inputCls} value={subheadline} onChange={e => setSubheadline(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Date</label>
                  <input className={inputCls} value={dateStr} onChange={e => setDateStr(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Time</label>
                  <input className={inputCls} value={timeStr} onChange={e => setTimeStr(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Location</label>
                <input className={inputCls} value={locationStr} onChange={e => setLocationStr(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Badge</label>
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {BADGE_PRESETS.map(b => (
                    <button
                      key={b}
                      onClick={() => setBadge(b)}
                      className={`py-1 px-2.5 rounded-[6px] text-[10px] font-sans font-bold transition-colors ${
                        badge === b
                          ? "bg-g700 text-white"
                          : "bg-g50 text-ink3 hover:bg-g100"
                      }`}
                    >
                      {b || "None"}
                    </button>
                  ))}
                </div>
                <input className={inputCls} value={badge} onChange={e => setBadge(e.target.value)} placeholder="Custom badge text" />
              </div>
            </div>

            <div className="bg-white rounded-[12px] p-4 card-shadow space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={e => setAccentColor(e.target.value)}
                      className="w-8 h-8 rounded border border-g200 cursor-pointer p-0"
                    />
                    <input className={inputCls} value={accentColor} onChange={e => setAccentColor(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Text Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={textColor}
                      onChange={e => setTextColor(e.target.value)}
                      className="w-8 h-8 rounded border border-g200 cursor-pointer p-0"
                    />
                    <input className={inputCls} value={textColor} onChange={e => setTextColor(e.target.value)} />
                  </div>
                </div>
              </div>
              {match.homeTeam?.primaryColor && (
                <button
                  onClick={() => setAccentColor(match.homeTeam?.primaryColor || "#1B5E20")}
                  className="text-[11px] font-sans font-medium text-g700 hover:text-g900 transition-colors"
                >
                  Use {match.homeTeam.name} color
                </button>
              )}
              {match.awayTeam?.primaryColor && (
                <button
                  onClick={() => setAccentColor(match.awayTeam?.primaryColor || "#374151")}
                  className="text-[11px] font-sans font-medium text-g700 hover:text-g900 transition-colors ml-3"
                >
                  Use {match.awayTeam.name} color
                </button>
              )}
            </div>

            <Button
              className="w-full h-11 rounded-[8px] text-[13px] font-semibold gap-2 bg-g700 hover:bg-g900"
              onClick={() => handleDownload("horizontal")}
              disabled={exporting}
            >
              {exporting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Download className="w-4 h-4" /> Download Horizontal (1920x1080)</>
              )}
            </Button>
            <Button
              className="w-full h-11 rounded-[8px] text-[13px] font-semibold gap-2"
              variant="outline"
              onClick={() => handleDownload("vertical")}
              disabled={exporting}
            >
              {exporting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Download className="w-4 h-4" /> Download Vertical (1080x1920)</>
              )}
            </Button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-[12px] p-6 card-shadow">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="w-4 h-4 text-ink3" />
                <span className="text-[12px] font-sans font-semibold text-ink3 uppercase tracking-wider">
                  Preview - {orientation === "horizontal" ? "1920 x 1080" : "1080 x 1920"}
                </span>
              </div>

              <div
                style={{
                  overflow: "hidden",
                  borderRadius: 8,
                  border: "1px solid var(--g200)",
                  backgroundColor: "#f0f0f0",
                  width: dims.w * previewScale,
                  height: dims.h * previewScale,
                  margin: "0 auto",
                }}
              >
                <div
                  style={{
                    transform: `scale(${previewScale})`,
                    transformOrigin: "top left",
                    width: dims.w,
                    height: dims.h,
                  }}
                >
                  <div ref={previewRef} style={{ width: dims.w, height: dims.h }}>
                    {TemplateComponent && <TemplateComponent data={graphicData} orientation={orientation} />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}>
          <div ref={horizontalRef} style={{ width: 1920, height: 1080 }}>
            {TemplateComponent && <TemplateComponent data={graphicData} orientation="horizontal" />}
          </div>
          <div ref={verticalRef} style={{ width: 1080, height: 1920 }}>
            {TemplateComponent && <TemplateComponent data={graphicData} orientation="vertical" />}
          </div>
        </div>
      </div>
    </div>
  );
}
