import { useRoute } from "wouter";
import { useEffect, useState } from "react";
import { MatchControl, type ControlMode } from "@/pages/admin/MatchControl";
import { PageLoading } from "@/components/LoadingBar";

type SharePageType = "stats" | "gfx";

interface Resolved {
  matchId: string;
  pageType: ControlMode;
}

interface ErrorState {
  reason: "revoked" | "expired" | "not_found" | "match_missing" | "mismatch" | "network";
  message: string;
}

function reasonTitle(reason: ErrorState["reason"]): string {
  switch (reason) {
    case "revoked":  return "This share link has been revoked";
    case "expired":  return "This share link has expired";
    case "not_found": return "Share link not found";
    case "match_missing": return "Match not found";
    case "mismatch": return "Wrong page type for this link";
    default: return "Link unavailable";
  }
}

export function ShareControl({ pageType }: { pageType: SharePageType }) {
  const [, params] = useRoute(`/share/${pageType}/:token`);
  const token = params?.token;
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);

  useEffect(() => {
    if (!token) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/share/${token}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          const reason = (data?.reason as ErrorState["reason"]) || "network";
          throw { reason, message: data?.message || "Invalid link" } as ErrorState;
        }
        if (data.pageType !== pageType) {
          throw { reason: "mismatch", message: `This link opens the ${data.pageType} page, not ${pageType}.` } as ErrorState;
        }
        setResolved({ matchId: data.matchId, pageType: data.pageType });
      })
      .catch((e: ErrorState | Error) => {
        if ((e as ErrorState).reason) setError(e as ErrorState);
        else setError({ reason: "network", message: (e as Error).message || "Network error" });
      });
  }, [token, pageType]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <div className="bg-white card-shadow rounded-[12px] p-6 max-w-md text-center">
          <h1 className="font-display text-xl font-bold text-ink mb-2">{reasonTitle(error.reason)}</h1>
          <p className="text-[14px] text-ink2">{error.message}</p>
          <p className="text-[12px] text-ink3 mt-3">Ask the match admin to send you a new link.</p>
        </div>
      </div>
    );
  }
  if (!resolved) return <PageLoading />;
  return <MatchControl mode={resolved.pageType} shareToken={token} matchId={resolved.matchId} />;
}
