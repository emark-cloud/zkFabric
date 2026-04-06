"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NAV_LINKS = [
  { href: "/issue", label: "Issue" },
  { href: "/prove", label: "Prove" },
  { href: "/vault", label: "Vault" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="relative bg-[#050505]/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-xl font-bold font-heading gradient-text drop-shadow-[0_0_8px_rgba(139,92,246,0.4)]"
            >
              zkFabric
            </Link>
            <div className="hidden sm:flex items-center gap-6">
              {NAV_LINKS.map(({ href, label }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative text-sm font-heading uppercase tracking-wider transition pb-0.5 ${
                      isActive ? "text-white" : "text-[#71717a] hover:text-white"
                    }`}
                  >
                    {label}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full animate-fade-in" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
          <ConnectButton />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
    </nav>
  );
}
