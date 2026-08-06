// Shared RPC/PostgREST error mapping (plan §8.3, §11.1)
import type { CoinsErrorCode } from '../types/database';

const KNOWN_CODES: CoinsErrorCode[] = [
  'NOT_AUTHENTICATED', 'ACCOUNT_NOT_BOOTSTRAPPED', 'INVALID_USERNAME',
  'USERNAME_TAKEN', 'INVALID_QUANTITY', 'ASSET_NOT_FOUND', 'MARKET_HALTED',
  'INSUFFICIENT_FUNDS', 'INSUFFICIENT_HOLDINGS', 'IDEMPOTENCY_CONFLICT',
  'INVALID_RANGE', 'SEQUENCE_MISMATCH', 'ARCHIVE_NOT_CONFIRMED',
];

export class CoinsError extends Error {
  readonly code: CoinsErrorCode;
  constructor(code: CoinsErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'CoinsError';
    this.code = code;
  }
}

/** Extract the stable machine code from a PostgREST/RPC error. */
export function mapRpcError(err: unknown): CoinsError {
  const message =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err);
  const code = KNOWN_CODES.find((c) => message.includes(c)) ?? 'UNKNOWN';
  return new CoinsError(code, message);
}

/** Map Supabase Auth / GoTrue errors to readable copy. */
export function mapAuthError(err: unknown): string {
  const message =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err);
  const lower = message.toLowerCase();
  if (lower.includes('email not confirmed')) {
    return 'Confirm your email before signing in. Check your inbox for the link.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'Email or password is incorrect.';
  }
  if (lower.includes('user already registered')) {
    return 'An account with that email already exists. Try signing in.';
  }
  if (lower.includes('password')) {
    return message;
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return message || 'Authentication failed. Please try again.';
}

/** User-facing copy per code (components may override). */
export function describeError(code: CoinsErrorCode): string {
  switch (code) {
    case 'NOT_AUTHENTICATED': return 'Please sign in to continue.';
    case 'ACCOUNT_NOT_BOOTSTRAPPED': return 'Account setup is incomplete.';
    case 'INVALID_USERNAME': return 'Choose a username between 1 and 50 characters.';
    case 'USERNAME_TAKEN': return 'That username is already taken.';
    case 'INVALID_QUANTITY': return 'Enter a valid quantity (positive, up to 12 decimals).';
    case 'ASSET_NOT_FOUND': return 'This coin is no longer available.';
    case 'MARKET_HALTED': return 'The market is currently halted. Trading is paused.';
    case 'INSUFFICIENT_FUNDS': return 'Insufficient funds for this purchase.';
    case 'INSUFFICIENT_HOLDINGS': return 'You do not hold enough of this coin to sell.';
    case 'IDEMPOTENCY_CONFLICT': return 'This request conflicts with an earlier submission.';
    case 'INVALID_RANGE': return 'Unsupported chart range.';
    default: return 'Something went wrong. Please try again.';
  }
}
