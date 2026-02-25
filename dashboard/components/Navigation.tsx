"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Trophy, TrendingUp, Flame, Zap, Calendar, Target,
  BarChart3, Radio, Cloud, ShieldCheck, GitBranch, Menu, X, Activity,
} from "lucide-react";

const navItems = [
  { href: "/",           label: "Table",    icon: Trophy },
  { href: "/race",       label: "Race",     icon: TrendingUp },
  { href: "/form",       label: "Form",     icon: Flame },
  { href: "/live",       label: "Live",     icon: Zap },
  { href: "/results",    label: "Results",  icon: Calendar },
  { href: "/scorers",    label: "Scorers",  icon: Target },
  { href: "/stats",      label: "Stats",    icon: BarChart3 },
  { href: "/stream",     label: "Stream",   icon: Radio },
  { href: "/weather",    label: "Weather",  icon: Cloud },
  { href: "/quality",    label: "Quality",  icon: ShieldCheck },
  { href: "/lineage",    label: "Lineage",  icon: GitBranch },
  { href: "/health",     label: "Health",   icon: Activity },
];

export default function Navigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.06]" style={{ background: "rgba(10, 10, 15, 0.85)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00ff85] to-[#00cc6a] flex items-center justify-center text-[#0a0a0f] font-black text-[11px] tracking-tight shadow-lg shadow-[#00ff85]/20 group-hover:shadow-[#00ff85]/40 transition-shadow">
                EPL
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="font-bold text-white text-[15px] leading-tight">
                  Analytics
                </span>
                <span className="text-[#00ff85] text-[10px] font-semibold tracking-wider uppercase">
                  2025-26 Season
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {navItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200
                      ${active
                        ? "bg-[#00ff85]/10 text-[#00ff85] shadow-inner"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                      }
                    `}
                  >
                    <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-out drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 nav-overlay animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute top-0 left-0 bottom-0 w-72 bg-[#0d1117]/95 backdrop-blur-xl border-r border-white/[0.06] animate-slide-in-left">
            {/* Drawer header */}
            <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/[0.06]">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ff85] to-[#00cc6a] flex items-center justify-center text-[#0a0a0f] font-black text-[10px]">
                EPL
              </div>
              <div>
                <span className="font-bold text-white text-sm">EPL Analytics</span>
                <span className="block text-[#00ff85] text-[10px] font-semibold">2025-26</span>
              </div>
            </div>

            {/* Drawer nav items */}
            <nav className="px-3 py-4 space-y-0.5 overflow-y-auto max-h-[calc(100vh-4rem)]">
              {navItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                      ${active
                        ? "bg-[#00ff85]/10 text-[#00ff85]"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                      }
                    `}
                  >
                    <Icon size={18} strokeWidth={active ? 2.5 : 1.5} />
                    <span>{item.label}</span>
                    {active && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00ff85]" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
