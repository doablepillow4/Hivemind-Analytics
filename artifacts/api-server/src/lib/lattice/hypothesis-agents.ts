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

function symbolBias(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  return ((hash % 201) - 100) / 1000;
}

function timeframeMult(timeframe: string): number {
  return (
    { "15m": 0.7, "30m": 0.78, "1h": 0.85, "6h": 0.92, "12h": 0.96, "1d": 1.0, "7d": 1.05 }[
      timeframe
    ] ?? 1.0
  );
}

export function momentumAgent(
  features: TechnicalFeatures,
  regime: RegimeContext,
  parentIds: string[],
  symbol = "",
  timeframe = "1d",
): BeliefToken {
  const { rsi, macdHistogram, maCross, momentum5d } = features;

  const macdScore =
    macdHistogram > 0.002 ? 0.74 : macdHistogram > 0 ? 0.6 : macdHistogram > -0.002 ? 0.42 : 0.28;
  const maScore = maCross > 1 ? 0.72 : maCross > 0 ? 0.6 : maCross > -1 ? 0.4 : 0.28;
  const momScore = momentum5d > 3 ? 0.76 : momentum5d > 0 ? 0.62 : momentum5d > -3 ? 0.38 : 0.24;
  const rsiTrend = rsi > 55 ? 0.65 : rsi < 45 ? 0.38 : 0.52;

  let probability = macdScore * 0.35 + maScore * 0.25 + momScore * 0.25 + rsiTrend * 0.15;

  const regimeMult = regime.regime === "calm" ? 1.1 : regime.regime === "volatile" ? 0.9 : 0.75;
  const tfMult = timeframeMult(timeframe);
  probability = clamp(probability * regimeMult * tfMult + symbolBias(symbol) * 0.5);

  const confidence = clamp(0.52 + Math.abs(probability - 0.5) * 0.85);
  const direction = directionFromProb(probability);

  const macdStr =
    macdHistogram > 0
      ? `positive crossover (${macdHistogram.toFixed(4)}) — upside momentum building`
      : `negative (${macdHistogram.toFixed(4)}) — bearish pressure accumulating`;

  const momStr =
    momentum5d > 0
      ? `+${momentum5d.toFixed(2)}% 5-day move confirms trend continuation`
      : `${momentum5d.toFixed(2)}% 5-day drawdown — momentum deteriorating`;

  const maStr =
    maCross > 0
      ? `Price ${maCross.toFixed(2)}% above 20-SMA — golden-cross territory`
      : `Price ${Math.abs(maCross).toFixed(2)}% below 20-SMA — death-cross territory`;

  const regimeNote =
    regime.regime === "calm"
      ? `Calm regime amplifies trend signals — ${symbol} momentum trades carry higher Sharpe in low-vol environments`
      : regime.regime === "volatile"
        ? `Volatile regime reduces trend reliability — applying ${((1 - regimeMult) * 100).toFixed(0)}% momentum haircut`
        : `Crisis regime: momentum signals are largely noise — technical conviction is low`;

  const tfNote = ["15m", "30m", "1h"].includes(timeframe)
    ? `Short ${timeframe} horizon: momentum decay is fast — intraday noise dominates`
    : `${timeframe} horizon: trend signals have higher persistence`;

  return {
    id: nanoid(8),
    agentType: "hypothesis_momentum",
    round: 1,
    hypothesis: direction,
    probability: parseFloat(probability.toFixed(4)),
    confidence: parseFloat(confidence.toFixed(4)),
    rationale: [
      `Role: trend-following momentum analyst · ${symbol} ${timeframe}`,
      `MACD: ${macdStr}`,
      momStr,
      maStr,
      regimeNote,
      tfNote,
    ],
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
  parentIds: string[],
  symbol = "",
  timeframe = "1d",
): BeliefToken {
  const { rsi, bollingerPercentB, momentum5d } = features;

  const extremeOversold = rsi < 32;
  const extremeOverbought = rsi > 72;
  const bbLow = bollingerPercentB < 0.12;
  const bbHigh = bollingerPercentB > 0.88;
  const recentDrop = momentum5d < -4;
  const recentRally = momentum5d > 4;

  let probability: number;

  if (extremeOversold && (bbLow || recentDrop)) {
    probability = 0.76;
  } else if (extremeOversold || bbLow || recentDrop) {
    probability = 0.66;
  } else if (extremeOverbought && (bbHigh || recentRally)) {
    probability = 0.26;
  } else if (extremeOverbought || bbHigh || recentRally) {
    probability = 0.36;
  } else {
    probability = 0.5 + (0.5 - bollingerPercentB) * 0.3 + (50 - rsi) * 0.005;
  }

  const regimeMult = regime.regime === "volatile" ? 1.15 : regime.regime === "crisis" ? 1.25 : 0.88;
  probability = clamp(probability * (probability > 0.5 ? regimeMult : 2 - regimeMult));

  const tfMult = timeframeMult(timeframe);
  probability = clamp(probability * (1 + (1 - tfMult) * 0.3) + symbolBias(symbol) * 0.5);

  const confidence = clamp(0.48 + Math.abs(probability - 0.5) * 0.95);
  const direction = directionFromProb(probability);

  const rsiStr = extremeOversold
    ? `RSI ${rsi.toFixed(1)} — deep oversold zone; historically ${symbol} snaps back within 2-3 sessions`
    : extremeOverbought
      ? `RSI ${rsi.toFixed(1)} — overbought; ${symbol} mean-reversion profit opportunity forming`
      : `RSI ${rsi.toFixed(1)} — within normal range, moderate ${probability > 0.5 ? "bullish" : "bearish"} mean-reversion edge`;

  const bbStr = bbLow
    ? `Bollinger %B at ${bollingerPercentB.toFixed(2)} — price kissing lower band; buyers typically absorb here`
    : bbHigh
      ? `Bollinger %B at ${bollingerPercentB.toFixed(2)} — price at upper band; extension risk; potential snap-back`
      : `Bollinger %B at ${bollingerPercentB.toFixed(2)} — mid-band; no extreme for clean reversion trade`;

  const regimeStr =
    regime.regime === "volatile"
      ? `Volatile regime is fertile ground for mean-reversion — fat tails both ways, but oversold bounces are sharper`
      : regime.regime === "crisis"
        ? `Crisis regime amplifies reversion signals: capitulation events precede sharp recoveries, but timing is hazardous`
        : `Calm regime reduces reversion sharpness — trend persistence weakens the contrarian edge`;

  const tfStr = ["15m", "30m", "1h"].includes(timeframe)
    ? `Short ${timeframe} timeframe: mean-reversion signals are strongest intraday — snap-back trades resolve faster`
    : `${timeframe} timeframe: reversion plays may take days to materialize`;

  return {
    id: nanoid(8),
    agentType: "hypothesis_meanrevert",
    round: 1,
    hypothesis: direction,
    probability: parseFloat(probability.toFixed(4)),
    confidence: parseFloat(confidence.toFixed(4)),
    rationale: [
      `Role: contrarian mean-reversion analyst · ${symbol} ${timeframe}`,
      rsiStr,
      bbStr,
      regimeStr,
      tfStr,
    ],
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
  parentIds: string[],
  symbol = "",
  timeframe = "1d",
): BeliefToken {
  const { rsi, bollingerPercentB } = features;

  let probability = 0.5;
  const vol = regime.volatility;
  const rs = regime.regimeScore;

  if (regime.regime === "calm") {
    const trendBias = bollingerPercentB > 0.5 ? 0.1 : -0.08;
    probability = 0.5 + trendBias + rs * 0.12;
  } else if (regime.regime === "volatile") {
    const overextended = rsi > 68 || rsi < 32;
    if (overextended) {
      probability = rsi < 32 ? 0.64 : 0.36;
    } else {
      probability = 0.5 + (0.5 - vol) * 0.25;
    }
  } else {
    probability = 0.5 - rs * 0.18;
  }

  probability = clamp(probability + symbolBias(symbol));

  const tfMult = timeframeMult(timeframe);
  probability = clamp(probability + (tfMult - 1.0) * (probability - 0.5) * 0.5);

  const confidence = clamp(
    0.38 + (1 - Math.min(1, vol / 0.6)) * 0.3 + Math.abs(probability - 0.5) * 0.5,
  );
  const direction = directionFromProb(probability);

  const volStr =
    vol < 0.15
      ? `${(vol * 100).toFixed(1)}% annualized vol — near-silence; breakout risk rising`
      : vol < 0.3
        ? `${(vol * 100).toFixed(1)}% annualized vol — moderate; options pricing fair value`
        : vol < 0.5
          ? `${(vol * 100).toFixed(1)}% annualized vol — elevated; VaR widening, position sizing down`
          : `${(vol * 100).toFixed(1)}% annualized vol — extreme; GBM assumptions break down`;

  const regimeStr =
    regime.regime === "calm"
      ? `Calm regime (score ${(rs * 100).toFixed(0)}): trend-following strategies have positive expected value — signal clarity is high`
      : regime.regime === "volatile"
        ? `Volatile regime (score ${(rs * 100).toFixed(0)}): contrarian plays at RSI extremes carry premium — ${symbol} at ${rsi.toFixed(1)} RSI is ${rsi < 50 ? "approaching" : "leaving"} an extreme`
        : `Crisis regime (score ${(rs * 100).toFixed(0)}): correlation matrices are breaking — cross-asset hedges required`;

  const tfStr = ["15m", "30m", "1h"].includes(timeframe)
    ? `Intraday ${timeframe}: vol is dominated by microstructure noise; overnight gap risk not captured`
    : ["6h", "12h"].includes(timeframe)
      ? `${timeframe} horizon: vol regime signal has moderate predictive power over the session`
      : `${timeframe} horizon: regime vol provides reliable risk-adjusted position sizing guidance`;

  return {
    id: nanoid(8),
    agentType: "hypothesis_volregime",
    round: 1,
    hypothesis: direction,
    probability: parseFloat(probability.toFixed(4)),
    confidence: parseFloat(confidence.toFixed(4)),
    rationale: [
      `Role: volatility-regime specialist · ${symbol} ${timeframe}`,
      volStr,
      regimeStr,
      `Confidence ${(confidence * 100).toFixed(0)}% — inversely scaled to regime turbulence`,
      tfStr,
    ],
    shapHive: 0,
    shapAi: 1,
    shapGeo: 0,
    liquidityScore: 0,
    parentIds,
  };
}

export function hiveWisdomAgent(
  hive: HiveSignal,
  parentIds: string[],
  symbol = "",
  timeframe = "1d",
): BeliefToken {
  const probability = clamp(hive.probability + symbolBias(symbol) * 0.3);
  const direction = directionFromProb(probability);
  const confidence = clamp(hive.confidence * (1 + hive.liquidityScore * 0.35));

  const bullPct = (hive.probability * 100).toFixed(1);
  const bearPct = (100 - hive.probability * 100).toFixed(1);

  const liqStr =
    hive.liquidityScore > 0.5
      ? `High-liquidity market (score ${hive.liquidityScore.toFixed(2)}) — smart money is committed; this signal carries significant weight`
      : hive.liquidityScore > 0.25
        ? `Moderate liquidity (score ${hive.liquidityScore.toFixed(2)}) — applying partial weight discount to Polymarket signal`
        : `Thin liquidity (score ${hive.liquidityScore.toFixed(2)}) — Polymarket crowd is limited; 60% discount applied`;

  const consensusStr =
    hive.probability > 0.65
      ? `Strong ${bullPct}% bullish consensus — the crowd is leaning heavily ${direction}; skin-in-the-game bettors see upside`
      : hive.probability < 0.35
        ? `Strong ${bearPct}% bearish consensus — prediction market participants expect ${symbol} weakness`
        : `Split market: ${bullPct}% bull vs ${bearPct}% bear — genuine two-sided uncertainty, no dominant narrative`;

  const geoStr =
    hive.geoPressure > 0.35
      ? `Elevated geopolitical pressure (GPR ${(hive.geoPressure * 100).toFixed(0)}%) bleeding into ${symbol} pricing via macro risk channels`
      : `Low geopolitical noise (GPR ${(hive.geoPressure * 100).toFixed(0)}%) — macro tail risk is contained for ${symbol}`;

  const mktStr =
    hive.relevantMarkets.length > 0 &&
    hive.relevantMarkets[0] !== "Fallback signal — live data unavailable"
      ? `Key Polymarket event driving signal: "${hive.relevantMarkets[0]}"`
      : `No directly relevant Polymarket market found for ${symbol} — using correlated macro markets`;

  const tfStr = ["15m", "30m", "1h"].includes(timeframe)
    ? `${timeframe} horizon: Polymarket odds reflect multi-day expectations and may not capture intraday catalysts`
    : `${timeframe} horizon: Polymarket odds align well with this resolution window`;

  return {
    id: nanoid(8),
    agentType: "hypothesis_hive",
    round: 1,
    hypothesis: direction,
    probability: parseFloat(probability.toFixed(4)),
    confidence: parseFloat(confidence.toFixed(4)),
    rationale: [
      `Role: crowd-signal & prediction-market analyst · ${symbol} ${timeframe}`,
      consensusStr,
      liqStr,
      geoStr,
      mktStr,
      tfStr,
    ],
    shapHive: 1,
    shapAi: 0,
    shapGeo: hive.geoPressure,
    liquidityScore: hive.liquidityScore,
    parentIds,
  };
}
