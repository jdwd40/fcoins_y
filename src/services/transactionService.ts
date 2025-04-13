import type { TransactionResponse } from '../types';

const API_BASE_URL = 'https://jdwd40.com/api-2/api';

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
    
    const data = await response.json();
    console.log('Buy response data:', data);

    if (!response.ok) {
      // Try to extract the error message from the response
      const errorMessage = data.msg || data.message || 'Failed to complete purchase';
      throw new Error(errorMessage);
    }

    return data;
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
  const response = await fetch(`${API_BASE_URL}/transactions/sell`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      user_id: userId,
      coin_id: coinId,
      amount
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to complete sale');
  }

  return data;
}

export async function getUserPortfolio(userId: number, token: string) {
  const response = await fetch(`${API_BASE_URL}/portfolio/${userId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch portfolio');
  }

  return data;
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
