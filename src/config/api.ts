/**
 * API origin for all frontend HTTP calls.
 *
 * Staging / local: set at build time, e.g.
 *   VITE_API_BASE_URL=https://staging.example.com/api-2/api npm run build
 *
 * Production default matches the live VPS path so existing deploys keep working
 * when the env var is unset.
 */
const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

export const API_BASE = (raw && raw.length > 0 ? raw : 'https://jdwd40.com/api-2/api').replace(
  /\/$/,
  ''
);
