import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Request failed");
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Polo Clubhouse" className="w-16 h-16 rounded-[12px] mb-4" style={{ boxShadow: 'var(--shadow-md)' }} />
          <h1 className="font-display text-2xl font-bold text-g900">Reset Password</h1>
          <p className="text-[14px] text-ink2 mt-1">
            {sent ? "Check your inbox" : "Enter your email to reset your password"}
          </p>
        </div>

        <div className="bg-white rounded-[12px] p-8" style={{ boxShadow: 'var(--shadow-lg)' }}>
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-g50 border border-g100 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-g700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-[14px] text-ink">
                If an account exists for <span className="font-medium">{email}</span>, we've sent a password reset link.
              </p>
              <p className="text-[13px] text-ink3">
                Please check your email and follow the link to reset your password. The link expires in 1 hour.
              </p>
              <Link href="/login" className="block">
                <Button variant="outline" className="w-full h-10 mt-2 rounded-[8px]">
                  Back to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-live-dim text-live text-[13px] p-3 rounded-[8px] border border-live/20">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1.5">Email address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="Enter your email address"
                  className="rounded-[8px] h-10"
                />
              </div>
              <Button type="submit" className="w-full h-10 mt-2 rounded-[8px]" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          )}

          {!sent && (
            <div className="mt-6 text-center text-[13px] text-ink2">
              Remember your password? <Link href="/login" className="text-g500 font-medium hover:text-g700 transition-colors">Sign in</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
