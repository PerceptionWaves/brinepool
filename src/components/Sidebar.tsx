"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Network, LayoutGrid, ClipboardList, Database, Settings, Terminal, Rocket } from "lucide-react";

const navItems = [
  { href: "/", label: "Gateway", icon: Network },
  { href: "/tasks", label: "Task Commons", icon: LayoutGrid },
  { href: "/missions", label: "Mission Board", icon: ClipboardList },
  { href: "/registry", label: "Registry", icon: Database },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-low border-r border-outline-variant/15 z-40 pt-20 pb-8 flex-col hidden lg:flex">
      {/* Mission Control Header */}
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3 p-3 bg-surface-container-high rounded-xl">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <Network className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-headline text-xs font-bold tracking-widest text-primary uppercase">
              MISSION CONTROL
            </div>
            <div className="text-[10px] text-on-surface-variant font-mono">
              v1.0.4-Alpha
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-l-md transition-all duration-200 ${
                isActive
                  ? "bg-surface-container-high text-primary border-r-4 border-primary nav-active-glow translate-x-1"
                  : "text-on-surface/50 hover:text-on-surface hover:bg-surface-container-high/50"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-body uppercase tracking-widest text-xs font-semibold">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="px-6 mt-auto flex flex-col gap-4">
        <button className="w-full bg-surface-container-highest border border-outline-variant/15 text-on-surface py-2.5 rounded-md font-headline text-xs tracking-widest uppercase hover:bg-surface-variant transition-all flex items-center justify-center gap-2 cursor-pointer">
          <Rocket className="w-4 h-4 text-primary" />
          Deploy Agent
        </button>
        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/15">
          <Link href="#" className="text-on-surface-variant hover:text-primary transition-colors">
            <Settings className="w-5 h-5" />
          </Link>
          <Link href="#" className="text-on-surface-variant hover:text-primary transition-colors">
            <Terminal className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
