# E2E Tests for Account Creation

This directory contains end-to-end tests that automate the account creation flow you just tested manually.

## Quick Start

### 1. Install Playwright

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Or use the setup script:

```bash
chmod +x scripts/setup-e2e-tests.sh
./scripts/setup-e2e-tests.sh
```

### 2. Start the Application

In a separate terminal:

```bash
npm run dev
```

The app should be running at `http://localhost:5001`

### 3. Run the Tests

```bash
# Run all E2E tests
npx playwright test

# Run with UI (recommended for development)
npx playwright test --ui

# Run in headed mode (see the browser)
npx playwright test --headed

# Run specific test file
npx playwright test client/src/pages/portfolio.e2e.test.ts
```

## Test Files

### 📄 `client/src/pages/portfolio.e2e.test.ts`
Complete E2E test suite for account creation with detailed step-by-step tests:
- ✅ Full account creation flow
- ✅ Form validation
- ✅ Step navigation (back/forward)
- ✅ Cancel functionality
- ✅ Manual vs Calculated accounts

### 📄 `client/src/pages/portfolio.e2e.simple.test.ts`
Simplified version using helper functions for cleaner, more maintainable tests.

### 📄 `client/src/test-utils/e2e-helpers.ts`
Reusable helper functions for E2E tests:
- `loginAsTestUser()` - Handles authentication
- `openAddAccountDialog()` - Opens the account creation dialog
- `fillAccountDetails()` - Fills in account information
- `selectControlMethod()` - Selects manual/calculated control
- `configureContributions()` - Sets up scheduled contributions
- `submitAccountCreation()` - Submits the form
- `verifyAccountExists()` - Confirms account was created
- And more...

## What the Tests Do

The tests automate exactly what we did manually:

1. **Login** with test credentials
2. **Navigate** to the portfolio page
3. **Click** the "+" button to open account creation
4. **Fill in** account details:
   - Name: "Test Investment Account"
   - Platform: Trading 212
   - Account Type: ISA
   - Start Date: 2024-01-01
5. **Select** control method (Manual or Calculated)
6. **Configure** contributions (Yes/No)
7. **Submit** and verify the account appears in the portfolio

## Configuration

### 📄 `playwright.config.ts`
Main Playwright configuration:
- Base URL: `http://localhost:5001`
- Browser: Chromium (default)
- Screenshots on failure
- Video recording on failure
- HTML reports

## Debugging

### Use Playwright Inspector

```bash
npx playwright test --debug
```

This opens a GUI where you can:
- Step through tests line by line
- See the browser actions in real-time
- Inspect element selectors
- View console logs

### View Test Report

After running tests:

```bash
npx playwright show-report
```

### View Trace

For failed tests:

```bash
npx playwright show-trace test-results/path-to-trace.zip
```

## Adding More Tests

To add new E2E tests:

1. Create a new file: `*.e2e.test.ts`
2. Import helpers from `test-utils/e2e-helpers.ts`
3. Write your test following the existing patterns
4. Run with `npx playwright test`

Example:

```typescript
import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToPage } from '../test-utils/e2e-helpers';

test.describe('My New Feature', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should do something', async ({ page }) => {
    // Your test code here
  });
});
```

## Prerequisites

Make sure you have:
- ✅ Application running on `localhost:5001`
- ✅ Test user exists: `test@milestone.com` / `test`
- ✅ Database is accessible and populated

## Documentation

Full documentation: **[docs/E2E-Testing.md](docs/E2E-Testing.md)**

Includes:
- Detailed setup instructions
- Best practices
- Common patterns
- Troubleshooting guide
- CI/CD integration

## CI/CD

To run tests in CI, add to your workflow:

```yaml
- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npx playwright test
  env:
    CI: true
```

## Help

If you run into issues:

1. Check [docs/E2E-Testing.md](docs/E2E-Testing.md) - Troubleshooting section
2. Run `npx playwright --version` to verify installation
3. Ensure the app is running on `http://localhost:5001`
4. Try running with `--headed` to see what's happening

---

**Happy Testing! 🎭**


