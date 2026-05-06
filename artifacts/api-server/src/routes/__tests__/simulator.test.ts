import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import app from "../../app";

vi.mock("../../routes/polymarket", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../routes/polymarket")>();
  return {
    ...actual,
    fetchPolymarketData: vi.fn().mockRejectedValue(new Error("mocked offline")),
    getFallbackMarkets: vi.fn().mockReturnValue([]),
  };
});

describe("POST /api/simulator/monte-carlo", () => {
  it("returns 200 with required result fields for a valid request", async () => {
    const res = await request(app)
      .post("/api/simulator/monte-carlo")
      .send({
        symbol: "BTC",
        currentPrice: 50000,
        volatility: 30,
        eventImpact: 5,
        timeHorizon: 10,
        simulations: 200,
      });

    expect(res.status).toBe(200);

    const body = res.body as Record<string, unknown>;
    expect(body.symbol).toBe("BTC");
    expect(typeof body.median).toBe("number");
    expect(typeof body.mean).toBe("number");
    expect(typeof body.p10).toBe("number");
    expect(typeof body.p90).toBe("number");
    expect(typeof body.bullishProbability).toBe("number");
    expect(typeof body.bearishProbability).toBe("number");
    expect(typeof body.var95).toBe("number");
    expect(typeof body.maxDrawdown).toBe("number");
    expect(typeof body.expectedReturn).toBe("number");
    expect(Array.isArray(body.paths)).toBe(true);
  });

  it("bullishProbability + bearishProbability ≈ 1", async () => {
    const res = await request(app)
      .post("/api/simulator/monte-carlo")
      .send({
        symbol: "AAPL",
        currentPrice: 200,
        volatility: 25,
        eventImpact: 0,
        timeHorizon: 5,
        simulations: 300,
      });

    expect(res.status).toBe(200);
    const body = res.body as { bullishProbability: number; bearishProbability: number };
    expect(body.bullishProbability + body.bearishProbability).toBeCloseTo(1, 1);
  });

  it("number of paths is capped at 50", async () => {
    const res = await request(app)
      .post("/api/simulator/monte-carlo")
      .send({
        symbol: "ETH",
        currentPrice: 3000,
        volatility: 40,
        eventImpact: -10,
        timeHorizon: 20,
        simulations: 500,
      });

    expect(res.status).toBe(200);
    expect((res.body as { paths: number[][] }).paths.length).toBeLessThanOrEqual(50);
  });

  it("simulations is clamped to [100, 2000]", async () => {
    const res = await request(app)
      .post("/api/simulator/monte-carlo")
      .send({
        symbol: "SPY",
        currentPrice: 500,
        volatility: 15,
        eventImpact: 0,
        timeHorizon: 10,
        simulations: 9999,
      });

    expect(res.status).toBe(200);
    expect((res.body as { simulations: number }).simulations).toBeLessThanOrEqual(2000);
  });

  it("returns 400 for missing required fields", async () => {
    const res = await request(app).post("/api/simulator/monte-carlo").send({ symbol: "BTC" });
    expect(res.status).toBe(400);
  });

  it("negative eventImpact shifts distribution downward", async () => {
    const baseRes = await request(app)
      .post("/api/simulator/monte-carlo")
      .send({
        symbol: "BTC",
        currentPrice: 50000,
        volatility: 20,
        eventImpact: 0,
        timeHorizon: 5,
        simulations: 500,
      });

    const shockedRes = await request(app)
      .post("/api/simulator/monte-carlo")
      .send({
        symbol: "BTC",
        currentPrice: 50000,
        volatility: 20,
        eventImpact: -50,
        timeHorizon: 5,
        simulations: 500,
      });

    expect(baseRes.status).toBe(200);
    expect(shockedRes.status).toBe(200);
    expect((shockedRes.body as { mean: number }).mean).toBeLessThan(
      (baseRes.body as { mean: number }).mean,
    );
  });

  it("median, p10, p25, p75, p90 are ordered correctly", async () => {
    const res = await request(app)
      .post("/api/simulator/monte-carlo")
      .send({
        symbol: "BTC",
        currentPrice: 50000,
        volatility: 30,
        eventImpact: 0,
        timeHorizon: 10,
        simulations: 1000,
      });

    expect(res.status).toBe(200);
    const body = res.body as {
      p10: number;
      p25: number;
      median: number;
      p75: number;
      p90: number;
    };
    expect(body.p10).toBeLessThanOrEqual(body.p25);
    expect(body.p25).toBeLessThanOrEqual(body.median);
    expect(body.median).toBeLessThanOrEqual(body.p75);
    expect(body.p75).toBeLessThanOrEqual(body.p90);
  });
});
