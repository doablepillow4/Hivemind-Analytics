import type { Regime, RegimeContext } from "./types";

export function detectRegime(closes: number[]): RegimeContext {
  if (closes.length < 5) {
    return { regime: "calm", regimeScore: 0.1, volatility: 0.1, closes };
  }

  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const ret = (closes[i] - closes[i - 1]) / closes[i - 1];
    if (isFinite(ret)) returns.push(ret);
  }

  const slice = returns.slice(-20);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
  const dailyVol = Math.sqrt(variance);
  const annualizedVol = dailyVol * Math.sqrt(252);

  const maxDrawdown = computeMaxDrawdown(closes.slice(-20));

  let regime: Regime;
  let regimeScore: number;

  if (annualizedVol > 0.45 || maxDrawdown > 0.15) {
    regime = "crisis";
    regimeScore = Math.min(1, annualizedVol / 0.6 + maxDrawdown);
  } else if (annualizedVol > 0.18) {
    regime = "volatile";
    regimeScore = (annualizedVol - 0.18) / 0.27;
  } else {
    regime = "calm";
    regimeScore = annualizedVol / 0.18;
  }

  return {
    regime,
    regimeScore: parseFloat(regimeScore.toFixed(3)),
    volatility: parseFloat(annualizedVol.toFixed(4)),
    closes,
  };
}

function computeMaxDrawdown(closes: number[]): number {
  if (closes.length < 2) return 0;
  let peak = closes[0];
  let maxDD = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    const dd = (peak - c) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

export function describeRegime(regime: Regime, vol: number): string {
  switch (regime) {
    case "calm":
      return `Low-volatility environment (${(vol * 100).toFixed(1)}% annualized). Momentum and trend-following signals are reliable.`;
    case "volatile":
      return `Elevated volatility (${(vol * 100).toFixed(1)}% annualized). Mean-reversion and contrarian signals carry higher weight.`;
    case "crisis":
      return `Crisis-regime detected (${(vol * 100).toFixed(1)}% annualized). Directional confidence is significantly reduced; tail-risk scenarios dominate.`;
  }
}
