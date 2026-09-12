import { parsePrice } from '../services/transactionService.ts';

export function isCoinCollapsed(price: string | number): boolean {
  return !(parsePrice(price) > 0);
}

export const GAME_STARTING_CASH_LABEL = '£10,000';
export const TRADE_QUANTITY_MAX_DECIMALS = 8;
export const TRADE_MIN_VALUE = 0.01;
export type TradeQuantityParse = { ok: true; value: number } | { ok: false; error: string };

const PLAIN_QUANTITY_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

function significantDecimalPlaces(text: string): number {
  const fraction = text.includes('.') ? text.slice(text.indexOf('.') + 1) : '';
  return fraction.replace(/0+$/, '').length;
}

export function parseTradeQuantity(raw: string): TradeQuantityParse {
  const text = raw.trim();
  if (text === '') return { ok: false, error: 'Enter a quantity greater than 0' };
  if (!PLAIN_QUANTITY_PATTERN.test(text)) {
    return { ok: false, error: 'Enter a valid decimal quantity (digits with at most one decimal point)' };
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: 'Enter a quantity greater than 0' };
  }
  if (significantDecimalPlaces(text) > TRADE_QUANTITY_MAX_DECIMALS) {
    return {
      ok: false,
      error: `Quantities support up to ${TRADE_QUANTITY_MAX_DECIMALS} decimal places — reduce the precision instead of rounding`
    };
  }
  return { ok: true, value };
}

export function minTradeValueError(total: number, price: number): string | null {
  if (!(price > 0) || !(total < TRADE_MIN_VALUE)) return null;
  return `Trade value must be at least £${TRADE_MIN_VALUE.toFixed(2)}. This trade totals £${total.toFixed(2)} at the current price.`;
}

export function formatQuantity(quantity: number): string {
  if (!Number.isFinite(quantity) || quantity === 0) return '0';
  return quantity.toFixed(TRADE_QUANTITY_MAX_DECIMALS).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatAbsoluteTimestamp(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  return new Date(time).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function formatActivityTimestamp(createdAt: string, nowMs: number): string {
  const then = Date.parse(createdAt);
  if (!Number.isFinite(then)) return '';
  const diffMs = nowMs - then;
  if (diffMs < 45_000) return 'just now';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatAbsoluteTimestamp(createdAt);
}

export function findMyEntry<T extends { userId: number }>(
  entries: T[] | undefined,
  userId: number | null | undefined
): T | null {
  if (!entries || userId === null || userId === undefined) return null;
  return entries.find((entry) => entry.userId === userId) ?? null;
}

export function formatSignedGbp(value: number): string {
  const abs = Math.abs(value).toLocaleString('en-GB', {
    style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  return `${value < 0 ? '-' : '+'}${abs}`;
}

export function personalityLabel(personality: string | null): string | null {
  if (!personality) return null;
  return personality.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const PERSISTENT_LEADERBOARD_RULE_COPY =
  'Ranked by net worth (cash + holdings − debt). Backend rank is authoritative.';

export const HOW_TO_PLAY_TITLE = 'HOW TO PLAY THE PERSISTENT MARKET';
export const HOW_TO_PLAY_TAGLINE = 'NO TIMER. NO RESET. CASH COMPOUNDS.';
export const HOW_TO_PLAY_STARTING_CASH = GAME_STARTING_CASH_LABEL;

export interface HowToPlayStep {
  id: string;
  title: string;
  body: string;
}

export const HOW_TO_PLAY_STEPS: HowToPlayStep[] = [
  { id: 'enter', title: "YOU'RE IN", body: `The market runs continuously — no lobby, no entry button, no countdown. Sign in and your ${HOW_TO_PLAY_STARTING_CASH} Cash is waiting, owned and kept by the server. It is fantasy play money, completely separate from any real-world funds, and it is not an investment product.` },
  { id: 'trade', title: 'TRADE', body: 'Buy and sell fantasy coins with your Cash as prices rise and fall. Fractional quantities are supported. Tap any coin card to open its detail view.' },
  { id: 'persist', title: 'IT STICKS', body: `Your portfolio and leaderboard rank persist across sessions. The market never resets your Cash. ${PERSISTENT_LEADERBOARD_RULE_COPY}` },
  { id: 'bag', title: "DON'T HOLD THE BAG", body: 'Coins can permanently die. Dead holdings stay on your account as historical positions at £0 and cannot be traded.' },
  { id: 'replace', title: 'NEW BLOOD', body: 'When coins die, replacement coins may enter the market. Keep scanning the board for new names.' },
  { id: 'bots', title: 'BEAT THE BOTS', body: 'Rule-based bots trade alongside you on the same persistent leaderboard. They read the same public market signals.' },
  { id: 'cash', title: 'CASH COMPOUNDS', body: 'Climb the persistent leaderboard by growing net worth over time — cash plus live holdings, minus debt. Virtual GBP only.' }
];

export const QUICK_BUY_NOTIONALS: readonly number[] = [250, 500, 1000, 2500];

export function quickBuyLabel(notional: number): string {
  if (notional === 1000) return '£1K';
  if (notional === 2500) return '£2.5K';
  return `£${notional}`;
}

export function quantityForNotional(notional: number, price: number): number | null {
  if (!Number.isFinite(notional) || notional <= 0 || !Number.isFinite(price) || price <= 0) return null;
  const quantity = Math.floor((notional / price) * 1e8) / 1e8;
  return quantity > 0 ? quantity : null;
}

export function formatRecentChangePct(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return '—';
  return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

export function momentumArrow(momentum: 'UP' | 'DOWN' | 'FLAT'): string {
  if (momentum === 'UP') return '▲ UP';
  if (momentum === 'DOWN') return '▼ DOWN';
  return '◆ FLAT';
}

export const ARCHETYPE_PERSONALITY: Record<string, string> = {
  ZIP: 'fast, small swings', MOON: 'steady bread-and-butter cycles', BULL: 'medium swing trading',
  HODL: 'slow cycles, big swings', DEGEN: 'wild and unpredictable', RUG: 'extreme opportunity and risk'
};

export function archetypePersonality(archetype: string): string {
  return ARCHETYPE_PERSONALITY[archetype] ?? 'cyclical trader';
}

export function formatSignedPct(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return '—';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}
