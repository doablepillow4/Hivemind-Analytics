import { create } from "zustand";

export interface SelectedAsset {
  symbol: string;
  name?: string;
  price?: number;
}

interface AppStore {
  selectedAsset: SelectedAsset | null;
  setSelectedAsset: (asset: SelectedAsset | null) => void;

  lastLatticeSymbol: string;
  lastLatticeQuestion: string;
  setLastLatticeQuery: (symbol: string, question: string) => void;

  agentUpvotes: Record<string, number>;
  upvoteAgent: (agentType: string) => void;
  resetUpvotes: () => void;

  lastPredictionSymbol: string;
  setLastPredictionSymbol: (symbol: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  selectedAsset: null,
  setSelectedAsset: (asset) => set({ selectedAsset: asset }),

  lastLatticeSymbol: "",
  lastLatticeQuestion: "",
  setLastLatticeQuery: (symbol, question) =>
    set({ lastLatticeSymbol: symbol, lastLatticeQuestion: question }),

  agentUpvotes: {},
  upvoteAgent: (agentType) =>
    set((state) => ({
      agentUpvotes: {
        ...state.agentUpvotes,
        [agentType]: (state.agentUpvotes[agentType] ?? 0) + 1,
      },
    })),
  resetUpvotes: () => set({ agentUpvotes: {} }),

  lastPredictionSymbol: "",
  setLastPredictionSymbol: (symbol) => set({ lastPredictionSymbol: symbol }),
}));
