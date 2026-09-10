// Wave 4: server-clock countdown for Director windows and coin events.
// Remaining time is derived from the payload's serverTime plus local
// elapsed since that payload arrived — never from a raw local clock alone.
// Clamp >= 0; never count negative. Compact format: `8m 12s`, `42s`,
// or `Ended — updating` once remaining hits zero (UI removes on next poll).

/** Milliseconds remaining until endsAt on the derived server clock. */
export function remainingMs(
  endsAt: string,
  serverTime: string,
  receivedAtLocal: number,
  nowLocal: number
): number {
  const serverNow = Date.parse(serverTime) + Math.max(0, nowLocal - receivedAtLocal);
  const endsMs = Date.parse(endsAt);
  if (!Number.isFinite(serverNow) || !Number.isFinite(endsMs)) return 0;
  return Math.max(0, endsMs - serverNow);
}

/** Compact remaining display. Never negative. */
export function formatRemaining(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  if (clamped <= 0) return 'Ended — updating';
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
