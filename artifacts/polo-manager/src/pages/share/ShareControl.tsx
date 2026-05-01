import { useRoute } from "wouter";
import { useEffect, useState } from "react";
import { MatchControl, type ControlMode } from "@/pages/admin/MatchControl";
import { PageLoading } from "@/components/LoadingBar";

interface Resolved {
  matchId: string;
  pageType: ControlMode;
}

export function ShareControl({ pageType }: { pageType: "score" | "stats" | "gfx" }) {
  const [, params] = useRoute(`/share/${pageType}/:token`);
  const token = params?.token;
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/share/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || "Invalid link");
        if (data.pageType !== pageType) throw new Error(`Link is for ${data.pageType}, not ${pageType}`);
        setResolved({ matchId: data.matchId, pageType: data.pageType });
      })
      .catch((e) => setError(e.message));
  }, [token, pageType]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <div className="bg-white card-shadow rounded-[12px] p-6 max-w-md text-center">
          <h1 className="font-display text-xl font-bold text-ink mb-2">Link unavailable</h1>
          <p className="text-[14px] text-ink2">{error}</p>
        </div>
      </div>
    );
  }
  if (!resolved) return <PageLoading />;
  return <MatchControl mode={resolved.pageType} shareToken={token} matchId={resolved.matchId} />;
}
