import { Router, type IRouter } from "express";
import { GetPolymarketMarketsQueryParams, GetPolymarketMarketsResponse } from "@workspace/api-zod";
import { getOddsShift } from "../lib/polymarket-cache";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface PolymarketEvent {
  id: string;
  title: string;
  category: string;
  markets: Array<{
    id: string;
    question: string;
    outcomePrices: string;
    volume: string;
    liquidity: string;
    endDate: string;
    active: boolean;
    closed: boolean;
  }>;
}

type MarketItem = {
  id: string;
  question: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  endDate: string;
  active: boolean;
  oddsShift: number | null;
};

let _cache: { data: MarketItem[]; expiresAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

function eventsToMarkets(events: PolymarketEvent[]): MarketItem[] {
  const markets: MarketItem[] = [];
  for (const event of events) {
    for (const market of event.markets ?? []) {
      if (!market.active || market.closed) continue;
      let yesPrice = 0.5;
      let noPrice = 0.5;
      try {
        const prices = JSON.parse(market.outcomePrices ?? "[]") as number[];
        yesPrice = prices[0] ?? 0.5;
        noPrice = prices[1] ?? 1 - yesPrice;
      } catch {
        // intentional
      }
      markets.push({
        id: market.id,
        question: market.question,
        category: event.category ?? "general",
        yesPrice: parseFloat(yesPrice.toString()),
        noPrice: parseFloat(noPrice.toString()),
        volume: parseFloat(market.volume ?? "0"),
        liquidity: parseFloat(market.liquidity ?? "0"),
        endDate:
          market.endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        active: market.active,
        oddsShift: getOddsShift(market.id, parseFloat(yesPrice.toString())),
      });
    }
  }
  return markets;
}

async function fetchTag(tag: string, limit: number): Promise<PolymarketEvent[]> {
  const url = `https://gamma-api.polymarket.com/events?limit=${limit}&active=true&closed=false&tag_slug=${tag}&order=volume&ascending=false`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Polymarket ${tag} error: ${res.status}`);
  return (await res.json()) as PolymarketEvent[];
}

export async function fetchPolymarketData(limit: number = 30) {
  if (_cache && Date.now() < _cache.expiresAt) {
    return _cache.data.slice(0, limit);
  }

  const slicePerTag = Math.ceil(limit / 3);

  const [byPolitics, byGeo, byEcon] = await Promise.allSettled([
    fetchTag("politics", 60),
    fetchTag("geopolitics", 40),
    fetchTag("economics", 30),
  ]);

  const seenIds = new Set<string>();
  const merged: MarketItem[] = [];

  function addFrom(result: PromiseSettledResult<PolymarketEvent[]>, cap: number) {
    if (result.status !== "fulfilled") return;
    const slice = eventsToMarkets(result.value);
    let added = 0;
    for (const m of slice) {
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);
      merged.push(m);
      if (++added >= cap) break;
    }
  }

  addFrom(byGeo, slicePerTag);
  addFrom(byEcon, slicePerTag);
  addFrom(byPolitics, limit - merged.length);

  if (merged.length === 0) throw new Error("All Polymarket fetches failed");

  _cache = { data: merged, expiresAt: Date.now() + CACHE_TTL };
  return merged.slice(0, limit);
}

router.get("/polymarket/markets", async (req, res): Promise<void> => {
  const queryParsed = GetPolymarketMarketsQueryParams.safeParse(req.query);
  const limit = queryParsed.success ? queryParsed.data.limit : 20;

  try {
    const markets = await fetchPolymarketData(limit);
    res.json(GetPolymarketMarketsResponse.parse(markets.slice(0, limit)));
  } catch (err) {
    logger.warn({ err }, "Failed to fetch Polymarket markets, using fallback");
    res.json(GetPolymarketMarketsResponse.parse(getFallbackMarkets(limit)));
  }
});

function getFallbackMarkets(limit: number) {
  const markets = [
    {
      id: "f1",
      question: "Will the US Federal Reserve cut rates before September 2026?",
      category: "economics",
      yesPrice: 0.68,
      noPrice: 0.32,
      volume: 5200000,
      liquidity: 1050000,
      endDate: "2026-09-30T00:00:00Z",
      active: true,
      oddsShift: 0.04,
    },
    {
      id: "f2",
      question: "Will Russia and Ukraine reach a ceasefire agreement in 2026?",
      category: "geopolitics",
      yesPrice: 0.34,
      noPrice: 0.66,
      volume: 7100000,
      liquidity: 1800000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.06,
    },
    {
      id: "f3",
      question: "Will Bitcoin reach $120k in 2026?",
      category: "crypto",
      yesPrice: 0.52,
      noPrice: 0.48,
      volume: 9300000,
      liquidity: 2400000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: -0.03,
    },
    {
      id: "f4",
      question: "Will Iran close the Strait of Hormuz in 2026?",
      category: "geopolitics",
      yesPrice: 0.13,
      noPrice: 0.87,
      volume: 2100000,
      liquidity: 490000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.02,
    },
    {
      id: "f5",
      question: "Will China impose a naval blockade on Taiwan in 2026?",
      category: "geopolitics",
      yesPrice: 0.09,
      noPrice: 0.91,
      volume: 3600000,
      liquidity: 870000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.01,
    },
    {
      id: "f6",
      question: "Will the US economy enter a recession in 2026?",
      category: "economics",
      yesPrice: 0.38,
      noPrice: 0.62,
      volume: 6400000,
      liquidity: 1500000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.07,
    },
    {
      id: "f7",
      question: "Will NATO trigger Article 5 due to Russia-Ukraine conflict?",
      category: "geopolitics",
      yesPrice: 0.07,
      noPrice: 0.93,
      volume: 4200000,
      liquidity: 980000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: null,
    },
    {
      id: "f8",
      question: "Will Israel and Hamas reach a permanent ceasefire in 2026?",
      category: "geopolitics",
      yesPrice: 0.28,
      noPrice: 0.72,
      volume: 5800000,
      liquidity: 1300000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.03,
    },
    {
      id: "f9",
      question: "Will North Korea conduct a nuclear test in 2026?",
      category: "geopolitics",
      yesPrice: 0.18,
      noPrice: 0.82,
      volume: 1800000,
      liquidity: 420000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: null,
    },
    {
      id: "f10",
      question: "Will gold hit $3500/oz before end of 2026?",
      category: "commodities",
      yesPrice: 0.61,
      noPrice: 0.39,
      volume: 2900000,
      liquidity: 670000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.09,
    },
    {
      id: "f11",
      question: "Will Ethereum surpass Bitcoin's market cap by 2027?",
      category: "crypto",
      yesPrice: 0.16,
      noPrice: 0.84,
      volume: 2600000,
      liquidity: 610000,
      endDate: "2027-01-01T00:00:00Z",
      active: true,
      oddsShift: null,
    },
    {
      id: "f12",
      question: "Will India surpass Japan in GDP in 2026?",
      category: "economics",
      yesPrice: 0.44,
      noPrice: 0.56,
      volume: 1400000,
      liquidity: 340000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.02,
    },
    {
      id: "f13",
      question: "Will there be a new major European armed conflict in 2026?",
      category: "geopolitics",
      yesPrice: 0.06,
      noPrice: 0.94,
      volume: 2200000,
      liquidity: 510000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: null,
    },
    {
      id: "f14",
      question: "Will the US dollar lose reserve currency status before 2028?",
      category: "macro",
      yesPrice: 0.08,
      noPrice: 0.92,
      volume: 1700000,
      liquidity: 390000,
      endDate: "2028-01-01T00:00:00Z",
      active: true,
      oddsShift: null,
    },
    {
      id: "f15",
      question: "Will OPEC+ cut oil production by 10% in 2026?",
      category: "energy",
      yesPrice: 0.31,
      noPrice: 0.69,
      volume: 2400000,
      liquidity: 560000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: -0.02,
    },
    {
      id: "f16",
      question: "Will the S&P 500 reach 7000 in 2026?",
      category: "finance",
      yesPrice: 0.55,
      noPrice: 0.45,
      volume: 4100000,
      liquidity: 1000000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.03,
    },
    {
      id: "f17",
      question: "Will China's GDP growth fall below 4% in 2026?",
      category: "economics",
      yesPrice: 0.42,
      noPrice: 0.58,
      volume: 1900000,
      liquidity: 440000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.04,
    },
    {
      id: "f18",
      question: "Will a global AI regulation framework be agreed in 2026?",
      category: "technology",
      yesPrice: 0.22,
      noPrice: 0.78,
      volume: 1600000,
      liquidity: 370000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: null,
    },
    {
      id: "f19",
      question: "Will Iran develop a nuclear weapon by 2027?",
      category: "geopolitics",
      yesPrice: 0.19,
      noPrice: 0.81,
      volume: 2800000,
      liquidity: 650000,
      endDate: "2027-01-01T00:00:00Z",
      active: true,
      oddsShift: 0.02,
    },
    {
      id: "f20",
      question: "Will EU impose new Russia sanctions package in 2026?",
      category: "geopolitics",
      yesPrice: 0.73,
      noPrice: 0.27,
      volume: 1300000,
      liquidity: 310000,
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.05,
    },
  ];
  return markets.slice(0, limit);
}

export { getFallbackMarkets };
export default router;
