export function getPublicBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

export function buildAbsoluteUrl(path: string) {
  const base = getPublicBaseUrl().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
