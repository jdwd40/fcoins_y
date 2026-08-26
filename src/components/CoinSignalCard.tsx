import { useState } from 'react';
import { Check, Skull, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useGame } from '../context/GameContext.tsx';
import { RoundTradePanel } from './RoundTradePanel.tsx';
import { CoinSparkline, DeadCoinSparkline } from './CoinSparkline.tsx';
import { SessionExpiredError, formatCurrency } from '../services/transactionService.ts';
import { GameApiError } from '../services/gameService.ts';
import type { MarketSignalCoin, RoundHolding } from '../services/gameService.ts';
import {
  archetypePersonality,
  displayRoundCash,
  estimateBuyPowerCost,
  formatQuantity,
  formatRecentChangePct,
  formatSignedGbp,
  formatSignedPct,
  formatTypicalProfile,
  momentumArrow,
  openLivePositionCount,
  quantityForNotional,
  quickBuyBlockReason,
  quickBuyLabel,
  QUICK_BUY_BLOCK_LABEL,
  QUICK_BUY_NOTIONALS
} from '../utils/gameLogic.ts';
import type { Coin } from '../types';

interface CoinSignalCardProps {
  coin: MarketSignalCoin;
  holding: RoundHolding | null;
  /** Issue #13: opens this coin's detailed V2 view (modal owned by
   *  GameMarketGrid). Fired from the card's non-trade areas only. */
  onOpenDetail: () => void;
}

// V2-5 coin card. One card per gameplay coin driven by the public
// market-signals contract (phase, momentum, archetype, typical ranges,
// collapse risk) plus the server-owned holding economics when the player has
// a position. Every state is explicit text — colour only reinforces.
//
// Quick buys convert a fixed notional (£250/£500/£1K/£2.5K) into a quantity
// at the current displayed price; the Power figure is the shared V2 preview
// (1 + floor(notional / £125)), labelled as an estimate. The server remains
// authoritative: trades confirm first, fake success is never shown, and a
// domain rejection renders verbatim.
export function CoinSignalCard({ coin, holding, onOpenDetail }: CoinSignalCardProps) {
  const { user, handleSessionExpired } = useAuth();
  const { showToast } = useToast();
  const { joined, myEntry, myParticipant, lifecycle, connection, trade, gameState } = useGame();

  const [confirmNotional, setConfirmNotional] = useState<number | null>(null);
  const [confirmSell, setConfirmSell] = useState(false);
  const [showCustomTrade, setShowCustomTrade] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Issue #13: tapping a NON-TRADE area of the card opens the detailed coin
  // view. Every trade control (quick-buy ladder, sell, confirmations,
  // cancel, custom amount, nested RoundTradePanel) is a real button/input,
  // so this delegation guard keeps trade taps strictly isolated from detail
  // navigation — a trade click can never open the detail, and the detail
  // gesture can never fire a trade. Keyboard users get the explicit Details
  // button in the header (real <button>, visible focus, labelled).
  const handleCardClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [role="button"]')) return;
    onOpenDetail();
  };

  const owned = !!holding && holding.quantity > 0;
  const roundCash = displayRoundCash(myEntry, myParticipant);
  const powerCurrent = myParticipant?.power?.current ?? null;
  const openPositions = openLivePositionCount(myParticipant?.holdings ?? []);

  // The classic trade panel consumes the legacy Coin shape; only
  // coin_id/symbol/current_price are read from it. The price stays the
  // server-published signal price.
  const legacyCoin: Coin = {
    coin_id: coin.coinId,
    name: coin.name,
    symbol: coin.symbol,
    current_price: String(coin.currentPrice),
    market_cap: '£0.00',
    circulating_supply: 0,
    price_change_24h: coin.recentChangePct ?? 0,
    founder: ''
  };

  const handleTradeError = (err: unknown, fallback: string) => {
    if (err instanceof SessionExpiredError) {
      handleSessionExpired();
      showToast('Your session has expired. Please log in again.', 'error');
    } else if (err instanceof GameApiError) {
      // Server rejection BEFORE any mutation (stale price, Power spent,
      // collapse race, settlement): the exact backend message, verbatim.
      setError(err.message);
      showToast(err.message, 'error');
    } else {
      const message = err instanceof Error ? err.message : fallback;
      setError(message);
      showToast(message, 'error');
    }
  };

  const confirmQuickBuy = async (notional: number) => {
    const quantity = quantityForNotional(notional, coin.currentPrice);
    if (quantity === null) return;
    setPending(true);
    setError(null);
    try {
      await trade('BUY', coin.coinId, quantity);
      showToast(`Bought ${formatQuantity(quantity)} ${coin.symbol} (~${quickBuyLabel(notional)})`, 'success');
      setConfirmNotional(null);
    } catch (err) {
      handleTradeError(err, 'Buy failed');
    } finally {
      setPending(false);
    }
  };

  const confirmSellPosition = async () => {
    if (!holding) return;
    setPending(true);
    setError(null);
    try {
      await trade('SELL', coin.coinId, holding.quantity);
      showToast(`Sold ${formatQuantity(holding.quantity)} ${coin.symbol}`, 'success');
      setConfirmSell(false);
    } catch (err) {
      handleTradeError(err, 'Sell failed');
    } finally {
      setPending(false);
    }
  };

  const signalBlock = (
    <div className="signal-facts" aria-label="Market signal">
      <div className="flex items-center justify-between gap-2">
        <span className="label">1m change</span>
        <span className={`font-mono text-xs font-bold tnum ${(coin.recentChangePct ?? 0) >= 0 ? 'text-verdigris' : 'text-oxblood'}`}>
          {formatRecentChangePct(coin.recentChangePct)} {momentumArrow(coin.momentum)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="label">Phase</span>
        <span className={`signal-chip phase-${coin.phase.toLowerCase()}`}>{coin.phase}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="label">Style</span>
        <span className="text-xs text-ink-dim text-right">
          {coin.archetype} · {archetypePersonality(coin.archetype)}
        </span>
      </div>
      {formatTypicalProfile(coin) !== '' && (
        <div className="flex items-center justify-between gap-2">
          <span className="label">Typical</span>
          <span className="font-mono text-xs text-ink-dim text-right tnum">{formatTypicalProfile(coin)}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="label">Collapse risk</span>
        <span className={`signal-chip risk-${coin.collapseRisk.toLowerCase()}`}>{coin.collapseRisk}</span>
      </div>
    </div>
  );

  const cardHeader = (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <div className="font-display font-bold text-ink text-lg leading-tight truncate">{coin.name}</div>
        <div className="label mt-0.5">{coin.symbol}/GBP</div>
      </div>
      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        <div>
          <div className="label mb-0.5">Price</div>
          <div className={`numeral text-2xl tnum ${coin.dead ? 'text-oxblood' : 'text-ink'}`}>
            {coin.dead ? '£0.00' : formatCurrency(coin.currentPrice)}
          </div>
        </div>
        {/* Explicit accessible route into the detailed coin view (issue
            #13); the rest of the non-trade card surface opens it too. */}
        <button
          type="button"
          className="card-detail-trigger"
          onClick={onOpenDetail}
          aria-label={`Open ${coin.name} details`}
        >
          Details ▸
        </button>
      </div>
    </div>
  );

  // --- Dead / collapsed coin -------------------------------------------------
  if (coin.dead) {
    return (
      <article className="game-card dead-card" aria-label={`${coin.name} — dead`} onClick={handleCardClick}>
        {cardHeader}
        <div className="flex items-center gap-2 mb-3" role="note">
          <Skull className="w-4 h-4 text-oxblood" aria-hidden="true" />
          <span className="font-mono text-sm font-bold text-oxblood tracking-caps uppercase">
            DEAD · COLLAPSED
          </span>
        </div>
        <p className="text-xs text-ink-dim mb-3">
          This coin collapsed to £0.00 and stays dead for the rest of the apocalypse. It cannot be bought.
        </p>
        <DeadCoinSparkline symbol={coin.symbol} />
        {owned && holding && (
          <div className="border border-oxblood rounded-lg p-3 bg-paper-alt">
            <div className="label text-oxblood mb-1">Position destroyed</div>
            <div className="font-mono text-xs text-ink-dim tnum mb-1">
              {formatQuantity(holding.quantity)} {coin.symbol} · cost basis {formatCurrency(holding.costBasis)}
            </div>
            <div className="font-mono text-sm font-bold text-oxblood tnum mb-3">
              {formatSignedGbp(holding.unrealizedPnl)} ({formatSignedPct(holding.unrealizedPnlPct)}) — lost
            </div>
            {!confirmSell ? (
              <button
                type="button"
                className="btn-ink w-full tap-target"
                onClick={() => { setError(null); setConfirmSell(true); }}
              >
                Sell dead position for £0.00
              </button>
            ) : (
              <div>
                <p className="text-xs text-ink-dim mb-2">
                  Confirm: sell {formatQuantity(holding.quantity)} {coin.symbol} for exactly £0.00. Selling costs no Power.
                </p>
                <div className="flex gap-2">
                  <button type="button" className="btn-ink flex-1 tap-target" disabled={pending} onClick={() => setConfirmSell(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-oxblood flex-1 tap-target"
                    disabled={pending}
                    onClick={() => void confirmSellPosition()}
                  >
                    {pending ? 'Committing…' : 'Confirm £0 sell'}
                  </button>
                </div>
              </div>
            )}
            {error && <div className="font-mono text-xs text-oxblood mt-2" role="alert">{error}</div>}
          </div>
        )}
      </article>
    );
  }

  // --- Owned live position -----------------------------------------------------
  if (owned && holding) {
    const pnlClass = holding.unrealizedPnl >= 0 ? 'text-verdigris' : 'text-oxblood';
    const pnlWord = holding.unrealizedPnl >= 0 ? 'profit' : 'loss';
    return (
      <article className="game-card owned-card" aria-label={`${coin.name} — your position`} onClick={handleCardClick}>
        {cardHeader}
        <CoinSparkline coin={coin} averageEntryPrice={holding.averageEntryPrice} cycleStartTime={gameState?.startTime ?? null} />
        <div className="position-economics" aria-label={`Position ${pnlWord}`}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <div className="label mb-0.5">Avg entry</div>
              <div className="font-mono text-sm text-ink tnum">
                {holding.averageEntryPrice === null ? '—' : formatCurrency(holding.averageEntryPrice)}
              </div>
            </div>
            <div>
              <div className="label mb-0.5">Current price</div>
              <div className="font-mono text-sm text-ink tnum">{formatCurrency(holding.currentPrice)}</div>
            </div>
            <div>
              <div className="label mb-0.5">Position value</div>
              <div className="font-mono text-sm font-bold text-ink tnum">{formatCurrency(holding.currentValue)}</div>
            </div>
            <div>
              <div className="label mb-0.5">Quantity</div>
              <div className="font-mono text-sm text-ink-dim tnum">{formatQuantity(holding.quantity)} {coin.symbol}</div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 py-2 border-y border-rule mb-3">
            <span className="label">P&amp;L</span>
            <span className={`font-mono text-lg font-bold tnum ${pnlClass}`}>
              {formatSignedGbp(holding.unrealizedPnl)} ({formatSignedPct(holding.unrealizedPnlPct)}) {pnlWord}
            </span>
          </div>
        </div>
        {signalBlock}

        <div className="mt-3">
          {!confirmSell ? (
            <button
              type="button"
              className="btn-oxblood w-full tap-target-lg"
              onClick={() => { setError(null); setConfirmSell(true); }}
              aria-label={`Sell entire ${coin.symbol} position`}
            >
              Sell position · {formatCurrency(holding.currentValue)}
            </button>
          ) : (
            <div className="border border-rule rounded-lg p-3 bg-paper-alt">
              <div className="label text-oxblood mb-2">Confirm sale</div>
              <dl className="font-mono text-xs space-y-1 mb-3">
                <div className="flex justify-between gap-2"><dt className="text-ink-mute">Quantity</dt><dd className="text-ink tnum text-right">{formatQuantity(holding.quantity)} {coin.symbol}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-mute">Est. proceeds</dt><dd className="text-ink tnum text-right">{formatCurrency(holding.currentValue)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-mute">Power cost</dt><dd className="text-verdigris tnum text-right">0 — selling is always free</dd></div>
              </dl>
              <div className="flex gap-2">
                <button type="button" className="btn-ink flex-1 tap-target" disabled={pending} onClick={() => setConfirmSell(false)}>
                  <X className="w-3 h-3" /> Cancel
                </button>
                <button
                  type="button"
                  className="btn-oxblood flex-1 tap-target"
                  disabled={pending}
                  onClick={() => void confirmSellPosition()}
                >
                  {pending ? 'Committing…' : (<span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> Confirm sell</span>)}
                </button>
              </div>
            </div>
          )}
          {error && <div className="font-mono text-xs text-oxblood mt-2" role="alert">{error}</div>}
        </div>

        <button
          type="button"
          className="mt-2 label hover:text-gold transition-colors"
          onClick={() => setShowCustomTrade((open) => !open)}
          aria-expanded={showCustomTrade}
        >
          {showCustomTrade ? '▾ Hide partial / buy-more trades' : '▸ Partial sell or buy more'}
        </button>
        {showCustomTrade && (
          <div className="mt-2">
            <RoundTradePanel coin={legacyCoin} />
          </div>
        )}
      </article>
    );
  }

  // --- Not owned: quick buys -----------------------------------------------------
  const blockedReasons = QUICK_BUY_NOTIONALS.map((notional) =>
    quickBuyBlockReason({
      authenticated: !!user,
      joined,
      lifecycle,
      connection,
      collapsed: coin.dead,
      cash: roundCash,
      power: powerCurrent,
      openPositions,
      alreadyOwned: false,
      notional,
      price: coin.currentPrice
    })
  );
  const sharedBlock = blockedReasons.every((reason) => reason !== null && reason === blockedReasons[0])
    ? blockedReasons[0]
    : null;

  return (
    <article className="game-card" aria-label={`${coin.name} — available to buy`} onClick={handleCardClick}>
      {cardHeader}
      <CoinSparkline coin={coin} cycleStartTime={gameState?.startTime ?? null} />
      {signalBlock}

      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="label">Quick buy</span>
          <span className="text-xs text-ink-mute">⚡ = estimated Power cost</span>
        </div>
        {confirmNotional === null ? (
          <div className="quick-buy-grid" role="group" aria-label={`Quick buy ${coin.symbol}`}>
            {QUICK_BUY_NOTIONALS.map((notional, index) => {
              const reason = blockedReasons[index];
              const powerCost = estimateBuyPowerCost(notional);
              return (
                <button
                  key={notional}
                  type="button"
                  className="quick-buy-btn"
                  disabled={reason !== null}
                  title={reason !== null ? QUICK_BUY_BLOCK_LABEL[reason] : undefined}
                  aria-label={
                    reason !== null
                      ? `Buy ${quickBuyLabel(notional)} of ${coin.symbol} — unavailable: ${QUICK_BUY_BLOCK_LABEL[reason]}`
                      : `Buy ${quickBuyLabel(notional)} of ${coin.symbol} (estimated ${powerCost} Power)`
                  }
                  onClick={() => { setError(null); setConfirmNotional(notional); }}
                >
                  <span className="quick-buy-amount">{quickBuyLabel(notional)}</span>
                  <span className="quick-buy-power">⚡{powerCost} est.</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="border border-rule rounded-lg p-3 bg-paper-alt">
            <div className="label text-gold mb-2">Confirm quick buy</div>
            {(() => {
              const quantity = quantityForNotional(confirmNotional, coin.currentPrice);
              const estTotal = quantity === null ? 0 : Math.round(quantity * coin.currentPrice * 100) / 100;
              return (
                <dl className="font-mono text-xs space-y-1 mb-3">
                  <div className="flex justify-between gap-2"><dt className="text-ink-mute">Spend (requested)</dt><dd className="text-ink tnum text-right">{quickBuyLabel(confirmNotional)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-mute">Quantity</dt><dd className="text-ink tnum text-right">{quantity === null ? '—' : `${formatQuantity(quantity)} ${coin.symbol}`}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-mute">At displayed price</dt><dd className="text-ink tnum text-right">{formatCurrency(coin.currentPrice)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-mute">Est. total</dt><dd className="text-gold font-bold tnum text-right">{formatCurrency(estTotal)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-mute">Power (estimate)</dt><dd className="text-ink tnum text-right">⚡{estimateBuyPowerCost(confirmNotional)} — server confirms the final cost</dd></div>
                </dl>
              );
            })()}
            <div className="flex gap-2">
              <button type="button" className="btn-ink flex-1 tap-target" disabled={pending} onClick={() => setConfirmNotional(null)}>
                <X className="w-3 h-3" /> Cancel
              </button>
              <button
                type="button"
                className="btn-gold flex-1 tap-target"
                disabled={pending}
                onClick={() => void confirmQuickBuy(confirmNotional)}
              >
                {pending ? 'Committing…' : (<span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> Confirm buy</span>)}
              </button>
            </div>
          </div>
        )}
        {sharedBlock !== null && confirmNotional === null && (
          <p className="text-xs text-ink-dim mt-1.5" role="status">{QUICK_BUY_BLOCK_LABEL[sharedBlock]}</p>
        )}
        {error && <div className="font-mono text-xs text-oxblood mt-2" role="alert">{error}</div>}
      </div>

      <button
        type="button"
        className="mt-2 label hover:text-gold transition-colors"
        onClick={() => setShowCustomTrade((open) => !open)}
        aria-expanded={showCustomTrade}
      >
        {showCustomTrade ? '▾ Hide custom amount' : '▸ Custom amount'}
      </button>
      {showCustomTrade && (
        <div className="mt-2">
          <RoundTradePanel coin={legacyCoin} />
        </div>
      )}
    </article>
  );
}
