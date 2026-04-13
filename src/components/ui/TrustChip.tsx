import type { ReactNode } from "react";

interface TrustChipProps {
  children: ReactNode;
  tone?: "default" | "gold";
}

export function TrustChip({ children, tone = "default" }: TrustChipProps) {
  return <span className={`trust-chip ${tone === "gold" ? "trust-chip-gold" : ""}`.trim()}>{children}</span>;
}
