import { useState } from "react";
import { Link } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setStoredToken } from "@/hooks/use-auth";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const loginMutation = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      const response = await loginMutation.mutateAsync({ data: { email, password } });
      if (response && typeof response === "object" && "token" in response) {
        setStoredToken((response as any).token);
      }
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Failed to log in. Please check your credentials.");
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Polo Clubhouse" className="w-16 h-16 rounded-[12px] mb-4" style={{ boxShadow: 'var(--shadow-md)' }} />
          <h1 className="font-display text-2xl font-bold text-g900">Polo Clubhouse</h1>
          <p className="text-[14px] text-ink2 mt-1">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-[12px] p-8" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-live-dim text-live text-[13px] p-3 rounded-[8px] border border-live/20">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1.5">Email or Username</label>
              <Input 
                type="text" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="username"
                className="rounded-[8px] h-10"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[13px] font-medium text-ink">Password</label>
                <Link href="/forgot-password" className="text-[12px] text-g500 hover:text-g700 transition-colors">Forgot?</Link>
              </div>
              <Input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="rounded-[8px] h-10"
              />
            </div>

            <Button type="submit" className="w-full h-10 mt-2 rounded-[8px]" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="flex items-center my-5">
            <div className="flex-grow h-px bg-ink3/20" />
            <span className="px-3 text-[12px] text-ink3">or</span>
            <div className="flex-grow h-px bg-ink3/20" />
          </div>

          <GoogleSignInButton mode="signin" onError={setError} />

          <div className="mt-6 text-center text-[13px] text-ink2">
            Don't have an account? <Link href="/signup" className="text-g500 font-medium hover:text-g700 transition-colors">Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
