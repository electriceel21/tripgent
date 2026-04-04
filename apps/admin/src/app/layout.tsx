import type { Metadata } from "next";
import { AdminNav } from "@/components/AdminNav";
import "./globals.css";

export const dynamic = "force-dynamic";

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
    <html lang="en">
      <body>
        <AdminNav />
        {children}
      </body>
    </html>
  );
}
