import { Router, type IRouter } from "express";
import {
  RunLatticeBody,
  RunLatticeResponse,
  GetLatticeAgentsResponse,
  GetMarketRegimeQueryParams,
  GetMarketRegimeResponse,
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
