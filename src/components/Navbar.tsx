"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio, Cpu, Wallet, Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Gateway" },
  { href: "/tasks", label: "Task Commons" },
  { href: "/missions", label: "Mission Board" },
  { href: "/registry", label: "Registry" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-surface-variant/60 backdrop-blur-xl border-b border-outline-variant/15 abyssal-shadow">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-2xl font-bold tracking-tighter text-primary drop-shadow-[0_0_8px_rgba(0,220,227,0.4)] font-headline">
          BRINEPOOL
        </Link>
        <nav className="hidden md:flex items-center gap-1 font-headline tracking-tight">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  isActive
                    ? "text-primary border-b-2 border-primary px-3 py-1"
                    : "text-on-surface/70 hover:bg-surface-container-high hover:text-primary-fixed px-3 py-1 rounded transition-all duration-200"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-surface-container-highest rounded-lg ghost-border">
          <Radio className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-mono text-primary/80 tracking-widest uppercase">
            Protocol Live
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-on-surface/70">
          <Radio className="w-5 h-5 cursor-pointer hover:text-primary transition-colors" />
          <Cpu className="w-5 h-5 cursor-pointer hover:text-primary transition-colors" />
          <Wallet className="w-5 h-5 cursor-pointer hover:text-primary transition-colors" />
        </div>
        <button className="bg-gradient-to-br from-primary to-on-primary-container text-on-primary px-5 py-2 rounded-md font-semibold text-sm transition-all hover:scale-105 active:scale-95 cursor-pointer">
          Connect Wallet
        </button>
        <button
          className="md:hidden text-on-surface"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="absolute top-16 left-0 w-full bg-surface-container-low/95 backdrop-blur-xl border-b border-outline-variant/15 md:hidden z-50">
          <nav className="flex flex-col p-4 gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`px-4 py-3 rounded-md font-headline text-sm tracking-tight transition-all ${
                    isActive
                      ? "bg-surface-container-high text-primary"
                      : "text-on-surface/70 hover:bg-surface-container-high/50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
