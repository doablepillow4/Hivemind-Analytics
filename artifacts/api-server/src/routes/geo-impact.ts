import { Router, type IRouter } from "express";
import { classifyThreat } from "../lib/geo-threat-analyzer";
import { logger } from "../lib/logger";
import { TTLCache } from "../lib/cache";

const router: IRouter = Router();

const geoImpactCache = new TTLCache(100);

router.post("/geo-impact", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;

  const headline = typeof body["headline"] === "string" ? body["headline"].trim() : "";
  if (headline.length < 4) {
    res.status(400).json({ error: "headline must be at least 4 characters" });
    return;
  }

  const description =
    typeof body["description"] === "string" ? body["description"].slice(0, 1000) : "";
  const isBreaking = body["isBreaking"] === true;

  const cacheKey = Buffer.from(headline.slice(0, 40)).toString("base64");
  const cached = geoImpactCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const classification = classifyThreat(headline, description, isBreaking);

    logger.debug(
      {
        type: classification.type,
        severity: classification.severity,
        headline: headline.slice(0, 60),
      },
      "Geo-impact classification",
    );

    geoImpactCache.set(cacheKey, classification, 15 * 60 * 1000); // 15 min cache
    res.json(classification);
  } catch (err) {
    logger.error({ err }, "Geo-impact classification failed");
    res.status(500).json({ error: "Classification failed" });
  }
});

export default router;
