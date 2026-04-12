export const runtime = "nodejs";

export async function GET() {
  // Test if Google provider works by checking the discovery URL
  let googleDiscovery = null;
  try {
    const res = await fetch("https://accounts.google.com/.well-known/openid-configuration");
    googleDiscovery = res.ok ? "reachable" : "unreachable";
  } catch {
    googleDiscovery = "error";
  }

  return Response.json({
    hasGoogleId: !!process.env.AUTH_GOOGLE_ID,
    hasGoogleSecret: !!process.env.AUTH_GOOGLE_SECRET,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    authUrl: process.env.AUTH_URL,
    nextAuthUrl: process.env.NEXTAUTH_URL,
    googleIdLength: process.env.AUTH_GOOGLE_ID?.length,
    googleIdPreview: process.env.AUTH_GOOGLE_ID?.substring(0, 20),
    googleSecretLength: process.env.AUTH_GOOGLE_SECRET?.length,
    googleDiscovery,
    nodeEnv: process.env.NODE_ENV,
  });
}
