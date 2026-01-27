import type { TransactionResponse } from '../types';

const API_BASE_URL = 'https://jdwd40.com/api-2/api';

// Custom error class for session expired errors
export class SessionExpiredError extends Error {
  constructor(message: string = 'Your session has expired. Please log in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

// Helper to handle API responses with 401 checking
async function handleApiResponse<T>(response: Response, errorPrefix: string): Promise<T> {
  const data = await response.json();
  
  if (response.status === 401) {
    console.log('Received 401 Unauthorized response');
    throw new SessionExpiredError();
  }
  
  if (!response.ok) {
    const errorMessage = data.msg || data.message || `${errorPrefix}`;
    throw new Error(errorMessage);
  }
  
  return data;
}

export async function buyCoins(
  userId: number,
  coinId: number,
  amount: number,
  token: string
): Promise<TransactionResponse> {
  // Log all parameters to help debug
  console.log('Buy request parameters:', {
    userId: userId,
    coinId: coinId,
    amount: amount,
    userIdType: typeof userId,
    coinIdType: typeof coinId,
    amountType: typeof amount
  });
  
  // Validate parameters before sending
  if (!userId || isNaN(Number(userId))) {
    throw new Error('Invalid user ID');
  }
  
  if (!coinId || isNaN(Number(coinId))) {
    throw new Error('Invalid coin ID');
  }
  
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new Error('Amount must be greater than 0');
  }
  
  // Ensure all values are proper numbers
  const numericUserId = Number(userId);
  const numericCoinId = Number(coinId);
  const numericAmount = Number(amount);
  
  // Format the request payload exactly as the API expects it
  const requestPayload = {
    user_id: numericUserId,
    coin_id: numericCoinId,
    amount: numericAmount
  };
  
  console.log('Buy request payload:', requestPayload);
  console.log('Authorization header:', `Bearer ${token.substring(0, 10)}...`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/transactions/buy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestPayload)
    });

    // Log the raw response
    console.log('Buy response status:', response.status, response.statusText);
    
    return await handleApiResponse<TransactionResponse>(response, 'Failed to complete purchase');
  } catch (error) {
    console.error('Buy request error:', error);
    throw error;
  }
}

export async function sellCoins(
  userId: number,
  coinId: number,
  amount: number,
  token: string
): Promise<TransactionResponse> {
  // Validate parameters before sending
  if (!userId || isNaN(Number(userId))) {
    throw new Error('Invalid user ID');
  }
  
  if (!coinId || isNaN(Number(coinId))) {
    throw new Error('Invalid coin ID');
  }
  
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const numericUserId = Number(userId);
  const numericCoinId = Number(coinId);
  const numericAmount = Number(amount);

  console.log('Sell request payload:', { user_id: numericUserId, coin_id: numericCoinId, amount: numericAmount });

  try {
    const response = await fetch(`${API_BASE_URL}/transactions/sell`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: numericUserId,
        coin_id: numericCoinId,
        amount: numericAmount
      })
    });

    console.log('Sell response status:', response.status, response.statusText);
    
    return await handleApiResponse<TransactionResponse>(response, 'Failed to complete sale');
  } catch (error) {
    console.error('Sell request error:', error);
    throw error;
  }
}

// Raw API response format
interface RawPortfolioItem {
  coin_id: number;
  name: string;
  symbol: string;
  current_price: string;
  total_amount: string;
  total_invested: string;
}

// Normalized portfolio item for the app
export interface PortfolioItem {
  portfolio_id: number;
  user_id: number;
  coin_id: number;
  coin_name: string;
  coin_symbol: string;
  quantity: number;
  average_purchase_price: number;
  current_price: number;
  total_value: number;
  profit_loss: number;
  profit_loss_percentage: number;
}

// Helper to normalize portfolio item from API response
function normalizePortfolioItem(raw: RawPortfolioItem, index: number): PortfolioItem {
  const quantity = Number(raw.total_amount) || 0;
  const totalInvested = Number(raw.total_invested) || 0;
  const currentPrice = Number(raw.current_price) || 0;
  const averagePrice = quantity > 0 ? totalInvested / quantity : 0;
  const totalValue = quantity * currentPrice;
  const profitLoss = totalValue - totalInvested;
  const profitLossPercentage = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

  return {
    portfolio_id: index + 1,  // Generate a unique ID based on index
    user_id: 0,  // Not provided by API
    coin_id: raw.coin_id,
    coin_name: raw.name,
    coin_symbol: raw.symbol,
    quantity,
    average_purchase_price: averagePrice,
    current_price: currentPrice,
    total_value: totalValue,
    profit_loss: profitLoss,
    profit_loss_percentage: profitLossPercentage
  };
}

export interface PortfolioResponse {
  portfolio: PortfolioItem[];
  user_funds: number;
}

export async function getUserPortfolio(userId: number, token: string): Promise<PortfolioResponse> {
  console.log('Fetching portfolio for user:', userId);
  
  try {
    const response = await fetch(`${API_BASE_URL}/transactions/portfolio/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Portfolio response status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('Portfolio raw response data:', JSON.stringify(data, null, 2));
    
    if (response.status === 401) {
      console.log('Received 401 Unauthorized response');
      throw new SessionExpiredError();
    }
    
    if (!response.ok) {
      const errorMessage = data.msg || data.message || 'Failed to fetch portfolio';
      throw new Error(errorMessage);
    }
    
    // Normalize portfolio items from API format to app format
    const normalizedPortfolio: PortfolioItem[] = (data.portfolio || []).map(
      (item: RawPortfolioItem, index: number) => normalizePortfolioItem(item, index)
    );
    
    console.log('Normalized portfolio:', normalizedPortfolio);
    
    return {
      portfolio: normalizedPortfolio,
      user_funds: Number(data.user_funds) || 0
    };
  } catch (error) {
    console.error('Portfolio fetch error:', error);
    throw error;
  }
}

export interface TransactionHistoryItem {
  transaction_id: number;
  user_id: number;
  coin_id: number;
  coin_name: string;
  coin_symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price_at_transaction: number;
  total_amount: number;
  created_at: string;
}

export interface TransactionsResponse {
  transactions: TransactionHistoryItem[];
}

export async function getUserTransactions(userId: number, token: string): Promise<TransactionsResponse> {
  console.log('Fetching transactions for user:', userId);
  
  try {
    const response = await fetch(`${API_BASE_URL}/transactions/user/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Transactions response status:', response.status, response.statusText);
    
    return await handleApiResponse<TransactionsResponse>(response, 'Failed to fetch transactions');
  } catch (error) {
    console.error('Transactions fetch error:', error);
    throw error;
  }
}

export function formatCurrency(value: number) {
  return value.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parsePrice(price: string | number): number {
  if (typeof price === 'string') {
    // Remove any existing currency symbols and spaces
    const cleanPrice = price.replace(/[£\s]/g, '');
    return parseFloat(cleanPrice);
  }
  return price;
}
