# Crypto Chaos V2 — Gameplay Pivot

## Preparation checkpoint

- Branch: `gameplay-v2-20260824`
- Preparation timestamp: `2026-08-24T23:02:17+01:00`
- Scope: repository preparation only. No V2 gameplay has been implemented.
- Deployment or production changes: none.
- Main/master merge or push: none.

## Starting repository state

- Repository: `jdwd40/fcoins_y`
- Origin: `git@github.com:jdwd40/fcoins_y.git`
- Starting branch: `master`
- Starting/current HEAD before this document: `ec190d167a9ed03f5fd6bd642196ad6a9a982330`
- Starting commit: `feat(game): finish Crypto Chaos Core 7 UI`
- Starting status: clean.

The completed Core 7 frontend was already committed on `master`; the V2 branch was created before any frontend commit action, so no work was accidentally committed onto `master` during preparation.

## Checkpoint

- V2 branch HEAD before this progress document: `ec190d167a9ed03f5fd6bd642196ad6a9a982330`
- No gameplay implementation was added.

## Baseline verification

- `npm run lint` — **PASS**, 0 errors, 6 existing warnings:
  - missing React Hook dependencies in `Profile.tsx`
  - missing React Hook dependencies in `SellForm.tsx`
  - Fast Refresh export warning in `AuthContext.tsx`
  - Fast Refresh export warning in `GameContext.tsx`
  - Fast Refresh export warning in `ToastContext.tsx`
  - unused ESLint disable directive in `src/utils/priceSummary.test.ts`
- `npm run test:ui` — **PASS**, Crypto Chaos UI contract passed.
- `npm run test:unit` — **PASS**, 109 tests passed.
- `npm run build` — **PASS**. Existing warning: Browserslist/caniuse-lite data is 16 months old.
- `git diff --check` passed before and after the checkpoint.

## Repository state after checkpoint

This progress document is the only new tracked preparation file pending checkpoint commit. The V2 branch remains separate from `master`; no merge, deployment, production data change, or main/master push was performed.

## Next authorised phase

Begin with V2-1 planning and the shared deterministic cyclical-market/simulation gate. Do not proceed to Power, bots, or major UI work until DIP-BOOM demonstrates a repeatable advantage over RANDOM on identical seeded paths.

---

## V2-1 — COMPLETE (backend-led stage)

- Backend authoritative stage SHA: `b71f0671b0beb2c712af298232f61befef8f67f1`
- Frontend SHA: `3a2688b3111785f09321dd9f8cb8f32ff6d63357` (unchanged)
- Frontend V2-1 implementation: none; backend shared domain and simulator are authoritative for this stage.
- Backend focused V2-1 tests: 86/86 passed.
- Backend full suite: 65 suites / 587 tests passed.
- Independent 2,000-round paired simulation gate: passed.
- DIP-BOOM vs RANDOM paired win rate: 99.55%.
- DIP-BOOM median ROI: 271.37%; RANDOM median ROI: -53.76%.
- No production branches, services or data were changed.

The backend progress file is authoritative for the complete V2-1 file list, simulation configuration, metrics, K3 state and next action. Reconcile this frontend record against the backend copy if they differ.

## V2-2 — COMPLETE (backend-led stage)

- Backend implementation SHA: `84699449d71ecab305d331f17d95689eadbe942d`
- Frontend SHA: `266d67878ab90124527d5e632b971d73a6f96c2a` (unchanged; no UI work permitted yet)
- Final Power parameters: max 100, +1 per 30 seconds, buy cost `1 + floor(total / £125)`, maximum 3 open live positions.
- Focused V2-2 suites: 5 suites / 67 tests passed.
- Full backend suite: 70 suites / 654 tests passed.
- Independent 40×24 multi-round Power gate: passed; 960 paired rounds per player.
- DIP-BOOM vs RANDOM paired win rate: 82.60%; median ROI 14.31% vs RANDOM -7.81%; median paired advantage £2,253.78.
- SPAM median ROI -4.07%, with 194,944 Power-blocked buys and 543 position-limit blocks.
- LATE_ENTRANT median ROI 22.06%, paired win rate against RANDOM 85.52%; RETURNING mean round-start Power 39.95.
- Zero accounting/position-limit violations and zero majority-starved rounds in the final study.
- Anti-fragmentation twin test: whole deployment 18 Power versus fragmented deployment 20 Power.
- No production branches, services or data changed. No UI work began.
- Known Jest force-exit/open-handle warning remains; no V2-2 test failures remain.

The backend progress file is authoritative for the complete V2-2 file list, tuning evidence, simulation configuration and metrics. The only correction was a test-fixture duplicate-selection bug; no service code was changed for it.

## V2-3 — COMPLETE (backend-led stage)

- Backend implementation SHA: `d583d56b2371b04ae7dd5c5dfc3e124b01c5e347`
- Frontend SHA: `cc578d52ce075d5237868c76e58921288ecaa3ee` (unchanged; UI still prohibited)
- Escalation bands: NORMAL 0–40%, ELEVATED 40–70%, HIGH 70–90%, EXTREME 90–100%; shared Core 2 curve preserved at 1.0→3.0, exponent 2.
- Collapse risk vocabulary: STABLE, SHAKY, DANGER, CRITICAL; dead coins expose DEAD; no hidden schedule fields.
- Selected V2 economy configuration: explicit `GAME_ECONOMY_SCALE=0.25` in the study; default 1 preserves Core 7 compatibility.
- Independent V2-3 gate: 30×24 consecutive rounds, all 11 criteria passed.
- Median tick movement NORMAL→EXTREME: 2.09%→2.95%→4.14%→5.15%; equal-window swing 18.99%→51.60%.
- Risk classifier: 22.71% versus 22.86% chance baseline over 5,760 samples.
- DIP-BOOM median ROI 17.11%; RANDOM -5.69%; paired DIP-BOOM win rate 83.06%.
- LATE_SELLER paired win rate 73.06%; OVERSTAYER 80.83%; HOLD_FOREVER median ROI -57.87%.
- LATE_ENTRANT median ROI 24.66%, paired win rate versus RANDOM 84.58%.
- V2 economy median debits £80.37/round; DIP-BOOM erased-gain rounds 0.18%.
- Zero cash/basis/position invariant violations; 725,774 Power blocks and 149,679 position-limit blocks.
- Independent focused V2-1/V2-2/V2-3 run: 15 suites / 199 tests passed.
- K3 full backend run: 74 suites / 691 tests passed. Independent full rerun had the known `game-public-state-no-seed` timeout/deadlock baseline failure; it also failed isolated in the existing settlement/collapse path, outside V2-3 files.
- No migration, production configuration, branch, service or data changes outside the V2 branch.

The backend progress file is authoritative for the complete V2-3 file list, risk/economy design, simulation configuration and metrics. The economy-scale fixture correction pinned fresh cycle seeds; service code was unchanged.

## V2-4 — COMPLETE (backend-led stage)

- Backend implementation SHA: `bdaf1d0787abc94456ca1338a93e0d2bfd08c799`
- Frontend SHA: `2f78fa85151e717a9a5bb02aeade1fd1e7bdf7bf` (unchanged)
- Existing four-bot roster preserved and adapted to shared V2 public signals, Power, position limits, P&L and common buy/sell services.
- Exact public-state allowlists reject hidden seed, future collapse schedule/rank/timestamp and extra/missing fields.
- Independent bot gate: 24×16 consecutive rounds, all 9 criteria passed.
- Conservative median ROI +2.21%; Momentum +0.45%; Dip Buyer +13.93%; Reckless -6.84%; DIP_BOOM +18.55%.
- Dip Buyer versus DIP_BOOM paired win rate 34.11%; conservative risky entries 0%; reckless risky entries 48.99%; Dip Buyer DIP entries 97.5%; Momentum RISE entries 100%.
- Zero cash/basis/position invariant violations; max open positions 3; zero-Power sells 73/73; 185,856 hidden-information checks with 0 violations.
- Independent focused run: 20 suites / 237 tests passed.
- Independent V2-2 and V2-3 regression gates passed.
- Independent full backend: 74 suites / 710 tests passed; one known suite-order worker/settlement deadlock baseline failure. `game-cycle-worker.test.js` passes isolated 5/5. No V2-4 files are implicated.
- `git diff --check` and JS syntax checks passed. No migration, production config, service or data changes.

## V2-5 — COMPLETE

- Backend SHA: `7ffab04c24f0b30f8bfb1b10d2d87db91991314a` (unchanged)
- Frontend implementation SHA: `018cc0f1fb677256166c2443b982b65502c45f15`
- Mobile-first game surface: compact top bar, server countdown/apocalypse header, Cash/Power/rank/positions strip, leaderboard pressure and signal-driven active/dead coin cards.
- Real `/api/game/market-signals` contract consumed through the shared GameContext poll; participant Power and cost-basis/P&L fields typed and validated.
- Quick buys: £250/£500/£1K/£2.5K; Power preview uses `1 + floor(notional / £125)`; server remains authoritative.
- Owned cards show average entry, current value, P&L £/%, phase, risk and complete-position SELL; dead cards show £0/DEAD/no BUY.
- Existing profile/results/classic market/chart surfaces preserved below the primary game.
- Responsive one-column phone layout, wider breakpoint columns, tap targets and reduced-motion rules implemented.
- Readability contract covers all 13 plan answers.
- `npm run test:unit`: 130/130 passed.
- `npm run test:ui`: passed.
- `npm run lint`: 0 errors, six existing warnings.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `git diff --check`: passed; generated artifacts ignored.

## V2-6 — NOT STARTED

Before V2-6, read the complete plan, both progress files and both repository states again. Run final backend/frontend verification, final large simulations against final gameplay code, regression checks and the complete morning report. Do not merge or deploy.
