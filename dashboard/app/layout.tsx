import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "EPL Analytics | 2025-26 Premier League",
  description: "Premier League 2025-26 season analytics dashboard — live pipeline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0f0f0f] text-gray-100">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
        <footer className="text-center py-6 text-gray-500 text-sm border-t border-white/5 mt-12">
          <p>⚽ EPL Analytics Dashboard · 2025-26 Season · Built with Next.js + Airflow + DuckDB + dbt</p>
          <p className="mt-1">Data: football-data.org (live) · StatsBomb Open Data (historical)</p>
        </footer>
      </body>
    </html>
  );
}
