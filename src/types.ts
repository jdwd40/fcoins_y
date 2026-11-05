// Per-coin price-history windows. The backend's coins.controller validRanges
// include 5M/10M/30M/1H/2H/24H/7D/30D/ALL. User-facing chart selectors are capped at
// ≤12h (coin charts max 2H — BE has no 12H). Longer keys remain on the type
// for BE response compatibility only and must not be offered in UI selectors.
export type TimeRange = '5M' | '10M' | '30M' | '1H' | '2H' | '24H' | '7D' | '30D' | 'ALL';

// POST /users/login request body.
export interface LoginCredentials {
  email: string;
  password: string;
}

// POST /users/register request body.
export interface RegisterCredentials extends LoginCredentials {
  username: string;
}

// User row as the backend sends it: keyed by `user_id`, with NUMERIC columns
// serialised as strings.
export interface BackendUser {
  user_id: number;
  username: string;
  email: string;
  funds: string;
  created_at: string;
  updated_at?: string;
}

// POST /users/login success envelope.
export interface AuthResponse {
  success: boolean;
  msg: string;
  user: BackendUser;
  token: string;
}

// Validated session user, as held in AuthContext and persisted to storage.
export interface User {
  id: number;
  username: string;
  email: string;
  funds: number;
}

// POST /transactions/buy and /transactions/sell request body.
export interface TransactionRequest {
  user_id: number;
  coin_id: number;
  amount: number;
}

// Ledger row returned by the transaction endpoints (NUMERICs as strings).
export interface TransactionRecord {
  transaction_id: number;
  user_id: number;
  coin_id: number;
  type: 'BUY' | 'SELL';
  quantity: string;
  price: string;
  total_amount: string;
  created_at: string;
}

// POST /transactions/buy and /transactions/sell success envelope.
export interface TransactionResponse {
  status: 'success';
  message: string;
  data: TransactionRecord;
}

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
