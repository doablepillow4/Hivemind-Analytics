import { Router, type IRouter } from "express";
import {
  GetMarketPricesResponseItem,
  GetMarketHistoryParams,
  GetMarketHistoryQueryParams,
  GetMarketHistoryResponse,
} from "@workspace/api-zod";
import {
  fetchStockPrice,
  fetchCryptoPrices,
  fetchStockHistory,
  fetchCryptoHistory,
  STOCK_SYMBOL_LIST,
  CRYPTO_ID_MAP,
} from "../lib/market-data";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/market/prices", async (req, res): Promise<void> => {
  const [cryptos, ...stocks] = await Promise.allSettled([
    fetchCryptoPrices(),
    ...STOCK_SYMBOL_LIST.map((s) => fetchStockPrice(s)),
  ]);

  const raw: unknown[] = [];

  if (cryptos.status === "fulfilled") raw.push(...cryptos.value);
  for (const stock of stocks) {
    if (stock.status === "fulfilled") raw.push(stock.value);
  }

  const prices = raw
    .map((item) => {
      const parsed = GetMarketPricesResponseItem.safeParse(item);
      if (!parsed.success) {
        logger.warn({ item, error: parsed.error.message }, "Skipping invalid market price entry");
        return null;
      }
      return parsed.data;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  res.json(prices);
});

router.get("/market/history/:symbol", async (req, res): Promise<void> => {
  const rawSymbol = Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol;
  const params = GetMarketHistoryParams.safeParse({ symbol: rawSymbol });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = GetMarketHistoryQueryParams.safeParse(req.query);
  const days = query.success ? query.data.days : 30;
  const symbol = params.data.symbol.toUpperCase();

  let data;
  if (symbol in CRYPTO_ID_MAP) {
    const coinId = CRYPTO_ID_MAP[symbol]?.id ?? symbol.toLowerCase();
    data = await fetchCryptoHistory(coinId, days);
  } else {
    data = await fetchStockHistory(symbol, days);
  }

  res.json(GetMarketHistoryResponse.parse({ symbol, data }));
});

export default router;
