import { describe, it, expect } from "vitest";
import { synthesize } from "../synthesis-agent";
import type { BeliefToken } from "../types";

function makeToken(
  overrides: Partial<BeliefToken> & { hypothesis: "bullish" | "bearish" | "neutral" },
): BeliefToken {
  return {
    id: "test-id",
    agentType: "hypothesis_momentum",
    round: 1,
    probability: 0.6,
    confidence: 0.8,
    rationale: ["test rationale"],
    shapHive: 0.2,
    shapAi: 0.7,
    shapGeo: 0.1,
    liquidityScore: 0.5,
    parentIds: [],
    ...overrides,
  };
}

const neutralReputations = new Map<string, number>();

describe("synthesize()", () => {
  it("returns bullish direction when all hypothesis tokens are bullish", () => {
    const hyps = [
      makeToken({ hypothesis: "bullish", probability: 0.7, agentType: "hypothesis_momentum" }),
      makeToken({ hypothesis: "bullish", probability: 0.65, agentType: "hypothesis_meanrevert" }),
    ];
    const result = synthesize(hyps, [], neutralReputations);
    expect(result.token.hypothesis).toBe("bullish");
    expect(result.token.probability).toBeGreaterThan(0.54);
  });

  it("returns bearish direction when all hypothesis tokens are bearish", () => {
    const hyps = [
      makeToken({ hypothesis: "bearish", probability: 0.3, agentType: "hypothesis_momentum" }),
      makeToken({ hypothesis: "bearish", probability: 0.35, agentType: "hypothesis_meanrevert" }),
    ];
    const result = synthesize(hyps, [], neutralReputations);
    expect(result.token.hypothesis).toBe("bearish");
    expect(result.token.probability).toBeLessThan(0.46);
  });

  it("SHAP attribution always sums to ~1", () => {
    const tokens = [
      makeToken({ hypothesis: "bullish", probability: 0.65, shapHive: 0.3, shapAi: 0.5, shapGeo: 0.2 }),
      makeToken({ hypothesis: "bearish", probability: 0.4, shapHive: 0.1, shapAi: 0.8, shapGeo: 0.1 }),
    ];
    const result = synthesize(tokens, [], neutralReputations);
    const total = result.shap.hive + result.shap.ai + result.shap.geo;
    expect(total).toBeCloseTo(1.0, 5);
  });

  it("agentConsensus is 1.0 when all tokens agree", () => {
    const tokens = [
      makeToken({ hypothesis: "bullish", probability: 0.7, agentType: "hypothesis_momentum" }),
      makeToken({ hypothesis: "bullish", probability: 0.65, agentType: "hypothesis_hive" }),
    ];
    const result = synthesize(tokens, [], neutralReputations);
    expect(result.agentConsensus).toBe(1.0);
  });

  it("generates a minority report when consensus is below 75%", () => {
    // 1 bullish vs 2 bearish → 33% consensus on bullish
    const tokens = [
      makeToken({ id: "t1", hypothesis: "bullish", probability: 0.65, agentType: "hypothesis_momentum" }),
      makeToken({ id: "t2", hypothesis: "bearish", probability: 0.35, agentType: "hypothesis_meanrevert" }),
      makeToken({ id: "t3", hypothesis: "bearish", probability: 0.32, agentType: "hypothesis_volregime" }),
    ];
    const result = synthesize(tokens, [], neutralReputations);
    expect(result.minorityReport).not.toBeNull();
    expect(result.minorityReport).toContain("dissent");
  });

  it("does not generate a minority report when consensus is ≥75%", () => {
    const tokens = [
      makeToken({ id: "t1", hypothesis: "bullish", probability: 0.7 }),
      makeToken({ id: "t2", hypothesis: "bullish", probability: 0.68 }),
      makeToken({ id: "t3", hypothesis: "bullish", probability: 0.65 }),
      makeToken({ id: "t4", hypothesis: "bearish", probability: 0.38 }),
    ];
    const result = synthesize(tokens, [], neutralReputations);
    // 3 bullish, 1 bearish = 75% consensus → no minority report
    expect(result.minorityReport).toBeNull();
  });

  it("higher reputation agents have more weight in the final probability", () => {
    const tokens = [
      makeToken({ hypothesis: "bullish", probability: 0.8, confidence: 1.0, agentType: "hypothesis_momentum" }),
      makeToken({ hypothesis: "bearish", probability: 0.2, confidence: 1.0, agentType: "hypothesis_meanrevert" }),
    ];
    const highBullRep = new Map([["hypothesis_momentum", 10.0], ["hypothesis_meanrevert", 1.0]]);
    const highBearRep = new Map([["hypothesis_momentum", 1.0], ["hypothesis_meanrevert", 10.0]]);

    const bullResult = synthesize(tokens, [], highBullRep);
    const bearResult = synthesize(tokens, [], highBearRep);

    expect(bullResult.token.probability).toBeGreaterThan(bearResult.token.probability);
  });

  it("synthesis token is tagged with agentType=synthesis and round=3", () => {
    const tokens = [makeToken({ hypothesis: "bullish" })];
    const result = synthesize(tokens, [], neutralReputations);
    expect(result.token.agentType).toBe("synthesis");
    expect(result.token.round).toBe(3);
  });

  it("handles empty token arrays by returning neutral with 0.5 probability", () => {
    const result = synthesize([], [], neutralReputations);
    // rawProb = 0.5 → plattScale(0.5) = 0.5 → neutral
    expect(result.token.probability).toBeCloseTo(0.5, 2);
  });

  it("final probability is always clamped to [0, 1]", () => {
    const tokens = Array.from({ length: 10 }, (_, i) =>
      makeToken({ hypothesis: "bullish", probability: 0.999, confidence: 1.0, agentType: `hypothesis_momentum` as const }),
    );
    const result = synthesize(tokens, [], neutralReputations);
    expect(result.token.probability).toBeLessThanOrEqual(1);
    expect(result.token.probability).toBeGreaterThanOrEqual(0);
  });
});
