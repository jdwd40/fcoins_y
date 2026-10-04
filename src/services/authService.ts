// Auth REST client + session normalisation.
//
// Identity rules (quadrant D finding M1):
//  - `user_id` from the response body is the AUTHORITATIVE identity source.
//  - The JWT decode is a secondary cross-check only; a mismatch fails the
//    login rather than silently picking a winner.
//  - A malformed payload (no user object, no usable user_id, no token)
//    FAILS the login. The client never fabricates an identity — no default
//    id, no invented email, no assumed funds — and never persists a
//    partial/guessed user. Persistence happens only after a fully validated
//    session exists (see loginUser/registerUser below).
import type { LoginCredentials, RegisterCredentials, User } from '../types';
import { API_BASE_URL } from './apiConfig.ts';
import { getUserIdFromToken, isTokenExpired, parsePositiveUserId } from '../utils/jwt.ts';

export interface AuthSession {
  token: string;
  user: User;
}

// Minimal storage contract so tests can observe persistence with a fake.
export type SessionStorage = Pick<Storage, 'setItem'>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

// Validate + normalise a login-envelope payload into a session. Pure: no
// storage, no fetch, no side effects. Throws on anything malformed.
export function normalizeAuthResponse(data: unknown): AuthSession {
  const envelope = asRecord(data);
  if (!envelope) {
    throw new Error('Login failed: the server returned a malformed response');
  }

  const token = envelope.token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Login response missing authentication token');
  }

  const rawUser = asRecord(envelope.user);
  if (!rawUser) {
    throw new Error('Login failed: the server response did not include a user');
  }

  // Authoritative identity: the response body's user_id.
  const userId = parsePositiveUserId(rawUser.user_id);
  if (userId === null) {
    throw new Error('Login failed: the server response did not include a valid user id');
  }

  // A structurally valid, unexpired token must carry the same identity.
  const tokenUserId = getUserIdFromToken(token);
  if (tokenUserId === null || isTokenExpired(token)) {
    throw new Error('Login failed: invalid or expired authentication token');
  }
  if (tokenUserId !== userId) {
    throw new Error('Login failed: the user id does not match the authentication token');
  }

  const email = rawUser.email;
  if (typeof email !== 'string' || email.length === 0) {
    throw new Error('Login failed: the server response did not include a valid email');
  }

  const user: User = { id: userId, email };

  if (typeof rawUser.username === 'string' && rawUser.username.length > 0) {
    user.username = rawUser.username;
  }

  // funds arrives as a pg NUMERIC string; carry it only when it parses.
  const funds = typeof rawUser.funds === 'string' || typeof rawUser.funds === 'number'
    ? Number(rawUser.funds)
    : NaN;
  if (Number.isFinite(funds)) {
    user.funds = funds;
  }

  return { token, user };
}

export function persistSession(storage: SessionStorage, session: AuthSession): void {
  storage.setItem('token', session.token);
  storage.setItem('user', JSON.stringify(session.user));
}

// Startup and refresh use the same pure validation as login. Stored app users
// have id, not user_id; never parseInt, repair, or cast unvalidated JSON to User.
export function restoreAuthSession(token: string | null, storedUser: string | null): AuthSession | null {
  if (!token || !storedUser) return null;
  try {
    const rawUser = asRecord(JSON.parse(storedUser));
    if (!rawUser) return null;
    return normalizeAuthResponse({ token, user: { ...rawUser, user_id: rawUser.id } });
  } catch {
    return null;
  }
}

async function postAuthJson(path: string, body: unknown, fallbackError: string): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const responseText = await response.text();

  let data: unknown;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error('Server returned invalid JSON response');
  }

  if (!response.ok) {
    const msg = asRecord(data)?.msg;
    throw new Error(typeof msg === 'string' && msg.length > 0 ? msg : fallbackError);
  }

  return data;
}

// Login and persist the session ONLY when the payload validated. On a
// malformed payload this rejects before touching storage — nothing is
// persisted.
export async function loginUser(credentials: LoginCredentials, storage: SessionStorage): Promise<AuthSession> {
  const data = await postAuthJson('/users/login', credentials, 'Login failed');
  const session = normalizeAuthResponse(data);
  persistSession(storage, session);
  return session;
}

// Registration returns no token; the app logs in immediately after. The
// session is persisted only when the auto-login payload validates.
export async function registerUser(credentials: RegisterCredentials, storage: SessionStorage): Promise<AuthSession> {
  await postAuthJson('/users/register', credentials, 'Registration failed');
  try {
    return await loginUser({ email: credentials.email, password: credentials.password }, storage);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auto-login failed after registration';
    throw new Error(message.startsWith('Auto-login failed') ? message : `Auto-login failed after registration: ${message}`);
  }
}
