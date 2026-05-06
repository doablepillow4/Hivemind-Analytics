import type { BeliefToken, DebateRound, Direction, HiveSignal, RegimeContext } from "./types";
import { nanoid } from "nanoid";

function clamp(v: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

function directionFromProb(p: number): Direction {
  if (p > 0.54) return "bullish";
  if (p < 0.46) return "bearish";
  return "neutral";
}

interface DebateResult {
  tokens: BeliefToken[];
  rounds: DebateRound[];
  adjustedProb: number;
}

export function runDevilsAdvocate(
  hypothesisTokens: BeliefToken[],
  features: { rsi: number; macdHistogram: number; bollingerPercentB: number; momentum5d: number },
  regime: RegimeContext,
  parentIds: string[],
  symbol = "",
  timeframe = "1d"
): DebateResult {
  const avgProb =
    hypothesisTokens.reduce((s, t) => s + t.probability, 0) / hypothesisTokens.length;
  const consensusStrength = Math.abs(avgProb - 0.5) * 2;

  let adjustment = 0;
  const challenges: string[] = [];

  if (consensusStrength > 0.6) {
    adjustment -= 0.08;
    challenges.push(
      `Strong consensus (${(consensusStrength * 100).toFixed(0)}% agreement) triggers overconfidence penalty — markets rarely reward obvious bets`
    );
  }

  if (avgProb > 0.55 && features.rsi > 68) {
    adjustment -= 0.07;
    challenges.push(
      `Bullish consensus coincides with RSI ${features.rsi.toFixed(1)} — overbought conditions historically mean-revert within 5-7 trading days`
    );
  }

  if (avgProb < 0.45 && features.rsi < 32) {
    adjustment -= 0.07;
    challenges.push(
      `Bearish consensus with RSI ${features.rsi.toFixed(1)} — capitulation events often mark short-term lows; contrarian risk is elevated`
    );
  }

  if (regime.regime === "crisis") {
    adjustment -= 0.1;
    challenges.push(
      "Crisis regime: historical correlation breakdown makes technical signals unreliable — applying additional confidence haircut"
    );
  }

  if (features.momentum5d > 4 && avgProb > 0.55) {
    adjustment -= 0.05;
    challenges.push(
      `5-day momentum of +${features.momentum5d.toFixed(1)}% with bullish consensus may represent late-cycle chasing`
    );
  }

  const finalChallenge =
    challenges.length > 0
      ? challenges.join(". ")
      : `No strong counter-arguments found for ${symbol} at current levels — consensus appears well-supported.`;
  const accepted = adjustment < -0.03;

  const tfNote = ["15m", "30m", "1h"].includes(timeframe)
    ? `${timeframe} horizon: short-duration consensus breaks down rapidly — even a minor catalyst can invalidate this call`
    : `${timeframe} horizon: consensus has had time to absorb available information`;

  const adjustedProb = clamp(avgProb + adjustment);
  const roundToken: BeliefToken = {
    id: nanoid(8),
    agentType: "critique_devil",
    round: 2,
    hypothesis: directionFromProb(adjustedProb),
    probability: parseFloat(adjustedProb.toFixed(4)),
    confidence: clamp(0.55 + Math.abs(adjustedProb - 0.5)),
    rationale: [
      `Role: consensus skeptic · ${symbol} ${timeframe}`,
      `Devil's Advocate challenge of ${hypothesisTokens.length} hypothesis agents — net probability adjustment: ${adjustment >= 0 ? "+" : ""}${(adjustment * 100).toFixed(1)}%`,
      finalChallenge,
      tfNote,
    ],
    shapHive: 0,
    shapAi: 1,
    shapGeo: 0,
    liquidityScore: 0,
    parentIds,
  };

  return {
    tokens: [roundToken],
    rounds: [
      {
        round: 1,
        agentType: "critique_devil",
        challenge: finalChallenge,
        adjustment,
        accepted,
      },
    ],
    adjustedProb,
  };
}

export function runTailRiskAgent(
  currentProb: number,
  hive: HiveSignal,
  regime: RegimeContext,
  parentIds: string[],
  symbol = "",
  timeframe = "1d"
): DebateResult {
  let adjustment = 0;
  const challenges: string[] = [];

  if (hive.geoPressure > 0.35) {
    const geoAdj = -(hive.geoPressure - 0.35) * 0.25;
    adjustment += geoAdj;
    challenges.push(
      `Elevated geopolitical risk (GPR index: ${(hive.geoPressure * 100).toFixed(0)}%) — Polymarket prediction markets signal tail-risk scenarios. Hormuz/Taiwan causal chains inject supply-shock probability.`
    );
  }

  if (regime.regime === "crisis") {
    const crisisAdj = -(regime.regimeScore * 0.1);
    adjustment += crisisAdj;
    challenges.push(
      `Crisis-regime fat-tails: kurtosis of return distribution is elevated. Standard deviation understates true downside risk by an estimated ${(regime.regimeScore * 30).toFixed(0)}%.`
    );
  }

  if (regime.volatility > 0.35) {
    adjustment -= 0.04;
    challenges.push(
      `Volatility spike alert: ${(regime.volatility * 100).toFixed(1)}% annualized vol exceeds 35% threshold. VaR (95%) is expanded by ~${(regime.volatility * 120).toFixed(0)} bps versus calm baseline.`
    );
  }

  if (challenges.length === 0) {
    challenges.push(
      `No significant tail risks identified. Geopolitical pressure ${(hive.geoPressure * 100).toFixed(0)}% and volatility ${(regime.volatility * 100).toFixed(1)}% are within normal bounds.`
    );
  }

  const accepted = adjustment < -0.02;
  const adjustedProb = clamp(currentProb + adjustment);

  const roundToken: BeliefToken = {
    id: nanoid(8),
    agentType: "critique_tailrisk",
    round: 2,
    hypothesis: adjustedProb > 0.54 ? "bullish" : adjustedProb < 0.46 ? "bearish" : "neutral",
    probability: parseFloat(adjustedProb.toFixed(4)),
    confidence: clamp(0.5 + Math.abs(adjustedProb - 0.5) * 0.8),
    rationale: [
      `Role: tail-risk & geopolitical analyst · ${symbol} ${timeframe}`,
      `Tail Risk Assessment — scanning ${symbol} for fat-tail exposures over ${timeframe} horizon`,
      ...challenges,
      `Net probability adjustment: ${adjustment >= 0 ? "+" : ""}${(adjustment * 100).toFixed(1)}% (${accepted ? "tail risks accepted into model" : "tail risks within tolerance"})`,
    ],
    shapHive: hive.geoPressure,
    shapAi: 0,
    shapGeo: 1,
    liquidityScore: hive.liquidityScore,
    parentIds,
  };

  return {
    tokens: [roundToken],
    rounds: [
      {
        round: 2,
        agentType: "critique_tailrisk",
        challenge: challenges[0],
        adjustment,
        accepted,
      },
    ],
    adjustedProb,
  };
}
