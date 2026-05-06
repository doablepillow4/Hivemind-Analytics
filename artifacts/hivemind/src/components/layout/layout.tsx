import React from "react";
import { BottomNav } from "./sidebar";
import { Brain } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          <span className="font-bold text-base tracking-tight text-white">Hivemind</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[11px] font-mono text-muted-foreground">Live</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 py-5 max-w-2xl mx-auto">
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
