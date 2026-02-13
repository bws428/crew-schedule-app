/**
 * Parse a Chrome "Copy as cURL" command to extract the FLICA session token
 * and cookie header. Also accepts a raw 32-char hex token as a fallback.
 */

export interface ParsedCredentials {
  /** 32-char hex FLICA session token */
  token: string;
  /** Full Cookie header value (may be empty if only a raw token was provided) */
  cookies: string;
}

const TOKEN_REGEX = /^[0-9a-fA-F]{32}$/;

/**
 * Parse a "Copy as cURL" string (or raw 32-char token) into token + cookies.
 *
 * Chrome macOS uses single quotes:  curl 'https://...' -H 'cookie: ...'
 * Chrome Windows uses double quotes: curl "https://..." -H "cookie: ..."
 */
export function parseCurlCommand(input: string): ParsedCredentials {
  const trimmed = input.trim();

  // Fallback: raw 32-char hex token (no cookies)
  if (TOKEN_REGEX.test(trimmed)) {
    return { token: trimmed, cookies: '' };
  }

  // Must look like a cURL command
  if (!trimmed.startsWith('curl ')) {
    throw new Error(
      'Input must be a "Copy as cURL" command from DevTools, or a 32-character hex token.'
    );
  }

  // Extract the URL — first quoted string after "curl"
  // Handles both single quotes (macOS) and double quotes (Windows)
  const urlMatch = trimmed.match(/curl\s+['"]([^'"]+)['"]/);
  if (!urlMatch) {
    throw new Error('Could not find URL in cURL command. Make sure you used "Copy as cURL".');
  }

  let token: string;
  try {
    const url = new URL(urlMatch[1]);
    const tokenParam = url.searchParams.get('token');
    if (!tokenParam || !TOKEN_REGEX.test(tokenParam)) {
      throw new Error('missing or invalid');
    }
    token = tokenParam;
  } catch {
    throw new Error(
      'Could not find a valid 32-char hex token in the cURL URL. ' +
      'Make sure you copied the scheduledetail.cgi request.'
    );
  }

  // Extract cookies from either:
  //   -H 'cookie: ...'  or  -H "Cookie: ..."   (header style)
  //   -b '...'          or  --cookie '...'      (curl shorthand)
  const cookieHeaderMatch = trimmed.match(/-H\s+['"][Cc]ookie:\s*([^'"]+)['"]/);
  const cookieBFlagMatch = trimmed.match(/(?:-b|--cookie)\s+['"]([^'"]+)['"]/);
  const cookies = (cookieHeaderMatch ? cookieHeaderMatch[1] : cookieBFlagMatch ? cookieBFlagMatch[1] : '').trim();

  if (!cookies) {
    console.warn('[curl-parser] No Cookie header found in cURL command — request may fail without cookies');
  }

  return { token, cookies };
}
