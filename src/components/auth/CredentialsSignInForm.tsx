"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function CredentialsSignInForm({
  callbackUrl,
  initialError,
}: {
  callbackUrl: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(initialError === "CredentialsSignin" ? "Invalid email or password." : "");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    if (!result) {
      setError("Unable to sign in right now.");
      setSubmitting(false);
      return;
    }

    if (result.error) {
      setError(result.error === "CredentialsSignin" ? "Invalid email or password." : "Unable to sign in right now.");
      setSubmitting(false);
      return;
    }

    window.location.href = result.url ?? callbackUrl;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "grid", gap: "0.75rem" }}>
        <label style={{ textAlign: "left" }}>
          <span style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", color: "#3A4A42" }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            style={{
              width: "100%",
              borderRadius: "12px",
              border: "1px solid rgba(18,78,64,0.16)",
              padding: "12px 14px",
              fontSize: "0.9rem",
              color: "#233029",
            }}
          />
        </label>

        <label style={{ textAlign: "left" }}>
          <span style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", color: "#3A4A42" }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            style={{
              width: "100%",
              borderRadius: "12px",
              border: "1px solid rgba(18,78,64,0.16)",
              padding: "12px 14px",
              fontSize: "0.9rem",
              color: "#233029",
            }}
          />
        </label>
      </div>

      {error && (
        <div style={{ marginTop: "0.9rem", padding: "10px", borderRadius: "8px", background: "#FEE2E2", color: "#991B1B", fontSize: "0.8rem" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          marginTop: "1rem",
          width: "100%",
          borderRadius: "12px",
          border: "none",
          background: "#124E40",
          color: "#F6F1E8",
          padding: "12px 16px",
          fontSize: "0.9rem",
          fontWeight: 600,
          cursor: submitting ? "wait" : "pointer",
          opacity: submitting ? 0.8 : 1,
        }}
      >
        {submitting ? "Signing in..." : "Sign in with email"}
      </button>
    </form>
  );
}
