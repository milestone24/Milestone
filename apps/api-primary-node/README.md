# @milestone/api-primary

## Purpose

Primary HTTP API for this monorepo. Built with [Hono](https://hono.dev) on Node.js.

Handles routing, global middleware (logging, CORS, errors), and **authentication/authorization** via the internal `src/auth/` module.

## What belongs here

- Route definitions (`src/routes/`)
- Auth module and middleware (`src/auth/`) — persistence-agnostic; uses injected callbacks
- Environment validation (`src/env.ts`)
- Server entry (`src/index.ts`)

## What does not belong here

- Database schemas or repository implementations → `@milestone/data`
- Entity/repository interface definitions → `@milestone/domain`
- Shared React components → `@milestone/js-common`

## Key dependencies

| Package | Role |
|---------|------|
| `@milestone/domain` | Types and contracts (optional direct imports) |
| `@milestone/data` | `createDataLayer()` — wire in `src/index.ts` |
| `@milestone/js-common` | Shared non-domain utilities/types if needed |

## Auth module

`src/auth/` exposes `createAuth(config)` with callbacks:

- `findUser` — resolve user after JWT cookie verification
- `verifyApiToken` — validate bearer tokens

Implement these using `@milestone/data` repositories (see that package's README).

## Routes (template)

| Route | Auth | Description |
|-------|------|-------------|
| `GET /health` | None | Health check |
| `GET /me` | Cookie session | Current user + session summary |
| `POST /auth/demo/session` | None (dev only) | Sets demo session cookie |

## Environment

See `.env.example`: `PORT`, `AUTH_JWT_SECRET`, `CORS_ORIGIN`, `NODE_ENV`. Add `DATABASE_URL` when wiring `@milestone/data`.

## Commands

```bash
npm run dev      # watch mode
npm run build
npm start        # run compiled dist/
```
