# Market API Endpoints Documentation

## Market Status Endpoint

### GET /api/market/status

Returns the current market cycle and its effect on coin prices.

#### Response Format
```json
{
  "currentCycle": {
    "type": "STRONG_BOOM" | "MILD_BOOM" | "STRONG_BUST" | "MILD_BUST" | "STABLE",
    "baseEffect": number  // Range: -0.005 to 0.005 (represents -0.5% to 0.5%)
  },
  "timestamp": "2025-02-11T18:55:21Z"
}
```

#### Market Cycle Types
- `STRONG_BOOM`: Strong positive market trend (+0.5% max effect)
- `MILD_BOOM`: Mild positive market trend (+0.2% max effect)
- `STRONG_BUST`: Strong negative market trend (-0.5% max effect)
- `MILD_BUST`: Mild negative market trend (-0.2% max effect)
- `STABLE`: Neutral market trend (0% effect)

#### Example Response
```json
{
  "currentCycle": {
    "type": "MILD_BOOM",
    "baseEffect": 0.002
  },
  "timestamp": "2025-02-11T18:55:21Z"
}
```

## Market Stats Endpoint

### GET /api/market/stats

Returns comprehensive statistics about all coins in the market.

#### Response Format
```json
{
  "marketStats": {
    "totalCoins": number,
    "activeEvents": number,
    "lastUpdate": string
  },
  "coins": [
    {
      "coin_id": string,
      "symbol": string,
      "current_price": number,
      "volatility": {
        "baseVolatility": number,      // Range: 0.2 to 0.8
        "trendDirection": number,      // 1 or -1
        "trendStrength": number        // Range: 0 to 0.002 (0.2% max)
      },
      "activeEvents": [
        {
          "type": string,
          "multiplier": number,
          "startTime": string,
          "endTime": string
        }
      ],
      "priceHistory": [
        {
          "price": number,
          "timestamp": string
        }
      ]
    }
  ]
}
```

#### Event Types and Their Effects
- `MAJOR_PARTNERSHIP`: +5% price effect
- `MINOR_PARTNERSHIP`: +2% price effect
- `REGULATION_NEGATIVE`: -5% price effect
- `REGULATION_POSITIVE`: +3% price effect
- `MAJOR_ADOPTION`: +8% price effect
- `MINOR_ADOPTION`: +3% price effect
- `SCANDAL`: -7% price effect
- `RUMOR_POSITIVE`: +1% price effect
- `RUMOR_NEGATIVE`: -1% price effect

#### Example Response
```json
{
  "marketStats": {
    "totalCoins": 10,
    "activeEvents": 3,
    "lastUpdate": "2025-02-11T18:55:21Z"
  },
  "coins": [
    {
      "coin_id": "btc",
      "symbol": "BTC",
      "current_price": 45000.50,
      "volatility": {
        "baseVolatility": 0.4,
        "trendDirection": 1,
        "trendStrength": 0.001
      },
      "activeEvents": [
        {
          "type": "MAJOR_PARTNERSHIP",
          "multiplier": 1.05,
          "startTime": "2025-02-11T18:30:00Z",
          "endTime": "2025-02-11T19:10:00Z"
        }
      ],
      "priceHistory": [
        {
          "price": 44950.25,
          "timestamp": "2025-02-11T18:50:21Z"
        },
        {
          "price": 45000.50,
          "timestamp": "2025-02-11T18:55:21Z"
        }
      ]
    }
  ]
}
```

## Usage Example

```javascript
// Fetch market status
async function getMarketStatus() {
  const response = await fetch('/api/market/status');
  const data = await response.json();
  return data;
}

// Fetch market stats
async function getMarketStats() {
  const response = await fetch('/api/market/stats');
  const data = await response.json();
  return data;
}

// Example usage with error handling
try {
  const marketStatus = await getMarketStatus();
  console.log('Current market cycle:', marketStatus.currentCycle.type);
  
  const marketStats = await getMarketStats();
  console.log('Total coins:', marketStats.marketStats.totalCoins);
  console.log('Active events:', marketStats.marketStats.activeEvents);
} catch (error) {
  console.error('Error fetching market data:', error);
}
```

## Notes
- All endpoints update every 5 seconds
- Timestamps are in ISO 8601 format
- Price history is limited to the last 24 hours
- Base volatility is assigned per coin and remains relatively stable
- Event durations vary by event type (7-45 seconds)

