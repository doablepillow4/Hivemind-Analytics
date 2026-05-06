import { Router, type IRouter } from "express";
import {
  RunLatticeBody,
  RunLatticeResponse,
  GetLatticeAgentsResponse,
  GetMarketRegimeQueryParams,
  GetMarketRegimeResponse,
  LatticeChallengeBody,
  LatticeChallengeResponse,
} from "@workspace/api-zod";
import { runLattice, getAllAgentStates, getStaticAgentStates } from "../lib/lattice/lattice-engine";
import { detectRegime, describeRegime } from "../lib/lattice/regime-detector";
import { fetchStockHistory, fetchCryptoHistory, CRYPTO_ID_MAP } from "../lib/market-data";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/lattice/run", async (req, res): Promise<void> => {
  const parsed = RunLatticeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { symbol, timeframe = "7d" } = parsed.data;

  try {
    const result = await runLattice(symbol.toUpperCase(), timeframe);
    res.json(RunLatticeResponse.parse(result));
  } catch (err) {
    logger.error({ err, symbol }, "Lattice run failed");
    res.status(500).json({ error: "Lattice run failed" });
  }
});

router.post("/lattice/challenge", async (req, res): Promise<void> => {
  const parsed = LatticeChallengeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { agentType, challenge, symbol, currentProbability } = parsed.data;
  const lower = challenge.toLowerCase();

  let adjustment = 0;
  let response = "";

  // ── Macro bearish ────────────────────────────────────────
  if (/recession|downturn|bear market|contraction/.test(lower)) {
    adjustment = -0.07;
    response = `Recession risk is a material concern. Historical precedent shows risk assets underperform by 25–40% during NBER-defined contractions. For ${symbol}, I'm applying a macro-headwind discount — growth multiples compress as earnings expectations reset downward. Revising probability lower.`;
  } else if (/fed|rate hike|interest rate|monetary tighten|hawkish/.test(lower)) {
    adjustment = -0.05;
    response = `Federal Reserve policy is a critical macro variable. Each 25bps hike increases the discount rate applied to future cash flows, compressing equity multiples by ~4-6% on a DCF basis. For high-growth names like ${symbol}, this headwind is amplified by duration sensitivity.`;
  } else if (/inflation/.test(lower)) {
    adjustment = -0.04;
    response = `Persistent inflation erodes real earnings power and locks central banks into restrictive stances longer than consensus expects. For ${symbol}, margin pressure from input cost inflation and the ceiling on PE expansion both weigh on probability. Revising slightly lower.`;
  } else if (/debt|balance sheet|leverage|bankruptcy|default/.test(lower)) {
    adjustment = -0.06;
    response = `Balance sheet risk is a direct hit to enterprise value. Elevated leverage in a rising-rate environment increases refinancing risk and reduces operating flexibility. For ${symbol}, this injects tail-risk into the bear case that I must account for.`;
  }
  // ── Geopolitical/regulatory bearish ──────────────────────
  else if (/china|taiwan|war|conflict|geopolit|sanction/.test(lower)) {
    adjustment = -0.07;
    response = `Geopolitical tail risk is systematically underweighted by standard models. Conflict risk scenarios introduce supply-chain disruption, export control acceleration, and risk-off positioning that cascades through equity markets. For ${symbol}, the causal transmission chains are real — adjusting tail-risk premium upward.`;
  } else if (/regulat|sec|ban|antitrust|probe|investigation/.test(lower)) {
    adjustment = -0.08;
    response = `Regulatory risk introduces a discount ceiling on the upside case. Whether it's SEC enforcement, antitrust action, or legislative uncertainty, these events reduce investor confidence and limit institutional positioning. For ${symbol}, this is a legitimate headwind I'm incorporating.`;
  }
  // ── Earnings/fundamental bearish ─────────────────────────
  else if (/(earnings|revenue|guidance).*(miss|disappoint|cut|lower|poor|weak)/.test(lower)) {
    adjustment = -0.09;
    response = `Earnings disappointment fundamentally revises the bull thesis. If revenue growth is decelerating and management is cutting guidance, the market will re-rate the multiple downward — potentially aggressively. For ${symbol}, I'm revising my probability materially lower on this new fundamental information.`;
  }
  // ── Bullish triggers ─────────────────────────────────────
  else if (/(earnings|revenue|guidance).*(beat|strong|raise|better|great|exceed)/.test(lower)) {
    adjustment = +0.08;
    response = `Strong earnings validate the fundamental bull thesis. Revenue growth beating consensus and raised guidance typically triggers a re-rating event, as institutional investors revise their price targets upward. For ${symbol}, this is a credible positive catalyst — revising probability higher.`;
  } else if (/etf|institutional|pension|fund.*buy|accumulate/.test(lower)) {
    adjustment = +0.06;
    response = `Institutional demand flow is a structural tailwind that changes supply/demand dynamics at the margin. ETF inflows create programmatic buying pressure independent of individual stock selection. For ${symbol}, persistent institutional accumulation is a positive signal I'm incorporating.`;
  } else if (/buyback|share repurchase|dividend|capital return/.test(lower)) {
    adjustment = +0.05;
    response = `Capital return programs signal management's confidence in the forward business trajectory. Buybacks reduce float and are EPS-accretive, while dividends attract income-seeking institutional holders. For ${symbol}, this is a positive signal that tightens the downside distribution.`;
  } else if (/ai|artificial intelligence|llm|machine learning|data center/.test(lower)) {
    adjustment = +0.06;
    response = `The AI secular cycle is a multi-year structural driver of revenue growth and pricing power for exposed names. The capex wave from hyperscalers is still in early innings. For ${symbol}, genuine AI exposure is a credible bull catalyst that I'm incorporating into my probability.`;
  } else if (/breakout|all.?time high|ath|resistance.*break|momentum.*bull/.test(lower)) {
    adjustment = +0.05;
    response = `Technical breakouts above key resistance trigger systematic trend-following capital inflows from CTAs and momentum funds. The mechanics of market structure create self-reinforcing buying pressure at all-time highs. For ${symbol}, this technical catalyst is a legitimate factor.`;
  } else if (/rate cut|pivot|dovish|easing|qe/.test(lower)) {
    adjustment = +0.07;
    response = `Monetary easing is a powerful tailwind for risk assets. A Fed pivot compresses the risk-free rate, expands equity multiples on a DCF basis, and triggers a rotation from bonds to equities. For ${symbol}, this macro shift is a genuine bull catalyst — revising probability higher.`;
  } else if (/underval|cheap|discount|low pe|margin of safety/.test(lower)) {
    adjustment = +0.04;
    response = `Valuation support provides a margin of safety that asymmetrically skews the risk/reward in the bull direction. When ${symbol} trades at a meaningful discount to intrinsic value or peers, downside is cushioned and upside is uncapped. This is a constructive factor.`;
  } else if (/breakdown|support.*fail|crash|collapse/.test(lower)) {
    adjustment = -0.07;
    response = `Technical breakdown below key support levels triggers systematic selling from trend-following models. Stop-loss cascades and forced liquidations can amplify the initial move. For ${symbol}, structural buyers exit on such breaks, and I'm revising downside risk higher.`;
  } else {
    adjustment = 0;
    response = `Your challenge raises a nuanced consideration. After reviewing the argument, I note the signal-to-noise ratio is limited given current information. While I acknowledge the uncertainty this introduces, the preponderance of evidence still supports my existing thesis for ${symbol}. I'm holding my probability estimate but flagging this as an area to monitor.`;
  }

  const newProbability = Math.max(0.05, Math.min(0.95, currentProbability + adjustment));

  const result = LatticeChallengeResponse.parse({
    agentType,
    response,
    adjustment: parseFloat(adjustment.toFixed(4)),
    newProbability: parseFloat(newProbability.toFixed(4)),
  });

  res.json(result);
});

router.get("/lattice/agents", async (_req, res): Promise<void> => {
  try {
    const dbStates = await getAllAgentStates();
    const states = dbStates.length > 0 ? dbStates : getStaticAgentStates();
    res.json(GetLatticeAgentsResponse.parse(states));
  } catch (err) {
    logger.warn({ err }, "Failed to fetch agent states, using static");
    res.json(GetLatticeAgentsResponse.parse(getStaticAgentStates()));
  }
});

router.get("/lattice/regime", async (req, res): Promise<void> => {
  const parsed = GetMarketRegimeQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "symbol is required" });
    return;
  }

  const { symbol } = parsed.data;
  const isCrypto = symbol.toUpperCase() in CRYPTO_ID_MAP;

  try {
    let closes: number[] = [];
    if (isCrypto) {
      const coinId = CRYPTO_ID_MAP[symbol.toUpperCase()]?.id ?? symbol.toLowerCase();
      const history = await fetchCryptoHistory(coinId, 30);
      closes = history.filter((h) => h.close != null).map((h) => h.close!);
    } else {
      const history = await fetchStockHistory(symbol.toUpperCase(), 30);
      closes = history.filter((h) => h.close != null).map((h) => h.close!);
    }

    const ctx = detectRegime(closes);
    res.json(
      GetMarketRegimeResponse.parse({
        symbol: symbol.toUpperCase(),
        regime: ctx.regime,
        regimeScore: ctx.regimeScore,
        volatility: ctx.volatility,
        description: describeRegime(ctx.regime, ctx.volatility),
      })
    );
  } catch (err) {
    logger.warn({ err, symbol }, "Regime detection failed");
    res.json(
      GetMarketRegimeResponse.parse({
        symbol: symbol.toUpperCase(),
        regime: "calm",
        regimeScore: 0.1,
        volatility: 0.14,
        description: "Low-volatility environment (14.0% annualized).",
      })
    );
  }
});

export default router;
