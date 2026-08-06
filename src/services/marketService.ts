// Market data service (plan §11.3) — public reads via PostgREST + RPC.
import { supabase, coins } from '../lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { mapRpcError } from './errorMapper';
import type {
  PublicAsset, MarketStatusView, PriceHistoryResult, MarketHistoryResult,
} from '../types/database';

export type AssetRange = '24H' | '7D' | '30D' | 'ALL';
export type MarketRange = '5M' | '10M' | '30M' | '1H' | '2H' | '12H' | '24H' | 'ALL';

export async function fetchAssets(): Promise<PublicAsset[]> {
  const { data, error } = await coins()
    .from('public_assets')
    .select('*')
    .order('market_cap', { ascending: false });
  if (error) throw mapRpcError(error);
  return data as PublicAsset[];
}

export async function fetchAsset(assetId: number): Promise<PublicAsset | null> {
  const { data, error } = await coins()
    .from('public_assets')
    .select('*')
    .eq('id', assetId)
    .maybeSingle();
  if (error) throw mapRpcError(error);
  return data as PublicAsset | null;
}

export async function fetchMarketStatus(): Promise<MarketStatusView> {
  const { data, error } = await coins()
    .from('market_status_view')
    .select('*')
    .single();
  if (error) throw mapRpcError(error);
  return data as MarketStatusView;
}

export async function fetchPriceHistory(
  assetId: number, range: AssetRange,
): Promise<PriceHistoryResult> {
  const { data, error } = await coins()
    .rpc('get_price_history', { p_asset_id: assetId, p_range: range });
  if (error) throw mapRpcError(error);
  return data as PriceHistoryResult;
}

export async function fetchMarketHistory(range: MarketRange): Promise<MarketHistoryResult> {
  const { data, error } = await coins()
    .rpc('get_market_history', { p_range: range });
  if (error) throw mapRpcError(error);
  return data as MarketHistoryResult;
}

/** Aggregate stats for the MarketStats header: latest index value plus
 * all-time high/low from the durable market history. */
export interface MarketStatsData {
  currentValue: number;
  latestValue: number;
  allTimeHigh: number | null;
  allTimeLow: number | null;
}

export async function fetchMarketStats(): Promise<MarketStatsData> {
  const assets = await fetchAssets();
  const currentValue = assets.reduce((sum, a) => sum + Number(a.current_price), 0);
  const history = await fetchMarketHistory('ALL');
  const points = history.points ?? [];
  return {
    currentValue,
    latestValue: currentValue,
    allTimeHigh: points.length ? Math.max(...points.map((p) => Number(p.high))) : null,
    allTimeLow: points.length ? Math.min(...points.map((p) => Number(p.low))) : null,
  };
}

/**
 * Subscribe to current-price + market-status changes (display freshness
 * only — never proof a trade committed). Caller must unsubscribe on cleanup
 * and refetch a full snapshot on reconnect.
 */
export function subscribeMarket(
  onAsset: (row: PublicAsset) => void,
  onStatus: () => void,
) {
  const channel = supabase
    .channel('coins-market')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'coins', table: 'assets' },
      (payload: RealtimePostgresChangesPayload<PublicAsset>) => onAsset(payload.new as PublicAsset))
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'coins', table: 'market_state' },
      () => onStatus())
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
