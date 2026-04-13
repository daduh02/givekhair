import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="flex min-h-[calc(100vh-4.75rem)] flex-col">
        <div className="flex-1">{children}</div>
        <PublicFooter />
      </div>
    </div>
  );
}
