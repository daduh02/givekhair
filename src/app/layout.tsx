import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: { template: "%s | GiveKhair", default: "GiveKhair — Every act of Khair is an act of care." },
  description: "A trust-first charity fundraising platform with verified charities, Gift Aid support, and fee-transparent giving.",
  openGraph: {
    type: "website",
    siteName: "GiveKhair",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
