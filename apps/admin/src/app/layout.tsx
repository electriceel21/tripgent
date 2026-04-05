import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { AdminNav } from "@/components/AdminNav";
import "./globals.css";

export const dynamic = "force-dynamic";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tripgent Admin",
  description: "Sponsor programs, destinations, and reward rules",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body className={spaceGrotesk.className}>
        <AdminNav />
        {children}
      </body>
    </html>
  );
}
