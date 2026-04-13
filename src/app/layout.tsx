import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// The public refresh leans on a warmer editorial serif for emphasis while keeping
// a clear sans-serif for application text and forms.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
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
      <body className={`${plusJakartaSans.variable} ${fraunces.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
