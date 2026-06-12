# @milestone/expo-primary

Primary mobile client for this monorepo. React Native app built with [Expo SDK 56](https://docs.expo.dev/versions/v56.0.0/).

Uses **development builds** (`expo-dev-client`) — not App Store Expo Go.

## Documentation

- **[DEV_BUILD.md](./DEV_BUILD.md)** — full setup guide: EAS builds, daily workflow, when to rebuild, monorepo notes
- **[TESTING.md](./TESTING.md)** — testing before client's Apple account: direct install, TestFlight, simulator, Android, migration

## Quick start

```bash
# From monorepo root
npm install
npm run build -w @milestone/js-common

# From apps/expo-primary
eas login
npm run build:dev:ios          # install dev app on iPhone (once)
export EXPO_PUBLIC_API_URL=http://192.168.x.x:5000
npm start                      # open Milestone dev app on phone
```

## Key dependencies

| Package | Role |
|---------|------|
| `@milestone/js-common` | Shared hooks, contexts, schemas, API transport |
| `expo-dev-client` | Development build client |
| `expo-router` | File-based navigation |
