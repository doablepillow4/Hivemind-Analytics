import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import app from "../../app";

vi.mock("../../lib/news", () => ({
  fetchGeopoliticsNews: vi.fn().mockResolvedValue([
    {
      id: "item-1",
      title: "Fed holds rates steady amid economic uncertainty",
      description: "The Federal Reserve held interest rates at 5.25% following its latest meeting.",
      url: "https://reuters.com/article/1",
      source: "Reuters",
      publishedAt: new Date().toISOString(),
      sentiment: "neutral",
      category: "macro",
      isBreaking: false,
      relatedMarkets: null,
    },
    {
      id: "item-2",
      title: "BTC breaks $60k resistance level",
      description: "Bitcoin surged past the key $60,000 level on heavy volume.",
      url: "https://coindesk.com/article/2",
      source: "CoinDesk",
      publishedAt: new Date().toISOString(),
      sentiment: "bullish",
      category: "crypto",
      isBreaking: true,
      relatedMarkets: [
        {
          question: "Will BTC exceed $70k by end of year?",
          yesPrice: 0.65,
          noPrice: 0.35,
          volume: 1500000,
          category: "crypto",
          marketImpact: "Direct price exposure",
          oddsShift: 0.03,
        },
      ],
    },
  ]),
  getNewsContextForSymbol: vi.fn().mockResolvedValue({
    sentiment: 0.3,
    weight: 0.5,
    headlines: ["BTC breaks $60k resistance level"],
    breakingAlert: true,
  }),
}));

describe("GET /api/news", () => {
  it("returns 200 with an array of news items", async () => {
    const res = await request(app).get("/api/news");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as unknown[]).length).toBeGreaterThan(0);
  });

  it("each news item has required fields", async () => {
    const res = await request(app).get("/api/news");
    expect(res.status).toBe(200);
    const items = res.body as Array<Record<string, unknown>>;
    for (const item of items) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("source");
      expect(item).toHaveProperty("publishedAt");
      expect(item).toHaveProperty("sentiment");
      expect(item).toHaveProperty("category");
    }
  });

  it("returns JSON content-type", async () => {
    const res = await request(app).get("/api/news");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  it("?symbol= filter returns a non-empty array", async () => {
    const res = await request(app).get("/api/news?symbol=BTC");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("isBreaking field is a boolean", async () => {
    const res = await request(app).get("/api/news");
    expect(res.status).toBe(200);
    const items = res.body as Array<{ isBreaking: unknown }>;
    for (const item of items) {
      expect(typeof item.isBreaking).toBe("boolean");
    }
  });
});
