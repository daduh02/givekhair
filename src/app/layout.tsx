import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { TRPCProvider } from "@/components/providers";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: { template: "%s | giveKhair", default: "giveKhair — Give charity, give khair" },
  description: "Peer-to-peer fundraising for the causes you care about. Gift Aid eligible, fee transparent.",
  openGraph: {
    type: "website",
    siteName: "giveKhair",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionProvider session={session}>
          <TRPCProvider>
            {children}
          </TRPCProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
