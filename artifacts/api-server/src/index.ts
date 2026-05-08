import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler, stopScheduler } from "./lib/scheduler";
import { fetchCryptoPrices, fetchStockPrice, STOCK_SYMBOL_LIST } from "./lib/market-data";
import { fetchGeopoliticsNews } from "./lib/news";

let rawPort = process.env["PORT"];

if (!rawPort) {
  logger.warn("PORT environment variable is missing, defaulting to 8080");
  rawPort = "8080";
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, '0.0.0.0', (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startScheduler();

  // Pre-warm caches in background so first page loads are fast
  Promise.allSettled([
    fetchCryptoPrices().catch((e) => logger.warn({ err: e }, "Warmup: crypto prices failed")),
    ...STOCK_SYMBOL_LIST.map((s) =>
      fetchStockPrice(s).catch((e) => logger.warn({ err: e, symbol: s }, "Warmup: stock price failed")),
    ),
    fetchGeopoliticsNews().catch((e) => logger.warn({ err: e }, "Warmup: news failed")),
  ]).then(() => {
    logger.info("Cache warmup complete");
  });
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Received shutdown signal — stopping scheduler and closing server");
  stopScheduler();
  server.close(() => {
    logger.info("Server closed cleanly");
    process.exit(0);
  });
  // Force-exit after 10 s if connections are still draining
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
