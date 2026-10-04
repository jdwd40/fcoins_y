// Per-coin price-history windows. The backend's coins.controller validRanges
// include 5M/10M/30M/1H/2H/24H/7D/30D/ALL. User-facing chart selectors are capped at
// ≤12h (coin charts max 2H — BE has no 12H). Longer keys remain on the type
// for BE response compatibility only and must not be offered in UI selectors.
export type TimeRange = '5M' | '10M' | '30M' | '1H' | '2H' | '24H' | '7D' | '30D' | 'ALL';

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

// ============================================================================
// Auth — verified against back_coins_x (models/users.model.js,
// controllers/users.controller.js)
// ============================================================================

// The user as the app holds it after login. The backend row is snake_case
// with a `user_id` primary key; the app normalises that to `id` (consumers
// read `user.id`). No field here is ever invented client-side.
export interface User {
  id: number;         // normalised from the backend's `user_id`
  email: string;
  username?: string;
  funds?: number;     // parsed from the backend NUMERIC string when present
}

// The raw user row the backend sends (snake_case). `funds` is a pg NUMERIC
// and therefore arrives as a STRING (e.g. "1000.00"), not a number.
// Login returns the full row minus password_hash; register returns the
// INSERT ... RETURNING subset (user_id, username, email, funds, created_at).
export interface AuthUser {
  user_id: number;
  username: string;
  email: string;
  funds: string;
  is_bot?: boolean;
  created_at?: string;
  updated_at?: string;
}

// POST /users/login → 200 { success, msg, user, token }.
// (POST /users/register → 201 { success, msg, user } with NO token; the app
// logs in immediately after registering and only ever persists via the
// login envelope.)
export interface AuthResponse {
  success: boolean;
  msg: string;
  user: AuthUser;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

// POST /transactions/buy|sell → 201 { status, message, data } where data is
// the inserted transactions row (RETURNING *). NUMERIC columns arrive as
// strings.
export interface TransactionResponse {
  status: 'success' | 'error';
  message: string;
  data: {
    transaction_id: number;
    user_id: number;
    coin_id: number;
    type: 'BUY' | 'SELL';
    quantity: string;       // pg NUMERIC string
    price: string;          // pg NUMERIC string
    total_amount: string;   // pg NUMERIC string
    created_at: string;     // actual transactions table / RETURNING * field
  };
}
