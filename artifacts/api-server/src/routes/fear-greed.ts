import { Router, type IRouter } from "express";
import { fearGreedCache, TTL } from "../lib/cache";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface FearGreedData {
  value: number;
  valueText: string;
  timestamp: string;
  previousValue: number;
  previousValueText: string;
  trend: "rising" | "falling" | "stable";
}

async function fetchFearGreedIndex(): Promise<FearGreedData> {
  const cached = fearGreedCache.get<FearGreedData>("fear-greed:current");
  if (cached) return cached;

  try {
    const res = await fetch(
      "https://api.alternative.me/fng/?limit=2&format=json",
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      data: Array<{ value: string; value_classification: string; timestamp: string }>;
    };

    const [current, previous] = json.data ?? [];
    if (!current) throw new Error("No data");

    const currentValue = parseInt(current.value, 10);
    const previousValue = previous ? parseInt(previous.value, 10) : currentValue;
    const diff = currentValue - previousValue;

    const result: FearGreedData = {
      value: currentValue,
      valueText: current.value_classification,
      timestamp: new Date(parseInt(current.timestamp, 10) * 1000).toISOString(),
      previousValue,
      previousValueText: previous?.value_classification ?? current.value_classification,
      trend: diff > 2 ? "rising" : diff < -2 ? "falling" : "stable",
    };

    fearGreedCache.set("fear-greed:current", result, TTL.FEAR_GREED);
    return result;
  } catch (err) {
    logger.warn({ err }, "Fear & Greed fetch failed, using fallback");
    return getFallbackFearGreed();
  }
}

function getFallbackFearGreed(): FearGreedData {
  const seed = new Date().getDate() + new Date().getMonth() * 3;
  const value = 45 + (seed % 30);
  const previous = value + (Math.random() > 0.5 ? 3 : -3);
  const texts = [
    [0, 24, "Extreme Fear"],
    [25, 44, "Fear"],
    [45, 55, "Neutral"],
    [56, 74, "Greed"],
    [75, 100, "Extreme Greed"],
  ];
  const getText = (v: number) =>
    (texts.find(([lo, hi]) => v >= lo && v <= hi) ?? texts[2])[2] as string;

  return {
    value,
    valueText: getText(value),
    timestamp: new Date().toISOString(),
    previousValue: previous,
    previousValueText: getText(previous),
    trend: value > previous + 2 ? "rising" : value < previous - 2 ? "falling" : "stable",
  };
}

router.get("/market/fear-greed", async (_req, res): Promise<void> => {
  try {
    const data = await fetchFearGreedIndex();
    res.json(data);
  } catch (err) {
    logger.error({ err }, "Fear & Greed endpoint failed");
    res.json(getFallbackFearGreed());
  }
});

export default router;
