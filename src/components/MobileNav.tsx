"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Network, LayoutGrid, ClipboardList, Database } from "lucide-react";

const navItems = [
  { href: "/", label: "Gateway", icon: Network },
  { href: "/tasks", label: "Tasks", icon: LayoutGrid },
  { href: "/missions", label: "Missions", icon: ClipboardList },
  { href: "/registry", label: "Registry", icon: Database },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 w-full bg-surface-variant/60 backdrop-blur-xl border-t border-outline-variant/15 px-6 py-3 flex justify-between items-center z-50">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 transition-colors ${
              isActive ? "text-primary" : "text-on-surface/50"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
