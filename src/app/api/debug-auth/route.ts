export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    hasGoogleId: !!process.env.AUTH_GOOGLE_ID,
    hasGoogleSecret: !!process.env.AUTH_GOOGLE_SECRET,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    authUrl: process.env.AUTH_URL,
    nextAuthUrl: process.env.NEXTAUTH_URL,
    googleIdLength: process.env.AUTH_GOOGLE_ID?.length,
    googleIdPreview: process.env.AUTH_GOOGLE_ID?.substring(0, 15) + "...",
  });
}
