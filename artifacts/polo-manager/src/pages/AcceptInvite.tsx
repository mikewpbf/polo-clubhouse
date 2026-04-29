import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAcceptInvite, useGetInviteByToken } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<"pending" | "accepting" | "accepted" | "error">("pending");
  const [errorMsg, setErrorMsg] = useState("");

  const { data: invite, isLoading: inviteLoading, error: inviteError } = useGetInviteByToken(token || "", {
    query: { enabled: !!token } as any,
  });

  const acceptMutation = useAcceptInvite();

  const handleAccept = async () => {
    if (!token) return;
    setStatus("accepting");
    try {
      await acceptMutation.mutateAsync({ data: { token } });
      setStatus("accepted");
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to accept invite");
    }
  };

  if (authLoading || inviteLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-ink2 text-[14px]">Loading invite...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-surface border border-line rounded-[4px] p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink mb-4">Accept Invite</h1>
          <p className="text-ink2 text-[14px] mb-6">You need to log in or create an account to accept this invite.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => setLocation(`/login?redirect=/accept-invite/${token}`)}>Log In</Button>
            <Button variant="secondary" onClick={() => setLocation(`/signup?redirect=/accept-invite/${token}`)}>Sign Up</Button>
          </div>
        </div>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-surface border border-line rounded-[4px] p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink mb-4">Invalid Invite</h1>
          <p className="text-ink2 text-[14px]">This invite link is invalid, expired, or has already been used.</p>
        </div>
      </div>
    );
  }

  const inv = invite as Record<string, unknown> | undefined;

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface border border-line rounded-[4px] p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-ink mb-4">Accept Invite</h1>
        {inv && (
          <p className="text-ink2 text-[14px] mb-6">
            You've been invited as a <span className="font-medium text-ink">{inv.type === "team_manager" ? "Team Manager" : "Club Admin"}</span>.
          </p>
        )}
        {status === "pending" && (
          <Button onClick={handleAccept} className="w-full">Accept Invite</Button>
        )}
        {status === "accepting" && (
          <p className="text-ink2 text-[14px]">Accepting invite...</p>
        )}
        {status === "accepted" && (
          <div className="text-g700 text-[14px] font-medium">
            Invite accepted! Redirecting...
          </div>
        )}
        {status === "error" && (
          <div className="text-live text-[13px]">{errorMsg}</div>
        )}
      </div>
    </div>
  );
}
