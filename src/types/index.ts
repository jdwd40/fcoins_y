export interface Coin {
  coin_id: number;
  name: string;
  symbol: string;
  current_price: string | number;
  market_cap: string | number;
  circulating_supply: string | number;
  price_change_24h: string | number;
  date_added: string;
  latest_price: string;
}

export interface MarketStats {
  all_time_high: number;
  all_time_low: number;
  current_market_value: number;
}

export interface MarketData {
  coins: Coin[];
  market_stats: MarketStats;
}

export interface MarketEvent {
  coinId: number;
  type: 'PARTNERSHIP' | 'ADOPTION' | 'RUMOR' | 'REGULATION' | 'SCANDAL';
  timeRemaining: string;
  effect: 'POSITIVE' | 'NEGATIVE';
}

export interface MarketStatus {
  status: 'RUNNING' | 'STOPPED';
  currentCycle: {
    type: 'BOOM' | 'BUST';
    timeRemaining: string;
  };
  events: MarketEvent[];
}

export interface PriceHistory {
  price_history: Array<{
    history_id: number;
    coin_id: number;
    date: string;
    price: string;
    created_at: string;
  }>;
}

export interface User {
  id: number;
  username: string;
  email: string;
  funds: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  username: string;
}

export interface Transaction {
  transaction_id: number;
  user_id: number;
  coin_id: number;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total_amount: number;
  created_at: string;
}

export interface TransactionResponse {
  status: string;
  message: string;
  data: Transaction;
}

export interface PortfolioItem {
  coin_id: number;
  quantity: number;
  average_price: number;
  coin_name?: string;
  coin_symbol?: string;
}

export interface Portfolio {
  portfolio: PortfolioItem[];
}