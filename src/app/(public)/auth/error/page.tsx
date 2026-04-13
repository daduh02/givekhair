import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="section-shell">
      <div className="site-shell">
        <div className="mx-auto max-w-xl surface-card p-8 text-center sm:p-10">
          <span className="section-kicker">Sign-in error</span>
          <h1 className="mt-5 text-3xl font-bold tracking-[-0.04em] text-[color:var(--color-ink)]">
            We couldn&apos;t complete your sign-in.
          </h1>
          <p className="mt-4 text-base leading-8 text-[color:var(--color-ink-soft)]">
            There was a problem authenticating your session. Please try again or contact GiveKhair support if it keeps happening.
          </p>
          <Link href="/auth/signin" className="btn-primary mt-7">
            Try again
          </Link>
        </div>
      </div>
    </main>
  );
}
