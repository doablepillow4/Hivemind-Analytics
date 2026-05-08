import React from "react";
import { Link } from "wouter";
import { Network, LineChart, Telescope, ArrowRight, Zap, Globe, BarChart3 } from "lucide-react";

const ACTIONS = [
  {
    href: "/lattice",
    icon: Network,
    accentIcon: Zap,
    label: "Lattice",
    sublabel: "AI Multi-Agent Debate",
    description: "Run the Hivemind debate engine for buy/sell/hold predictions with confidence scores.",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    glowColor: "rgba(0,212,255,0.15)",
    badgeColor: "bg-primary/15 text-primary border-primary/25",
    badge: "LIVE",
  },
  {
    href: "/simulator",
    icon: LineChart,
    accentIcon: BarChart3,
    label: "Simulator",
    sublabel: "Monte Carlo Engine",
    description: "Stress-test any asset against market scenarios, Fed shocks, and geopolitical events.",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    glowColor: "rgba(139,92,246,0.15)",
    badgeColor: "bg-violet-500/15 text-violet-400 border-violet-500/25",
    badge: "GBM",
  },
  {
    href: "/intelligence",
    icon: Telescope,
    accentIcon: Globe,
    label: "Intelligence",
    sublabel: "Geopolitical Radar",
    description: "Live threat analysis, Polymarket odds, and breaking news with AI impact scoring.",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    glowColor: "rgba(249,115,22,0.15)",
    badgeColor: "bg-orange-500/15 text-orange-400 border-orange-500/25",
    badge: "FEED",
  },
];

export function QuickActions() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-mono font-700 text-muted-foreground uppercase tracking-widest">
          Quick Access
        </h2>
      </div>

      <div className="space-y-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href}>
              <div
                className={`relative rounded-xl border ${action.borderColor} bg-black/20 p-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.03] transition-all duration-200 overflow-hidden group`}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse at left center, ${action.glowColor}, transparent 70%)`,
                  }}
                />

                <div
                  className={`relative w-10 h-10 rounded-xl ${action.bgColor} border ${action.borderColor} flex items-center justify-center shrink-0`}
                >
                  <Icon className={`w-5 h-5 ${action.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[13px] font-mono font-700 ${action.color}`}>
                      {action.label}
                    </span>
                    <span
                      className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${action.badgeColor} uppercase tracking-widest`}
                    >
                      {action.badge}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono mb-1">
                    {action.sublabel}
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 leading-snug line-clamp-1">
                    {action.description}
                  </p>
                </div>

                <ArrowRight
                  className={`w-4 h-4 ${action.color} shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200`}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
