import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="section-shell">
      <div className="site-shell">
        <div className="mx-auto max-w-2xl surface-card p-8 text-center sm:p-12">
          <span className="section-kicker">Access restricted</span>
          <h1 className="mt-6 text-4xl font-bold tracking-[-0.04em] text-[color:var(--color-ink)]">This area isn&apos;t available for your account.</h1>
          <p className="mt-5 text-base leading-8 text-[color:var(--color-ink-soft)]">
            If you expected to see this page, sign in with the right account or contact the GiveKhair team so we can confirm your role and charity access.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn-primary">Return home</Link>
            <Link href="/auth/signin?callbackUrl=%2Fdashboard" className="btn-secondary">Sign in again</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
