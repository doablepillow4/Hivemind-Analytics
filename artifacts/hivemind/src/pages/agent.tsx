import React, { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bot,
  Send,
  Zap,
  Activity,
  RefreshCw,
  Radar,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Terminal,
  Wifi,
  WifiOff,
  BarChart3,
  Newspaper,
  Award,
  Shield,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  intent?: string;
  durationMs?: number;
}

interface ScanAlert {
  symbol: string;
  direction: "bullish" | "bearish" | "neutral";
  hivemindScore: number;
  confidence: number;
  regime: string;
  reason: string;
  urgency: "high" | "medium" | "low";
}

interface ScanResult {
  scannedAt: string;
  durationMs: number;
  symbolsScanned: number;
  alerts: ScanAlert[];
  summary: string;
}

interface SchedulerStatus {
  running: boolean;
  intervalMs: number;
  cycleCount: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResult: {
    resolved: number;
    improved: number;
    accuracyGain: number;
    message: string;
  } | null;
}

interface HealthSnapshot {
  status: "ok" | "degraded" | "critical";
  db: "ok" | "degraded";
  uptime: number;
  anomalies: string[];
  checkedAt: string;
}

interface AgentEvent {
  id: string;
  type: string;
  timestamp: string;
  message: string;
  data?: Record<string, unknown>;
}

interface AgentStatus {
  health: HealthSnapshot;
  scheduler: SchedulerStatus;
  lastScan: ScanResult | null;
  scanRunning: boolean;
  recentEvents: AgentEvent[];
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchAgentStatus(): Promise<AgentStatus> {
  const res = await fetch("/api/agent/status");
  if (!res.ok) throw new Error("Failed to fetch agent status");
  return res.json();
}

async function postChat(message: string) {
  const res = await fetch("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error("Agent request failed");
  return res.json() as Promise<{ message: string; intent: string; durationMs: number }>;
}

async function postScan() {
  const res = await fetch("/api/agent/scan", { method: "POST" });
  if (!res.ok && res.status !== 409) throw new Error("Scan failed");
  return res.json() as Promise<ScanResult>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: "ok" | "degraded" | "critical" }) {
  const colors = { ok: "bg-green-400", degraded: "bg-yellow-400", critical: "bg-red-400" };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status]} animate-pulse`} />;
}

function UrgencyBadge({ urgency }: { urgency: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-red-500/15 text-red-400 border-red-500/30",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  };
  return (
    <span className={`text-[9px] font-mono tracking-widest border rounded px-1.5 py-0.5 ${styles[urgency]}`}>
      {urgency.toUpperCase()}
    </span>
  );
}

function DirectionIcon({ direction }: { direction: "bullish" | "bearish" | "neutral" }) {
  if (direction === "bullish") return <TrendingUp className="w-3.5 h-3.5 text-green-400" />;
  if (direction === "bearish") return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

function EventTypeIcon({ type }: { type: string }) {
  if (type.includes("scan")) return <Radar className="w-3 h-3 text-primary" />;
  if (type.includes("health")) return <Activity className="w-3 h-3 text-green-400" />;
  if (type.includes("train")) return <Zap className="w-3 h-3 text-yellow-400" />;
  if (type.includes("chat")) return <Terminal className="w-3 h-3 text-blue-400" />;
  if (type.includes("anomaly")) return <AlertTriangle className="w-3 h-3 text-red-400" />;
  return <Activity className="w-3 h-3 text-muted-foreground" />;
}

function SuggestedQuery({ label, icon: Icon, onClick }: { label: string; icon: React.ElementType; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-muted-foreground hover:text-white hover:bg-white/[0.07] transition-all"
    >
      <Icon className="w-3 h-3 text-primary" />
      {label}
    </button>
  );
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isAgent = msg.role === "agent";
  return (
    <div className={`flex flex-col gap-1 ${isAgent ? "items-start" : "items-end"}`}>
      {isAgent && (
        <div className="flex items-center gap-1.5 ml-1">
          <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Bot className="w-3 h-3 text-primary" />
          </div>
          <span className="text-[9px] font-mono text-primary/60 tracking-widest">AGENT</span>
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap ${
          isAgent
            ? "bg-white/[0.05] border border-white/[0.08] text-white/90 rounded-tl-sm"
            : "bg-primary/20 border border-primary/30 text-white rounded-tr-sm"
        }`}
      >
        {msg.content}
      </div>
      <div className="flex items-center gap-2 mx-1">
        <span className="text-[9px] text-muted-foreground/50">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        {msg.durationMs !== undefined && isAgent && (
          <span className="text-[9px] font-mono text-muted-foreground/40">{msg.durationMs}ms</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      content:
        "Hivemind Agent online. I can analyze assets, scan markets, check system health, summarize news, and more.\n\nTry: \"What's your outlook on BTC?\" or \"Scan all assets\"",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "status" | "scan">("chat");
  const [showEvents, setShowEvents] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const statusQuery = useQuery({
    queryKey: ["agent-status"],
    queryFn: fetchAgentStatus,
    refetchInterval: 15_000,
  });

  const chatMutation = useMutation({
    mutationFn: (msg: string) => postChat(msg),
    onSuccess: (data, variables) => {
      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        content: data.message,
        timestamp: new Date().toISOString(),
        intent: data.intent,
        durationMs: data.durationMs,
      };
      setMessages((prev) => [...prev, agentMsg]);
    },
    onError: () => {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "agent",
        content: "Something went wrong processing your request. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    },
  });

  const scanMutation = useMutation({
    mutationFn: postScan,
    onSuccess: () => {
      statusQuery.refetch();
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || chatMutation.isPending) return;
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      chatMutation.mutate(content);
    },
    [input, chatMutation],
  );

  const suggestions = [
    { label: "BTC outlook", icon: BarChart3, q: "What's your outlook on BTC for the next 7 days?" },
    { label: "Scan markets", icon: Radar, q: "Scan all assets" },
    { label: "System health", icon: Shield, q: "Health check" },
    { label: "Top news", icon: Newspaper, q: "What's in the news?" },
    { label: "Agent ranking", icon: Award, q: "Show agent leaderboard" },
    { label: "NVDA analysis", icon: TrendingUp, q: "Analyze NVDA with v3" },
  ];

  const status = statusQuery.data;
  const health = status?.health;
  const scheduler = status?.scheduler;
  const lastScan = scanMutation.data ?? status?.lastScan;
  const events = status?.recentEvents ?? [];

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md" />
            <div className="relative w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight text-white">Hivemind Agent</h1>
            <p className="text-[10px] text-muted-foreground font-mono">Autonomous backend controller</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {health ? (
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 border text-[10px] font-mono ${
              health.status === "ok"
                ? "bg-green-500/8 border-green-500/20 text-green-400"
                : health.status === "degraded"
                ? "bg-yellow-500/8 border-yellow-500/20 text-yellow-400"
                : "bg-red-500/8 border-red-500/20 text-red-400"
            }`}>
              <StatusDot status={health.status} />
              {health.status.toUpperCase()}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-full px-2.5 py-1">
              <WifiOff className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground">CONNECTING</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5">
        {(["chat", "status", "scan"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[11px] font-semibold tracking-wider uppercase rounded-lg transition-all duration-200 ${
              activeTab === tab
                ? "bg-primary/15 text-primary border border-primary/25"
                : "text-muted-foreground hover:text-white/70"
            }`}
          >
            {tab === "chat" ? "Chat" : tab === "status" ? "Status" : "Scanner"}
          </button>
        ))}
      </div>

      {/* ── CHAT TAB ── */}
      {activeTab === "chat" && (
        <div className="flex flex-col gap-3">
          {/* Messages */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 flex flex-col gap-4 min-h-[320px] max-h-[420px] overflow-y-auto">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
            {chatMutation.isPending && (
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested queries */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <SuggestedQuery
                  key={s.label}
                  label={s.label}
                  icon={s.icon}
                  onClick={() => sendMessage(s.q)}
                />
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask the agent anything…"
              disabled={chatMutation.isPending}
              className="flex-1 bg-white/[0.04] border border-white/[0.10] rounded-xl px-4 py-3 text-[13px] text-white placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:bg-white/[0.06] transition-all disabled:opacity-50"
            />
            <Button
              onClick={() => sendMessage()}
              disabled={chatMutation.isPending || !input.trim()}
              className="rounded-xl bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 disabled:opacity-40 px-4"
              variant="ghost"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STATUS TAB ── */}
      {activeTab === "status" && (
        <div className="flex flex-col gap-3">
          {statusQuery.isLoading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading status…
            </div>
          ) : health ? (
            <>
              {/* Health grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-[10px] text-muted-foreground font-mono tracking-widest mb-2">SYSTEM</div>
                  <div className="flex items-center gap-2">
                    <StatusDot status={health.status} />
                    <span className="text-[15px] font-bold text-white capitalize">{health.status}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5">
                    DB: <span className={health.db === "ok" ? "text-green-400" : "text-red-400"}>{health.db}</span>
                  </div>
                </div>

                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-[10px] text-muted-foreground font-mono tracking-widest mb-2">UPTIME</div>
                  <div className="text-[15px] font-bold text-white">
                    {Math.floor((health.uptime ?? 0) / 3600)}h {Math.floor(((health.uptime ?? 0) % 3600) / 60)}m
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5">{(health.uptime ?? 0) % 60}s</div>
                </div>

                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-[10px] text-muted-foreground font-mono tracking-widest mb-2">SCHEDULER</div>
                  <div className="flex items-center gap-2">
                    {scheduler?.running ? (
                      <Wifi className="w-4 h-4 text-green-400" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-[15px] font-bold text-white">
                      {scheduler?.running ? "Active" : "Stopped"}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5">
                    Cycle #{scheduler?.cycleCount ?? 0}
                  </div>
                </div>

                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-[10px] text-muted-foreground font-mono tracking-widest mb-2">NEXT TRAIN</div>
                  <div className="text-[15px] font-bold text-white">
                    {scheduler?.nextRunAt
                      ? `${Math.max(0, Math.round((new Date(scheduler.nextRunAt).getTime() - Date.now()) / 60000))}m`
                      : "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5">
                    Every {Math.round((scheduler?.intervalMs ?? 900000) / 60000)}m
                  </div>
                </div>
              </div>

              {/* Last training result */}
              {scheduler?.lastResult && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-[10px] text-muted-foreground font-mono tracking-widest mb-3">LAST TRAINING CYCLE</div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-[18px] font-bold text-white">{scheduler.lastResult.resolved}</div>
                      <div className="text-[10px] text-muted-foreground">Resolved</div>
                    </div>
                    <div>
                      <div className="text-[18px] font-bold text-green-400">{scheduler.lastResult.improved}</div>
                      <div className="text-[10px] text-muted-foreground">Improved</div>
                    </div>
                    <div>
                      <div className="text-[18px] font-bold text-primary">
                        {(scheduler.lastResult.accuracyGain * 100).toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-muted-foreground">Accuracy Δ</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Anomalies */}
              {health.anomalies.length > 0 && (
                <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-[11px] font-semibold text-red-400 tracking-wider">ANOMALIES DETECTED</span>
                  </div>
                  {health.anomalies.map((a, i) => (
                    <div key={i} className="text-[12px] text-red-300/80 mt-1">• {a}</div>
                  ))}
                </div>
              )}

              {/* Event log */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl">
                <button
                  onClick={() => setShowEvents(!showEvents)}
                  className="w-full flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-primary" />
                    <span className="text-[12px] font-semibold text-white">Agent Event Log</span>
                    <span className="text-[10px] font-mono text-muted-foreground">({events.length})</span>
                  </div>
                  {showEvents ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {showEvents && (
                  <div className="border-t border-white/[0.06] px-4 pb-4 max-h-64 overflow-y-auto">
                    {events.length === 0 ? (
                      <div className="text-[12px] text-muted-foreground py-4 text-center">No events yet</div>
                    ) : (
                      <div className="flex flex-col gap-2 pt-3">
                        {events.map((ev) => (
                          <div key={ev.id} className="flex items-start gap-2">
                            <EventTypeIcon type={ev.type} />
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] text-white/80 leading-snug">{ev.message}</div>
                              <div className="text-[9px] font-mono text-muted-foreground/50 mt-0.5">
                                {new Date(ev.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button
                onClick={() => statusQuery.refetch()}
                variant="ghost"
                className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:text-white hover:bg-white/[0.07] text-[12px]"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </>
          ) : (
            <div className="text-muted-foreground text-sm text-center py-12">Failed to load status</div>
          )}
        </div>
      )}

      {/* ── SCAN TAB ── */}
      {activeTab === "scan" && (
        <div className="flex flex-col gap-3">
          {/* Trigger */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-lg bg-primary/20 blur-sm" />
                <div className="relative w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Radar className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div>
                <div className="text-[13px] font-bold text-white">Autonomous Market Scanner</div>
                <div className="text-[11px] text-muted-foreground">Runs Lattice on all priority assets</div>
              </div>
            </div>
            <Button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending || status?.scanRunning}
              className="w-full rounded-xl bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 disabled:opacity-50 font-semibold"
              variant="ghost"
            >
              {scanMutation.isPending || status?.scanRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Scanning markets…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Full Scan
                </>
              )}
            </Button>
          </div>

          {/* Scan result */}
          {lastScan && (
            <>
              {/* Summary card */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] text-muted-foreground font-mono tracking-widest">LAST SCAN</div>
                  <div className="text-[10px] font-mono text-muted-foreground/60">
                    {new Date(lastScan.scannedAt).toLocaleTimeString()} · {lastScan.durationMs}ms
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center mb-4">
                  <div>
                    <div className="text-[18px] font-bold text-white">{lastScan.symbolsScanned}</div>
                    <div className="text-[10px] text-muted-foreground">Scanned</div>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold text-primary">{lastScan.alerts.length}</div>
                    <div className="text-[10px] text-muted-foreground">Signals</div>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold text-red-400">
                      {lastScan.alerts.filter((a) => a.urgency === "high").length}
                    </div>
                    <div className="text-[10px] text-muted-foreground">High urgency</div>
                  </div>
                </div>
                <div className="text-[12px] text-muted-foreground leading-snug">{lastScan.summary}</div>
              </div>

              {/* Alerts list */}
              {lastScan.alerts.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] text-muted-foreground font-mono tracking-widest px-1">SIGNALS</div>
                  {lastScan.alerts.map((alert, i) => (
                    <div
                      key={i}
                      className={`bg-white/[0.03] border rounded-xl p-4 ${
                        alert.urgency === "high"
                          ? "border-red-500/25"
                          : alert.urgency === "medium"
                          ? "border-yellow-500/20"
                          : "border-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <DirectionIcon direction={alert.direction} />
                          <span className="text-[14px] font-bold text-white">{alert.symbol}</span>
                          <span
                            className={`text-[11px] font-semibold ${
                              alert.direction === "bullish"
                                ? "text-green-400"
                                : alert.direction === "bearish"
                                ? "text-red-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {alert.direction.toUpperCase()}
                          </span>
                        </div>
                        <UrgencyBadge urgency={alert.urgency} />
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-[11px] text-muted-foreground">
                          Score: <span className="text-white font-semibold">{alert.hivemindScore.toFixed(0)}/100</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Confidence: <span className="text-white font-semibold">{(alert.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground capitalize">
                          Regime: <span className="text-white font-semibold">{alert.regime}</span>
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-snug">{alert.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!lastScan && !scanMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Radar className="w-6 h-6 text-primary/60" />
              </div>
              <div className="text-[13px] text-muted-foreground text-center">
                No scan data yet.<br />Hit "Run Full Scan" to analyze all priority assets.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
