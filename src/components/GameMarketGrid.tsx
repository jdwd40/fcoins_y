import { useState } from 'react';
import { useGame } from '../context/GameContext.tsx';
import { usePersistent } from '../context/PersistentContext.tsx';
import { CoinSignalCard } from './CoinSignalCard.tsx';
import { GameCoinDetail } from './GameCoinDetail.tsx';
import { Modal } from './Modal.tsx';
import {
  derivedServerNowMs,
  formatCountdown,
  MARKET_PHASE_SENTIMENT_LABEL,
  marketPhaseSentiment,
  remainingUntilIso
} from '../utils/gameLogic.ts';
import type { MarketPhaseInfo } from '../services/gameService.ts';

// SIM-16: the current PUBLIC market phase banner — name, sentiment treatment
// and a server-clock countdown to endsAt. The countdown derives from
// signals.serverTime plus real local elapsed time and re-anchors on every 5s
// shared-poll adoption; the client clock is never authoritative. The WORDS
// carry the meaning (phase name + tailwind/headwind); colour only reinforces.
function MarketPhaseBanner({ phase, serverNowMs }: { phase: MarketPhaseInfo | null; serverNowMs: number }) {
  const sentiment = marketPhaseSentiment(phase);
  if (phase === null) {
    // Legitimate between-phases gap — a clear neutral state, never an error.
    return (
      <div
        className="market-phase-banner market-phase-neutral mb-3"
        role="status"
        aria-label="Market phase: none active"
      >
        <span className="label">Market phase</span>
        <span className="text-xs text-ink-dim">{MARKET_PHASE_SENTIMENT_LABEL.neutral}</span>
      </div>
    );
  }
  const remainingMs = remainingUntilIso(phase.endsAt, serverNowMs);
  const countdown = formatCountdown(remainingMs);
  return (
    <div
      className={`market-phase-banner market-phase-${sentiment} mb-3`}
      role="status"
      aria-label={`Market phase: ${phase.name}, ${MARKET_PHASE_SENTIMENT_LABEL[sentiment]}, ends in ${countdown}`}
    >
      <div className="min-w-0">
        <span className="label mr-2">Market phase</span>
        <span className="signal-chip">{phase.name}</span>
        <span className="text-xs text-ink-dim ml-2">{MARKET_PHASE_SENTIMENT_LABEL[sentiment]}</span>
      </div>
      <div className="text-right shrink-0">
        <span className="label mr-2">Ends in</span>
        <span className="font-mono text-sm font-bold tnum">{countdown}</span>
      </div>
    </div>
  );
}

// V2-5 market summary: every active gameplay coin as a large, scannable card
// (owned positions first — the player's own economics lead), with collapsed
// coins clearly separated below. Driven entirely by the shared GameContext
// market-signals poll — no per-card timers or independent fetching.
//
// Issue #13: tapping any card's non-trade area opens that coin's detailed
// V2 view in a modal. The detail reads the SAME live signals/holding
// objects, so it stays in step with the poll; closing it returns to the
// exact market location (the grid never unmounts and round state is
// untouched).
export function GameMarketGrid() {
  const { signals, signalsError, signalsSyncedAt, nowTick, lifecycle } = useGame();
  // Persistent Stage 6: ownership comes from the persistent account — round
  // participants no longer decide what the player owns.
  const { account } = usePersistent();
  const [detailCoinId, setDetailCoinId] = useState<number | null>(null);

  if (signals === null) {
    return (
      <section aria-label="Market" className="paper-card p-6 text-center">
        <div className="label mb-2">Market</div>
        <p className="text-sm text-ink-dim">
          {lifecycle === 'SETTLING'
            ? 'Market signals temporarily unavailable — holdings stay safe. Retrying…'
            : signalsError ?? 'Loading market signals…'}
        </p>
      </section>
    );
  }

  // SIM-16/17: the derived current server instant. Anchored to the payload's
  // serverTime at adoption; the shared 1s display tick merely interpolates
  // between polls — the next successful poll re-anchors and corrects drift.
  const serverNowMs = signalsSyncedAt !== null
    ? derivedServerNowMs(signals.serverTime, signalsSyncedAt, nowTick)
    : Date.parse(signals.serverTime);

  const holdings = account?.holdings ?? [];
  const holdingByCoinId = new Map(holdings.map((holding) => [holding.coinId, holding]));
  const active = signals.coins
    .filter((coin) => !coin.dead)
    .sort((a, b) => {
      // Owned positions lead — the player's economics come first; the rest
      // keep the backend's stable catalogue order.
      const aOwned = (holdingByCoinId.get(a.coinId)?.quantity ?? 0) > 0 ? 0 : 1;
      const bOwned = (holdingByCoinId.get(b.coinId)?.quantity ?? 0) > 0 ? 0 : 1;
      return aOwned - bOwned || a.coinId - b.coinId;
    });
  const dead = signals.coins.filter((coin) => coin.dead);

  // The open detail always resolves from the LIVE signals payload — the
  // correct coin id/name/symbol is traceable end to end, and a mid-view
  // collapse or trade re-renders the detail with authoritative data.
  const detailCoin = detailCoinId === null
    ? null
    : signals.coins.find((coin) => coin.coinId === detailCoinId) ?? null;

  return (
    <section aria-label="Market">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="label mb-1">Market</div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
            {active.length} coins in play
          </h2>
        </div>
        {/* Secondary chrome yields to the primary scan on narrow phones. */}
        <span className="chip hidden sm:inline-flex">Refreshes every poll</span>
      </div>

      {signalsError && (
        <p className="text-xs text-oxblood mb-3" role="status">
          Market update failed — showing the last synced signals. {signalsError}
        </p>
      )}

      <MarketPhaseBanner phase={signals.marketPhase} serverNowMs={serverNowMs} />

      <div className="game-grid">
        {active.map((coin) => (
          <CoinSignalCard
            key={coin.coinId}
            coin={coin}
            holding={holdingByCoinId.get(coin.coinId) ?? null}
            signalsNowMs={serverNowMs}
            onOpenDetail={() => setDetailCoinId(coin.coinId)}
          />
        ))}
      </div>

      {dead.length > 0 && (
        <div className="mt-6">
          <div className="label mb-2 text-oxblood">Dead coins — trading has stopped permanently</div>
          <div className="game-grid">
            {dead.map((coin) => (
              <CoinSignalCard
                key={coin.coinId}
                coin={coin}
                holding={holdingByCoinId.get(coin.coinId) ?? null}
                signalsNowMs={serverNowMs}
                onOpenDetail={() => setDetailCoinId(coin.coinId)}
              />
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={detailCoin !== null} onClose={() => setDetailCoinId(null)}>
        {detailCoin && (
          <GameCoinDetail
            key={detailCoin.coinId}
            coin={detailCoin}
            holding={holdingByCoinId.get(detailCoin.coinId) ?? null}
          />
        )}
      </Modal>
    </section>
  );
}
