# Crew Schedule App

A mobile app for airline crew members to view their FLICA schedules offline. Built with React Native + Expo.

## How It Works

The app runs entirely on-device with no backend server:

1. **Tap "Fetch Schedule"** to open FLICA in an embedded WebView
2. **Log in** with your FLICA credentials (and solve CAPTCHA if prompted)
3. **Schedule is parsed automatically** using a DOM parser injected into the WebView
4. **Data is cached in SQLite** for instant offline access

Navigate between months with the arrow controls. Cached months load instantly; uncached months trigger a new fetch. Pull to refresh re-fetches the current month.

## Architecture

```
apps/mobile/
  src/
    components/       # React Native UI
    db/               # SQLite database + repository pattern
    parsers/          # Vanilla JS DOM parser (injected into WebView)
    services/         # Credential storage (OS keychain)
    types/            # TypeScript type definitions
packages/shared/      # Shared types across packages
server/               # Express server (legacy reference, not used at runtime)
```

### Key Design Decisions

- **No server dependency** -- everything runs on the device. The WebView handles authentication, a vanilla JS parser extracts schedule data from the DOM, and SQLite stores results locally.
- **Repository pattern** -- `ScheduleRepository` interface makes it easy to swap `SQLiteScheduleRepository` for an API-backed implementation later.
- **Secure credential storage** -- passwords stored in the OS keychain via `expo-secure-store` (iOS Keychain / Android Keystore).
- **WebView cookie persistence** -- after first login, session cookies often persist across fetches, making subsequent loads seamless.

## Tech Stack

- **React Native** + **Expo** (SDK 54)
- **TypeScript**
- **expo-sqlite** -- on-device schedule cache
- **expo-secure-store** -- OS keychain for credentials
- **react-native-webview** -- FLICA login, CAPTCHA, and schedule loading

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the Expo dev server
cd apps/mobile
npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/go) on your phone to run the app.

## Schedule Data

The parser extracts a complete monthly schedule including:

- **Trips** -- flight legs, duty periods, layovers, crew members, TAFB, block/credit times
- **Activities** -- sick leave, simulator sessions, recurrent training, reserve days, etc.
- **Calendar** -- day-by-day view with activity codes and layover airports
- **Summary** -- monthly block hours, credit hours, YTD, and days off
