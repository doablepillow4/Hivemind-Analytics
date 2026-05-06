export type Regime = "calm" | "volatile" | "crisis";
export type Direction = "bullish" | "bearish" | "neutral";

export type AgentType =
  | "hive_polymarket"
  | "hypothesis_momentum"
  | "hypothesis_meanrevert"
  | "hypothesis_volregime"
  | "hypothesis_hive"
  | "critique_devil"
  | "critique_tailrisk"
  | "synthesis"
  | "meta";

export interface BeliefToken {
  id: string;
  agentType: AgentType;
  round: number;
  hypothesis: Direction;
  probability: number;
  confidence: number;
  rationale: string[];
  shapHive: number;
  shapAi: number;
  shapGeo: number;
  liquidityScore: number;
  parentIds: string[];
}

export interface DebateRound {
  round: number;
  agentType: string;
  challenge: string;
  adjustment: number;
  accepted: boolean;
}

export interface ShapBreakdown {
  hive: number;
  ai: number;
  geo: number;
}

export interface LatticePrediction {
  direction: Direction;
  targetPrice: number;
  confidence: number;
  hivemindScore: number;
}

export interface LatticeResult {
  runId: string;
  symbol: string;
  timeframe: string;
  regime: Regime;
  regimeScore: number;
  tokens: BeliefToken[];
  debateRounds: DebateRound[];
  shap: ShapBreakdown;
  finalPrediction: LatticePrediction;
  causalNarrative: string;
  minorityReport: string | null;
  agentConsensus: number;
}

export interface AgentState {
  agentId: string;
  agentType: string;
  reputation: number;
  brierScore: number;
  totalRuns: number;
  correctRuns: number;
}

export interface RegimeStatus {
  symbol: string;
  regime: Regime;
  regimeScore: number;
  volatility: number;
  description: string;
}

export interface RegimeContext {
  regime: Regime;
  regimeScore: number;
  volatility: number;
  closes: number[];
}

export interface HiveSignal {
  probability: number;
  confidence: number;
  liquidityScore: number;
  relevantMarkets: string[];
  geoPressure: number;
}

export interface TechnicalFeatures {
  rsi: number;
  macdHistogram: number;
  bollingerPercentB: number;
  maCross: number;
  momentum5d: number;
  volatility: number;
}
