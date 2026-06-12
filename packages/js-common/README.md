# @milestone/js-common

## Purpose

Shared JavaScript and React code used across web, mobile, and API-facing clients in this monorepo.

## What belongs here

- Reusable React components and hooks (`src/react/`)
- Framework-agnostic utilities (`src/utils/`)
- Shared TypeScript types that are not domain entities (`src/types/`)

## What does not belong here

- Database access, ORM schemas, or repository implementations → `@milestone/data`
- Business entity definitions and repository contracts → `@milestone/domain`
- HTTP routes, auth middleware, or server startup → `apps/api-primary`

## Structure

```
src/
  react/          # Components and hooks (browser / React Native via compatible imports)
  utils/          # Pure JS helpers
  types/          # Shared non-domain types
  index.ts        # Package entry — re-exports public API
```

## Consumers

- `apps/client-primary` (Vite React)
- `apps/expo-primary` (React Native), when present
- May be referenced by `apps/api-primary` for shared types only (avoid React imports on the server)

## Commands

```bash
npm run build
```

Build this package before running apps that depend on it.
