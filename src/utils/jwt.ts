// JWT payload decoding for the auth flow.
//
// JWTs are base64url-encoded (RFC 7515), not plain base64: payloads may
// contain '-' and '_' and omit padding. Feeding such a payload straight into
// atob() throws, and the old catch paths treated a VALID token as expired,
// forcing a logout. Normalise base64url -> base64 (and restore padding)
// before decoding.

export function base64UrlToBase64(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (base64.length % 4)) % 4;
  return base64 + '='.repeat(padding);
}

// Returns the decoded payload, or null when the token is not a 3-part JWT
// with a JSON payload.
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part) || part.length % 4 === 1)) {
    return null;
  }
  try {
    const decode = (part: string): unknown => {
      const bytes = Uint8Array.from(atob(base64UrlToBase64(part)), char => char.charCodeAt(0));
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    };
    const header = decode(parts[0]);
    // Structural validation only; the backend alone verifies signatures.
    if (!isRecord(header) || header.alg !== 'HS256') return null;
    const payload = decode(parts[1]);
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parsePositiveUserId(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[1-9]\d*$/.test(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Only the backend's user_id claim is an identity authority.
export function getUserIdFromToken(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return null;
  }
  return parsePositiveUserId(payload.user_id);
}

// A token we cannot decode is treated as expired (fail closed). A decodable
// token with a missing/malformed expiry or identity also fails closed.
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return true;
  }
  const exp = payload.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= 0 || parsePositiveUserId(payload.user_id) === null) {
    return true;
  }
  // exp is in seconds, Date.now() is in milliseconds
  return Date.now() >= exp * 1000;
}
