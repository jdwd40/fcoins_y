// Hand-written types mirroring the coins schema (migrations 00001–00007).
// Regenerate from the live staging schema with the Supabase CLI before
// production cutover; keep this file the authoritative contract until then.

export type TradeSide = 'BUY' | 'SELL';
export type MarketCycle =
  | 'STRONG_BOOM' | 'MILD_BOOM' | 'STRONG_BUST' | 'MILD_BUST' | 'STABLE';

/** coins.public_assets (numeric — never pre-formatted GBP strings) */
export interface PublicAsset {
  id: number;
  legacy_coin_id: number;
  name: string;
  symbol: string;
  current_price: number;
  market_cap: number;
  circulating_supply: number;
  founder: string | null;
  listed_at: string;
  price_change_24h: number | null;
}

/** coins.market_status_view */
export interface MarketStatusView {
  is_running: boolean;
  cycle: MarketCycle;
  cycle_started_at: string;
  cycle_ends_at: string;
  cycle_seconds_remaining: number;
  tick_sequence: number;
  last_tick_at: string | null;
  halted_reason: string | null;
  active_event_count: number;
  active_events: Array<{
    asset_id: number;
    event_type: string;
    event_multiplier: number;
    event_ends_at: string | null;
  }>;
}

/** coins.my_portfolio row */
export interface PortfolioRow {
  asset_id: number;
  name: string;
  symbol: string;
  quantity: number;
  cost_basis: number;
  current_price: number;
  current_value: number;
  unrealized_pl: number;
  cash_balance: number;
  holding_updated_at: string;
}

/** coins.my_trades row */
export interface TradeRow {
  trade_id: number;
  legacy_transaction_id: number | null;
  asset_id: number;
  symbol: string;
  asset_name: string;
  side: TradeSide;
  quantity: number;
  unit_price: number;
  total_amount: number;
  cash_balance_after: number | null;
  holding_quantity_after: number | null;
  executed_at: string;
}

/** coins.wallets row (own wallet only via RLS) */
export interface WalletRow {
  user_id: string;
  cash_balance: number;
  version: number;
}

/** coins.profiles row (own profile only via RLS) */
export interface ProfileRow {
  id: string;
  username: string;
  created_at: string;
  disabled_at: string | null;
}

/** OHLC point returned by history RPCs */
export interface HistoryPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  samples: number;
  complete: boolean;
}

export interface PriceHistoryResult {
  range: string;
  from: string | null;
  to: string;
  server_time: string;
  resolution: string;
  latest: number;
  points: HistoryPoint[];
}

export interface MarketHistoryResult {
  range: string;
  from: string | null;
  to: string;
  server_time: string;
  resolution: string;
  label: 'aggregate_quote_index';
  points: HistoryPoint[];
}

/** buy_coin / sell_coin RPC result */
export interface TradeResult {
  trade_id: number;
  side: TradeSide;
  asset_id: number;
  quantity: number;
  unit_price: number;
  total_amount: number;
  cash_balance_after: number;
  holding_quantity_after: number;
  executed_at: string;
  idempotent_replay: boolean;
}

/** bootstrap_account RPC result */
export interface BootstrapResult {
  profile_id: string;
  username: string;
  created: boolean;
  cash_balance: number;
}

/** Stable error codes raised by coins RPCs (plan §8.3) */
export type CoinsErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'ACCOUNT_NOT_BOOTSTRAPPED'
  | 'INVALID_USERNAME'
  | 'USERNAME_TAKEN'
  | 'INVALID_QUANTITY'
  | 'ASSET_NOT_FOUND'
  | 'MARKET_HALTED'
  | 'INSUFFICIENT_FUNDS'
  | 'INSUFFICIENT_HOLDINGS'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_RANGE'
  | 'SEQUENCE_MISMATCH'
  | 'ARCHIVE_NOT_CONFIRMED'
  | 'UNKNOWN';
