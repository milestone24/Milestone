# Milestone Investment Tracker - Application Specification

## Overview

Milestone is a comprehensive investment tracking and financial planning application designed to help users monitor their investment portfolios, set financial goals, and track progress toward financial independence (FIRE - Financial Independence, Retire Early). The application supports multiple investment account types and provides detailed analytics and goal tracking capabilities.

## Core Features

### 1. Portfolio Management
- **Multi-Account Support**: Users can manage multiple investment accounts including:
  - ISA (Individual Savings Account)
  - CISA (Cash ISA)
  - SIPP (Self-Invested Personal Pension)
  - LISA (Lifetime ISA)
  - GIA (General Investment Account)
- **Broker Integration**: Support for multiple broker providers with API key connections
- **Asset Tracking**: Track individual securities and their performance over time
- **Value History**: Maintain historical records of portfolio values and contributions
- **Account Management**: Add, edit, and delete investment accounts

### 2. Financial Goal Setting (Milestones)
- **Goal Creation**: Set financial milestones with target values
- **Progress Tracking**: Visual progress indicators for each milestone
- **Account-Specific Goals**: Set goals for specific account types or overall portfolio
- **AI-Suggested Milestones**: Intelligent suggestions for financial goals
- **Goal Completion**: Mark milestones as completed when targets are reached

### 3. FIRE (Financial Independence, Retire Early) Planning
- **FIRE Calculator**: Calculate required portfolio size for financial independence
- **Retirement Planning**: Set target retirement age and income goals
- **Safe Withdrawal Rate**: Configure withdrawal rate assumptions (default 4%)
- **Inflation Adjustment**: Account for inflation in long-term planning
- **State Pension Integration**: Include UK state pension in retirement planning
- **Monthly Investment Tracking**: Monitor required monthly contributions

### 4. Portfolio Analytics
- **Performance Tracking**: Monitor portfolio performance over time
- **Contribution Tracking**: Record and track investment contributions
- **Recurring Contributions**: Set up automatic contribution schedules
- **Historical Analysis**: View portfolio value changes over different time periods
- **On-Track Status**: Determine if current savings rate meets retirement goals

### 5. Data Entry and Management
- **Manual Value Entry**: Record current portfolio values manually
- **Screenshot Upload**: Upload screenshots for AI-powered value extraction
- **OCR Processing**: Extract account values from screenshots using AI
- **Bulk Operations**: Update multiple accounts simultaneously
- **Historical Data**: Maintain complete history of all portfolio changes

### 6. Securities Management
- **Security Database**: Comprehensive database of investment securities
- **External API Integration**: EODHD API for real-time security data
- **Security Search**: Search for securities by symbol, name, or ISIN
- **Security Details**: Store comprehensive security information including:
  - Symbol, name, exchange, country, currency
  - ISIN, CUSIP, FIGI identifiers
  - Security type classification

## Technical Architecture

### Frontend (Client)
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: 
  - React Context for global state
  - TanStack Query (React Query) for server state
- **UI Components**: 
  - Radix UI primitives
  - Custom shadcn/ui components
  - Tailwind CSS for styling
- **Charts**: Recharts for data visualization
- **Forms**: React Hook Form with Zod validation
- **Mobile Support**: Capacitor for cross-platform mobile deployment

### Backend (Server)
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Session Management**: Express sessions with cookie-based storage
- **API Design**: RESTful API with JSON responses
- **Validation**: Zod schema validation
- **Error Handling**: Centralized error handling middleware

### Database Schema
- **User Accounts**: User authentication and profile data
- **Portfolio Assets**: Investment accounts and their values
- **Asset Values**: Historical portfolio value records
- **Asset Contributions**: Investment contribution tracking
- **Recurring Contributions**: Automated contribution schedules
- **Securities**: Investment security information
- **FIRE Settings**: Financial independence planning parameters
- **Milestones**: Financial goal tracking
- **Broker Providers**: Supported investment platforms

### External Integrations
- **EODHD API**: Real-time security data and market information
- **Anthropic Claude AI**: Screenshot analysis and value extraction
- **Trading212 API**: Broker integration (planned/partial)

### Development Tools
- **Build System**: Vite for frontend, esbuild for backend
- **Testing**: Vitest for unit and integration testing
- **Database Migrations**: Drizzle Kit for schema management
- **Development Server**: Hot reloading with Vite dev server
- **Mobile Development**: Capacitor CLI for mobile app generation

### Deployment
- **Platform**: Cross-platform support (Web, iOS, Android)
- **Static Assets**: PWA support with service workers
- **Mobile App**: Native mobile apps via Capacitor
- **Hosting**: Single-port deployment (port 5000)

## Security Features
- **Authentication**: Secure user authentication with JWT tokens
- **Password Security**: Bcrypt password hashing
- **Session Management**: Secure session handling with cookies
- **API Security**: Protected routes with authentication middleware
- **Data Validation**: Input validation using Zod schemas
- **CORS**: Configured for secure cross-origin requests

## Mobile Features
- **Cross-Platform**: iOS and Android support via Capacitor
- **Native Features**: 
  - Haptic feedback
  - Status bar customization
  - Keyboard handling
  - Splash screen
- **Responsive Design**: Adaptive layouts for different screen sizes
- **Offline Support**: PWA capabilities for offline functionality

## Data Management
- **Real-time Updates**: Live portfolio value updates
- **Historical Data**: Complete audit trail of all changes
- **Data Export**: Portfolio data export capabilities
- **Backup**: Database backup and recovery procedures
- **Data Integrity**: Referential integrity with foreign key constraints

## Performance Features
- **Caching**: React Query for efficient data caching
- **Optimistic Updates**: Immediate UI updates with background sync
- **Lazy Loading**: Component and route-based code splitting
- **Image Optimization**: Efficient screenshot processing
- **Database Optimization**: Indexed queries for fast data retrieval

## User Experience
- **Intuitive Interface**: Clean, modern UI with consistent design
- **Responsive Layout**: Adaptive design for desktop and mobile
- **Accessibility**: WCAG compliant components
- **Loading States**: Skeleton loaders and progress indicators
- **Error Handling**: User-friendly error messages and recovery
- **Toast Notifications**: Real-time feedback for user actions

## Configuration and Customization
- **Environment Variables**: Configurable settings for different environments
- **Theme Support**: Customizable color schemes and branding
- **Date Range Selection**: Flexible time period analysis
- **Currency Support**: Multi-currency portfolio tracking
- **Account Type Customization**: Support for various investment account types

This specification represents the current state of the Milestone application as implemented in the codebase, providing a comprehensive investment tracking and financial planning platform with modern web and mobile capabilities.
