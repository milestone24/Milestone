# @milestone/client-primary

## Purpose

Primary web client for this monorepo. React SPA built with [Vite](https://vitejs.dev).

## What belongs here

- Pages, layouts, and route-level UI
- App-specific hooks and state
- API client calls to `apps/api-primary`

## What does not belong here

- Shared components used by Expo too → prefer `@milestone/js-common`
- Server-side or database code

## Key dependencies

| Package | Role |
|---------|------|
| `@milestone/js-common` | Shared React components, hooks, utils |

## Commands

```bash
npm run dev
npm run build
npm run preview
```

Use credentials (`credentials: 'include'`) when calling the API if using cookie-based sessions.
