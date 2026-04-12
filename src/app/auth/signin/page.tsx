import { redirect } from "next/navigation";

// In Next-Auth v5, the correct signin URL is /api/auth/signin (not /api/auth/signin/google)
// Next-Auth will then redirect to Google automatically since it's the only provider
export default function SignInPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const callbackUrl = searchParams.callbackUrl ?? "/admin";

  // If no error, redirect straight to the Next-Auth signin handler
  if (!searchParams.error) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  // Show error page if something went wrong
  return (
    <div style={{ minHeight: "100vh", background: "#F6F1E8", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: "360px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "2rem" }}>
          <span style={{ display: "grid", height: "40px", width: "40px", placeItems: "center", borderRadius: "12px", background: "#124E40" }}>
            <svg viewBox="0 0 24 24" style={{ height: "24px", width: "24px" }} fill="none" stroke="#F6F1E8" strokeWidth="2">
              <path d="M12 20s-7-4.5-7-9.5A4.5 4.5 0 0 1 9.5 6c1.6 0 2.6.8 3.5 2 0 0 .9-2 3.5-2A4.5 4.5 0 0 1 19 10.5C19 15.5 12 20 12 20Z" />
            </svg>
          </span>
          <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#233029" }}>GiveKhair</span>
        </div>

        <div style={{ background: "white", borderRadius: "1rem", padding: "1.5rem", boxShadow: "0 4px 24px rgba(18,78,64,0.1)", marginBottom: "1rem" }}>
          <p style={{ color: "#991B1B", fontWeight: 600, marginBottom: "0.5rem" }}>Sign in failed</p>
          <p style={{ fontSize: "0.875rem", color: "#3A4A42", marginBottom: "1.5rem" }}>
            {searchParams.error === "Configuration" ? "Auth configuration error — please contact support." : "There was a problem signing you in."}
          </p>
          <a
            href={`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            style={{ display: "inline-block", padding: "10px 24px", borderRadius: "9999px", background: "#1E8C6E", color: "white", fontWeight: 600, fontSize: "0.875rem", textDecoration: "none" }}>
            Try again
          </a>
        </div>

        <p style={{ fontSize: "0.75rem", color: "#8A9E94" }}>
          Questions? <a href="mailto:hello@givekhair.com" style={{ color: "#1E8C6E" }}>Get in touch</a>
        </p>
      </div>
    </div>
  );
}
