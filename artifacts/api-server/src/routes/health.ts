import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/healthz", async (_req, res): Promise<void> => {
  let dbStatus: "ok" | "degraded" = "ok";

  try {
    await pool.query("SELECT 1");
  } catch (err) {
    logger.warn({ err }, "Health check: database unreachable");
    dbStatus = "degraded";
  }

  const status = dbStatus === "ok" ? "ok" : "degraded";
  const statusCode = status === "ok" ? 200 : 503;

  res.status(statusCode).json({
    status,
    db: dbStatus,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
