import * as SecureStore from 'expo-secure-store';
import { getDatabase } from '../db/database';

const PASSWORD_KEY = 'flica_password';

export interface SessionState {
  username: string | null;
  isLoggedIn: boolean;
  lastLoginAt: string | null;
  employeeNumber: string | null;
}

// ── Credential storage ────────────────────────────────────────

export async function saveCredentials(username: string, password: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO session_state (key, value) VALUES ('username', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [username],
  );
  await SecureStore.setItemAsync(PASSWORD_KEY, password);
}

export async function getCredentials(): Promise<{ username: string; password: string } | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM session_state WHERE key = 'username'",
  );
  if (!row) return null;

  const password = await SecureStore.getItemAsync(PASSWORD_KEY);
  if (!password) return null;

  return { username: row.value, password };
}

export async function clearCredentials(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM session_state WHERE key = 'username'");
  await SecureStore.deleteItemAsync(PASSWORD_KEY);
  await setLoggedOut();
}

export async function hasCredentials(): Promise<boolean> {
  const creds = await getCredentials();
  return creds !== null;
}

// ── Session state ─────────────────────────────────────────────

export async function getSessionState(): Promise<SessionState> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM session_state WHERE key IN ('username', 'is_logged_in', 'last_login_at', 'employee_number')",
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    username: map.get('username') ?? null,
    isLoggedIn: map.get('is_logged_in') === 'true',
    lastLoginAt: map.get('last_login_at') ?? null,
    employeeNumber: map.get('employee_number') ?? null,
  };
}

export async function setLoggedIn(employeeNumber: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO session_state (key, value) VALUES ('is_logged_in', 'true')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
  await db.runAsync(
    `INSERT INTO session_state (key, value) VALUES ('last_login_at', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [now],
  );
  await db.runAsync(
    `INSERT INTO session_state (key, value) VALUES ('employee_number', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [employeeNumber],
  );
}

export async function setLoggedOut(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO session_state (key, value) VALUES ('is_logged_in', 'false')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
}

/** Check if a URL indicates authenticated FLICA access */
export function isAuthenticatedUrl(url: string): boolean {
  return /\/(online|full)\//i.test(url);
}
