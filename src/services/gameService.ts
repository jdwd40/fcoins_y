// Game state service — Crypto Chaos Core 1 (Global Apocalypse Cycle).
// Public poll contract for the server-owned global cycle. Clients must use
// server_time/remaining_ms from the response — never a local timer.
import { coins } from '../lib/supabase';
import { mapRpcError } from './errorMapper';
import type { GameState } from '../types/database';

/**
 * Fetch the current global apocalypse state. Safe to poll: the RPC is
 * self-healing and advances the cycle server-side if the previous round
 * expired, so the game progresses even with no players online.
 */
export async function fetchGameState(): Promise<GameState> {
  const { data, error } = await coins().rpc('get_game_state');
  if (error) throw mapRpcError(error);
  return data as GameState;
}
