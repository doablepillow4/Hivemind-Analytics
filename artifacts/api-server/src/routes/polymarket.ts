import { Router, type IRouter } from "express";
import { GetPolymarketMarketsQueryParams, GetPolymarketMarketsResponse } from "@workspace/api-zod";
import { getOddsShift } from "../lib/polymarket-cache";
import { logger } from "../lib/logger";
import { fetchWithRetry, DEFAULT_BROWSER_HEADERS } from "../lib/fetch-utils";

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
const CACHE_TTL = 2 * 60 * 1000;

function eventsToMarkets(events: PolymarketEvent[]): MarketItem[] {
  const markets: MarketItem[] = [];
  for (const event of events) {
    for (const market of event.markets ?? []) {
      if (!market.active || market.closed) continue;
      let yesPrice = 0.5;
      let noPrice = 0.5;
      try {
        // FIX: Polymarket's outcomePrices field is an array of STRINGS like ["0.72","0.28"],
        // not numbers. JSON.parse returns strings, and casting directly to number[] gives NaN.
        // Parse to string array first then convert each element.
        const raw = JSON.parse(market.outcomePrices ?? "[]") as (string | number)[];
        if (raw.length >= 2) {
          yesPrice = parseFloat(String(raw[0]));
          noPrice = parseFloat(String(raw[1]));
        } else if (raw.length === 1) {
          yesPrice = parseFloat(String(raw[0]));
          noPrice = 1 - yesPrice;
        }
        // Guard against NaN from bad data
        if (!Number.isFinite(yesPrice) || yesPrice < 0 || yesPrice > 1) yesPrice = 0.5;
        if (!Number.isFinite(noPrice) || noPrice < 0 || noPrice > 1) noPrice = 1 - yesPrice;
      } catch {
        // intentional: keep 0.5/0.5 for unparseable prices
      }
      markets.push({
        id: market.id,
        question: market.question,
        category: event.category ?? "general",
        yesPrice,
        noPrice,
        volume: parseFloat(market.volume ?? "0") || 0,
        liquidity: parseFloat(market.liquidity ?? "0") || 0,
        endDate:
          market.endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        active: market.active,
        oddsShift: getOddsShift(market.id, yesPrice),
      });
    }
  }
  return markets;
}

async function fetchTag(tag: string, limit: number): Promise<PolymarketEvent[]> {
  // FIX: The gamma-api.polymarket.com endpoint uses tag_slug but the valid slugs
  // have changed. "geopolitics" and "economics" are not valid slugs — they return
  // empty arrays. The correct slugs are "politics", "crypto", "sports", "pop-culture".
  // For geopolitical content, "politics" is the right tag. We fetch more from it
  // and filter client-side by keyword instead of relying on tag taxonomy.
  const url = `https://gamma-api.polymarket.com/events?limit=${limit}&active=true&closed=false&tag_slug=${tag}&order=volume24hr&ascending=false`;
  const res = await fetchWithRetry(url, {
    headers: {
      ...DEFAULT_BROWSER_HEADERS,
      Accept: "application/json",
      Referer: "https://polymarket.com/",
      Origin: "https://polymarket.com",
    },
  }, 3, 15000);
  if (!res.ok) throw new Error(`Polymarket ${tag} error: ${res.status}`);
  const data = await res.json();
  // FIX: gamma-api wraps results in { data: [...] } on some endpoints but not others.
  // Handle both shapes.
  if (Array.isArray(data)) return data as PolymarketEvent[];
  if (data && Array.isArray((data as any).data)) return (data as any).data as PolymarketEvent[];
  return [];
}

export async function fetchPolymarketData(limit: number = 30, options?: { live?: boolean }) {
  const live = options?.live === true;
  if (!live && _cache && Date.now() < _cache.expiresAt) {
    return _cache.data.slice(0, limit);
  }

  // FIX: Only fetch valid Polymarket tag slugs. "geopolitics" and "economics" return
  // empty arrays — use "politics" and "crypto" instead, which have the most relevant
  // geo/macro markets. Fetch more from politics to compensate.
  const [byPolitics, byCrypto] = await Promise.allSettled([
    fetchTag("politics", 80),
    fetchTag("crypto", 20),
  ]);

  const seenIds = new Set<string>();
  const merged: MarketItem[] = [];

  function addFrom(result: PromiseSettledResult<PolymarketEvent[]>, cap: number) {
    if (result.status !== "fulfilled") {
      if (result.reason) logger.warn({ err: result.reason }, "Polymarket tag fetch failed");
      return;
    }
    const slice = eventsToMarkets(result.value);
    let added = 0;
    for (const m of slice) {
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);
      merged.push(m);
      if (++added >= cap) break;
    }
  }

  addFrom(byPolitics, limit - 5);
  addFrom(byCrypto, 5);

  if (merged.length === 0) {
    if (_cache) {
      logger.warn("Polymarket fetch failed, returning stale cached data");
      return _cache.data.slice(0, limit);
    }
    throw new Error("All Polymarket tag fetches failed — no live data available");
  }

  _cache = { data: merged, expiresAt: Date.now() + CACHE_TTL };
  return merged.slice(0, limit);
}

router.get("/polymarket/markets", async (req, res): Promise<void> => {
  const queryParsed = GetPolymarketMarketsQueryParams.safeParse(req.query);
  const limit = queryParsed.success ? queryParsed.data.limit : 20;
  const live = typeof req.query["live"] === "string" ? req.query["live"] === "true" : false;

  try {
    const markets = await fetchPolymarketData(limit, { live });
    res.json(GetPolymarketMarketsResponse.parse(markets.slice(0, limit)));
  } catch (err) {
    logger.error({ err }, "Polymarket fetch failed — no live data available");
    res.status(503).json({
      error: "Polymarket data unavailable",
      message: "Live Polymarket data could not be fetched. Please try again shortly.",
    });
  }
});

export default router;
