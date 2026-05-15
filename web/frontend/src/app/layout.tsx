import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/QueryProvider";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "CPBL Savant — 中華職棒進階數據分析",
  description:
    "CPBL Statcast-style analytics: leaderboards, spray charts, pitch trajectories",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-background antialiased">
        <QueryProvider>
          <Nav />
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
