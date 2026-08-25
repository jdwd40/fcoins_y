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

## V2-3 — NOT STARTED

The next authorised work is backend-led V2-3 apocalypse escalation, collapse-risk signals and passive-economy tuning. UI work remains prohibited until V2-1 through V2-4 gates pass.
