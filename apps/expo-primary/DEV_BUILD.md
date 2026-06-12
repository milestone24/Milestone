# Development build guide

This app uses **Expo development builds** (`expo-dev-client`), not App Store **Expo Go**.

SDK 56 is **not available** on the App Store version of Expo Go for physical iPhones. A development build is the supported way to run this app on a real device while staying on SDK 56.

For **TestFlight**, testing before your client has an Apple Developer account, and other distribution options, see **[TESTING.md](./TESTING.md)**.

## Development build vs Expo Go

**Expo Go** is a generic pre-built app from the App Store. It only supports one SDK version at a time and cannot include this project's native configuration (plugins, bundle ID, etc.).

**A development build** is a custom native app compiled for this project — with bundle ID `com.milestone.app`, expo-router, splash screen, and `expo-dev-client` baked in. It still connects to Metro for fast JS reload, but the native shell is yours.

```
Expo Go (not used here)
  Generic App Store app → loads your JS bundle

Dev build (this project)
  Milestone dev app on your phone → loads your JS bundle + your native config
```

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node 24+ | From monorepo root |
| [EAS CLI](https://docs.expo.dev/build/setup/) | `npm install -g eas-cli` |
| [Expo account](https://expo.dev) | Project owner: `digozis-organization`; EAS project id in `app.config.ts` |
| Apple Developer Program | Required for smooth iPhone installs via EAS (recommended) |
| Xcode | Required only for local iOS builds (`npm run run:ios`) |

## First-time setup

### 1. Install monorepo dependencies

From the monorepo root:

```bash
npm install
npm run build -w @milestone/js-common
```

### 2. Log in to EAS

```bash
cd apps/expo-primary
eas login
```

The project is already linked to EAS via `extra.eas.projectId` in `app.config.ts`.

## Build the dev client

You need to install the custom dev app on your device **once**, then again only when the native layer changes (see [When to rebuild](#when-to-rebuild-the-native-app)).

### EAS cloud build (recommended)

From `apps/expo-primary`:

```bash
# Physical iPhone
npm run build:dev:ios

# iOS Simulator only (no Apple signing)
npm run build:dev:ios:simulator

# Android device (APK)
npm run build:dev:android
```

On the first iOS build, EAS will prompt you to sign in with your Apple Developer account and can manage certificates/provisioning for you.

When the build finishes:

1. Open the install link from the EAS dashboard or terminal output
2. Or scan the QR code on your device
3. Install the **Milestone** dev app (not Expo Go)

Build profiles are defined in [`eas.json`](./eas.json):

| Profile | Use case |
|---------|----------|
| `development` | Physical iPhone or Android device |
| `development-simulator` | iOS Simulator only |
| `preview` | Internal distribution (non-dev-client) |
| `production` | Store builds |

### Local build (Mac + Xcode)

```bash
cd apps/expo-primary
npm run prebuild    # generates ios/ and android/ (gitignored)
npm run run:ios     # build and install on connected iPhone
```

Requires Xcode installed. Same rebuild rules as EAS builds.

## Daily development

### 1. Start the API

Run `apps/api-primary-node` (or your deployed API). The phone cannot reach `localhost` on your Mac.

### 2. Set a reachable API URL

Use your Mac's LAN IP, not `localhost`:

```bash
export EXPO_PUBLIC_API_URL=http://192.168.x.x:5000
```

Replace `192.168.x.x` with your machine's IP (`ipconfig getifaddr en0` on macOS).

This is read at build time for `app.config.ts` `extra.apiUrl` defaults and at Metro runtime for the JS bundle.

### 3. Start Metro with the dev client

```bash
cd apps/expo-primary
npm start
```

This runs `expo start --dev-client`.

### 4. Open the Milestone dev app

Open the **development build** you installed — **not** Expo Go. It connects to Metro over your LAN and hot-reloads JS/TS changes.

### Legacy Expo Go (not recommended for this app)

```bash
npm run start:go
```

Only useful if you intentionally test with Expo Go on a matching SDK. **Not supported for SDK 56 on App Store iOS.**

## When to rebuild the native app

| Change | Rebuild needed? |
|--------|-----------------|
| React screens, hooks, styles | No — Metro reload |
| `@milestone/js-common` JS changes | No — Metro reload |
| Add/change native module (e.g. new `expo-*` package) | **Yes** |
| Change `app.config.ts` plugins | **Yes** |
| Upgrade Expo SDK | **Yes** |
| Change bundle ID or signing | **Yes** |

## Day-to-day comparison

| | Expo Go | Dev build |
|---|---------|-----------|
| App on phone | App Store Expo Go | Your Milestone dev app |
| Start Metro | `expo start` | `expo start --dev-client` (`npm start`) |
| SDK 56 on iPhone | Not on App Store | Supported |
| `app.config` plugins | Ignored | Applied |
| Cookie auth / API | Same JS layer | Same — API must be reachable from phone |

## Monorepo notes

- **`@milestone/js-common`** is linked via npm workspaces; Metro is configured in [`metro.config.js`](./metro.config.js) for the monorepo.
- **EAS builds** run from `apps/expo-primary`; npm workspaces are resolved from the monorepo root automatically.
- **`ios/` and `android/`** are gitignored — generated by `expo prebuild` or by EAS in the cloud. Do not commit them unless you adopt a bare workflow intentionally.
- **Auth** uses cookie sessions (`credentials: "include"`). Validate login on a real device early; the API must accept requests from your phone's network origin.

## Commands reference

| Command | Description |
|---------|-------------|
| `npm start` | Metro + dev client (default) |
| `npm run start:go` | Metro for Expo Go (legacy) |
| `npm run build:dev:ios` | EAS development build for iPhone |
| `npm run build:dev:ios:simulator` | EAS dev build for iOS Simulator |
| `npm run build:dev:android` | EAS development APK for Android |
| `npm run prebuild` | Generate native `ios/` and `android/` projects |
| `npm run run:ios` | Local native build + install on device |
| `npm run run:android` | Local native build + install on Android device |
| `npm run check` | TypeScript check |

## Quick start checklist

1. `npm install` at monorepo root
2. `npm run build -w @milestone/js-common`
3. `cd apps/expo-primary && eas login`
4. `npm run build:dev:ios`
5. Install the app on your iPhone from the EAS link
6. `export EXPO_PUBLIC_API_URL=http://<your-mac-ip>:5000`
7. Start API server
8. `npm start`
9. Open the Milestone dev app on your phone

## Further reading

- [TESTING.md](./TESTING.md) — TestFlight, client Apple account not ready, simulator, Android
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo SDK 56 changelog](https://expo.dev/changelog/sdk-56)
- [Expo Go and the App Store (May 2026)](https://expo.dev/changelog/expo-go-and-app-store-may-2026)
