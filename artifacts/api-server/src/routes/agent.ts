import { Router, type IRouter } from "express";
import { handleChatMessage } from "../lib/agent/chat-orchestrator";
import { runAutonomousScan, runHealthCheck, getLastScan, isScanRunning } from "../lib/agent/auto-scanner";
import { getAgentEvents } from "../lib/agent/agent-log";
import { getSchedulerStatus } from "../lib/scheduler";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── POST /api/agent/chat ─────────────────────────────────────────────────────
router.post("/agent/chat", async (req, res): Promise<void> => {
  const message = req.body?.message;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "message is required (max 500 chars)" });
    return;
  }
  if (message.length > 500) {
    res.status(400).json({ error: "message must be at most 500 characters" });
    return;
  }

  try {
    const response = await handleChatMessage(message.trim());
    res.json(response);
  } catch (err) {
    logger.error({ err }, "Agent chat route failed");
    res.status(500).json({ error: "Agent failed to process your request" });
  }
});

// ─── POST /api/agent/scan ─────────────────────────────────────────────────────
router.post("/agent/scan", async (req, res): Promise<void> => {
  const rawSymbols = req.body?.symbols;
  const symbols: string[] | undefined =
    Array.isArray(rawSymbols)
      ? rawSymbols.filter((s): s is string => typeof s === "string").slice(0, 20)
      : undefined;

  if (isScanRunning()) {
    res.status(409).json({ error: "A scan is already in progress", lastScan: getLastScan() });
    return;
  }

  try {
    // Kick off and respond once complete
    const result = await runAutonomousScan(symbols);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Agent scan route failed");
    res.status(500).json({ error: "Scan failed" });
  }
});

// ─── GET /api/agent/status ────────────────────────────────────────────────────
router.get("/agent/status", async (_req, res): Promise<void> => {
  try {
    const [health, events] = await Promise.all([
      runHealthCheck(),
      Promise.resolve(getAgentEvents(30)),
    ]);

    res.json({
      health,
      scheduler: getSchedulerStatus(),
      lastScan: getLastScan(),
      scanRunning: isScanRunning(),
      recentEvents: events,
    });
  } catch (err) {
    logger.error({ err }, "Agent status route failed");
    res.status(500).json({ error: "Failed to get agent status" });
  }
});

// ─── GET /api/agent/events ────────────────────────────────────────────────────
router.get("/agent/events", (req, res): void => {
  const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) ?? "50")));
  res.json({ events: getAgentEvents(limit) });
});

// ─── GET /api/agent/health ────────────────────────────────────────────────────
router.get("/agent/health", async (_req, res): Promise<void> => {
  try {
    const health = await runHealthCheck();
    const code = health.status === "critical" ? 503 : health.status === "degraded" ? 207 : 200;
    res.status(code).json(health);
  } catch (err) {
    logger.error({ err }, "Agent health route failed");
    res.status(500).json({ error: "Health check failed" });
  }
});

export default router;
