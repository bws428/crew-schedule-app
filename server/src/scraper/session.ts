/**
 * In-memory FLICA session storage.
 * Stores the session token (32-char hex) and cookie header string.
 * Not persisted — must be re-entered on server restart.
 */

const TOKEN_REGEX = /^[0-9a-fA-F]{32}$/;

export interface FlicaSession {
  /** 32-char hex FLICA session token */
  token: string;
  /** Full Cookie header value (may be empty) */
  cookies: string;
}

let currentSession: FlicaSession | null = null;

/** Store a FLICA session. Throws if token format is invalid. */
export function setSession(session: FlicaSession): void {
  const trimmedToken = session.token.trim();
  if (!TOKEN_REGEX.test(trimmedToken)) {
    throw new Error(
      `Invalid FLICA token format. Expected 32 hex characters, got ${trimmedToken.length} chars.`
    );
  }
  currentSession = {
    token: trimmedToken,
    cookies: session.cookies.trim(),
  };
}

/** Get the stored FLICA session, or null if none. */
export function getSession(): FlicaSession | null {
  return currentSession;
}

/** Clear the stored FLICA session. */
export function clearSession(): void {
  currentSession = null;
}

/** Check whether a session is currently stored. */
export function hasSession(): boolean {
  return currentSession !== null;
}

// ── Backwards-compat aliases ────────────────────────────────────

/** @deprecated Use setSession() */
export function setToken(token: string): void {
  setSession({ token, cookies: '' });
}

/** @deprecated Use getSession() */
export function getToken(): string | null {
  return currentSession?.token ?? null;
}

/** @deprecated Use clearSession() */
export const clearToken = clearSession;

/** @deprecated Use hasSession() */
export const hasToken = hasSession;
