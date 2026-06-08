# @milestone/expo-primary

## Purpose

Primary mobile client for this monorepo. React Native app built with [Expo](https://expo.dev).

## What belongs here

- Screens, navigation, and mobile-specific UI
- App-specific hooks and native integrations
- API client calls to `apps/api-primary`

## What does not belong here

- Shared UI that should match web → `@milestone/js-common` (where compatible)
- Server or database code

## Key dependencies

| Package | Role |
|---------|------|
| `@milestone/js-common` | Shared components/hooks where platform allows |

## First-time setup

```bash
eas login
eas init    # links project on expo.dev
npx expo start
```

## Commands

```bash
npx expo start
```
