import type { BeliefToken, Direction, ShapBreakdown } from "./types";
import { nanoid } from "nanoid";

function clamp(v: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

function plattScale(rawScore: number): number {
  return 1 / (1 + Math.exp(-(rawScore - 0.5) * 10));
}

function directionFromProb(p: number): Direction {
  if (p > 0.54) return "bullish";
  if (p < 0.46) return "bearish";
  return "neutral";
}

export interface SynthesisOutput {
  token: BeliefToken;
  shap: ShapBreakdown;
  agentConsensus: number;
  minorityReport: string | null;
}

export function synthesize(
  hypothesisTokens: BeliefToken[],
  critiqueTokens: BeliefToken[],
  agentReputations: Map<string, number>
): SynthesisOutput {
  const allInputTokens = [...hypothesisTokens, ...critiqueTokens];
  const parentIds = allInputTokens.map((t) => t.id);

  const getReputation = (agentType: string) =>
    agentReputations.get(agentType) ?? 1.0;

  let weightedProbSum = 0;
  let weightSum = 0;
  let shapHiveSum = 0;
  let shapAiSum = 0;
  let shapGeoSum = 0;
  let weightedShapTotal = 0;

  for (const token of allInputTokens) {
    const reputation = getReputation(token.agentType);
    const confidenceWeight = token.confidence;
    const w = reputation * confidenceWeight;
    weightedProbSum += token.probability * w;
    weightSum += w;
    shapHiveSum += token.shapHive * w;
    shapAiSum += token.shapAi * w;
    shapGeoSum += token.shapGeo * w;
    weightedShapTotal += w;
  }

  const rawProb = weightSum > 0 ? weightedProbSum / weightSum : 0.5;
  const calibratedProb = plattScale(rawProb);
  const finalProb = clamp(calibratedProb);
  const direction = directionFromProb(finalProb);

  const shapTotal = shapHiveSum + shapAiSum + shapGeoSum;
  let shapHive = shapTotal > 0 ? shapHiveSum / shapTotal : 0.2;
  let shapAi = shapTotal > 0 ? shapAiSum / shapTotal : 0.7;
  let shapGeo = shapTotal > 0 ? shapGeoSum / shapTotal : 0.1;

  const shapNorm = shapHive + shapAi + shapGeo;
  if (shapNorm > 0) {
    shapHive /= shapNorm;
    shapAi /= shapNorm;
    shapGeo /= shapNorm;
  }

  const bullishCount = allInputTokens.filter((t) => t.hypothesis === "bullish").length;
  const bearishCount = allInputTokens.filter((t) => t.hypothesis === "bearish").length;
  const consensusCount = Math.max(bullishCount, bearishCount);
  const agentConsensus = allInputTokens.length > 0 ? consensusCount / allInputTokens.length : 1;

  const dominantDir = bullishCount >= bearishCount ? "bullish" : "bearish";
  let minorityReport: string | null = null;
  if (agentConsensus < 0.75) {
    const minorityCount = allInputTokens.length - consensusCount;
    const minorityDir = dominantDir === "bullish" ? "bearish" : "bullish";
    minorityReport = `${minorityCount} of ${allInputTokens.length} agents dissent with ${minorityDir.toUpperCase()} thesis — minority report: probability gap is narrow (${(Math.abs(finalProb - 0.5) * 200).toFixed(0)}/100). Consider straddling or reduced position size.`;
  }

  const confidence = clamp(0.5 + Math.abs(finalProb - 0.5) * 1.2);

  const token: BeliefToken = {
    id: nanoid(8),
    agentType: "synthesis",
    round: 3,
    hypothesis: direction,
    probability: parseFloat(finalProb.toFixed(4)),
    confidence: parseFloat(confidence.toFixed(4)),
    rationale: [
      `Reputation-weighted Bayesian fusion of ${allInputTokens.length} belief tokens`,
      `Platt-scaled probability: ${(finalProb * 100).toFixed(1)}% ${direction}`,
      `Agent consensus: ${(agentConsensus * 100).toFixed(0)}% aligned on ${dominantDir}`,
      `SHAP attribution — Hive: ${(shapHive * 100).toFixed(0)}%, AI: ${(shapAi * 100).toFixed(0)}%, Geo: ${(shapGeo * 100).toFixed(0)}%`,
    ],
    shapHive: parseFloat(shapHive.toFixed(4)),
    shapAi: parseFloat(shapAi.toFixed(4)),
    shapGeo: parseFloat(shapGeo.toFixed(4)),
    liquidityScore: hypothesisTokens.find((t) => t.agentType === "hypothesis_hive")?.liquidityScore ?? 0,
    parentIds,
  };

  return {
    token,
    shap: {
      hive: parseFloat(shapHive.toFixed(4)),
      ai: parseFloat(shapAi.toFixed(4)),
      geo: parseFloat(shapGeo.toFixed(4)),
    },
    agentConsensus: parseFloat(agentConsensus.toFixed(4)),
    minorityReport,
  };
}
