"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/",           label: "Table",    icon: "🏆" },
  { href: "/race",       label: "Race",     icon: "📈" },
  { href: "/form",       label: "Form",     icon: "🔥" },
  { href: "/live",       label: "Live",     icon: "⚡" },
  { href: "/results",    label: "Results",  icon: "⚽" },
  { href: "/scorers",    label: "Scorers",  icon: "🎯" },
  { href: "/stats",      label: "Stats",    icon: "📊" },
  { href: "/stream",    label: "Stream",   icon: "📡" },
  { href: "/weather",   label: "Weather",  icon: "🌤️" },
  { href: "/quality",   label: "Quality",  icon: "🛡️" },
  { href: "/lineage",   label: "Lineage",  icon: "🔗" },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-[#38003c] shadow-lg shadow-purple-900/30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-[#00ff85] rounded-full flex items-center justify-center text-[#38003c] font-black text-xs">
              EPL
            </div>
            <span className="font-bold text-white text-lg hidden sm:block">
              Analytics
            </span>
            <span className="text-[#00ff85] text-xs font-semibold hidden sm:block">
              2025-26
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                    ${active
                      ? "bg-[#00ff85] text-[#38003c]"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                    }
                  `}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="hidden sm:block">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
