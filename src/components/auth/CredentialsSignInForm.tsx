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
  const initialErrorMessage =
    initialError === "CredentialsSignin"
      ? "Invalid email or password."
      : initialError === "AccountSuspended" || initialError === "AccessDenied"
        ? "This account is suspended. Please contact GiveKhair support."
        : "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(initialErrorMessage);

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
      setError(
        result.error === "CredentialsSignin"
          ? "Invalid email or password."
          : result.error === "AccountSuspended" || result.error === "AccessDenied"
            ? "This account is suspended. Please contact GiveKhair support."
            : "Unable to sign in right now."
      );
      setSubmitting(false);
      return;
    }

    window.location.href = result.url ?? callbackUrl;
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {/* Label and field stay grouped so auth validation states remain easy to
          extend later without hunting through disconnected markup. */}
      <label className="grid gap-2 text-left">
        <span className="text-sm font-semibold text-[color:var(--color-ink-soft)]">Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          className="input"
        />
      </label>

      <label className="grid gap-2 text-left">
        <span className="text-sm font-semibold text-[color:var(--color-ink-soft)]">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          className="input"
        />
      </label>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button type="submit" disabled={submitting} className="btn-primary mt-2 w-full">
        {submitting ? "Signing in..." : "Sign in with email"}
      </button>
    </form>
  );
}
