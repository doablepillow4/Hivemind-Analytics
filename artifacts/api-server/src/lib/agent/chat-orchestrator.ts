import { parseIntent } from "./intent-parser";
import { logAgentEvent } from "./agent-log";
import { runAutonomousScan, runHealthCheck } from "./auto-scanner";
import { runLattice } from "../lattice/lattice-engine";
import { fetchAnyTicker, CRYPTO_ID_MAP } from "../market-data";
import { fetchGeopoliticsNews } from "../news";
import { runTrainingCycle } from "../scheduler";
import { getSchedulerStatus } from "../scheduler";
import { getAllAgentStates, getStaticAgentStates } from "../lattice/lattice-engine";
import { queryBeliefHistory } from "../lattice/belief-state";
import { detectRegime, describeRegime } from "../lattice/regime-detector";
import { fetchStockHistory, fetchCryptoHistory } from "../market-data";
import { logger } from "../logger";

export interface ChatMessage {
  role: "user" | "agent";
  content: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface ChatResponse {
  message: string;
  intent: string;
  data?: Record<string, unknown>;
  durationMs: number;
}

function formatDirection(dir: string): string {
  if (dir === "bullish") return "BULLISH";
  if (dir === "bearish") return "BEARISH";
  return "NEUTRAL";
}

function formatScore(score: number): string {
  if (score >= 75) return `${score.toFixed(0)}/100 (strong)`;
  if (score >= 60) return `${score.toFixed(0)}/100 (moderate)`;
  return `${score.toFixed(0)}/100 (weak)`;
}

export async function handleChatMessage(userMessage: string): Promise<ChatResponse> {
  const t0 = Date.now();
  const intent = parseIntent(userMessage);

  logAgentEvent("chat_query", `User query: "${userMessage}"`, { intentType: intent.type });

  try {
    switch (intent.type) {
      case "health_check": {
        const health = await runHealthCheck();
        const statusEmoji = health.status === "ok" ? "✓" : health.status === "degraded" ? "⚠" : "✗";
        const lines = [
          `${statusEmoji} System status: ${health.status.toUpperCase()}`,
          `Database: ${health.db}`,
          `Uptime: ${Math.floor(health.uptime / 60)}m ${health.uptime % 60}s`,
          `Scheduler: ${health.scheduler.running ? `running — cycle #${health.scheduler.cycleCount}` : "stopped"}`,
        ];
        if (health.scheduler.nextRunAt) {
          const next = new Date(health.scheduler.nextRunAt);
          const inMs = next.getTime() - Date.now();
          const inMin = Math.max(0, Math.round(inMs / 60000));
          lines.push(`Next training cycle: ~${inMin}m from now`);
        }
        if (health.anomalies.length > 0) {
          lines.push(`Anomalies detected: ${health.anomalies.join("; ")}`);
        }
        return {
          message: lines.join("\n"),
          intent: intent.type,
          data: health as unknown as Record<string, unknown>,
          durationMs: Date.now() - t0,
        };
      }

      case "scheduler_status": {
        const s = getSchedulerStatus();
        const lines = [
          `Scheduler is ${s.running ? "running" : "stopped"}.`,
          `Interval: every ${Math.round(s.intervalMs / 60000)} minutes`,
          `Cycles completed: ${s.cycleCount}`,
          s.lastRunAt ? `Last run: ${new Date(s.lastRunAt).toLocaleString()}` : "Last run: never",
          s.nextRunAt ? `Next run: ${new Date(s.nextRunAt).toLocaleString()}` : "",
        ].filter(Boolean);
        if (s.lastResult) {
          lines.push(
            `Last result: resolved ${s.lastResult.resolved} predictions, ${s.lastResult.improved} agent(s) improved.`,
          );
        }
        return {
          message: lines.join("\n"),
          intent: intent.type,
          data: s as unknown as Record<string, unknown>,
          durationMs: Date.now() - t0,
        };
      }

      case "train": {
        logAgentEvent("training_triggered", "Training cycle triggered via chat");
        const result = await runTrainingCycle();
        logAgentEvent("training_completed", result.message, { resolved: result.resolved, improved: result.improved });
        const lines = [
          `Training cycle complete.`,
          `Resolved predictions: ${result.resolved}`,
          `Agents improved: ${result.improved}`,
          `Accuracy gain: ${(result.accuracyGain * 100).toFixed(2)}%`,
        ];
        if (result.agentUpdates.length > 0) {
          lines.push("Top changes:");
          result.agentUpdates.slice(0, 3).forEach((u) => {
            lines.push(`  ${u.agentType}: ${u.oldReputation.toFixed(3)} → ${u.newReputation.toFixed(3)} (${u.delta > 0 ? "+" : ""}${u.delta.toFixed(4)})`);
          });
        }
        return {
          message: lines.join("\n"),
          intent: intent.type,
          data: result as unknown as Record<string, unknown>,
          durationMs: Date.now() - t0,
        };
      }

      case "run_scan": {
        const scan = await runAutonomousScan();
        const lines = [scan.summary];
        if (scan.alerts.length > 0) {
          lines.push("");
          lines.push("Top signals:");
          scan.alerts.slice(0, 5).forEach((a) => {
            lines.push(`  ${a.symbol} — ${formatDirection(a.direction)} | Score: ${formatScore(a.hivemindScore)} | ${a.urgency.toUpperCase()} urgency`);
          });
        }
        return {
          message: lines.join("\n"),
          intent: intent.type,
          data: scan as unknown as Record<string, unknown>,
          durationMs: Date.now() - t0,
        };
      }

      case "agent_leaderboard": {
        const states = await getAllAgentStates().catch(() => getStaticAgentStates());
        const sorted = [...states].sort((a, b) => b.reputation - a.reputation);
        const lines = ["Agent Leaderboard (by reputation):"];
        sorted.forEach((s, i) => {
          const acc = s.totalRuns > 0 ? ((s.correctRuns / s.totalRuns) * 100).toFixed(0) : "—";
          lines.push(
            `  #${i + 1} ${s.agentType.replace(/_/g, " ")} — rep: ${s.reputation.toFixed(3)}, accuracy: ${acc}%, runs: ${s.totalRuns}`,
          );
        });
        return {
          message: lines.join("\n"),
          intent: intent.type,
          data: { leaderboard: sorted },
          durationMs: Date.now() - t0,
        };
      }

      case "news_summary": {
        const news = await fetchGeopoliticsNews();
        const breaking = news.filter((n) => n.isBreaking).slice(0, 3);
        const top = news.slice(0, 5);
        const lines = [`Latest geopolitical news (${news.length} items):`];
        if (breaking.length > 0) {
          lines.push("BREAKING:");
          breaking.forEach((n) => lines.push(`  [${n.sentiment.toUpperCase()}] ${n.title}`));
          lines.push("");
        }
        lines.push("Top headlines:");
        top.forEach((n) => lines.push(`  [${n.source}] ${n.title}`));
        return {
          message: lines.join("\n"),
          intent: intent.type,
          data: { total: news.length, breaking: breaking.length, items: top },
          durationMs: Date.now() - t0,
        };
      }

      case "market_price": {
        const ticker = await fetchAnyTicker(intent.symbol);
        if (!ticker) {
          return {
            message: `Could not fetch price for ${intent.symbol}. The symbol may not be supported.`,
            intent: intent.type,
            durationMs: Date.now() - t0,
          };
        }
        const changeSign = ticker.change >= 0 ? "+" : "";
        return {
          message: [
            `${ticker.name} (${ticker.symbol})`,
            `Price: $${ticker.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            `Change: ${changeSign}${ticker.changePercent.toFixed(2)}% (${changeSign}$${ticker.change.toFixed(2)})`,
            `Type: ${ticker.type}`,
            `Updated: ${new Date(ticker.updatedAt).toLocaleTimeString()}`,
          ].join("\n"),
          intent: intent.type,
          data: ticker as unknown as Record<string, unknown>,
          durationMs: Date.now() - t0,
        };
      }

      case "lattice_run": {
        const result = await runLattice(intent.symbol, intent.timeframe, intent.useV3);
        const { finalPrediction, causalNarrative, agentConsensus, regime, shap } = result;
        const lines = [
          `Lattice analysis for ${intent.symbol} (${intent.timeframe}):`,
          `Direction: ${formatDirection(finalPrediction.direction)}`,
          `Hivemind Score: ${formatScore(finalPrediction.hivemindScore)}`,
          `Confidence: ${(finalPrediction.confidence * 100).toFixed(0)}%`,
          `Target price: $${finalPrediction.targetPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `Market regime: ${regime}`,
          `Agent consensus: ${(agentConsensus * 100).toFixed(0)}%`,
          `SHAP: Hive ${(shap.hive * 100).toFixed(0)}% | AI ${(shap.ai * 100).toFixed(0)}% | Geo ${(shap.geo * 100).toFixed(0)}%`,
          ``,
          `Narrative: ${causalNarrative}`,
        ];
        if (result.minorityReport) {
          lines.push(``, `Minority report: ${result.minorityReport}`);
        }
        return {
          message: lines.join("\n"),
          intent: intent.type,
          data: {
            runId: result.runId,
            symbol: result.symbol,
            direction: finalPrediction.direction,
            hivemindScore: finalPrediction.hivemindScore,
            confidence: finalPrediction.confidence,
            targetPrice: finalPrediction.targetPrice,
            regime: result.regime,
            agentConsensus: result.agentConsensus,
          },
          durationMs: Date.now() - t0,
        };
      }

      case "belief_history": {
        const rows = await queryBeliefHistory(intent.symbol, 10);
        if (rows.length === 0) {
          return {
            message: `No belief history found for ${intent.symbol}. Run a v3 lattice analysis first.`,
            intent: intent.type,
            durationMs: Date.now() - t0,
          };
        }
        const lines = [`Belief history for ${intent.symbol} (last ${rows.length} sessions):`];
        rows.forEach((r, i) => {
          const shift = r.convictionShift ?? "stable";
          lines.push(`  #${i + 1} ${new Date(r.createdAt).toLocaleDateString()} — ${(r.finalDirection ?? "").toUpperCase()} | Score: ${(r.hivemindScore ?? 0).toFixed(0)} | Shift: ${shift} | δ ${(r.delta ?? 0).toFixed(4)}`);
        });
        return {
          message: lines.join("\n"),
          intent: intent.type,
          data: { symbol: intent.symbol, rows },
          durationMs: Date.now() - t0,
        };
      }

      case "regime": {
        const isCrypto = intent.symbol in CRYPTO_ID_MAP;
        let closes: number[] = [];
        if (isCrypto) {
          const coinId = CRYPTO_ID_MAP[intent.symbol]?.id ?? intent.symbol.toLowerCase();
          const hist = await fetchCryptoHistory(coinId, 30);
          closes = hist.filter((h) => h.close !== null).map((h) => h.close!);
        } else {
          const hist = await fetchStockHistory(intent.symbol, 30);
          closes = hist.filter((h) => h.close !== null).map((h) => h.close!);
        }
        const ctx = detectRegime(closes);
        const desc = describeRegime(ctx.regime, ctx.volatility);
        return {
          message: [
            `Market regime for ${intent.symbol}:`,
            `Regime: ${ctx.regime.toUpperCase()} (score ${ctx.regimeScore.toFixed(2)})`,
            `Volatility: ${(ctx.volatility * 100).toFixed(1)}% annualized`,
            desc,
          ].join("\n"),
          intent: intent.type,
          data: { symbol: intent.symbol, regime: ctx.regime, regimeScore: ctx.regimeScore, volatility: ctx.volatility },
          durationMs: Date.now() - t0,
        };
      }

      default: {
        return {
          message: [
            "I didn't quite catch that. Here's what I can do:",
            "  • Analyze a symbol — e.g. \"What's your outlook on BTC?\"",
            "  • Check market price — e.g. \"Price of NVDA\"",
            "  • Run a full market scan — \"Scan all assets\"",
            "  • Health check — \"Are you healthy?\"",
            "  • Agent leaderboard — \"Show agent rankings\"",
            "  • News summary — \"What's in the news?\"",
            "  • Trigger training — \"Run training cycle\"",
            "  • Belief history — \"Show BTC belief history\"",
            "  • Market regime — \"What regime is ETH in?\"",
          ].join("\n"),
          intent: intent.type,
          durationMs: Date.now() - t0,
        };
      }
    }
  } catch (err) {
    logger.error({ err, intent }, "Chat orchestrator: unhandled error");
    return {
      message: `An error occurred while processing your request. Please try again.`,
      intent: intent.type,
      durationMs: Date.now() - t0,
    };
  }
}
