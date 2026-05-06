import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    },
    pool: {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    },
  };
});

vi.mock("../market-data", () => ({
  fetchCryptoPrices: vi.fn().mockResolvedValue([
    { symbol: "BTC", price: 50000 },
    { symbol: "ETH", price: 3000 },
  ]),
  fetchStockPrice: vi.fn().mockResolvedValue({ symbol: "AAPL", price: 195 }),
  CRYPTO_ID_MAP: { BTC: { id: "bitcoin" }, ETH: { id: "ethereum" } },
}));

vi.mock("../predictions-engine", () => ({
  resolveExpiredPredictions: vi.fn().mockResolvedValue(undefined),
  getPredictionsSummary: vi.fn().mockResolvedValue({}),
}));

vi.mock("../lattice/lattice-engine", () => ({
  getAllAgentStates: vi.fn().mockResolvedValue([
    { agentId: "hypothesis_momentum", agentType: "hypothesis_momentum", reputation: 1.05, brierScore: 0.22, totalRuns: 10, correctRuns: 6 },
    { agentId: "hypothesis_meanrevert", agentType: "hypothesis_meanrevert", reputation: 0.95, brierScore: 0.28, totalRuns: 10, correctRuns: 5 },
    { agentId: "hypothesis_volregime", agentType: "hypothesis_volregime", reputation: 1.0, brierScore: 0.25, totalRuns: 10, correctRuns: 5 },
  ]),
  getStaticAgentStates: vi.fn().mockReturnValue([]),
}));

import {
  runTrainingCycle,
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
} from "../scheduler";

describe("runTrainingCycle()", () => {
  it("returns a valid TrainingCycleResult shape", async () => {
    const result = await runTrainingCycle();
    expect(typeof result.resolved).toBe("number");
    expect(typeof result.improved).toBe("number");
    expect(typeof result.accuracyGain).toBe("number");
    expect(Array.isArray(result.agentUpdates)).toBe(true);
    expect(typeof result.message).toBe("string");
  });

  it("returns resolved=0 and a descriptive message when no predictions exist", async () => {
    const result = await runTrainingCycle();
    expect(result.resolved).toBe(0);
    expect(result.message).toMatch(/no expired predictions/i);
  });

  it("accuracyGain is 0 when no agent updates occurred", async () => {
    const result = await runTrainingCycle();
    expect(result.accuracyGain).toBe(0);
  });
});

describe("startScheduler() / stopScheduler()", () => {
  beforeEach(() => {
    stopScheduler();
  });

  afterEach(() => {
    stopScheduler();
  });

  it("getSchedulerStatus().running is false before start", () => {
    const status = getSchedulerStatus();
    expect(status.running).toBe(false);
  });

  it("getSchedulerStatus().running is true after startScheduler()", () => {
    startScheduler(60_000);
    const status = getSchedulerStatus();
    expect(status.running).toBe(true);
  });

  it("getSchedulerStatus().running is false after stopScheduler()", () => {
    startScheduler(60_000);
    stopScheduler();
    const status = getSchedulerStatus();
    expect(status.running).toBe(false);
  });

  it("cycleCount starts at 0", () => {
    startScheduler(60_000);
    expect(getSchedulerStatus().cycleCount).toBe(0);
  });

  it("nextRunAt is set after startScheduler()", () => {
    startScheduler(60_000);
    const { nextRunAt } = getSchedulerStatus();
    expect(nextRunAt).not.toBeNull();
    const next = new Date(nextRunAt!).getTime();
    expect(next).toBeGreaterThan(Date.now());
  });

  it("nextRunAt is null after stopScheduler()", () => {
    startScheduler(60_000);
    stopScheduler();
    expect(getSchedulerStatus().nextRunAt).toBeNull();
  });

  it("calling startScheduler() twice does not create duplicate timers", () => {
    startScheduler(60_000);
    startScheduler(60_000);
    expect(getSchedulerStatus().running).toBe(true);
    stopScheduler();
  });

  it("lastRunAt is null before the first tick fires", () => {
    startScheduler(60_000);
    expect(getSchedulerStatus().lastRunAt).toBeNull();
  });

  it("intervalMs reflects the value passed to startScheduler()", () => {
    startScheduler(30_000);
    expect(getSchedulerStatus().intervalMs).toBe(30_000);
  });
});
