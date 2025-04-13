export interface Coin {
  coin_id: number;
  name: string;
  symbol: string;
  current_price: string;  // Formatted as GBP (e.g., "£150.00")
  market_cap: string;     // Formatted as GBP (e.g., "£1,000,000.00")
  circulating_supply: number;
  price_change_24h: number;
  founder: string;
}

export interface MarketData {
  coins: Coin[];
  market_stats?: MarketStats;
}

export interface PriceHistoryItem {
  price_history_id: number;
  coin_id: number;
  price: number;
  created_at: string;
  name: string;
  symbol: string;
}

export interface PriceHistoryResponse {
  data: PriceHistoryItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasMore: boolean;
  };
}

export interface MarketEvent {
  type: string;
  timestamp: string;
  data: any;
  effect?: 'POSITIVE' | 'NEGATIVE';
  timeRemaining?: string;
  coinId?: number;
}

export interface MarketStatus {
  status: 'RUNNING' | 'STOPPED';
  events: MarketEvent[];
}

export interface MarketStats {
  currentValue: number;
  allTimeHigh: number;
  allTimeLow: number;
  latestValue: number;
  status: 'RUNNING' | 'STOPPED';
  currentCycle: {
    type: string;
    timeRemaining: string;
  };
}
