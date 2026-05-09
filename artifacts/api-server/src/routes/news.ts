import { Router, type IRouter } from "express";
import { GetNewsResponse } from "@workspace/api-zod";
import { fetchGeopoliticsNews } from "../lib/news";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/news", async (req, res): Promise<void> => {
  const symbol =
    typeof req.query["symbol"] === "string" ? req.query["symbol"].toUpperCase() : undefined;
  const live =
    typeof req.query["live"] === "string" ? req.query["live"] === "true" : false;

  try {
    const all = await fetchGeopoliticsNews({ live });
    let filtered = all;

    if (symbol) {
      const sym = symbol.toLowerCase();
      filtered = all.filter((n) => {
        const text = (n.title + " " + n.description).toLowerCase();
        return text.includes(sym);
      });
      if (filtered.length === 0) {
        filtered = all
          .filter((n) => n.category === "macro" || n.category === "geopolitics")
          .slice(0, 10);
      }
    }

    res.json(GetNewsResponse.parse(filtered));
  } catch (err) {
    if (live) {
      logger.error({ err }, "Failed to serve live news");
      res.status(503).json({
        error: "Live news unavailable",
        message: "Could not fetch live news at this time.",
      });
      return;
    }
    logger.error({ err }, "Failed to serve news");
    res.json(GetNewsResponse.parse([]));
  }
});

export default router;
