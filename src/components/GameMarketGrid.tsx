import { useState } from 'react';
import { useGame } from '../context/GameContext.tsx';
import { CoinSignalCard } from './CoinSignalCard.tsx';
import { GameCoinDetail } from './GameCoinDetail.tsx';
import { Modal } from './Modal.tsx';

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
  const { signals, signalsError, lifecycle, myParticipant } = useGame();
  const [detailCoinId, setDetailCoinId] = useState<number | null>(null);

  if (signals === null) {
    return (
      <section aria-label="Market" className="paper-card p-6 text-center">
        <div className="label mb-2">Market</div>
        <p className="text-sm text-ink-dim">
          {lifecycle === 'SETTLING'
            ? 'Market frozen — calculating the damage. The next apocalypse starts automatically.'
            : signalsError ?? 'Loading market signals…'}
        </p>
      </section>
    );
  }

  const holdings = myParticipant?.holdings ?? [];
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

      <div className="game-grid">
        {active.map((coin) => (
          <CoinSignalCard
            key={coin.coinId}
            coin={coin}
            holding={holdingByCoinId.get(coin.coinId) ?? null}
            onOpenDetail={() => setDetailCoinId(coin.coinId)}
          />
        ))}
      </div>

      {dead.length > 0 && (
        <div className="mt-6">
          <div className="label mb-2 text-oxblood">Collapsed this apocalypse — dead coins cannot be bought</div>
          <div className="game-grid">
            {dead.map((coin) => (
              <CoinSignalCard
                key={coin.coinId}
                coin={coin}
                holding={holdingByCoinId.get(coin.coinId) ?? null}
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
