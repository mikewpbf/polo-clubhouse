import { useEffect, useRef, useState } from "react";
import { useGoogleAuth } from "@workspace/api-client-react";
import { setStoredToken } from "@/hooks/use-auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            ux_mode?: "popup" | "redirect";
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number | string;
            },
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined;

interface Props {
  mode: "signin" | "signup";
  onError?: (message: string) => void;
}

export function GoogleSignInButton({ mode, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(320);
  const googleAuthMutation = useGoogleAuth();

  const mutateRef = useRef(googleAuthMutation.mutateAsync);
  mutateRef.current = googleAuthMutation.mutateAsync;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (containerRef.current) {
      setWidth(containerRef.current.offsetWidth || 320);
    }
  }, []);

  useEffect(() => {
    if (!CLIENT_ID) return;
    if (!containerRef.current) return;

    let cancelled = false;

    const handleCredential = async (response: { credential: string }) => {
      try {
        const result = await mutateRef.current({
          data: { idToken: response.credential },
        });
        if (result && typeof result === "object" && "token" in result) {
          setStoredToken((result as { token: string }).token);
        }
        window.location.href = "/";
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Google sign-in failed.";
        onErrorRef.current?.(msg);
      }
    };

    const render = () => {
      if (cancelled) return;
      const g = window.google;
      if (!g?.accounts?.id) {
        window.setTimeout(render, 100);
        return;
      }
      g.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
        ux_mode: "popup",
      });
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
        g.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: mode === "signup" ? "signup_with" : "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          width,
        });
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [mode, width]);

  if (!CLIENT_ID) {
    return (
      <div className="text-[12px] text-ink3 text-center">
        Google sign-in is not configured for this environment.
      </div>
    );
  }

  return <div ref={containerRef} className="flex justify-center" />;
}
