type HeaderSource = Headers | { get(name: string): string | null };

export function getClientIp(headers: HeaderSource) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "unknown";
}
