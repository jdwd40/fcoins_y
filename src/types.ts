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

export interface PriceHistory {
  history: {
    price: string;  // Formatted as GBP
    timestamp: string;  // ISO date string
    price_change_percentage: number;
  }[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export interface MarketEvent {
  type: string;
  timestamp: string;
  data: any;
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
