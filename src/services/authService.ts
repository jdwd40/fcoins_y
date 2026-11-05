// Auth payload validation and session persistence, kept free of React so the
// login/registration flow is unit-testable with a fake fetch and storage.
//
// Nothing here invents identity: a payload that is missing, malformed or
// disagrees with its own JWT rejects, and nothing is written to storage.
import type {
  AuthResponse,
  BackendUser,
  LoginCredentials,
  RegisterCredentials,
  User
} from '../types';
import { API_BASE_URL } from './apiConfig.ts';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const INVALID_RESPONSE = 'Login response contained invalid account data';

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Untrusted<T> = { [K in keyof T]?: unknown };
type UntrustedUser = Untrusted<BackendUser> & { id?: unknown };

export interface AuthSession {
  token: string;
  user: User;
}

export interface AuthDeps {
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  storage?: SessionStorage;
  baseUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUserId(value: unknown): number | null {
  const id = typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : value;
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseFunds(value: unknown): number | null {
  const funds = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof funds === 'number' && Number.isFinite(funds) ? funds : null;
}

/** Decodes a JWT payload (base64url, optional padding, UTF-8); null if malformed. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/gu, '+').replace(/_/gu, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    const payload: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function getUserIdFromToken(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  // The backend signs `user_id`; the other claims are tolerated for parity.
  return parseUserId(payload.user_id ?? payload.sub ?? payload.id ?? payload.userId);
}

/** Unreadable tokens count as expired; a token without `exp` never expires. */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  if (payload.exp === undefined) return false;
  return typeof payload.exp !== 'number' || Date.now() >= payload.exp * 1000;
}

function toUser(raw: UntrustedUser, id: number | null, tokenUserId: number | null): User | null {
  if (id === null || id !== tokenUserId) return null;
  if ([raw.id, raw.user_id].some((value) => value !== undefined && parseUserId(value) !== id)) {
    return null;
  }

  const { username, email } = raw;
  const funds = parseFunds(raw.funds);
  if (typeof username !== 'string' || username.trim() === '') return null;
  if (typeof email !== 'string' || !email.includes('@')) return null;
  if (funds === null) return null;

  return { id, username, email, funds };
}

/** Validates a login envelope into a session, throwing on anything untrustworthy. */
export function normalizeAuthResponse(data: unknown): AuthSession {
  if (!isRecord(data)) throw new Error(INVALID_RESPONSE);

  const { token, user: rawUser }: Untrusted<AuthResponse> = data;
  if (typeof token !== 'string' || token === '') {
    throw new Error('Login response missing authentication token');
  }
  if (!isRecord(rawUser) || isTokenExpired(token)) throw new Error(INVALID_RESPONSE);

  const raw: UntrustedUser = rawUser;
  const user = toUser(raw, parseUserId(raw.user_id), getUserIdFromToken(token));
  if (!user) throw new Error(INVALID_RESPONSE);

  return { token, user };
}

export function clearSession(storage: SessionStorage): void {
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(USER_KEY);
}

function persistSession(storage: SessionStorage, session: AuthSession): void {
  try {
    storage.setItem(TOKEN_KEY, session.token);
    storage.setItem(USER_KEY, JSON.stringify(session.user));
  } catch (err) {
    clearSession(storage);
    throw err;
  }
}

/** Restores a stored session; anything invalid or expired is cleared instead. */
export function readStoredSession(storage: SessionStorage): AuthSession | null {
  const token = storage.getItem(TOKEN_KEY);
  const storedUser = storage.getItem(USER_KEY);

  try {
    if (token && storedUser && !isTokenExpired(token)) {
      const raw: unknown = JSON.parse(storedUser);
      if (isRecord(raw)) {
        const user = toUser(raw, parseUserId(raw.id), getUserIdFromToken(token));
        if (user) return { token, user };
      }
    }
  } catch {
    // Unparseable stored user: cleared below.
  }

  clearSession(storage);
  return null;
}

async function postJson(
  path: string,
  body: LoginCredentials | RegisterCredentials,
  fallbackError: string,
  deps: AuthDeps
): Promise<unknown> {
  const fetchImpl = deps.fetchImpl ?? ((url, init) => fetch(url, init));
  const response = await fetchImpl(`${deps.baseUrl ?? API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  let data: unknown;
  try {
    data = JSON.parse(await response.text());
  } catch {
    throw new Error('Server returned invalid JSON response');
  }

  if (!response.ok) {
    const msg = isRecord(data) ? data.msg : undefined;
    throw new Error(typeof msg === 'string' && msg !== '' ? msg : fallbackError);
  }
  return data;
}

export async function loginUser(credentials: LoginCredentials, deps: AuthDeps = {}): Promise<User> {
  const session = normalizeAuthResponse(await postJson('/users/login', credentials, 'Login failed', deps));
  persistSession(deps.storage ?? localStorage, session);
  return session.user;
}

/** Registers, then logs in: the registration endpoint does not issue a token. */
export async function registerUser(credentials: RegisterCredentials, deps: AuthDeps = {}): Promise<User> {
  await postJson('/users/register', credentials, 'Registration failed', deps);

  try {
    return await loginUser({ email: credentials.email, password: credentials.password }, deps);
  } catch (err) {
    throw new Error(`Auto-login failed: ${err instanceof Error ? err.message : 'please log in'}`);
  }
}
