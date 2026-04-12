import { CredentialsSignInForm } from "@/components/auth/CredentialsSignInForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default function SignInPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const callbackUrl = searchParams.callbackUrl ?? "/admin";
  const error = searchParams.error;

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

        <div style={{ background: "white", borderRadius: "1rem", padding: "1.5rem", boxShadow: "0 4px 24px rgba(18,78,64,0.1)" }}>
          <p style={{ fontSize: "0.875rem", color: "#3A4A42", marginBottom: "1.25rem" }}>Sign in to your account</p>

          {error && (
            <div style={{ marginBottom: "1rem", padding: "10px", borderRadius: "8px", background: "#FEE2E2", color: "#991B1B", fontSize: "0.8rem" }}>
              Sign in failed — please try again.
            </div>
          )}

          <CredentialsSignInForm callbackUrl={callbackUrl} initialError={error} />

          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "1rem 0" }}>
            <div style={{ height: "1px", flex: 1, background: "rgba(18,78,64,0.14)" }} />
            <span style={{ fontSize: "0.75rem", color: "#8A9E94" }}>or</span>
            <div style={{ height: "1px", flex: 1, background: "rgba(18,78,64,0.14)" }} />
          </div>

          <GoogleSignInButton callbackUrl={callbackUrl} />
        </div>

        <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#8A9E94" }}>
          Questions? <a href="mailto:hello@givekhair.com" style={{ color: "#1E8C6E" }}>Get in touch</a>
        </p>
        <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#8A9E94" }}>
          Demo password for seeded accounts: <span style={{ color: "#233029", fontWeight: 600 }}>GiveKhair123!</span>
        </p>
      </div>
    </div>
  );
}
