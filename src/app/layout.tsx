import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
