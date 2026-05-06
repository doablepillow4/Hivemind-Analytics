import { logger } from "./logger";

const STOCK_SYMBOLS = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "SPY"];
const CRYPTO_IDS: Record<string, { id: string; symbol: string; name: string }> = {
  BTC:  { id: "bitcoin",       symbol: "BTC",  name: "Bitcoin"   },
  ETH:  { id: "ethereum",      symbol: "ETH",  name: "Ethereum"  },
  SOL:  { id: "solana",        symbol: "SOL",  name: "Solana"    },
  BNB:  { id: "binancecoin",   symbol: "BNB",  name: "BNB"       },
  ADA:  { id: "cardano",       symbol: "ADA",  name: "Cardano"   },
  XRP:  { id: "ripple",        symbol: "XRP",  name: "XRP"       },
  DOGE: { id: "dogecoin",      symbol: "DOGE", name: "Dogecoin"  },
  AVAX: { id: "avalanche-2",   symbol: "AVAX", name: "Avalanche" },
  DOT:  { id: "polkadot",      symbol: "DOT",  name: "Polkadot"  },
  LINK: { id: "chainlink",     symbol: "LINK", name: "Chainlink" },
  MATIC:{ id: "polygon-ecosystem-token", symbol: "MATIC",name: "Polygon"   },
  LTC:  { id: "litecoin",      symbol: "LTC",  name: "Litecoin"  },
};

function safeNum(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeSparkline(values: (number | null | undefined)[]): number[] {
  const clean = values.map((v) => (Number.isFinite(v as number) ? (v as number) : null));
  const filled: number[] = [];
  let last = 0;
  for (const v of clean) {
    if (v !== null) { last = v; filled.push(v); }
    else filled.push(last);
  }
  return filled;
}

export async function fetchStockPrice(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=30d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`);
    const json = (await res.json()) as {
      chart: {
        result: Array<{
          meta: {
            regularMarketPrice?: number | null;
            previousClose?: number | null;
            chartPreviousClose?: number | null;
            regularMarketOpen?: number | null;
            regularMarketVolume?: number | null;
            marketCap?: number | null;
            longName?: string | null;
          };
          indicators: {
            quote: Array<{ close: (number | null)[] }>;
          };
        }>;
        error: unknown;
      };
    };
    const result = json.chart?.result?.[0];
    if (!result) throw new Error("No data");

    const meta = result.meta;
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const validCloses = closes.filter((c): c is number => typeof c === "number" && Number.isFinite(c));
    const sparkline = sanitizeSparkline(validCloses.slice(-15));

    const price = safeNum(meta.regularMarketPrice);
    if (price === 0) throw new Error(`Zero/missing price for ${symbol}`);

    // chartPreviousClose is more reliable than previousClose (which is often null)
    const prevClose = safeNum(meta.chartPreviousClose) || safeNum(meta.previousClose) || price;
    const rawChange = price - prevClose;
    const rawChangePercent = prevClose !== 0 ? (rawChange / prevClose) * 100 : 0;

    return {
      symbol,
      name: (meta.longName && meta.longName.trim()) ? meta.longName : symbol,
      price,
      change: safeNum(rawChange),
      changePercent: safeNum(rawChangePercent),
      volume: safeNum(meta.regularMarketVolume),
      marketCap: safeNum(meta.marketCap),
      type: "stock" as const,
      sparkline: sparkline.length > 0 ? sparkline : generateSparkline(price, 0),
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn({ symbol, err }, "Failed to fetch stock price, using fallback");
    return generateFallbackStockPrice(symbol);
  }
}

export async function fetchCryptoPrices() {
  try {
    const ids = Object.values(CRYPTO_IDS)
      .map((c) => c.id)
      .join(",");
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
    const data = (await res.json()) as Record<
      string,
      {
        usd?: number | null;
        usd_24h_change?: number | null;
        usd_24h_vol?: number | null;
        usd_market_cap?: number | null;
      }
    >;

    const results = [];
    for (const [sym, info] of Object.entries(CRYPTO_IDS)) {
      const d = data[info.id];
      if (!d) continue;

      const price = safeNum(d.usd);
      if (price <= 0) {
        logger.warn({ sym, id: info.id }, "CoinGecko returned invalid price, skipping to fallback entry");
        results.push(generateFallbackCryptoEntry(sym));
        continue;
      }

      const changePercent = safeNum(d.usd_24h_change);
      const change = safeNum((price * changePercent) / 100);

      results.push({
        symbol: sym,
        name: info.name,
        price,
        change,
        changePercent,
        volume: safeNum(d.usd_24h_vol),
        marketCap: safeNum(d.usd_market_cap),
        type: "crypto" as const,
        sparkline: generateSparkline(price, changePercent),
        updatedAt: new Date().toISOString(),
      });
    }
    return results;
  } catch (err) {
    logger.warn({ err }, "Failed to fetch crypto prices, using fallback");
    return generateFallbackCryptoPrices();
  }
}

export async function fetchStockHistory(symbol: string, days = 30) {
  try {
    const range = days <= 7 ? "7d" : days <= 30 ? "1mo" : days <= 90 ? "3mo" : "6mo";
    const interval = days <= 7 ? "60m" : "1d";
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`);
    const json = (await res.json()) as {
      chart: {
        result: Array<{
          timestamp: number[];
          indicators: {
            quote: Array<{
              open: (number | null)[];
              high: (number | null)[];
              low: (number | null)[];
              close: (number | null)[];
              volume: (number | null)[];
            }>;
          };
        }>;
      };
    };
    const result = json.chart?.result?.[0];
    if (!result) throw new Error("No data");

    const timestamps = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    return timestamps
      .map((ts, i) => ({
        timestamp: new Date(ts * 1000).toISOString(),
        open: quote.open?.[i] ?? null,
        high: quote.high?.[i] ?? null,
        low: quote.low?.[i] ?? null,
        close: quote.close?.[i] ?? null,
        volume: quote.volume?.[i] ?? null,
      }))
      .filter((p) => p.close != null && Number.isFinite(p.close));
  } catch (err) {
    logger.warn({ symbol, err }, "Failed to fetch stock history");
    return generateFallbackHistory(symbol, days);
  }
}

export async function fetchCryptoHistory(coinId: string, days = 30) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
    const json = (await res.json()) as { prices: [number, number][] };
    return json.prices
      .map(([ts, close]) => ({
        timestamp: new Date(ts).toISOString(),
        close: Number.isFinite(close) ? close : null,
        open: null,
        high: null,
        low: null,
        volume: null,
      }))
      .filter((p) => p.close != null);
  } catch (err) {
    logger.warn({ coinId, err }, "Failed to fetch crypto history");
    return generateFallbackHistory(coinId, days);
  }
}

export const STOCK_SYMBOL_LIST = STOCK_SYMBOLS;
export const CRYPTO_ID_MAP = CRYPTO_IDS;

export async function fetchAnyTicker(symbol: string): Promise<{
  symbol: string; name: string; price: number; change: number; changePercent: number;
  volume: number; marketCap: number; type: "stock" | "crypto"; sparkline: number[]; updatedAt: string;
} | null> {
  const upper = symbol.toUpperCase();

  if (upper in CRYPTO_IDS) {
    const prices = await fetchCryptoPrices();
    return prices.find((p) => p.symbol === upper) ?? null;
  }

  try {
    const result = await fetchStockPrice(upper);
    return result;
  } catch {
    return null;
  }
}

function generateSparkline(price: number, changePercent: number): number[] {
  const points = 15;
  const result: number[] = [];
  let current = price * (1 - changePercent / 100);
  if (!Number.isFinite(current) || current <= 0) current = price > 0 ? price : 1;
  for (let i = 0; i < points; i++) {
    current = current * (1 + (Math.random() - 0.48) * 0.02);
    if (!Number.isFinite(current) || current <= 0) current = price > 0 ? price : 1;
    result.push(parseFloat(current.toFixed(4)));
  }
  result[result.length - 1] = price;
  return result;
}

function generateFallbackCryptoEntry(sym: string) {
  const fallback = generateFallbackCryptoPrices().find((c) => c.symbol === sym);
  return fallback ?? generateFallbackCryptoPrices()[0];
}

function generateFallbackStockPrice(symbol: string) {
  const prices: Record<string, number> = {
    NVDA: 875.4, TSLA: 175.2, AAPL: 189.5, MSFT: 412.3,
    AMZN: 185.7, META: 502.1, GOOGL: 175.8, SPY: 521.3,
  };
  const price = prices[symbol] ?? 100;
  const changePercent = (Math.random() - 0.5) * 4;
  const change = (price * changePercent) / 100;
  return {
    symbol,
    name: symbol,
    price,
    change,
    changePercent,
    volume: Math.floor(Math.random() * 50000000),
    marketCap: price * 1e9,
    type: "stock" as const,
    sparkline: generateSparkline(price, changePercent),
    updatedAt: new Date().toISOString(),
  };
}

function generateFallbackCryptoPrices() {
  return [
    { symbol: "BTC",   name: "Bitcoin",   price: 97500,  change: 1200,   changePercent:  1.24,  volume: 28e9,  marketCap: 1.92e12, type: "crypto" as const, sparkline: generateSparkline(97500,   1.24),  updatedAt: new Date().toISOString() },
    { symbol: "ETH",   name: "Ethereum",  price: 1870,   change: -22,    changePercent: -1.16,  volume: 14e9,  marketCap: 226e9,   type: "crypto" as const, sparkline: generateSparkline(1870,   -1.16),  updatedAt: new Date().toISOString() },
    { symbol: "SOL",   name: "Solana",    price: 148,    change: 2.8,    changePercent:  1.91,  volume: 3.5e9, marketCap: 78e9,    type: "crypto" as const, sparkline: generateSparkline(148,     1.91),  updatedAt: new Date().toISOString() },
    { symbol: "BNB",   name: "BNB",       price: 592,    change: -8,     changePercent: -1.33,  volume: 1.8e9, marketCap: 88e9,    type: "crypto" as const, sparkline: generateSparkline(592,    -1.33),  updatedAt: new Date().toISOString() },
    { symbol: "ADA",   name: "Cardano",   price: 0.72,   change: 0.015,  changePercent:  2.13,  volume: 0.4e9, marketCap: 26e9,    type: "crypto" as const, sparkline: generateSparkline(0.72,    2.13),  updatedAt: new Date().toISOString() },
    { symbol: "XRP",   name: "XRP",       price: 2.18,   change: -0.05,  changePercent: -2.24,  volume: 2.1e9, marketCap: 124e9,   type: "crypto" as const, sparkline: generateSparkline(2.18,   -2.24),  updatedAt: new Date().toISOString() },
    { symbol: "DOGE",  name: "Dogecoin",  price: 0.178,  change: 0.003,  changePercent:  1.71,  volume: 0.9e9, marketCap: 26e9,    type: "crypto" as const, sparkline: generateSparkline(0.178,   1.71),  updatedAt: new Date().toISOString() },
    { symbol: "AVAX",  name: "Avalanche", price: 19.5,   change: -0.45,  changePercent: -2.25,  volume: 0.5e9, marketCap: 8e9,     type: "crypto" as const, sparkline: generateSparkline(19.5,   -2.25),  updatedAt: new Date().toISOString() },
    { symbol: "DOT",   name: "Polkadot",  price: 3.9,    change: 0.08,   changePercent:  2.10,  volume: 0.3e9, marketCap: 6e9,     type: "crypto" as const, sparkline: generateSparkline(3.9,     2.10),  updatedAt: new Date().toISOString() },
    { symbol: "LINK",  name: "Chainlink", price: 12.4,   change: 0.30,   changePercent:  2.48,  volume: 0.4e9, marketCap: 8e9,     type: "crypto" as const, sparkline: generateSparkline(12.4,    2.48),  updatedAt: new Date().toISOString() },
    { symbol: "MATIC", name: "Polygon",   price: 0.098,  change: -0.002, changePercent: -1.79,  volume: 0.3e9, marketCap: 1e9,     type: "crypto" as const, sparkline: generateSparkline(0.098,  -1.79),  updatedAt: new Date().toISOString() },
    { symbol: "LTC",   name: "Litecoin",  price: 85,     change: 1.4,    changePercent:  1.68,  volume: 0.4e9, marketCap: 6e9,     type: "crypto" as const, sparkline: generateSparkline(85,      1.68),  updatedAt: new Date().toISOString() },
  ];
}

function generateFallbackHistory(symbol: string, days: number) {
  const prices: Record<string, number> = { NVDA: 875, TSLA: 175, BTC: 97500, ETH: 1870, SOL: 148 };
  const base = prices[symbol] ?? 100;
  const result = [];
  let price = base * 0.85;
  for (let i = days; i >= 0; i--) {
    price = price * (1 + (Math.random() - 0.48) * 0.025);
    const date = new Date();
    date.setDate(date.getDate() - i);
    result.push({
      timestamp: date.toISOString(),
      open: price * 0.995,
      high: price * 1.015,
      low: price * 0.985,
      close: price,
      volume: Math.floor(Math.random() * 30000000),
    });
  }
  return result;
}
