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

export async function fetchPolymarketData(limit: number = 30) {
  const url = `https://gamma-api.polymarket.com/events?limit=${Math.min(80, limit * 3)}&active=true&closed=false&order=volume&ascending=false`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Polymarket API error: ${response.status}`);
  const events = (await response.json()) as PolymarketEvent[];

  const markets = [];
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
          // intentional: parse failure uses default value
        }

      const oddsShift = getOddsShift(market.id, parseFloat(yesPrice.toString()));

      markets.push({
        id: market.id,
        question: market.question,
        category: event.category ?? "general",
        yesPrice: parseFloat(yesPrice.toString()),
        noPrice: parseFloat(noPrice.toString()),
        volume: parseFloat(market.volume ?? "0"),
        liquidity: parseFloat(market.liquidity ?? "0"),
        endDate: market.endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        active: market.active,
        oddsShift: oddsShift,
      });

      if (markets.length >= limit * 3) break;
    }
    if (markets.length >= limit * 3) break;
  }
  return markets;
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
      id: "1",
      question: "Will the Fed cut rates before July 2025?",
      category: "economics",
      yesPrice: 0.72,
      noPrice: 0.28,
      volume: 4200000,
      liquidity: 850000,
      endDate: "2025-07-31T00:00:00Z",
      active: true,
      oddsShift: 0.03,
    },
    {
      id: "2",
      question: "Will Bitcoin reach $100k in 2025?",
      category: "crypto",
      yesPrice: 0.58,
      noPrice: 0.42,
      volume: 8100000,
      liquidity: 2100000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: -0.02,
    },
    {
      id: "3",
      question: "Will NVIDIA remain the leading AI chip company?",
      category: "technology",
      yesPrice: 0.81,
      noPrice: 0.19,
      volume: 2900000,
      liquidity: 640000,
      endDate: "2025-06-30T00:00:00Z",
      active: true,
      oddsShift: null,
    },
    {
      id: "4",
      question: "Will the US enter a recession in 2025?",
      category: "economics",
      yesPrice: 0.31,
      noPrice: 0.69,
      volume: 5600000,
      liquidity: 1300000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.05,
    },
    {
      id: "5",
      question: "Will Ethereum ETF inflows exceed Bitcoin ETF?",
      category: "crypto",
      yesPrice: 0.22,
      noPrice: 0.78,
      volume: 1800000,
      liquidity: 420000,
      endDate: "2025-09-30T00:00:00Z",
      active: true,
      oddsShift: null,
    },
    {
      id: "6",
      question: "Will China invade Taiwan before 2026?",
      category: "geopolitics",
      yesPrice: 0.08,
      noPrice: 0.92,
      volume: 3200000,
      liquidity: 780000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.01,
    },
    {
      id: "7",
      question: "Will Apple release an AI-native iPhone in 2025?",
      category: "technology",
      yesPrice: 0.65,
      noPrice: 0.35,
      volume: 1500000,
      liquidity: 380000,
      endDate: "2025-09-30T00:00:00Z",
      active: true,
      oddsShift: null,
    },
    {
      id: "8",
      question: "Will US inflation drop below 2% in 2025?",
      category: "economics",
      yesPrice: 0.44,
      noPrice: 0.56,
      volume: 2100000,
      liquidity: 520000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: -0.03,
    },
    {
      id: "9",
      question: "Will Tesla release Full Self-Driving v5?",
      category: "technology",
      yesPrice: 0.39,
      noPrice: 0.61,
      volume: 980000,
      liquidity: 240000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: null,
    },
    {
      id: "10",
      question: "Will Russia-Ukraine conflict end in 2025?",
      category: "geopolitics",
      yesPrice: 0.28,
      noPrice: 0.72,
      volume: 6800000,
      liquidity: 1700000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.04,
    },
    {
      id: "11",
      question: "Will S&P 500 hit 6500 in 2025?",
      category: "finance",
      yesPrice: 0.61,
      noPrice: 0.39,
      volume: 3400000,
      liquidity: 870000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.02,
    },
    {
      id: "12",
      question: "Will Solana flip Ethereum by market cap?",
      category: "crypto",
      yesPrice: 0.14,
      noPrice: 0.86,
      volume: 2200000,
      liquidity: 550000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: null,
    },
    {
      id: "13",
      question: "Will Iran close the Strait of Hormuz in 2025?",
      category: "geopolitics",
      yesPrice: 0.11,
      noPrice: 0.89,
      volume: 1900000,
      liquidity: 410000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.02,
    },
    {
      id: "14",
      question: "Will crypto regulation pass in the US in 2025?",
      category: "crypto",
      yesPrice: 0.54,
      noPrice: 0.46,
      volume: 3100000,
      liquidity: 720000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.06,
    },
    {
      id: "15",
      question: "Will there be a Russia-Ukraine ceasefire in 2025?",
      category: "geopolitics",
      yesPrice: 0.34,
      noPrice: 0.66,
      volume: 5200000,
      liquidity: 1100000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.05,
    },
    {
      id: "16",
      question: "Will oil prices exceed $100/barrel in 2025?",
      category: "energy",
      yesPrice: 0.19,
      noPrice: 0.81,
      volume: 2700000,
      liquidity: 620000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: -0.02,
    },
    {
      id: "17",
      question: "Will North Korea conduct a nuclear test in 2025?",
      category: "geopolitics",
      yesPrice: 0.16,
      noPrice: 0.84,
      volume: 1600000,
      liquidity: 370000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: null,
    },
    {
      id: "18",
      question: "Will AI cause 1M+ US job losses in 2025?",
      category: "technology",
      yesPrice: 0.41,
      noPrice: 0.59,
      volume: 2000000,
      liquidity: 480000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.03,
    },
    {
      id: "19",
      question: "Will the dollar lose reserve currency status by 2026?",
      category: "macro",
      yesPrice: 0.07,
      noPrice: 0.93,
      volume: 1400000,
      liquidity: 320000,
      endDate: "2026-01-01T00:00:00Z",
      active: true,
      oddsShift: null,
    },
    {
      id: "20",
      question: "Will gold hit $3500/oz in 2025?",
      category: "commodities",
      yesPrice: 0.43,
      noPrice: 0.57,
      volume: 2300000,
      liquidity: 540000,
      endDate: "2025-12-31T00:00:00Z",
      active: true,
      oddsShift: 0.07,
    },
  ];
  return markets.slice(0, limit);
}

export { getFallbackMarkets };
export default router;
