export default function SignInPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F6F1E8", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{ display: "grid", height: "40px", width: "40px", placeItems: "center", borderRadius: "12px", background: "#124E40" }}>
              <svg viewBox="0 0 24 24" style={{ height: "24px", width: "24px" }} fill="none" stroke="#F6F1E8" strokeWidth="2">
                <path d="M12 20s-7-4.5-7-9.5A4.5 4.5 0 0 1 9.5 6c1.6 0 2.6.8 3.5 2 0 0 .9-2 3.5-2A4.5 4.5 0 0 1 19 10.5C19 15.5 12 20 12 20Z" />
              </svg>
            </span>
            <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#233029" }}>GiveKhair</span>
          </div>
          <p style={{ fontSize: "0.875rem", color: "#3A4A42" }}>Sign in to your account</p>
        </div>

        <div style={{ background: "white", borderRadius: "1rem", padding: "1.5rem", boxShadow: "0 4px 24px rgba(18,78,64,0.1)" }}>
          {/* Google sign in — plain form POST, no JS required */}
          <form action="/api/auth/signin/google" method="POST">
            <input type="hidden" name="callbackUrl" value="/admin" />
            <input type="hidden" name="csrfToken" id="csrfToken" value="" />
            <button type="submit"
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "12px 16px", borderRadius: "12px", border: "1px solid rgba(18,78,64,0.2)", background: "white", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, color: "#233029", marginBottom: "1rem" }}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
              </svg>
              Continue with Google
            </button>
          </form>

          <div style={{ position: "relative", marginBottom: "1rem" }}>
            <div style={{ borderTop: "1px solid rgba(18,78,64,0.12)" }} />
            <div style={{ position: "absolute", top: "-9px", left: "50%", transform: "translateX(-50%)", background: "white", padding: "0 8px", fontSize: "0.75rem", color: "#8A9E94" }}>or</div>
          </div>

          <p style={{ fontSize: "0.75rem", color: "#8A9E94", textAlign: "center" }}>
            Email/password sign in coming soon.
          </p>
        </div>

        <p style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.75rem", color: "#8A9E94" }}>
          Questions? <a href="mailto:hello@givekhair.com" style={{ color: "#1E8C6E" }}>Get in touch</a>
        </p>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        // Fetch CSRF token and set it on the form
        fetch('/api/auth/csrf')
          .then(r => r.json())
          .then(data => {
            document.getElementById('csrfToken').value = data.csrfToken;
          });
      `}} />
    </div>
  );
}
