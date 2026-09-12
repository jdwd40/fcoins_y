# Coins frontend

Vite, React, and TypeScript frontend for **Coins / Crypto Chaos**, the continuous fantasy cryptocurrency market served at [jdwd40.com/coins](https://jdwd40.com/coins/).

Repository: `jdwd40/fcoins_y`  
Production branch: `master`  
Backend: [`jdwd40/back_coins_x`](https://github.com/jdwd40/back_coins_x)

## Current player experience

- Public persistent market, Director state, events, coin roles, and leaderboard.
- JWT registration/login.
- £10,000 virtual persistent account with cash, holdings, wealth, and trade history.
- Fractional buy/sell flow using the backend's server-locked live price.
- Live coin grid, detail modals, event modifiers/durations, momentum, and sparklines.
- Aggregate market and coin charts with short-range stabilisation.
- Responsive dark/light game interface.

The normal UI has no Apocalypse countdown or round settlement. It runs continuously.

## Setup

Requirements: Node.js 20+ and npm.

```bash
npm ci
npm run dev
```

The API defaults to:

```text
https://jdwd40.com/api-2/api
```

Override it for local development:

```dotenv
# .env.local
VITE_API_BASE_URL=http://localhost:3000/api
```

The router basename is `/coins`.

## Commands

```bash
npm run test:unit
npm run test:ui
npx tsc --noEmit
npm run lint
npm run build
npm run preview
```

The deploy workflow runs UI contract checks, TypeScript, and the production build before rsyncing `dist/` to the VPS.

## Architecture

| Path | Responsibility |
|---|---|
| `src/App.tsx` | Routes and main page composition |
| `src/context/AuthContext.tsx` | Login, registration, token/user lifecycle |
| `src/context/PersistentContext.tsx` | Shared persistent signals, runtime, account, leaderboard, and sync state |
| `src/services/persistentService.ts` | Strict typed `/api/persistent/*` client and response validation |
| `src/services/apiConfig.ts` | Single API base URL authority |
| `src/components/Persistent*` | Current persistent header/trading/Director surfaces |
| `src/components/GameMarketGrid.tsx` | Primary live market grid |
| `src/components/MarketValueChart.tsx` | Aggregate market chart |
| `src/components/PriceChart.tsx` | Per-coin history chart |
| `src/utils/marketHistoryChart.ts` | Range mapping, sanitising, clipping, and chart time units |
| `scripts/ui-contract.mjs` | Source-level UI/API regression contract |

## Data flow

```text
AuthContext ───────────────────────────────┐
                                          ↓
public signals/runtime/leaderboard → PersistentContext → player components
                                          ↑
authenticated account/trade/history ──────┘

coins + market stats/history → secondary chart and asset-detail surfaces
```

`PersistentContext` is the normal player runtime provider. It polls shared public state, polls the authenticated account, resets on identity changes, and adopts the account returned by a successful trade.

## Chart contracts

- Market selector: `5M`, `10M`, `30M`, `1H`, `2H`, `12H`.
- Coin selector: `5M`, `10M`, `30M`, `1H`, `2H`.
- The backend has no 5M range; the client requests 10M and clips to 5M.
- Unknown/old persisted range choices are clamped.
- Data is sanitised and windowed before rendering; stale requests are aborted.
- `ALL` and ranges longer than 12H are intentionally absent from the player UI.

## Legacy boundary

The repository retains the internal `/coins/internal/apocalypse-monitor` and several old cycle-era modules/tests. Normal player routes do not mount `GameContext`; new gameplay work must use `PersistentContext` and `/api/persistent/*`.

Do not delete legacy modules opportunistically. Remove them only after proving they are unreachable or intentionally retiring the internal monitor, with contract/test updates in the same change.

## Documentation

Project-wide documentation is maintained in the backend repository to avoid drift:

- [`project_plan.md`](https://github.com/jdwd40/back_coins_x/blob/main/project_plan.md)
- [`PRD.md`](https://github.com/jdwd40/back_coins_x/blob/main/PRD.md)
- [`API_DOCUMENTATION.md`](https://github.com/jdwd40/back_coins_x/blob/main/API_DOCUMENTATION.md)
- [`docs/database_schema.md`](https://github.com/jdwd40/back_coins_x/blob/main/docs/database_schema.md)
- [`bugs.md`](https://github.com/jdwd40/back_coins_x/blob/main/bugs.md)
- [`new_features.md`](https://github.com/jdwd40/back_coins_x/blob/main/new_features.md)
- [`changelog.md`](https://github.com/jdwd40/back_coins_x/blob/main/changelog.md)

## Scope

Virtual currency only. No real cryptocurrency, payments, deposits, withdrawals, blockchain, wallets, gambling, or financial advice.

