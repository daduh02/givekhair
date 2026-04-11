"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SignInForm() {
  const searchParams = useSearchParams();
  // Default callbackUrl to /admin — works for charity admins
  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, callbackUrl, redirect: false });
    setLoading(false);
    if (res?.error) setError("Invalid email or password.");
    else window.location.href = callbackUrl;
  }

  function handleGoogle() {
    signIn("google", { callbackUrl });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "#F6F1E8" }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "#124E40" }}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#F6F1E8" strokeWidth="2">
                <path d="M12 20s-7-4.5-7-9.5A4.5 4.5 0 0 1 9.5 6c1.6 0 2.6.8 3.5 2 0 0 .9-2 3.5-2A4.5 4.5 0 0 1 19 10.5C19 15.5 12 20 12 20Z" />
              </svg>
            </span>
            <span className="text-xl font-bold" style={{ color: "#233029" }}>GiveKhair</span>
          </div>
          <p className="text-sm" style={{ color: "#3A4A42" }}>Sign in to your account</p>
        </div>

        <div className="rounded-2xl bg-white p-6" style={{ boxShadow: "0 4px 24px rgba(18,78,64,0.1)" }}>
          <button
            type="button"
            onClick={handleGoogle}
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors"
            style={{ border: "1px solid rgba(18,78,64,0.2)", color: "#233029", background: "white", cursor: "pointer" }}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: "1px solid rgba(18,78,64,0.12)" }} />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-xs" style={{ color: "#8A9E94" }}>or sign in with email</span>
            </div>
          </div>

          <form onSubmit={handleCredentials} className="space-y-3">
            {error && (
              <p className="rounded-xl px-3 py-2 text-xs" style={{ background: "#FEE2E2", color: "#991B1B" }}>{error}</p>
            )}
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-semibold" style={{ color: "#3A4A42" }}>Email</label>
              <input id="email" type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="input" placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-semibold" style={{ color: "#3A4A42" }}>Password</label>
              <input id="password" type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                className="input" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs" style={{ color: "#8A9E94" }}>
          Questions? <a href="mailto:hello@givekhair.com" style={{ color: "#1E8C6E" }}>Get in touch</a>
        </p>
      </div>
    </div>
  );
}
