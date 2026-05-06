import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, LineChart, Globe, Network } from "lucide-react";

const navItems = [
  { href: "/", label: "Markets", icon: LayoutDashboard },
  { href: "/lattice", label: "Lattice", icon: Network },
  { href: "/simulator", label: "Simulator", icon: LineChart },
  { href: "/geopolitics", label: "Geopolitics", icon: Globe },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex">
      {navItems.map((item) => {
        const isActive = location === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
