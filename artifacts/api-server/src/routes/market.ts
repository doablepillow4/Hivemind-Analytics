import { Router, type IRouter } from "express";

import {
  GetMarketPricesResponseItem,
  GetMarketHistoryParams,
  GetMarketHistoryQueryParams,
  GetMarketHistoryResponse,
  GetMarketQuoteParams,
  GetMarketQuoteResponse,
} from "@workspace/api-zod";

import {
  fetchStockPrice,
  fetchCryptoPrices,
  fetchStockHistory,
  fetchCryptoHistory,
  fetchAnyTicker,
  STOCK_SYMBOL_LIST,
  CRYPTO_ID_MAP,
} from "../lib/market-data";

import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/market/prices", async (req, res): Promise<void> => {
  const live =
    typeof req.query["live"] === "string" ? req.query["live"] === "true" : false;

  const [cryptosResult, ...stockResults] = await Promise.allSettled([
    fetchCryptoPrices(live),
    ...STOCK_SYMBOL_LIST.map(async (symbol) => ({
      symbol,
      result: await fetchStockPrice(symbol, live),
    })),
  ]);

  const raw: unknown[] = [];

  if (cryptosResult.status === "fulfilled") {
    raw.push(...cryptosResult.value);
  } else {
    logger.warn({ err: cryptosResult.reason }, "Crypto prices fetch failed");
  }

  for (const stock of stockResults) {
    if (stock.status === "fulfilled") {
      raw.push(stock.value.result);
    } else {
      logger.warn({ err: stock.reason }, "Stock price fetch failed");
    }
  }

  const prices = raw
    .map((item) => {
      // FIX: Use safeParse in strip mode — isLive is not in the Zod schema but
      // that's fine, we just don't want it causing parse failures on the whole item.
      // Zod strips unknown keys by default (not in strict mode), so this is safe.
      const parsed = GetMarketPricesResponseItem.safeParse(item);
      if (!parsed.success) {
        logger.warn({ item, error: parsed.error.message }, "Skipping invalid market price entry");
        return null;
      }
      return parsed.data;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (live && prices.length === 0) {
    logger.error({ live, rawCount: raw.length }, "Live market fetch failed with no valid results");
    res.status(503).json({
      error: "Live market data unavailable",
      message: "Could not fetch live market prices at this time.",
    });
    return;
  }

  if (prices.length > 0 && prices.length < STOCK_SYMBOL_LIST.length + 1) {
    logger.warn({ live, returned: prices.length }, "Partial market prices returned");
  } else {
    logger.info({ live, returned: prices.length }, "Market prices returned");
  }

  res.json(prices);
});

router.get("/market/quote/:symbol", async (req, res): Promise<void> => {
  const params = GetMarketQuoteParams.safeParse({ symbol: req.params.symbol });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const symbol = params.data.symbol.toUpperCase();

  try {
    const quote = await fetchAnyTicker(symbol);
    if (!quote) {
      res.status(404).json({ error: `No data found for symbol: ${symbol}` });
      return;
    }
    res.json(GetMarketQuoteResponse.parse(quote));
  } catch (err) {
    logger.warn({ err, symbol }, "Quote fetch failed");
    res.status(404).json({ error: `Could not fetch quote for ${symbol}` });
  }
});

router.get("/market/history/:symbol", async (req, res): Promise<void> => {
  const rawSymbol = Array.isArray(req.params.symbol)
    ? req.params.symbol[0]
    : req.params.symbol;

  const params = GetMarketHistoryParams.safeParse({ symbol: rawSymbol });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = GetMarketHistoryQueryParams.safeParse(req.query);
  const days = query.success ? query.data.days : 30;

  // FIX: This line was truncated in the repo ("params.data.sy" cut off mid-word),
  // causing a syntax error that broke the entire market router on startup.
  const symbol = params.data.symbol.toUpperCase();

  let data;
  try {
    if (symbol in CRYPTO_ID_MAP) {
      const coinId = CRYPTO_ID_MAP[symbol]?.id ?? symbol.toLowerCase();
      data = await fetchCryptoHistory(coinId, days);
    } else {
      data = await fetchStockHistory(symbol, days);
    }
    res.json(GetMarketHistoryResponse.parse({ symbol, data }));
  } catch (err) {
    logger.warn({ err, symbol, days }, "History fetch failed");
    res.status(503).json({ error: `Could not fetch history for ${symbol}` });
  }
});

export default router;
