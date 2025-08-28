# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `npm run dev` - Start development server with tsx
- `npm run build` - Build for production (Vite + esbuild for server)
- `npm start` - Run production server
- `npm run check` - TypeScript type checking

### Testing and Database
- `npm test` - Run tests with Vitest
- `npm test:run` - Run tests once
- `npm run db:push` - Push database schema changes using Drizzle

## Architecture Overview

This is a full-stack investment tracking application built with:

### Frontend (client/)
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (`import { Switch, Route } from "wouter"`)
- **UI Components**: Radix UI with shadcn/ui components in `components/ui/`
- **Styling**: Tailwind CSS with animations
- **State Management**: React Context (SessionContext, PortfolioContext, DateRangeContext)
- **Forms**: React Hook Form with Zod validation
- **Data Fetching**: TanStack React Query for API calls and caching
- **Mobile Support**: Capacitor for iOS/Android with platform-specific components

### Backend (server/)
- **Runtime**: Node.js with tsx for development
- **Framework**: Express with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy, JWT tokens
- **API Integration**: Services for financial data (Alpha Vantage, EODHD)

### Database Schema (server/db/schema/)
- **ORM**: Drizzle with PostgreSQL
- **Migrations**: Located in `/migrations` directory
- **Schema Files**: Modularized across multiple files (securities, portfolio-assets, user-account, etc.)

### Key Architectural Patterns

#### Client Structure
- Pages in `client/src/pages/`
- Reusable components in `client/src/components/` with feature subdirectories
- Custom hooks for API calls in `client/src/hooks/` with naming pattern `use-[feature].ts`
- Shared schemas and types in `shared/schema/`
- Protected routes use `ProtectedRoute` component

#### Server Structure  
- Modular services in `server/services/` for business logic
- API routes in `server/routes/`
- Database operations abstracted into service layers
- Authentication middleware and utilities in `server/auth/`

#### Securities Integration
- Multiple data providers (Alpha Vantage, EODHD) with unified interface
- Caching layer for historical data
- Gateway pattern for provider abstraction
- History synchronization services

## Coding Standards

### General Guidelines
- Small, controlled Git commits with user story format: "[subject] should [action]"
- Remove unused imports
- Check existing packages and architecture before installing new dependencies  
- Use form validation instead of toast messages for errors
- Delegate complex loop operations to separate functions

### Server-Side Rules
- Create small, modular, testable services for reusability
- Modularize data operations and business logic as services
- Follow existing database migration naming conventions
- Use array return type for pgTable's third argument when needed
- Check existing migrations before making database schema changes

### Client-Side Rules
- Use custom hooks for domain-specific API calls
- Leverage React Query for data fetching and caching
- Forms must use react-hook-form
- Place feature-specific components in organized subdirectories
- Define shared types using Zod schemas with TypeScript inference

## Financial Data Services

The application integrates with multiple financial data providers through a unified securities service architecture:
- Historical price data synchronization
- Security search and metadata
- Portfolio asset tracking
- Performance calculations and analytics

### ⚠️ CRITICAL REQUIREMENT: Cache-First Strategy
**All operations for obtaining security information and history from external resources should always use a cache-first strategy.** This means:
- Always check local database/cache before making external API calls
- Only query external providers (EODHD, Alpha Vantage) when data is not available locally
- Store retrieved data in cache for future use
- Implement proper cache invalidation strategies