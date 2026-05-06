import { describe, it, expect } from "vitest";
import {
  momentumAgent,
  meanReversionAgent,
  volRegimeAgent,
  hiveWisdomAgent,
} from "../hypothesis-agents";
import type { TechnicalFeatures, RegimeContext, HiveSignal } from "../types";

function makeFeatures(overrides: Partial<TechnicalFeatures> = {}): TechnicalFeatures {
  return {
    rsi: 50,
    macdHistogram: 0.001,
    bollingerPercentB: 0.5,
    maCross: 0,
    momentum5d: 0,
    volatility: 0.2,
    ...overrides,
  };
}

function makeRegime(regime: "calm" | "volatile" | "crisis" = "calm"): RegimeContext {
  return {
    regime,
    regimeScore: 0.5,
    volatility: 0.2,
    closes: Array.from({ length: 30 }, (_, i) => 100 + i * 0.5),
  };
}

function makeHive(overrides: Partial<HiveSignal> = {}): HiveSignal {
  return {
    probability: 0.6,
    confidence: 0.7,
    liquidityScore: 0.5,
    relevantMarkets: ["BTC price above $100k by end of year"],
    geoPressure: 0.1,
    ...overrides,
  };
}

// ─── momentumAgent ────────────────────────────────────────────────────────────

describe("momentumAgent()", () => {
  it("returns a BeliefToken with correct agentType and round", () => {
    const token = momentumAgent(makeFeatures(), makeRegime(), [], "AAPL", "1d");
    expect(token.agentType).toBe("hypothesis_momentum");
    expect(token.round).toBe(1);
  });

  it("probability is clamped to [0, 1]", () => {
    const bullish = momentumAgent(
      makeFeatures({ rsi: 80, macdHistogram: 0.01, momentum5d: 10, maCross: 5 }),
      makeRegime("calm"),
      [],
      "BTC",
      "1d",
    );
    expect(bullish.probability).toBeGreaterThanOrEqual(0);
    expect(bullish.probability).toBeLessThanOrEqual(1);
  });

  it("bullish signals produce a bullish direction", () => {
    const token = momentumAgent(
      makeFeatures({ rsi: 70, macdHistogram: 0.005, momentum5d: 5, maCross: 2 }),
      makeRegime("calm"),
      [],
      "TSLA",
      "1d",
    );
    expect(token.hypothesis).toBe("bullish");
    expect(token.probability).toBeGreaterThan(0.54);
  });

  it("bearish signals produce a bearish direction", () => {
    const token = momentumAgent(
      makeFeatures({ rsi: 25, macdHistogram: -0.005, momentum5d: -8, maCross: -3 }),
      makeRegime("calm"),
      [],
      "TSLA",
      "1d",
    );
    expect(token.hypothesis).toBe("bearish");
    expect(token.probability).toBeLessThan(0.46);
  });

  it("crisis regime reduces probability conviction toward 0.5", () => {
    const calm = momentumAgent(
      makeFeatures({ macdHistogram: 0.005, momentum5d: 4 }),
      makeRegime("calm"),
      [],
    );
    const crisis = momentumAgent(
      makeFeatures({ macdHistogram: 0.005, momentum5d: 4 }),
      makeRegime("crisis"),
      [],
    );
    expect(Math.abs(crisis.probability - 0.5)).toBeLessThan(Math.abs(calm.probability - 0.5));
  });

  it("includes rationale array with at least 3 entries", () => {
    const token = momentumAgent(makeFeatures(), makeRegime(), [], "ETH", "6h");
    expect(token.rationale.length).toBeGreaterThanOrEqual(3);
  });

  it("shapAi is 1 (momentum is a pure AI signal)", () => {
    const token = momentumAgent(makeFeatures(), makeRegime(), ["parent-1"], "BTC", "1d");
    expect(token.shapAi).toBe(1);
    expect(token.shapHive).toBe(0);
    expect(token.shapGeo).toBe(0);
  });
});

// ─── meanReversionAgent ───────────────────────────────────────────────────────

describe("meanReversionAgent()", () => {
  it("returns agentType=hypothesis_meanrevert and round=1", () => {
    const token = meanReversionAgent(makeFeatures(), makeRegime(), [], "AAPL", "1d");
    expect(token.agentType).toBe("hypothesis_meanrevert");
    expect(token.round).toBe(1);
  });

  it("extreme oversold RSI produces bullish outlook", () => {
    const token = meanReversionAgent(
      makeFeatures({ rsi: 28, bollingerPercentB: 0.05, momentum5d: -6 }),
      makeRegime("volatile"),
      [],
    );
    expect(token.hypothesis).toBe("bullish");
    expect(token.probability).toBeGreaterThan(0.54);
  });

  it("extreme overbought RSI produces bearish outlook", () => {
    const token = meanReversionAgent(
      makeFeatures({ rsi: 76, bollingerPercentB: 0.93, momentum5d: 6 }),
      makeRegime("volatile"),
      [],
    );
    expect(token.hypothesis).toBe("bearish");
    expect(token.probability).toBeLessThan(0.46);
  });

  it("probability is always in [0, 1]", () => {
    for (const rsi of [10, 30, 50, 70, 90]) {
      const token = meanReversionAgent(
        makeFeatures({ rsi, bollingerPercentB: rsi > 50 ? 0.9 : 0.1 }),
        makeRegime("crisis"),
        [],
      );
      expect(token.probability).toBeGreaterThanOrEqual(0);
      expect(token.probability).toBeLessThanOrEqual(1);
    }
  });
});

// ─── volRegimeAgent ───────────────────────────────────────────────────────────

describe("volRegimeAgent()", () => {
  it("returns agentType=hypothesis_volregime and round=1", () => {
    const token = volRegimeAgent(makeFeatures(), makeRegime(), [], "SPY", "1d");
    expect(token.agentType).toBe("hypothesis_volregime");
    expect(token.round).toBe(1);
  });

  it("probability is always in [0, 1]", () => {
    for (const regime of ["calm", "volatile", "crisis"] as const) {
      const token = volRegimeAgent(
        makeFeatures({ rsi: 35, bollingerPercentB: 0.15 }),
        makeRegime(regime),
        [],
      );
      expect(token.probability).toBeGreaterThanOrEqual(0);
      expect(token.probability).toBeLessThanOrEqual(1);
    }
  });

  it("confidence is inversely related to volatility", () => {
    const lowVol = volRegimeAgent(
      makeFeatures({ volatility: 0.05 }),
      { ...makeRegime("calm"), volatility: 0.05 },
      [],
    );
    const highVol = volRegimeAgent(
      makeFeatures({ volatility: 0.8 }),
      { ...makeRegime("volatile"), volatility: 0.8 },
      [],
    );
    expect(lowVol.confidence).toBeGreaterThan(highVol.confidence);
  });
});

// ─── hiveWisdomAgent ──────────────────────────────────────────────────────────

describe("hiveWisdomAgent()", () => {
  it("returns agentType=hypothesis_hive and round=1", () => {
    const token = hiveWisdomAgent(makeHive(), [], "BTC", "1d");
    expect(token.agentType).toBe("hypothesis_hive");
    expect(token.round).toBe(1);
  });

  it("high hive probability produces bullish direction", () => {
    const token = hiveWisdomAgent(makeHive({ probability: 0.78 }), [], "ETH", "1d");
    expect(token.hypothesis).toBe("bullish");
  });

  it("low hive probability produces bearish direction", () => {
    const token = hiveWisdomAgent(makeHive({ probability: 0.22 }), [], "ETH", "1d");
    expect(token.hypothesis).toBe("bearish");
  });

  it("shapHive is 1 and shapAi is 0 (crowd signal)", () => {
    const token = hiveWisdomAgent(makeHive(), [], "BTC", "1d");
    expect(token.shapHive).toBe(1);
    expect(token.shapAi).toBe(0);
  });

  it("high liquidity score boosts confidence", () => {
    const lowLiq = hiveWisdomAgent(makeHive({ liquidityScore: 0.1 }), []);
    const highLiq = hiveWisdomAgent(makeHive({ liquidityScore: 0.9 }), []);
    expect(highLiq.confidence).toBeGreaterThan(lowLiq.confidence);
  });

  it("probability is clamped to [0, 1]", () => {
    const token = hiveWisdomAgent(makeHive({ probability: 0.99 }), [], "AAPL");
    expect(token.probability).toBeLessThanOrEqual(1);
    expect(token.probability).toBeGreaterThanOrEqual(0);
  });
});
