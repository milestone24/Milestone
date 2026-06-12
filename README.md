# @milestone Monorepo

## Overview

This is a monorepo workspace scaffolded with the Digozi Builder.
It uses npm workspaces to manage shared packages and apps from a single root.

## Structure

```
.
├── apps/
│   ├── api-primary/      # Node.js API server (Hono) — see apps/api-primary/README.md
│   ├── client-primary/   # React web app (Vite) — see apps/client-primary/README.md
│   ├── expo-primary/     # React Native app (Expo) — see apps/expo-primary/README.md
└── packages/
    ├── js-common/        # Shared JS/React — packages/js-common/README.md
    ├── domain/           # Entity types + repository contracts — packages/domain/README.md
    └── data/             # Drizzle + Postgres implementations — packages/data/README.md
```

Each app and package includes its own **README.md** describing purpose, boundaries, and commands for AI agents and developers.

## Getting started

Install all workspace dependencies from the root:

```bash
npm install
```

## API Server (api-primary)

The `apps/api-primary` app is a Node.js HTTP API built with [Hono](https://hono.dev).

### Start the development server

```bash
cd apps/api-primary
npm install
npm run dev
```

The server starts on [http://localhost:3000](http://localhost:3000) by default.
Set the `PORT` environment variable to use a different port.

### Health check

```bash
curl http://localhost:3000/health
# { "status": "ok", "timestamp": "..." }
```

## React App (client-primary)

The `apps/client-primary` app is a React web app built with [Vite](https://vitejs.dev).

### Start the development server

```bash
cd apps/client-primary
npm run dev
```

## Expo App (expo-primary)

The `apps/expo-primary` app is a React Native app built with [Expo](https://expo.dev).

### Prerequisites

- **Expo Go** — Install it on your physical device:
  - [iOS — App Store](https://apps.apple.com/app/expo-go/id982107779)
  - [Android — Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **Expo account** — Sign up for free at [expo.dev](https://expo.dev/signup)
- **EAS CLI** — The Expo Application Services command-line tool:

```bash
npm install -g eas-cli
```

### First-time setup

1. **Log in to your Expo account:**

```bash
eas login
```

2. **Link this project to your Expo account** (run from inside `apps/expo-primary`):

```bash
cd apps/expo-primary
eas init
```

This creates an EAS project on expo.dev and writes a `projectId` into `app.json`.
You only need to do this once.

3. **Start the development server:**

```bash
npx expo start
```

Scan the QR code with the **Expo Go** app on your device to open the app.

## Packages

| Package | Role |
|---------|------|
| `packages/js-common` | Shared React/JS utilities and components |
| `packages/domain` | Branded IDs, entities, repository **interfaces** (no DB) |
| `packages/data` | Drizzle schema, migrations, repository **implementations** |

Build library packages before running apps:

```bash
npm run build --workspace=@milestone/domain
npm run build --workspace=@milestone/js-common
npm run build --workspace=@milestone/data
```
