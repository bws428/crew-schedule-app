import express from 'express';
import { parseScheduleDetail } from './scraper/parser.js';
import { setSession, getSession, clearSession, hasSession } from './scraper/session.js';
import { fetchScheduleHtml, toBlockDate, FetchError } from './scraper/fetcher.js';
import { parseCurlCommand } from './scraper/curl-parser.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '1mb' }));
app.use(express.text({ limit: '1mb', type: 'text/html' }));

// CORS for local dev
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// ── Health check ──────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Session (token management) ────────────────────────────────

// Store FLICA session credentials (cURL command or raw token)
app.post('/api/session', (req, res) => {
  try {
    const { curlCommand, token } = req.body as { curlCommand?: string; token?: string };

    if (curlCommand) {
      // New path: parse "Copy as cURL" for token + cookies
      const parsed = parseCurlCommand(curlCommand);
      setSession(parsed);
      console.log(`[session] Session stored from cURL (cookies: ${parsed.cookies ? 'yes' : 'none'})`);
    } else if (token) {
      // Legacy path: just a token, no cookies
      setSession({ token, cookies: '' });
      console.log('[session] Token stored (no cookies)');
    } else {
      res.status(400).json({ error: 'Missing "curlCommand" or "token" in request body' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

// Check if a session is stored (optionally include details for WebView)
app.get('/api/session', (req, res) => {
  const session = getSession();
  if (req.query.details === 'true' && session) {
    // Return full session info so the mobile app can build WebView requests
    res.json({ hasToken: true, token: session.token, cookies: session.cookies });
  } else {
    res.json({ hasToken: hasSession() });
  }
});

// Clear the stored session
app.delete('/api/session', (req, res) => {
  clearSession();
  console.log('[session] Session cleared');
  res.json({ ok: true });
});

// ── Schedule endpoints ────────────────────────────────────────

// Parse schedule HTML and return structured data
// Accepts HTML as POST body (Content-Type: text/html)
app.post('/api/schedule/parse', (req, res) => {
  try {
    const html = req.body as string;
    if (!html || typeof html !== 'string') {
      res.status(400).json({ error: 'Request body must be HTML string' });
      return;
    }
    const schedule = parseScheduleDetail(html);
    res.json(schedule);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to parse schedule', details: message });
  }
});

// Fetch live schedule from FLICA using stored token
app.get('/api/schedule/live', async (req, res) => {
  try {
    const session = getSession();
    if (!session) {
      res.status(401).json({ error: 'No FLICA session. Please connect first.' });
      return;
    }

    const month = parseInt(req.query.month as string, 10);
    const year = parseInt(req.query.year as string, 10);
    if (!month || !year || month < 1 || month > 12 || year < 2020) {
      res.status(400).json({ error: 'Invalid month/year. Use ?month=MM&year=YYYY' });
      return;
    }

    const blockDate = toBlockDate(month, year);
    const html = await fetchScheduleHtml(session, blockDate);
    const schedule = parseScheduleDetail(html);
    res.json(schedule);
  } catch (err) {
    if (err instanceof FetchError) {
      const status = err.code === 'TOKEN_EXPIRED' ? 401
        : err.code === 'RATE_LIMITED' ? 429
        : err.code === 'BLOCKED' ? 403
        : 502;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to fetch schedule', details: message });
  }
});

// Debug: fetch raw HTML from FLICA without parsing (temporary)
app.get('/api/schedule/raw', async (req, res) => {
  try {
    const session = getSession();
    if (!session) {
      res.status(401).json({ error: 'No FLICA session. Please connect first.' });
      return;
    }

    const month = parseInt(req.query.month as string, 10);
    const year = parseInt(req.query.year as string, 10);
    if (!month || !year || month < 1 || month > 12 || year < 2020) {
      res.status(400).json({ error: 'Invalid month/year. Use ?month=MM&year=YYYY' });
      return;
    }

    const blockDate = toBlockDate(month, year);
    const html = await fetchScheduleHtml(session, blockDate);
    res.type('html').send(html);
  } catch (err) {
    if (err instanceof FetchError) {
      const status = err.code === 'TOKEN_EXPIRED' ? 401
        : err.code === 'RATE_LIMITED' ? 429
        : err.code === 'BLOCKED' ? 403
        : 502;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to fetch schedule', details: message });
  }
});

// Serve a demo schedule from the fixture (for development)
app.get('/api/schedule/demo', async (req, res) => {
  try {
    const { readFile } = await import('fs/promises');
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const fixturePath = join(__dirname, 'scraper', '__fixtures__', 'schedule-detail-feb2026.html');
    const html = await readFile(fixturePath, 'utf-8');
    const schedule = parseScheduleDetail(html);
    res.json(schedule);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to load demo schedule', details: message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
