import Link from "next/link";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/password";
import { db } from "@/lib/db";
import { consumeUserAccessToken, markUserAccessTokenUsed } from "@/server/lib/user-admin";

type SearchParams = {
  token?: string;
  error?: string;
};

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const token = String(searchParams.token ?? "").trim();
  const tokenRecord = token
    ? await consumeUserAccessToken({
        rawToken: token,
        acceptedTypes: ["INVITE", "PASSWORD_SETUP", "PASSWORD_RESET"],
      })
    : null;

  async function setPasswordAction(formData: FormData) {
    "use server";

    const token = String(formData.get("token") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!token || password.length < 8 || password !== confirmPassword) {
      redirect(`/auth/set-password?token=${encodeURIComponent(token)}&error=invalid`);
    }

    const tokenRecord = await consumeUserAccessToken({
      rawToken: token,
      acceptedTypes: ["INVITE", "PASSWORD_SETUP", "PASSWORD_RESET"],
    });

    if (!tokenRecord) {
      redirect(`/auth/set-password?error=expired`);
    }

    await db.user.update({
      where: { id: tokenRecord.userId },
      data: {
        passwordHash: hashPassword(password),
        invitedAt: null,
        lastAccessChangeAt: new Date(),
        emailVerified: new Date(),
      },
    });
    await markUserAccessTokenUsed(tokenRecord.id);

    redirect("/auth/signin?notice=Password+set+successfully.+Please+sign+in.");
  }

  const errorMessage =
    searchParams.error === "invalid"
      ? "Please use a password with at least 8 characters and confirm it correctly."
      : searchParams.error === "expired"
        ? "This setup/reset link has expired or is no longer valid."
        : !tokenRecord
          ? "This setup/reset link is invalid or expired."
          : "";

  return (
    <main className="section-shell">
      <div className="site-shell">
        <div className="mx-auto max-w-lg surface-card p-8">
          <p className="section-kicker">Secure password setup</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[color:var(--color-ink)]">Set your password</h1>
          <p className="mt-4 text-sm leading-7 text-[color:var(--color-ink-soft)]">
            This one-time link lets you set a password for your GiveKhair account.
          </p>

          {errorMessage ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {tokenRecord ? (
            <form action={setPasswordAction} className="mt-6 grid gap-4">
              <input type="hidden" name="token" value={token} />
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[color:var(--color-ink-soft)]">New password</span>
                <input type="password" name="password" minLength={8} required className="input" autoComplete="new-password" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[color:var(--color-ink-soft)]">Confirm password</span>
                <input type="password" name="confirmPassword" minLength={8} required className="input" autoComplete="new-password" />
              </label>
              <button type="submit" className="btn-primary mt-2">Save password</button>
            </form>
          ) : (
            <div className="mt-6">
              <Link href="/auth/signin" className="btn-primary">Back to sign in</Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
