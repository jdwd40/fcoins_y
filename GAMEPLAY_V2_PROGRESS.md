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

## V2-6 — COMPLETE / OVERNIGHT RUN COMPLETE

- Backend final HEAD: `3670f2578a6af458c38d3219178a21a1d5a0b185`
- Frontend final HEAD: `b189d6927819c4e6178377bfab5df27ccfe94574`
- Both `gameplay-v2-20260824` branches are pushed and synchronized with origin.
- V2-1 through V2-6 complete; no stage stopped, no merge/deploy/production mutation.
- Final frontend evidence: 130/130 unit tests, UI contract passed, lint 0 errors with six existing warnings, TypeScript passed, build passed, diff check passed.
- Final backend evidence: 74/75 suites and 710/711 tests; one documented pre-existing suite-order settlement/worker deadlock flake, schema verification passed, isolated worker 5/5.
- Final simulations: V2-1 gate 2,000 rounds passed; Power 40×24 passed; V2-3 30×24 passed; bot 24×16 passed.
- Final V2-1 DIP_BOOM/RANDOM paired win rate 99.55%; DIP_BOOM median ROI 271.37%, RANDOM -53.76%; perfect-information median 454.25%.
- V2 reached UI and is ready for local human play-testing on the V2 branch. No browser/device screenshot or deployment is claimed.
- Unresolved: baseline backend deadlock flake, existing frontend warnings/build advisories; no new V2 gate failures.

The backend progress file is the authoritative complete morning report and contains final parameters, all strategy/bot metrics, regression evidence and readiness assessment. Do not merge, deploy or begin another milestone.

---

## Apocalypse Monitor Phase 3 Plan 1 — COMPLETE (internal frontend dashboard)

- Scope: internal operator dashboard and historical multi-coin viewer for the backend diagnostics monitor API (backend issue #21, Phase 2/2.5). Frontend only; no backend, gameplay, player-facing chart or navigation changes. No push, no deploy.
- Route: `/internal/apocalypse-monitor` under the existing `/coins` BrowserRouter basename; deliberately absent from player navigation and mounted WITHOUT the player providers (no player-API polling on the operator page).
- Token handling: the diagnostics token is entered manually on the operator gate screen and held ONLY in React memory. Never hard-coded, never Vite env, never Web Storage, never logged, never embedded in error strings (401 surfaces the fixed `INVALID_MONITOR_TOKEN_MESSAGE`). It leaves the page solely as `Authorization: Bearer <token>` on the two diagnostics calls in `src/services/monitorService.ts`; the player-facing `gameService` remains contractually barred from `/game/diagnostics/*`.
- Flow: token gate → `GET /game/diagnostics/monitor/cycles` → newest cycle auto-selected → `GET /game/diagnostics/monitor?cycleId=…`. Cycle switching shows a loading state; empty cycles, unknown-cycle 404s, fail-closed 404s, network failures and malformed payloads all surface cleanly. Clean state concepts: `selectedCycle`, `monitorData`, `chartMode`; no playback/scrubber/live logic.
- Chart: existing Chart.js/react-chartjs-2 dependency; one line per coin; x-axis is elapsed Apocalypse time (MM:SS / H:MM:SS) derived from backend timestamps and the cycle start; tooltips show elapsed time plus price/%. PRICE mode renders raw points verbatim (no interpolation; `source` COLLAPSE tags preserved). % CHANGE mode normalises each coin against its first observed price `((price - start) / start) * 100`; a zero starting price yields null values and `n/a` — never divide-by-zero.
- Summary table: per-coin start/end/latest/high/low/change/samples, provenance chip (Exact / Time-window derived / Mixed / No data), backend warnings panel, and a visually obvious `COLLAPSED · £0.00` state for coins whose final observed price is zero. Coins with no history render safely.
- New files: `src/services/monitorService.ts`, `src/utils/apocalypseMonitor.ts`, `src/components/ApocalypseMonitor.tsx`, `src/services/monitorService.test.ts`, `src/utils/apocalypseMonitor.test.ts`. Modified: `src/App.tsx` (route), `scripts/ui-contract.mjs` (monitor contract section), `package.json` (test:unit list).
- Gates: `npm run test:unit` 181/181 passed; `npm run test:ui` passed; `npm run lint` 0 errors (six pre-existing warnings); `npx tsc --noEmit` passed; `npm run build` passed; `git diff --check` passed.

---

## Apocalypse Monitor Phase 4 — COMPLETE (replay cursor / historical scrubbing)

- Scope: internal operator dashboard only. One React-memory replay cursor over the already-loaded snapshot; no backend, gameplay, player-facing, provider or router changes. No push, no deploy. Token stays React-memory-only.
- Replay design: `currentReplayTime` state is **elapsed ms since the cycle start** (same unit as the chart x-axis, so a future playback phase can advance it arithmetically). `null` = the bounds default. Loaded `monitorData` is never refetched or mutated while scrubbing; the cursor resets to the default on cycle selection, data load, auth failure and token reset.
- Bounds (`monitorReplayBounds`, pure helper): finished cycles (COMPLETED/SETTLING) span `[0, cycle length]` and default the cursor to the cycle end. ACTIVE cycles are capped at the latest legitimately observable time — max(snapshot `observedAt`, newest valid sample across coins) clamped to the cycle end — and default there; the operator can never scrub into the future over invented prices. Malformed cycle/point timestamps degrade to a zero-width safe range; one malformed/empty coin can never crash a lookup.
- UI: accessible native range slider (`min`/`max`/`step`, keyboard + touch + mouse, `aria-label` + `aria-valuetext` + polite live readout `Inspecting: elapsed / total`) below the full-history chart, with only Start and End/Latest buttons — no Play/Pause, speed control, auto movement or live polling. The chart remains full history in PRICE and % CHANGE modes; a small dashed vertical cursor marker rides a tiny Chart.js plugin.
- Point-in-time helpers: `getPriceAtTime` (latest sample ≤ cursor, step semantics, no interpolation; null before the first observation) and `getCoinStateAtTime` (unavailable before the first sample; % change vs first observed price, null on zero start; before a collapse the prior price shows, at/after a zero-priced `source='COLLAPSE'` sample the state is £0 and COLLAPSED). The summary table gains At cursor / Cursor Δ columns while retaining whole-cycle Start/End/Latest/High/Low/Change/Samples.
- Modified files: `src/utils/apocalypseMonitor.ts`, `src/utils/apocalypseMonitor.test.ts`, `src/components/ApocalypseMonitor.tsx`, `scripts/ui-contract.mjs` (Phase 3 no-replay assertion replaced by the Phase 4 contract). No new files.
- Gates: `npm run test:unit` 197/197 passed (Phase 3 tests green); `npm run test:ui` passed; `npm run lint` 0 errors (six pre-existing warnings); `npx tsc --noEmit` passed; `npm run build` passed; `git diff --check` passed.

---

## Apocalypse Monitor Phase 5 — COMPLETE (automatic replay playback)

- Scope: internal operator dashboard only. Playback advances the existing Phase 4 cursor over the already-loaded snapshot; no backend, gameplay, player-facing, provider or router changes. No push, no deploy. Token stays React-memory-only.
- Playback design: only two new pieces of state — `isPlaying` and `playbackSpeed` (default 10x). The cursor remains `currentReplayTime` (elapsed ms since cycle start); there is no competing timeline. A `requestAnimationFrame` loop advances the cursor by REAL frame-timestamp deltas: `replayAdvance = (frameTs - previousFrameTs) * playbackSpeed`, so delayed/throttled callbacks advance proportionally — no drift, no catch-up bursts. Supported speeds are exactly 1x/5x/10x/30x/60x (`MONITOR_PLAYBACK_SPEEDS`); speed changes apply live via a ref without disturbing the timing reference.
- Pure helpers (timestamp-injected, deterministic under `node --test`): `advanceReplayTime(cursor, realDeltaMs, speed, bounds)` → `{ cursorMs, reachedEnd }` clamped exactly into the bounds (invalid input is a deterministic no-op; NaN cursor recovers to the default), and `resolveReplayPlayStart(cursor, bounds, status)` — a finished cycle (COMPLETED/SETTLING) parked at the upper bound RESTARTS from the cycle start, otherwise resumes from the cursor; ACTIVE always plays from the cursor and stops at its existing replay upper bound (latest observable time, never the future). Reaching the upper bound clamps exactly and pauses — no looping.
- UI: accessible transport around the scrubber — Start / Play-Pause (`aria-pressed`, dynamic `Play replay`/`Pause replay` label) / End-Latest — with endpoint-aware disabled states, plus a 1x/5x/10x/30x/60x speed group (`aria-pressed`, per-speed `aria-label`). Full-history chart, cursor marker, point-in-time table columns, PRICE/% CHANGE modes and collapse behaviour are unchanged; chart mode changes preserve cursor and playback.
- Cleanup/lifecycle: one stable `pausePlayback()` helper routes every exit — cycle change (pauses BEFORE the fetch, so the monitor never refetches while playing), data load success/failure, 401 auth failure, token reset, manual slider scrub and Start/End jumps (pause then move). `visibilitychange` to hidden pauses and drops the timing reference; visible never auto-resumes. The RAF effect cleanup cancels the pending frame on pause/unmount/bounds change — no orphan callbacks, no setInterval/setTimeout anywhere in the monitor.
- Modified files: `src/utils/apocalypseMonitor.ts`, `src/utils/apocalypseMonitor.test.ts`, `src/components/ApocalypseMonitor.tsx`, `scripts/ui-contract.mjs` (Phase 4 no-playback assertion replaced by the Phase 5 contract). No new files.
- Gates: `npm run test:unit` 211/211 passed (14 new Phase 5 tests: speed vocabulary, per-speed timing, exact endpoint clamp/no-loop, invalid-input recovery, zero-width bounds, finished restart vs ACTIVE cap, collapse transition under playback, empty histories); `npm run test:ui` passed; `npm run lint` 0 errors (six pre-existing warnings); `npx tsc --noEmit` passed; `npm run build` passed; `git diff --check` passed.
