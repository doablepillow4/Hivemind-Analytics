import { STOCK_SYMBOL_LIST, CRYPTO_ID_MAP } from "../market-data";

export type AgentIntent =
  | { type: "lattice_run"; symbol: string; timeframe: string; useV3: boolean }
  | { type: "market_price"; symbol: string }
  | { type: "health_check" }
  | { type: "news_summary" }
  | { type: "scheduler_status" }
  | { type: "agent_leaderboard" }
  | { type: "run_scan" }
  | { type: "train" }
  | { type: "belief_history"; symbol: string }
  | { type: "regime"; symbol: string }
  | { type: "unknown"; raw: string };

const ALL_SYMBOLS = [
  ...STOCK_SYMBOL_LIST,
  ...Object.keys(CRYPTO_ID_MAP),
];

function extractSymbol(text: string): string | null {
  const upper = text.toUpperCase();
  for (const sym of ALL_SYMBOLS) {
    const re = new RegExp(`\\b${sym}\\b`);
    if (re.test(upper)) return sym;
  }
  const coinNames: Record<string, string> = {
    BITCOIN: "BTC", BTC: "BTC",
    ETHEREUM: "ETH", ETH: "ETH",
    SOLANA: "SOL", SOL: "SOL",
    DOGECOIN: "DOGE", DOGE: "DOGE",
    CARDANO: "ADA", ADA: "ADA",
    RIPPLE: "XRP", XRP: "XRP",
    NVIDIA: "NVDA", NVDA: "NVDA",
    TESLA: "TSLA", TSLA: "TSLA",
    APPLE: "AAPL", AAPL: "AAPL",
    AMAZON: "AMZN", AMZN: "AMZN",
    MICROSOFT: "MSFT", MSFT: "MSFT",
    GOOGLE: "GOOGL", ALPHABET: "GOOGL",
    META: "META", FACEBOOK: "META",
  };
  for (const [name, sym] of Object.entries(coinNames)) {
    if (upper.includes(name)) return sym;
  }
  return null;
}

function extractTimeframe(text: string): string {
  const lower = text.toLowerCase();
  if (/\b1\s*d(ay)?\b|today|24h/.test(lower)) return "1d";
  if (/\b7\s*d(ay)?\b|week|weekly/.test(lower)) return "7d";
  if (/\b30\s*d(ay)?\b|month|monthly/.test(lower)) return "30d";
  if (/\b90\s*d(ay)?\b|quarter/.test(lower)) return "90d";
  return "7d";
}

export function parseIntent(message: string): AgentIntent {
  const lower = message.toLowerCase().trim();

  // Health
  if (/\b(health|status|up|alive|ping|ok|operational)\b/.test(lower)) {
    return { type: "health_check" };
  }

  // Scheduler status
  if (/\b(scheduler|schedule|cron|interval|next run|last run|training schedule)\b/.test(lower) &&
      !/\b(trigger|run|start|force)\b/.test(lower)) {
    return { type: "scheduler_status" };
  }

  // Trigger training
  if (/\b(train|training cycle|retrain|run training|force train)\b/.test(lower)) {
    return { type: "train" };
  }

  // Full scan
  if (/\b(scan|full scan|scan all|analyze all|sweep|scan market)\b/.test(lower)) {
    return { type: "run_scan" };
  }

  // Leaderboard / agent reputation
  if (/\b(leaderboard|reputation|top agent|best agent|agent rank|agent score|agent performance)\b/.test(lower)) {
    return { type: "agent_leaderboard" };
  }

  // News
  if (/\b(news|headlines|geopolit|breaking|world news|latest news)\b/.test(lower)) {
    return { type: "news_summary" };
  }

  // Belief history
  if (/\b(belief|conviction|history|trend|session)\b/.test(lower)) {
    const symbol = extractSymbol(lower);
    if (symbol) return { type: "belief_history", symbol };
  }

  // Regime
  if (/\b(regime|market regime|volatility regime|calm|volatile|crisis)\b/.test(lower)) {
    const symbol = extractSymbol(lower);
    if (symbol) return { type: "regime", symbol };
  }

  // Price / quote
  if (/\b(price|quote|worth|trading at|current price|how much|value)\b/.test(lower)) {
    const symbol = extractSymbol(lower);
    if (symbol) return { type: "market_price", symbol };
  }

  // Lattice run — prediction, analyse, outlook etc.
  if (/\b(predict|prediction|analyze|analyse|outlook|run lattice|lattice|forecast|signal|buy|sell|hold)\b/.test(lower)) {
    const symbol = extractSymbol(lower);
    const timeframe = extractTimeframe(lower);
    const useV3 = /\bv3\b/.test(lower);
    if (symbol) return { type: "lattice_run", symbol, timeframe, useV3 };
  }

  // Fallback: if a symbol is mentioned with no clear intent, default to lattice run
  const sym = extractSymbol(lower);
  if (sym) {
    return { type: "lattice_run", symbol: sym, timeframe: extractTimeframe(lower), useV3: false };
  }

  return { type: "unknown", raw: message };
}
