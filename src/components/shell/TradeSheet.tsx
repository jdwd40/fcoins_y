import { Dialog } from '../ui/Dialog.tsx';
import { TradeTicket } from '../TradeTicket.tsx';
import { usePersistent } from '../../context/PersistentContext.tsx';
import { CoinAvatar } from '../ui/CoinAvatar.tsx';

// The trade sheet: the shared TradeTicket inside the accessible Dialog.
// Opened via shell services from the market board, coin page and portfolio.

interface TradeSheetProps {
  coinId: number | null;
  side: 'BUY' | 'SELL';
  onClose: () => void;
}

export function TradeSheet({ coinId, side, onClose }: TradeSheetProps) {
  const { signals } = usePersistent();
  const coin = coinId === null ? null : signals?.coins.find((c) => c.coinId === coinId) ?? null;

  return (
    <Dialog
      open={coinId !== null}
      onClose={onClose}
      title={
        coin ? (
          <span className="flex items-center gap-3">
            <CoinAvatar symbol={coin.symbol} coinId={coin.coinId} size="sm" dead={coin.dead} />
            <span>
              {coin.name}
              <span className="block text-xs font-normal text-ink-mute font-mono">{coin.symbol}/GBP</span>
            </span>
          </span>
        ) : (
          'Trade'
        )
      }
    >
      {coinId !== null && (
        // key resets the ticket per coin/side so stale form state never leaks
        // between sheets.
        <TradeTicket key={`${coinId}-${side}`} coinId={coinId} initialSide={side} onDone={onClose} />
      )}
    </Dialog>
  );
}
