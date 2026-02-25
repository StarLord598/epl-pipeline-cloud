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
      <body className="min-h-screen bg-[#0a0a0f] text-gray-200 antialiased">
        {/* Subtle soccer pitch background texture */}
        <div className="pitch-bg" aria-hidden="true" />

        <Navigation />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">
          {children}
        </main>

        <footer className="border-t border-white/[0.04] mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00ff85] inline-block" />
                EPL Analytics Dashboard · 2025-26 Season
              </p>
              <p>Built with Next.js + Airflow + DuckDB + dbt</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
