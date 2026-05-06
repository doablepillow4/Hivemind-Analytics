import type { BeliefToken, TechnicalFeatures, HiveSignal, RegimeContext, Direction } from "./types";
import { nanoid } from "nanoid";

function clamp(v: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

function directionFromProb(p: number): Direction {
  if (p > 0.54) return "bullish";
  if (p < 0.46) return "bearish";
  return "neutral";
}

export function momentumAgent(
  features: TechnicalFeatures,
  regime: RegimeContext,
  parentIds: string[]
): BeliefToken {
  const { rsi, macdHistogram, bollingerPercentB, maCross, momentum5d } = features;

  const rsiScore = rsi < 45 ? 0.75 : rsi > 65 ? 0.25 : 0.5;
  const macdScore = macdHistogram > 0 ? 0.7 : 0.3;
  const bbScore = bollingerPercentB < 0.4 ? 0.7 : bollingerPercentB > 0.7 ? 0.3 : 0.5;
  const maScore = maCross > 0 ? 0.65 : 0.35;
  const momScore = momentum5d > 0 ? 0.65 : 0.35;

  let probability = rsiScore * 0.25 + macdScore * 0.25 + bbScore * 0.2 + maScore * 0.15 + momScore * 0.15;

  const regimeMult = regime.regime === "calm" ? 1.08 : regime.regime === "volatile" ? 0.92 : 0.8;
  probability = clamp(probability * regimeMult);

  const confidence = clamp(0.55 + Math.abs(probability - 0.5) * 0.8);
  const direction = directionFromProb(probability);

  const rationale = [
    `RSI at ${rsi.toFixed(1)} — ${rsi < 45 ? "oversold, bullish setup" : rsi > 65 ? "overbought, caution" : "neutral territory"}`,
    `MACD histogram ${macdHistogram > 0 ? "positive" : "negative"} (${macdHistogram.toFixed(4)}) — momentum ${macdHistogram > 0 ? "building" : "fading"}`,
    `Bollinger %B at ${bollingerPercentB.toFixed(2)} — price ${bollingerPercentB < 0.3 ? "near lower band, mean-reversion setup" : bollingerPercentB > 0.7 ? "near upper band, extended" : "mid-range"}`,
    `${regime.regime} volatility regime applies a ${regimeMult > 1 ? "+" : ""}${((regimeMult - 1) * 100).toFixed(0)}% momentum multiplier`,
  ];

  return {
    id: nanoid(8),
    agentType: "hypothesis_momentum",
    round: 1,
    hypothesis: direction,
    probability: parseFloat(probability.toFixed(4)),
    confidence: parseFloat(confidence.toFixed(4)),
    rationale,
    shapHive: 0,
    shapAi: 1,
    shapGeo: 0,
    liquidityScore: 0,
    parentIds,
  };
}

export function meanReversionAgent(
  features: TechnicalFeatures,
  regime: RegimeContext,
  parentIds: string[]
): BeliefToken {
  const { rsi, bollingerPercentB, momentum5d } = features;

  const extremeOversold = rsi < 35;
  const extremeOverbought = rsi > 70;
  const bbLow = bollingerPercentB < 0.15;
  const bbHigh = bollingerPercentB > 0.85;
  const recentDrop = momentum5d < -3;
  const recentRally = momentum5d > 3;

  let probability = 0.5;
  if (extremeOversold || bbLow || recentDrop) probability = 0.68;
  else if (extremeOverbought || bbHigh || recentRally) probability = 0.32;
  else probability = 0.5 + (0.5 - bollingerPercentB) * 0.25;

  const regimeMult = regime.regime === "volatile" ? 1.1 : regime.regime === "crisis" ? 1.2 : 0.9;
  probability = clamp(probability * (probability > 0.5 ? regimeMult : 2 - regimeMult));

  const confidence = clamp(0.45 + Math.abs(probability - 0.5) * 0.9);
  const direction = directionFromProb(probability);

  const rationale = [
    extremeOversold
      ? `RSI at ${rsi.toFixed(1)} — deep oversold zone signals mean-reversion bounce`
      : extremeOverbought
        ? `RSI at ${rsi.toFixed(1)} — severely overbought, reversion to mean expected`
        : `RSI at ${rsi.toFixed(1)} — moderate conditions, ${probability > 0.5 ? "slight bullish" : "slight bearish"} bias`,
    `Bollinger %B at ${bollingerPercentB.toFixed(2)} — ${bbLow ? "touching lower band; historically bullish reversal" : bbHigh ? "touching upper band; extension risk" : "within normal range"}`,
    `${regime.regime} regime boosts mean-reversion reliability by ${((regimeMult - 1) * 100).toFixed(0)}%`,
  ];

  return {
    id: nanoid(8),
    agentType: "hypothesis_meanrevert",
    round: 1,
    hypothesis: direction,
    probability: parseFloat(probability.toFixed(4)),
    confidence: parseFloat(confidence.toFixed(4)),
    rationale,
    shapHive: 0,
    shapAi: 1,
    shapGeo: 0,
    liquidityScore: 0,
    parentIds,
  };
}

export function volRegimeAgent(
  features: TechnicalFeatures,
  regime: RegimeContext,
  parentIds: string[]
): BeliefToken {
  const { rsi, momentum5d, volatility } = features;

  let probability = 0.5;
  const adjustedVol = regime.volatility;

  if (regime.regime === "calm") {
    probability = momentum5d > 0 ? 0.62 : 0.38;
  } else if (regime.regime === "volatile") {
    const overextended = rsi > 65 || rsi < 35;
    probability = overextended ? (rsi < 35 ? 0.6 : 0.4) : 0.5;
  } else {
    probability = 0.5 + (0.5 - rsi / 100) * 0.2;
  }

  probability = clamp(probability);
  const confidence = clamp(0.4 + (1 - adjustedVol / 0.5) * 0.2);
  const direction = directionFromProb(probability);

  const rationale = [
    `Volatility regime: ${regime.regime} (${(regime.volatility * 100).toFixed(1)}% annualized)`,
    regime.regime === "calm"
      ? "Calm regime: momentum strategies dominate — following trend direction"
      : regime.regime === "volatile"
        ? "Volatile regime: contrarian setups at extremes carry premium alpha"
        : "Crisis regime: directional bets carry high risk; hedging scenarios considered",
    `Vol-adjusted confidence: ${(confidence * 100).toFixed(0)}% (lower in high-vol environments)`,
  ];

  return {
    id: nanoid(8),
    agentType: "hypothesis_volregime",
    round: 1,
    hypothesis: direction,
    probability: parseFloat(probability.toFixed(4)),
    confidence: parseFloat(confidence.toFixed(4)),
    rationale,
    shapHive: 0,
    shapAi: 1,
    shapGeo: 0,
    liquidityScore: 0,
    parentIds,
  };
}

export function hiveWisdomAgent(
  hive: HiveSignal,
  parentIds: string[]
): BeliefToken {
  const probability = hive.probability;
  const direction = directionFromProb(probability);
  const confidence = clamp(hive.confidence * (1 + hive.liquidityScore * 0.3));

  const bullPct = (probability * 100).toFixed(1);
  const rationale = [
    `Polymarket crowd intelligence: ${bullPct}% bullish consensus (liquidity-weighted)`,
    hive.liquidityScore > 0.4
      ? `High-liquidity signal — smart money has significant skin in the game (score: ${hive.liquidityScore.toFixed(2)})`
      : `Thin liquidity signal — applying 40% discount to Polymarket weight (score: ${hive.liquidityScore.toFixed(2)})`,
    hive.relevantMarkets.length > 0
      ? `Relevant markets: "${hive.relevantMarkets[0]}"${hive.relevantMarkets.length > 1 ? ` +${hive.relevantMarkets.length - 1} more` : ""}`
      : "No directly relevant Polymarket events found",
  ];

  return {
    id: nanoid(8),
    agentType: "hypothesis_hive",
    round: 1,
    hypothesis: direction,
    probability: parseFloat(probability.toFixed(4)),
    confidence: parseFloat(confidence.toFixed(4)),
    rationale,
    shapHive: 1,
    shapAi: 0,
    shapGeo: hive.geoPressure,
    liquidityScore: hive.liquidityScore,
    parentIds,
  };
}
