import React, { useState, useMemo } from "react";
import { useGetPolymarketMarkets, getGetPolymarketMarketsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, BarChart2, CalendarDays } from "lucide-react";
import { format } from "date-fns";

export default function Geopolitics() {
  const { data: markets, isLoading } = useGetPolymarketMarkets(undefined, {
    query: { queryKey: getGetPolymarketMarketsQueryKey() },
  });
  const [activeTab, setActiveTab] = useState<string>("all");

  const marketList = Array.isArray(markets) ? markets : [];

  const categories = useMemo(() => {
    if (marketList.length === 0) return ["all"];
    const cats = new Set<string>();
    marketList.forEach((m) => { if (m.category) cats.add(m.category.toLowerCase()); });
    return ["all", ...Array.from(cats)].sort();
  }, [marketList]);

  const filteredMarkets = useMemo(() => {
    const filtered = activeTab === "all" ? marketList : marketList.filter((m) => m.category?.toLowerCase() === activeTab);
    return [...filtered].sort((a, b) => (b.volume || 0) - (a.volume || 0));
  }, [marketList, activeTab]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Geopolitics</h1>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <Globe className="w-3 h-3 text-primary" />
          Live odds from global prediction markets
        </p>
      </div>

      {/* Category tabs — horizontally scrollable */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeTab === cat
                ? "bg-primary text-primary-foreground"
                : "bg-card/60 text-muted-foreground border border-white/5"
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMarkets.map((market) => (
            <Card key={market.id} className="bg-card/30 border-white/5 hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-3 mb-3">
                  <h3 className="font-semibold text-white text-sm leading-snug">{market.question}</h3>
                  {market.category && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground uppercase tracking-wider">
                      {market.category}
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-3">
                  <div className="relative h-9 bg-white/5 rounded overflow-hidden flex items-center">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-green-500/20"
                      style={{ width: `${market.yesPrice * 100}%` }}
                    />
                    <div className="relative flex justify-between w-full px-3 z-10 text-sm">
                      <span className="font-semibold text-green-400">YES</span>
                      <span className="font-mono text-white">{(market.yesPrice * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="relative h-9 bg-white/5 rounded overflow-hidden flex items-center">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-red-500/20"
                      style={{ width: `${market.noPrice * 100}%` }}
                    />
                    <div className="relative flex justify-between w-full px-3 z-10 text-sm">
                      <span className="font-semibold text-red-400">NO</span>
                      <span className="font-mono text-white">{(market.noPrice * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-white/5 pt-2.5">
                  <div className="flex items-center gap-1">
                    <BarChart2 className="w-3 h-3" />
                    ${(market.volume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  {market.endDate && (
                    <div className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {format(new Date(market.endDate), "MMM d, yyyy")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
