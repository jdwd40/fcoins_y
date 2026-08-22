import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useGame } from '../context/GameContext.tsx';
import { SessionExpiredError, formatCurrency, parsePrice } from '../services/transactionService.ts';
import { GameApiError } from '../services/gameService.ts';
import { isCoinCollapsed, tradeBlockReason, TRADE_BLOCK_LABEL, formatQuantity, parseTradeQuantity } from '../utils/gameLogic.ts';
import type { Coin } from '../types';
import { Check, X } from 'lucide-react';

interface RoundTradePanelProps {
  coin: Coin;
}

// Crypto Chaos round trading (Core 4): buys and sells settle against the
// participant's ROUND cash/holdings for the current apocalypse — never the
// legacy account funds. The authoritative cycle id travels with every
// request; the backend validates cycle/freeze/collapse state again at commit
// time, and any domain rejection refreshes game state instead of leaving
// optimistic UI behind.
export function RoundTradePanel({ coin }: RoundTradePanelProps) {
  const { user, handleSessionExpired } = useAuth();
  const { showToast } = useToast();
  const { joined, myEntry, myParticipant, lifecycle, connection, trade } = useGame();

  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const collapsed = isCoinCollapsed(coin.current_price);
  const currentPrice = parsePrice(coin.current_price);
  // The quantity is validated against the authoritative ledger precision
  // (DECIMAL(18,8)) as the user types — an unparseable or over-precise entry
  // is worth exactly nothing until it validates; it is never rounded.
  const parsedQuantity = parseTradeQuantity(amount);
  const amountValue = parsedQuantity.ok ? parsedQuantity.value : 0;
  const total = Math.round(amountValue * currentPrice * 100) / 100;

  const roundCash = myEntry?.currentCash ?? myParticipant?.currentCash ?? 0;
  const heldQuantity = useMemo(() => {
    const holding = myParticipant?.holdings.find((h) => h.coinId === coin.coin_id);
    return holding?.quantity ?? 0;
  }, [myParticipant, coin.coin_id]);

  const blockReason = tradeBlockReason({
    lifecycle,
    connection,
    joined,
    coinCollapsed: side === 'BUY' ? collapsed : false, // selling a dead coin is legal (credits £0)
    authenticated: !!user
  });

  const sideBlockReason = side === 'SELL' && blockReason === 'coin-collapsed' ? null : blockReason;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  const validationError = (): string | null => {
    if (!parsedQuantity.ok) return parsedQuantity.error;
    if (side === 'BUY' && total > roundCash) {
      return `Insufficient round cash. You need ${formatCurrency(total)} but have ${formatCurrency(roundCash)}.`;
    }
    if (side === 'SELL' && amountValue > heldQuantity) {
      return `Insufficient round holdings. You hold ${formatQuantity(heldQuantity)} ${coin.symbol} this round.`;
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sideBlockReason) return;
    const invalid = validationError();
    if (invalid) {
      setError(invalid);
      return;
    }
    setConfirming(true);
  };

  const handleConfirm = async () => {
    setPending(true);
    setError(null);
    try {
      await trade(side, coin.coin_id, amountValue);
      showToast(
        side === 'BUY'
          ? `Bought ${formatQuantity(amountValue)} ${coin.symbol} for the round`
          : `Sold ${formatQuantity(amountValue)} ${coin.symbol} for the round`,
        'success'
      );
      setAmount('');
      setConfirming(false);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        handleSessionExpired();
        showToast('Your session has expired. Please log in again.', 'error');
      } else if (err instanceof GameApiError) {
        // Backend rejection before mutation (collapsed coin mid-flight,
        // stale cycle, SETTLING, insufficient cash/oversell): show the exact
        // server message; GameContext already forced a resync.
        setError(err.message);
        showToast(err.message, 'error');
      } else {
        const message = err instanceof Error ? err.message : 'Trade failed';
        setError(message);
        showToast(message, 'error');
      }
      setConfirming(false);
    } finally {
      setPending(false);
    }
  };

  if (collapsed && side === 'BUY') {
    // A dead coin can never be bought — from any route into buying.
    return (
      <div className="border border-oxblood rounded-xl p-5 bg-paper-alt text-center" role="note">
        <div className="label text-oxblood mb-2">Collapsed</div>
        <p className="font-display text-xl font-bold text-ink">{coin.symbol} is dead</p>
        <p className="text-sm text-ink-dim mt-2">
          This coin collapsed to £0.00 and can never be bought again. It stays on the market as a warning.
        </p>
        {joined && heldQuantity > 0 && (
          <button onClick={() => setSide('SELL')} className="btn-ink mt-4">
            Sell remaining {formatQuantity(heldQuantity)} {coin.symbol} for £0.00
          </button>
        )}
      </div>
    );
  }

  if (sideBlockReason) {
    const label = TRADE_BLOCK_LABEL[sideBlockReason];
    return (
      <div className="border border-rule rounded-xl p-5 bg-paper-alt text-center">
        <div className="label mb-2">Round trading</div>
        <p className="text-sm text-ink-dim">{label}</p>
        {sideBlockReason === 'settling' && (
          <p className="font-display text-lg text-ink mt-2">Market frozen · calculating the damage…</p>
        )}
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="border border-rule rounded-xl p-5 bg-paper-alt">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-rule">
          <div>
            <div className={`label ${side === 'BUY' ? 'text-gold' : 'text-oxblood'}`}>
              Confirm round {side === 'BUY' ? 'purchase' : 'sale'}
            </div>
            <h3 className="font-display font-semibold text-2xl text-ink">Review order</h3>
          </div>
          <button onClick={() => setConfirming(false)} disabled={pending} className="text-ink-mute hover:text-ink" aria-label="Cancel review">
            <X className="w-4 h-4" />
          </button>
        </div>
        <dl className="space-y-2 mb-5 font-mono text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-mute">Quantity</dt>
            <dd className="text-ink tnum">{formatQuantity(amountValue)} {coin.symbol}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-mute">Unit price</dt>
            <dd className="text-ink tnum">{formatCurrency(currentPrice)}</dd>
          </div>
          <div className="flex justify-between border-t border-rule pt-2 mt-2">
            <dt className="text-ink font-bold">{side === 'BUY' ? 'Total' : 'Proceeds'}</dt>
            <dd className={`tnum font-bold ${side === 'BUY' ? 'text-gold' : 'text-verdigris'}`}>{formatCurrency(total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-mute">Round cash after</dt>
            <dd className="text-ink-dim tnum">{formatCurrency(side === 'BUY' ? roundCash - total : roundCash + total)}</dd>
          </div>
        </dl>
        <div className="flex gap-3">
          <button onClick={() => setConfirming(false)} disabled={pending} className="btn-ink flex-1">Cancel</button>
          <button onClick={() => void handleConfirm()} disabled={pending} className={`flex-1 ${side === 'BUY' ? 'btn-gold' : 'btn-oxblood'}`}>
            {pending ? 'Committing…' : (
              <span className="inline-flex items-center gap-2 justify-center">
                <Check className="w-3 h-3" /> Confirm {side === 'BUY' ? 'buy' : 'sell'}
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-rule rounded-xl p-5 bg-paper-alt">
      <div className="mb-4 pb-3 border-b border-rule">
        <div className="label">Round trading · this apocalypse only</div>
        <div className="flex gap-2 mt-2" role="group" aria-label="Trade side">
          <button
            type="button"
            onClick={() => { setSide('BUY'); setError(null); }}
            className={side === 'BUY' ? 'btn-gold flex-1' : 'btn-ink flex-1'}
            aria-pressed={side === 'BUY'}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => { setSide('SELL'); setError(null); }}
            className={side === 'SELL' ? 'btn-oxblood flex-1' : 'btn-ink flex-1'}
            aria-pressed={side === 'SELL'}
          >
            Sell
          </button>
        </div>
      </div>

      {side === 'SELL' && heldQuantity <= 0 ? (
        <p className="text-center text-sm text-ink-mute py-4">
          No {coin.symbol} in this round's holdings.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="round-amount" className="label block mb-2">Quantity</label>
            <div className="relative">
              <input
                id="round-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                className="input-ink"
                placeholder="0.004"
                disabled={pending}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none pr-3">
                <span className="font-mono text-xs text-ink-mute tracking-caps">{coin.symbol}</span>
              </div>
            </div>
            {side === 'SELL' && heldQuantity > 0 && (
              <button type="button" onClick={() => setAmount(formatQuantity(heldQuantity))} className="mt-2 label hover:text-gold transition-colors">
                → Sell all ({formatQuantity(heldQuantity)})
              </button>
            )}
          </div>

          <div className="flex justify-between items-baseline py-3 border-y border-rule">
            <div>
              <div className="label mb-1">Unit</div>
              <div className="font-mono text-sm text-ink tnum">{formatCurrency(currentPrice)}</div>
            </div>
            <div className="text-right">
              <div className="label mb-1">{side === 'BUY' ? 'Total' : 'Proceeds'}</div>
              <div className="font-mono text-sm sm:text-base tnum text-gold">{formatCurrency(total)}</div>
            </div>
          </div>

          <div className="label">
            Round cash · <span className="text-ink-dim">{formatCurrency(roundCash)}</span>
            {side === 'SELL' && <span className="ml-3">Held · <span className="text-ink-dim">{formatQuantity(heldQuantity)} {coin.symbol}</span></span>}
          </div>

          {error && <div className="font-mono text-xs text-oxblood" role="alert">{error}</div>}

          <button type="submit" className={`w-full ${side === 'BUY' ? 'btn-gold' : 'btn-oxblood'}`} disabled={pending || !amount}>
            {side === 'BUY' ? 'Place round buy' : 'Place round sell'}
          </button>
        </form>
      )}
    </div>
  );
}
