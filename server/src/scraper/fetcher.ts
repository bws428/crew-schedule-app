/**
 * FLICA schedule HTML fetcher.
 * Makes a single HTTP GET to spirit.flica.net to retrieve schedule HTML.
 *
 * Safety features:
 * - Minimum 5 seconds between requests (hard-coded)
 * - Single-request-at-a-time lock (no parallel fetches)
 * - Real Chrome User-Agent header
 * - Detects login redirects (expired token)
 * - Detects error/block pages
 */

import type { FlicaSession } from './session.js';

const FLICA_BASE = 'https://spirit.flica.net';
const SCHEDULE_PATH = '/full/scheduledetail.cgi';
const MIN_REQUEST_INTERVAL_MS = 5_000;
const MAX_UPDATE_RETRIES = 6;       // Retry up to 6 times for "updating schedule"
const UPDATE_RETRY_DELAY_MS = 5_000; // 5 seconds between retries

// Chrome 145 on macOS — matches a real browser
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

let lastRequestTime = 0;
let requestInFlight = false;

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly code: 'TOKEN_EXPIRED' | 'RATE_LIMITED' | 'BLOCKED' | 'HTTP_ERROR' | 'NETWORK_ERROR'
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

/**
 * Fetch schedule HTML from FLICA.
 * @param session  FLICA session containing token and cookies
 * @param blockDate  Month/year in MMYY format (e.g., "0226" for Feb 2026)
 * @returns Raw HTML string of the schedule detail page
 */
export async function fetchScheduleHtml(session: FlicaSession, blockDate: string): Promise<string> {
  // Single-request lock
  if (requestInFlight) {
    throw new FetchError('A request is already in progress. Please wait.', 'RATE_LIMITED');
  }

  // Rate limiting
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS && lastRequestTime > 0) {
    const waitSec = ((MIN_REQUEST_INTERVAL_MS - elapsed) / 1000).toFixed(1);
    throw new FetchError(
      `Rate limited. Please wait ${waitSec}s before the next request.`,
      'RATE_LIMITED'
    );
  }

  const url = new URL(SCHEDULE_PATH, FLICA_BASE);
  url.searchParams.set('BlockDate', blockDate);
  url.searchParams.set('token', session.token);

  requestInFlight = true;
  lastRequestTime = Date.now();

  try {
    const reqHeaders: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Referer: `${FLICA_BASE}/online/leftmenu.cgi?whosepage=Crewmember`,
      Origin: FLICA_BASE,
      'sec-fetch-dest': 'iframe',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
    };
    if (session.cookies) {
      reqHeaders['Cookie'] = session.cookies;
    }

    // Retry loop: FLICA may return "Updating schedule in progress" while building data
    for (let attempt = 0; attempt <= MAX_UPDATE_RETRIES; attempt++) {
      if (attempt > 0) {
        console.log(`[fetcher] Schedule updating, retry ${attempt}/${MAX_UPDATE_RETRIES} in ${UPDATE_RETRY_DELAY_MS / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, UPDATE_RETRY_DELAY_MS));
      }

      console.log(`[fetcher] Requesting schedule for BlockDate=${blockDate} (cookies: ${session.cookies ? 'yes' : 'none'}, attempt ${attempt + 1})`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: reqHeaders,
        redirect: 'manual',
      });

      // Detect login redirect (token expired)
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location') || '';
        if (location.includes('login') || location.includes('public')) {
          throw new FetchError(
            'FLICA session expired. Please log in again and update your token.',
            'TOKEN_EXPIRED'
          );
        }
        throw new FetchError(
          `Unexpected redirect to: ${location}`,
          'HTTP_ERROR'
        );
      }

      if (!response.ok) {
        throw new FetchError(
          `FLICA returned HTTP ${response.status}: ${response.statusText}`,
          'HTTP_ERROR'
        );
      }

      const html = await response.text();

      // ── Check for error/block pages FIRST (before schedule detection) ──

      // Detect reCAPTCHA / CAPTCHA pages (FLICA anti-bot protection)
      if (html.includes('g-recaptcha') || html.includes('recaptcha') || html.includes('CAPTCHA')) {
        throw new FetchError(
          'FLICA returned a CAPTCHA challenge. Your browser session may have triggered bot detection. ' +
          'Please solve the CAPTCHA in your browser, then copy a fresh "Copy as cURL" command.',
          'BLOCKED'
        );
      }

      // Detect login page in response body
      if (html.includes('Sign In to FLICA') || html.includes('login/index.html')) {
        throw new FetchError(
          'FLICA session expired. Please log in again and update your token.',
          'TOKEN_EXPIRED'
        );
      }

      // Detect session initialization failure (expired/invalid token)
      if (html.includes('InitializeSessionData') || html.includes('Application Error')) {
        throw new FetchError(
          'FLICA session expired. Please log in again and update your token.',
          'TOKEN_EXPIRED'
        );
      }

      // "Updating schedule in progress" — FLICA is building the data, retry
      if (html.includes('Updating schedule in progress')) {
        console.log(`[fetcher] Got "Updating" page (${html.length} bytes)`);
        if (attempt === MAX_UPDATE_RETRIES) {
          throw new FetchError(
            'FLICA is still building your schedule. Please try again in a minute.',
            'HTTP_ERROR'
          );
        }
        continue; // retry
      }

      // ── Now check for actual schedule content ──

      // Schedule ready — must contain the actual schedule table (id="table2")
      // Note: "Schedule Detail" string also appears in CAPTCHA pages, so we
      // require the actual table2 element OR the full title with body content
      if (html.includes('table2') || (html.includes('Schedule Detail') && html.includes('<table') && html.includes('maintable'))) {
        console.log(`[fetcher] Success — received ${html.length} bytes`);
        return html;
      }

      // Unknown response — return it anyway, parser will handle errors
      console.warn(`[fetcher] Response doesn't look like a schedule page (${html.length} bytes). First 500 chars: ${html.substring(0, 500)}`);
      return html;
    }

    // Should not reach here, but just in case
    throw new FetchError('Failed to fetch schedule after retries.', 'HTTP_ERROR');
  } catch (error) {
    if (error instanceof FetchError) throw error;
    throw new FetchError(
      `Network error: ${error instanceof Error ? error.message : String(error)}`,
      'NETWORK_ERROR'
    );
  } finally {
    requestInFlight = false;
  }
}

/**
 * Build a BlockDate string from month and year.
 * @param month 1-12
 * @param year  4-digit year (e.g., 2026)
 * @returns MMYY string (e.g., "0226")
 */
export function toBlockDate(month: number, year: number): string {
  const mm = String(month).padStart(2, '0');
  const yy = String(year).slice(-2);
  return `${mm}${yy}`;
}
