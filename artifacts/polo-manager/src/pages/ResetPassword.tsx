import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPassword() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Reset failed");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-[12px] p-8" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <p className="text-[14px] text-ink mb-4">Invalid reset link. Please request a new password reset.</p>
            <Link href="/forgot-password">
              <Button variant="outline" className="rounded-[8px]">Request New Reset</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Polo Clubhouse" className="w-16 h-16 rounded-[12px] mb-4" style={{ boxShadow: 'var(--shadow-md)' }} />
          <h1 className="font-display text-2xl font-bold text-g900">Set New Password</h1>
          <p className="text-[14px] text-ink2 mt-1">
            {success ? "Your password has been reset" : "Enter your new password below"}
          </p>
        </div>

        <div className="bg-white rounded-[12px] p-8" style={{ boxShadow: 'var(--shadow-lg)' }}>
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-g50 border border-g100 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-g700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-[14px] text-ink">Your password has been updated successfully.</p>
              <Link href="/login" className="block">
                <Button className="w-full h-10 rounded-[8px]">Sign In</Button>
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
                <label className="block text-[13px] font-medium text-ink mb-1.5">New Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className="rounded-[8px] h-10"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1.5">Confirm Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  className="rounded-[8px] h-10"
                />
              </div>
              <Button type="submit" className="w-full h-10 mt-2 rounded-[8px]" disabled={loading}>
                {loading ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
