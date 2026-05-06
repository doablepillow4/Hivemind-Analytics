import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import app from "../../app";

vi.mock("../../lib/predictions-engine", () => ({
  generatePrediction: vi.fn().mockResolvedValue({
    symbol: "AAPL",
    direction: "bullish" as const,
    probability: 0.65,
    targetPrice: 205,
    currentPrice: 195,
    confidence: 0.72,
    signals: [
      { name: "RSI", value: 55, weight: 0.3, bullish: true },
      { name: "MACD", value: 0.02, weight: 0.25, bullish: true },
    ],
    timeframe: "7d",
  }),
  resolveExpiredPredictions: vi.fn().mockResolvedValue([]),
  getPredictionsSummary: vi.fn().mockResolvedValue({
    totalPredictions: 10,
    correctPredictions: 6,
    accuracy: 0.6,
    averageConfidence: 0.72,
    recentAccuracy: 0.65,
    improvementTrend: 0.05,
    bySymbol: [
      { symbol: "AAPL", total: 5, correct: 3, accuracy: 0.6 },
      { symbol: "BTC", total: 5, correct: 3, accuracy: 0.6 },
    ],
  }),
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "pred-1",
              symbol: "AAPL",
              timeframe: "7d",
              direction: "bullish",
              targetPrice: 205,
              currentPrice: 195,
              confidence: 0.72,
              signals: JSON.stringify([]),
              outcome: null,
              createdAt: new Date(),
              resolvedAt: null,
            },
          ]),
        }),
      }),
    },
    pool: {
      query: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }),
    },
  };
});

vi.mock("../../lib/market-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/market-data")>();
  return {
    ...actual,
    fetchStockPrice: vi.fn().mockResolvedValue({ symbol: "AAPL", price: 195 }),
    fetchCryptoPrices: vi.fn().mockResolvedValue([{ symbol: "BTC", price: 50000 }]),
  };
});

describe("GET /api/predictions", () => {
  it("returns 200 with an array", async () => {
    const res = await request(app).get("/api/predictions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("GET /api/predictions/summary", () => {
  it("returns 200 with summary statistics fields", async () => {
    const res = await request(app).get("/api/predictions/summary");
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body).toHaveProperty("totalPredictions");
    expect(body).toHaveProperty("accuracy");
    expect(body).toHaveProperty("averageConfidence");
  });
});

describe("POST /api/predictions", () => {
  it("returns 400 for a completely empty body", async () => {
    const res = await request(app).post("/api/predictions").send({});
    expect(res.status).toBe(400);
  });

  it("returns 201 for a valid symbol + timeframe", async () => {
    const res = await request(app)
      .post("/api/predictions")
      .send({ symbol: "AAPL", timeframe: "7d" });
    expect(res.status).toBe(201);
    const body = res.body as Record<string, unknown>;
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("direction");
  });
});
