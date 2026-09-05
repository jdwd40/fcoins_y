import { useState } from 'react';
import { usePersistent } from '../context/PersistentContext.tsx';
import { CoinSignalCard } from './CoinSignalCard.tsx';
import { GameCoinDetail } from './GameCoinDetail.tsx';
import { Modal } from './Modal.tsx';

// Stage 11 cutover: primary player market grid now driven exclusively by
// public persistent signals from PersistentContext (shared 5s poll with
// leaderboard/account). No legacy GameContext signals, no phase banner,
// no server-time interpolation, no countdowns, no old round state, no
// Apocalypse phase banner. A coins:[] payload renders neutral empty state.
// Primary displayed prices are always signal.currentPrice (holding.currentPrice
// is only for economics calcs).

export function GameMarketGrid() {
  // Persistent signals are public/identity-independent (like leaderboard).
  // Account provides holdings for ownership sort/economics.
  const { account, signals, signalsError } = usePersistent();
  const [detailCoinId, setDetailCoinId] = useState<number | null>(null);

  if (signals === null) {
    return (
      <section aria-label="Market" className="paper-card p-6 text-center">
        <div className="label mb-2">Market</div>
        <p className="text-sm text-ink-dim">
          {signalsError ?? 'Loading market signals…'}
        </p>
      </section>
    );
  }

  // Valid payload with coins:[] is a legitimate no-world/empty state — neutral,
  // not an error, not loading.
  if (signals.coins.length === 0) {
    return (
      <section aria-label="Market" className="paper-card p-6 text-center">
        <div className="label mb-2">Market</div>
        <p className="text-sm text-ink-dim">No coins in the persistent market yet.</p>
      </section>
    );
  }

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

  // The open detail always resolves from the LIVE persistent signals payload —
  // the correct coin id/name/symbol is traceable end to end.
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
          <div className="label mb-2 text-oxblood">Dead coins — trading has stopped permanently</div>
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
