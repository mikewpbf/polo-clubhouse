import { useState } from "react";
import { Link } from "wouter";
import { useSignup } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setStoredToken } from "@/hooks/use-auth";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const signupMutation = useSignup();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      const response = await signupMutation.mutateAsync({ data: { email, password, displayName } });
      if (response && typeof response === "object" && "token" in response) {
        setStoredToken((response as any).token);
      }
      window.location.href = "/";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create account.";
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Polo Clubhouse" className="w-16 h-16 rounded-[12px] mb-4" style={{ boxShadow: 'var(--shadow-md)' }} />
          <h1 className="font-display text-2xl font-bold text-g900">Create Account</h1>
          <p className="text-[14px] text-ink2 mt-1">Join Polo Clubhouse to follow tournaments</p>
        </div>

        <div className="bg-white rounded-[12px] p-8" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-live-dim text-live text-[13px] p-3 rounded-[8px] border border-live/20">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[13px] font-medium text-ink mb-1.5">Display name</label>
              <Input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoComplete="name"
                className="rounded-[8px] h-10"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink mb-1.5">Email address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="rounded-[8px] h-10"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink mb-1.5">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
                className="rounded-[8px] h-10"
              />
              <p className="text-[11px] text-ink3 mt-1">At least 8 characters</p>
            </div>

            <Button type="submit" className="w-full h-10 mt-2 rounded-[8px]" disabled={signupMutation.isPending}>
              {signupMutation.isPending ? "Creating account..." : "Sign Up"}
            </Button>
          </form>

          <div className="flex items-center my-5">
            <div className="flex-grow h-px bg-ink3/20" />
            <span className="px-3 text-[12px] text-ink3">or</span>
            <div className="flex-grow h-px bg-ink3/20" />
          </div>

          <GoogleSignInButton mode="signup" onError={setError} />

          <div className="mt-6 text-center text-[13px] text-ink2">
            Already have an account? <Link href="/login" className="text-g500 font-medium hover:text-g700 transition-colors">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
