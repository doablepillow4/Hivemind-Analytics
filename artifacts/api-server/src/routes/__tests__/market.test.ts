import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import app from "../../app";

vi.mock("../../lib/market-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/market-data")>();
  return {
    ...actual,
    fetchStockPrice: vi.fn().mockImplementation((symbol: string) =>
      Promise.resolve({
        symbol,
        name: `${symbol} Inc.`,
        price: 195.5,
        change: 1.2,
        changePercent: 0.62,
        volume: 50000000,
        marketCap: 3000000000000,
        type: "stock",
        sparkline: [190, 191, 192, 193, 194, 195],
        updatedAt: new Date().toISOString(),
      }),
    ),
    fetchCryptoPrices: vi.fn().mockResolvedValue([
      {
        symbol: "BTC",
        name: "Bitcoin",
        price: 50000,
        change: 200,
        changePercent: 0.4,
        volume: 25000000000,
        marketCap: 900000000000,
        type: "crypto",
        sparkline: [49000, 49500, 50000],
        updatedAt: new Date().toISOString(),
      },
    ]),
    fetchStockHistory: vi.fn().mockResolvedValue([
      { timestamp: "2024-01-01", open: 190, high: 196, low: 189, close: 195, volume: 50000000 },
      { timestamp: "2024-01-02", open: 195, high: 198, low: 194, close: 197, volume: 48000000 },
    ]),
    fetchCryptoHistory: vi.fn().mockResolvedValue([
      { timestamp: "2024-01-01", open: 48000, high: 51000, low: 47500, close: 50000, volume: 1e10 },
    ]),
    fetchAnyTicker: vi.fn().mockImplementation((symbol: string) =>
      Promise.resolve({
        symbol,
        name: `${symbol} ETF`,
        price: 500,
        change: 2,
        changePercent: 0.4,
        volume: 80000000,
        marketCap: 0,
        type: "stock",
        sparkline: [498, 499, 500],
        updatedAt: new Date().toISOString(),
      }),
    ),
  };
});

describe("GET /api/market/prices", () => {
  it("returns 200 with an array of price items", async () => {
    const res = await request(app).get("/api/market/prices");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as unknown[]).length).toBeGreaterThan(0);
  });

  it("each item has symbol, price, and type fields", async () => {
    const res = await request(app).get("/api/market/prices");
    expect(res.status).toBe(200);
    const items = res.body as Array<{ symbol: string; price: number; type: string }>;
    for (const item of items) {
      expect(item).toHaveProperty("symbol");
      expect(typeof item.price).toBe("number");
      expect(["stock", "crypto"]).toContain(item.type);
    }
  });

  it("returns JSON content-type", async () => {
    const res = await request(app).get("/api/market/prices");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});

describe("GET /api/market/quote/:symbol", () => {
  it("returns 200 with price data for a valid symbol", async () => {
    const res = await request(app).get("/api/market/quote/AAPL");
    expect(res.status).toBe(200);
    const body = res.body as { symbol: string; price: number };
    expect(body.symbol).toBe("AAPL");
    expect(typeof body.price).toBe("number");
  });

  it("returns a different symbol for a different ticker", async () => {
    const res = await request(app).get("/api/market/quote/TSLA");
    expect(res.status).toBe(200);
    expect((res.body as { symbol: string }).symbol).toBe("TSLA");
  });
});

describe("GET /api/market/history/:symbol", () => {
  it("returns 200 for a known crypto symbol", async () => {
    const res = await request(app).get("/api/market/history/BTC");
    expect(res.status).toBe(200);
    const body = res.body as { symbol: string; data: unknown[] };
    expect(body.symbol).toBe("BTC");
    expect(Array.isArray(body.data)).toBe(true);
  });
});
