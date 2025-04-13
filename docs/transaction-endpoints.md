# Transaction API Endpoints Documentation

## Buy Transaction Endpoint

### POST /api/transactions/buy

Allows a user to purchase a specific amount of a cryptocurrency.

#### Request Format
```json
{
  "user_id": number,  // User ID (must be a valid number)
  "coin_id": number,  // Coin ID (must be a valid number)
  "amount": number    // Amount to purchase (must be greater than 0)
}
```

#### Headers
- `Content-Type`: application/json
- `Authorization`: Bearer {token}

#### Response Format
```json
{
  "success": boolean,
  "message": string,
  "transaction": {
    "id": number,
    "user_id": number,
    "coin_id": number,
    "amount": number,
    "price": number,
    "timestamp": string
  }
}
```

#### Error Responses
- 400 Bad Request: Invalid input parameters
- 401 Unauthorized: Missing or invalid authentication token
- 403 Forbidden: Insufficient funds
- 404 Not Found: User or coin not found
- 500 Internal Server Error: Server-side error

#### Example Request
```javascript
const buyTransaction = async (userId, coinId, amount, token) => {
  try {
    const response = await fetch('https://jdwd40.com/api-2/api/transactions/buy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: userId,  // Must be a number
        coin_id: coinId,  // Must be a number
        amount: amount    // Must be a number greater than 0
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to complete purchase');
    }
    
    return data;
  } catch (error) {
    console.error('Buy transaction error:', error);
    throw error;
  }
};
```

## Notes
- All numeric parameters must be valid numbers (not strings)
- User ID must match the authenticated user's ID
- The user must have sufficient funds to complete the purchase
- The transaction will be recorded in the user's transaction history
