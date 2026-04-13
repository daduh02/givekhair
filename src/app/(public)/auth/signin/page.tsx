import { CredentialsSignInForm } from "@/components/auth/CredentialsSignInForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { TrustChip } from "@/components/ui/TrustChip";

export default function SignInPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const callbackUrl = searchParams.callbackUrl ?? "/dashboard";
  const error = searchParams.error;

  return (
    <main className="section-shell">
      <div className="site-shell">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <section>
            <TrustChip tone="gold">Secure sign-in</TrustChip>
            <h1 className="mt-6 text-4xl font-bold tracking-[-0.04em] text-[color:var(--color-ink)] sm:text-5xl">
              Sign in to manage donations, fundraising, and charity operations.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--color-ink-soft)]">
              Use your email and password or continue with Google. Admins, fundraisers, and donors all enter through the same secure access point.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              <TrustChip>Verified charities</TrustChip>
              <TrustChip>Gift Aid ready</TrustChip>
              <TrustChip>Transparent fees</TrustChip>
            </div>
          </section>

          <section className="surface-card p-7 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--color-primary-dark)]">Welcome back</p>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-[color:var(--color-ink)]">Sign in to GiveKhair</h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--color-ink-soft)]">
              Your dashboard keeps fundraising, donations, and charity administration in one place.
            </p>

            {error ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Sign in failed. Please check your details and try again.
              </div>
            ) : null}

            <div className="mt-6">
              <CredentialsSignInForm callbackUrl={callbackUrl} initialError={error} />
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[color:var(--color-line)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-ink-muted)]">or</span>
              <div className="h-px flex-1 bg-[color:var(--color-line)]" />
            </div>

            <GoogleSignInButton callbackUrl={callbackUrl} />

            <div className="mt-6 rounded-2xl bg-[color:var(--color-sand)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
              Demo password for seeded accounts: <strong className="text-[color:var(--color-ink)]">GiveKhair123!</strong>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
