# CURRENT_STATE_INVENTORY — Coins frontend (fcoins_y)

Baseline: branch `migration/supabase-rebuild` @ `cbdabac`, recorded 2026-08-06.

## Hard-coded backend endpoints (must be removed during migration)

All point at the legacy Express API `https://jdwd40.com/api-2/api`:

| File | Usage |
|---|---|
| `src/App.tsx:111,114,125,130` | coins list, market stats, market status, selected coin — 2 s polling |
| `src/context/AuthContext.tsx:152,229,266` | login, register, register-then-login |
| `src/services/transactionService.ts:3` | buy, sell, portfolio, user transactions |
| `src/components/PriceChart.tsx:53,106` | per-coin price history (`API_BASE`) |
| `src/components/MarketValueChart.tsx:56` | aggregate market price-history |

No `VITE_*` environment variables are declared or used anywhere.

## Baseline gate results (2026-08-06, branch migration/supabase-rebuild)

| Gate | Command | Result |
|---|---|---|
| ESLint | `npm run lint` | exit 0, 7 warnings (1 auto-fixable) |
| App typecheck | `npx tsc -p tsconfig.app.json --noEmit` | **exit 2 — failing** |
| UI contract | `npm run test:ui` | exit 0 — passed |
| Build | `npm run build` | not run at baseline (blocked by typecheck) |

### Known `tsconfig.app.json` typecheck failures (pre-existing)

- `CoinDetail.tsx(56,45)` — `string | undefined` → `string`.
- `MarketValueChart.tsx(196,36)` and `PriceChart.tsx(385,29)` — Chart.js
  tooltip font `weight: "600"` not assignable (must be `600` numeric or
  `"bold"` etc.).
- `Profile.tsx(334,335)` — `number` assigned to `string` fields.
- `AuthContext.tsx(2,*)` — imports `User`, `AuthResponse`,
  `LoginCredentials`, `RegisterCredentials` from `../types`, which no longer
  exports them (duplicate/shadowed definitions in `src/types.ts` vs
  `src/types/index.ts`).
- `src/utils/priceSummary.test.ts(48,22)` — `'s' is possibly 'null'`.

The GitHub Actions deploy workflow runs root `tsc --noEmit`, which does **not**
surface these app-project failures — the workflow check must be replaced with
an explicit project/build-mode typecheck during the migration (plan §2.7).

## Other recorded findings

- Duplicate type definitions: `src/types.ts` and `src/types/index.ts`.
- `package-lock.json` lists `lightweight-charts`; `package.json` does not.
  Lockfile will be regenerated from the intentional Chart.js-only manifest.
- **RELEASE BLOCKER:** tracked file `github-actions-key` contains private-key
  material (confirmed by format check only; contents never read/printed).
  Removal from Git history + rotation requires John's explicit approval before
  any production deploy from this branch. Do not read, copy, reuse, or delete
  autonomously.
- Auth: custom 24 h JWT + user object in `localStorage`, manual expiry decode,
  dangerous fallbacks manufacturing user ID 1 / default user data.
- Router: `BrowserRouter basename="/coins"`, deployed at `/coins/` — preserved.
