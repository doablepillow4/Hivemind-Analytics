import type { HiveSignal } from "./types";

const SYMBOL_KEYWORDS: Record<string, string[]> = {
  BTC: ["bitcoin", "btc", "crypto", "100k", "satoshi"],
  ETH: ["ethereum", "eth", "ether", "crypto"],
  SOL: ["solana", "sol", "crypto"],
  BNB: ["binance", "bnb", "crypto"],
  NVDA: ["nvidia", "ai chip", "artificial intelligence", "jensen", "gpu"],
  TSLA: ["tesla", "elon musk", "ev", "electric vehicle", "autopilot"],
  AAPL: ["apple", "iphone", "tim cook", "ios"],
  MSFT: ["microsoft", "azure", "openai", "copilot"],
  AMZN: ["amazon", "aws", "cloud"],
  META: ["meta", "facebook", "zuckerberg", "instagram"],
  GOOGL: ["google", "alphabet", "search", "gemini"],
  SPY: ["s&p 500", "recession", "federal reserve", "inflation", "rate cut", "market"],
};

const GEO_KEYWORDS = [
  "ukraine", "russia", "taiwan", "china", "middle east", "hormuz",
  "iran", "israel", "north korea", "geopolit",
];

interface PolymarketEventRaw {
  id: string;
  title?: string;
  category?: string;
  markets?: Array<{
    id: string;
    question?: string;
    outcomePrices?: string;
    volume?: string;
    liquidity?: string;
    active?: boolean;
    closed?: boolean;
  }>;
}

export async function extractHiveSignal(symbol: string): Promise<HiveSignal> {
  try {
    const url =
      "https://gamma-api.polymarket.com/events?limit=80&active=true&closed=false&order=volume&ascending=false";
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) throw new Error(`Polymarket ${res.status}`);
    const events = (await res.json()) as PolymarketEventRaw[];

    const keywords = SYMBOL_KEYWORDS[symbol] ?? [symbol.toLowerCase()];

    let weightedBullishSum = 0;
    let weightedTotalSum = 0;
    let geoWeightedSum = 0;
    let geoTotalSum = 0;
    const relevantMarkets: string[] = [];

    for (const event of events) {
      for (const market of event.markets ?? []) {
        if (!market.active || market.closed) continue;

        const text = (
          (market.question ?? "") +
          " " +
          (event.title ?? "") +
          " " +
          (event.category ?? "")
        ).toLowerCase();

        let prices: number[] = [0.5, 0.5];
        try {
          prices = JSON.parse(market.outcomePrices ?? "[]") as number[];
        } catch {}

        const yesPrice = prices[0] ?? 0.5;
        const volume = parseFloat(market.volume ?? "0");
        const liquidity = parseFloat(market.liquidity ?? "0");
        const weight = Math.sqrt(liquidity) * Math.log1p(volume);

        const isRelevant = keywords.some((kw) => text.includes(kw));
        const isGeo = GEO_KEYWORDS.some((kw) => text.includes(kw));

        if (isRelevant && weight > 0) {
          const bullishPrior = yesPrice;
          weightedBullishSum += bullishPrior * weight;
          weightedTotalSum += weight;
          relevantMarkets.push(market.question?.slice(0, 60) ?? "Unknown");
        }

        if (isGeo && weight > 0) {
          const uncertainty = 1 - 2 * Math.abs(yesPrice - 0.5);
          geoWeightedSum += uncertainty * weight;
          geoTotalSum += weight;
        }
      }
    }

    const hiveProbability =
      weightedTotalSum > 0 ? weightedBullishSum / weightedTotalSum : 0.5;
    const geoPressure =
      geoTotalSum > 0 ? geoWeightedSum / geoTotalSum : 0.1;

    const liquidityScore = Math.min(1, weightedTotalSum / 5000);
    const hiveConfidence = liquidityScore * 0.7 + 0.1;

    return {
      probability: parseFloat(hiveProbability.toFixed(4)),
      confidence: parseFloat(hiveConfidence.toFixed(4)),
      liquidityScore: parseFloat(liquidityScore.toFixed(4)),
      relevantMarkets: relevantMarkets.slice(0, 5),
      geoPressure: parseFloat(geoPressure.toFixed(4)),
    };
  } catch {
    return generateFallbackHiveSignal(symbol);
  }
}

function generateFallbackHiveSignal(symbol: string): HiveSignal {
  const defaultProbabilities: Record<string, number> = {
    BTC: 0.61, ETH: 0.54, SOL: 0.58, BNB: 0.52,
    NVDA: 0.69, TSLA: 0.47, AAPL: 0.55, MSFT: 0.62,
    AMZN: 0.57, META: 0.59, GOOGL: 0.56, SPY: 0.53,
  };
  return {
    probability: defaultProbabilities[symbol] ?? 0.52,
    confidence: 0.35,
    liquidityScore: 0.2,
    relevantMarkets: ["Fallback signal — live data unavailable"],
    geoPressure: 0.18,
  };
}
