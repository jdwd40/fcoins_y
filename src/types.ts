export type TimeRange = '24H' | '7D' | '30D' | 'ALL';

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

export interface PricePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  samples: number;
  complete: boolean;
}

export interface PriceHistoryResponse {
  range: { requested: string; from: string; to: string };
  resolution: string;
  serverTime: string;
  latestValue: number;
  coin: { coin_id: number; symbol: string };
  points: PricePoint[];
}

export interface MarketEvent {
  type: string;
  timestamp: string;
  data: unknown;
  effect?: 'POSITIVE' | 'NEGATIVE';
  timeRemaining?: string;
  coinId?: number;
}

export interface MarketStatus {
  status: 'RUNNING' | 'STOPPED';
  currentCycle?: {
    type: string;
    timeRemaining: string;
    baseEffect?: number;
  } | null;
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
