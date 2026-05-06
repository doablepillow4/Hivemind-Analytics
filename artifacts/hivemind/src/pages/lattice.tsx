import React, { useState } from "react";
import {
  useRunLattice,
  useGetLatticeAgents,
  getGetLatticeAgentsQueryKey,
} from "@workspace/api-client-react";
import type { LatticeResult, BeliefToken } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, Zap, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, AlertTriangle, Shield, Activity } from "lucide-react";

const SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "SPY"];

const AGENT_LABELS: Record<string, string> = {
  hive_polymarket: "Hive (Polymarket)",
  hypothesis_momentum: "Momentum Agent",
  hypothesis_meanrevert: "Mean Reversion Agent",
  hypothesis_volregime: "Vol-Regime Agent",
  hypothesis_hive: "Hive Wisdom Agent",
  critique_devil: "Devil's Advocate",
  critique_tailrisk: "Tail Risk Agent",
  synthesis: "Synthesis Agent",
  meta: "Meta Agent",
};

const AGENT_COLORS: Record<string, string> = {
  hive_polymarket: "text-purple-400",
  hypothesis_momentum: "text-blue-400",
  hypothesis_meanrevert: "text-cyan-400",
  hypothesis_volregime: "text-indigo-400",
  hypothesis_hive: "text-violet-400",
  critique_devil: "text-orange-400",
  critique_tailrisk: "text-red-400",
  synthesis: "text-primary",
  meta: "text-yellow-400",
};

function RegimeBadge({ regime, score }: { regime: string; score: number }) {
  const colors = {
    calm: "bg-green-500/15 text-green-400 border-green-500/30",
    volatile: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    crisis: "bg-red-500/15 text-red-400 border-red-500/30",
  }[regime] ?? "bg-white/5 text-white border-white/10";
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colors} uppercase tracking-widest`}>
      {regime} · {(score * 100).toFixed(0)}
    </span>
  );
}

function DirectionIcon({ dir }: { dir: string }) {
  if (dir === "bullish") return <TrendingUp className="w-4 h-4 text-green-400" />;
  if (dir === "bearish") return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-yellow-400" />;
}

function HivemindGauge({ score }: { score: number }) {
  const color = score >= 65 ? "#4ade80" : score >= 40 ? "#f59e0b" : "#f87171";
  const pct = score / 100;
  const circ = 2 * Math.PI * 36;
  const dash = circ * pct;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="36" fill="none" stroke="#ffffff10" strokeWidth="8" />
        <circle
          cx="48" cy="48" r="36" fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
        <text x="48" y="52" textAnchor="middle" fontSize="20" fontWeight="bold" fill="white" fontFamily="monospace">
          {score.toFixed(0)}
        </text>
      </svg>
      <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Hivemind Score</span>
    </div>
  );
}

function ShapBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-white font-mono">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function TokenCard({ token }: { token: BeliefToken }) {
  const [open, setOpen] = useState(false);
  const label = AGENT_LABELS[token.agentType] ?? token.agentType;
  const colorClass = AGENT_COLORS[token.agentType] ?? "text-white";
  const dir = token.hypothesis;
  const dirColor = dir === "bullish" ? "text-green-400" : dir === "bearish" ? "text-red-400" : "text-yellow-400";

  return (
    <div className="bg-black/20 rounded border border-white/5 p-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[11px] font-semibold ${colorClass} shrink-0`}>R{token.round}</span>
          <span className="text-[11px] text-white truncate">{label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] font-mono ${dirColor}`}>{(token.probability * 100).toFixed(0)}%</span>
          <span className={`text-[10px] uppercase ${dirColor}`}>{dir}</span>
          {open ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
          {token.rationale.map((r, i) => (
            <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">{r}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function LatticeResultView({ result }: { result: LatticeResult }) {
  const [showTokens, setShowTokens] = useState(false);
  const { finalPrediction, shap, debateRounds, causalNarrative, minorityReport, agentConsensus, tokens, regime, regimeScore } = result;

  const priceChange = (
    (finalPrediction.direction === "bullish" ? 1 : finalPrediction.direction === "bearish" ? -1 : 0) *
    Math.abs(finalPrediction.targetPrice - (tokens.find(t => t.agentType === "meta")?.probability ?? 0.5)) /
    finalPrediction.targetPrice * 100
  );

  return (
    <div className="space-y-4">
      {/* Main result card */}
      <Card className="bg-card/50 border-white/5">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <RegimeBadge regime={regime} score={regimeScore} />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <DirectionIcon dir={finalPrediction.direction} />
                <span className={`text-lg font-bold ${finalPrediction.direction === "bullish" ? "text-green-400" : finalPrediction.direction === "bearish" ? "text-red-400" : "text-yellow-400"}`}>
                  {finalPrediction.direction.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Target: <span className="text-white font-mono">${finalPrediction.targetPrice.toFixed(2)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Confidence: <span className="text-white font-mono">{(finalPrediction.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Agent consensus: <span className="text-primary font-mono">{(agentConsensus * 100).toFixed(0)}%</span>
              </div>
            </div>
            <HivemindGauge score={finalPrediction.hivemindScore} />
          </div>
        </CardContent>
      </Card>

      {/* SHAP Attribution */}
      <Card className="bg-card/50 border-white/5">
        <CardContent className="p-4 space-y-3">
          <div className="text-xs font-semibold text-white mb-2">Signal Attribution (SHAP)</div>
          <ShapBar label="🐝 Hive (Polymarket)" value={shap.hive} color="bg-purple-500" />
          <ShapBar label="🤖 AI Ensemble" value={shap.ai} color="bg-primary" />
          <ShapBar label="🌍 Geopolitical" value={shap.geo} color="bg-orange-500" />
        </CardContent>
      </Card>

      {/* Minority Report */}
      {minorityReport && (
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-orange-400 mb-1">Minority Report</div>
                <p className="text-[11px] text-orange-200 leading-relaxed">{minorityReport}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debate Rounds */}
      <Card className="bg-card/50 border-white/5">
        <CardContent className="p-4">
          <div className="text-xs font-semibold text-white mb-3">Debate Rounds</div>
          <div className="space-y-3">
            {debateRounds.map((round, i) => (
              <div key={i} className="border-l-2 border-white/10 pl-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] font-medium ${AGENT_COLORS[round.agentType] ?? "text-white"}`}>
                    Round {round.round} — {AGENT_LABELS[round.agentType] ?? round.agentType}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-mono ${round.adjustment < 0 ? "text-red-400" : "text-green-400"}`}>
                      {round.adjustment >= 0 ? "+" : ""}{(round.adjustment * 100).toFixed(1)}%
                    </span>
                    {round.accepted ? (
                      <span className="text-[9px] bg-red-500/10 text-red-400 px-1 rounded">ACCEPTED</span>
                    ) : (
                      <span className="text-[9px] bg-white/5 text-muted-foreground px-1 rounded">REJECTED</span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{round.challenge}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Causal Narrative */}
      <Card className="bg-card/50 border-white/5">
        <CardContent className="p-4">
          <div className="text-xs font-semibold text-white mb-2">Causal Narrative</div>
          <div className="space-y-2">
            {causalNarrative.split("\n").filter(l => l.trim()).map((line, i) => (
              <p key={i} className={`text-[11px] leading-relaxed ${line.startsWith("HPL") ? "text-primary font-medium" : line.startsWith("Market Regime") || line.startsWith("Signal") || line.startsWith("Price Target") ? "text-white font-medium" : "text-muted-foreground"}`}>
                {line}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Belief Token DAG */}
      <Card className="bg-card/50 border-white/5">
        <CardContent className="p-4">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setShowTokens(o => !o)}
          >
            <div className="text-xs font-semibold text-white">Belief Token DAG ({tokens.length} nodes)</div>
            {showTokens ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showTokens && (
            <div className="mt-3 space-y-2">
              {tokens.map((token) => (
                <TokenCard key={token.id} token={token} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Lattice() {
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("7d");
  const runLattice = useRunLattice();
  const { data: agents } = useGetLatticeAgents({
    query: { queryKey: getGetLatticeAgentsQueryKey() },
  });

  const result = runLattice.data;
  const agentList = Array.isArray(agents) ? agents : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Predictive Lattice</h1>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <Network className="w-3 h-3 text-primary" />
          HPL-HPA v2 · Multi-agent intelligence engine
        </p>
      </div>

      {/* Run controls */}
      <Card className="bg-card/50 border-white/5">
        <CardContent className="p-4 space-y-3">
          <div className="text-xs font-semibold text-white">Configure Lattice Run</div>
          <div className="flex gap-2">
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="flex-1 bg-background border-white/10 h-9 text-sm">
                <SelectValue placeholder="Symbol" />
              </SelectTrigger>
              <SelectContent>
                {SYMBOLS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-24 bg-background border-white/10 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">1 Day</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full gap-2"
            onClick={() => { if (symbol) runLattice.mutate({ data: { symbol, timeframe } }); }}
            disabled={!symbol || runLattice.isPending}
          >
            {runLattice.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Running 6 agents · 2 debate rounds…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Run HPL Lattice
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && <LatticeResultView result={result} />}

      {/* Agent reputation panel */}
      {agentList.length > 0 && (
        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <div className="text-xs font-semibold text-white">Agent Reputation</div>
            </div>
            <div className="space-y-2">
              {agentList.map((agent) => (
                <div key={agent.agentId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Activity className={`w-3 h-3 shrink-0 ${AGENT_COLORS[agent.agentType] ?? "text-white"}`} />
                    <span className="text-[11px] text-muted-foreground truncate">
                      {AGENT_LABELS[agent.agentType] ?? agent.agentType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-white">{agent.reputation.toFixed(2)}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {agent.totalRuns > 0 ? `${agent.correctRuns}/${agent.totalRuns}` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
