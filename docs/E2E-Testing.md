# End-to-End Testing Guide

This document describes how to set up and run end-to-end (E2E) tests for the Milestone investment tracker application.

## Overview

We use [Playwright](https://playwright.dev/) for E2E testing. Playwright is a modern testing framework that allows us to test our application in real browser environments, simulating actual user interactions.

## Setup

### 1. Install Playwright

First, install Playwright and its dependencies:

```bash
npm install -D @playwright/test
```

### 2. Install Browsers

Playwright needs browser binaries to run tests. Install them with:

```bash
npx playwright install
```

This will download Chromium, Firefox, and WebKit browsers.

For CI environments or if you only need Chromium:

```bash
npx playwright install chromium
```

### 3. Verify Installation

Run the following to verify Playwright is set up correctly:

```bash
npx playwright --version
```

## Running Tests

### Prerequisites

Before running E2E tests, ensure:

1. **The application is running**: Start the dev server in a separate terminal:
   ```bash
   npm run dev
   ```
   The application should be accessible at `http://localhost:5001`

2. **Test data exists**: Ensure the test user exists in your database:
   - Email: `test@milestone.com`
   - Password: `test`

### Run All E2E Tests

```bash
npx playwright test
```

### Run Tests in UI Mode (Recommended for Development)

UI mode provides a visual interface for running and debugging tests:

```bash
npx playwright test --ui
```

### Run Specific Test File

```bash
npx playwright test client/src/pages/portfolio.e2e.test.ts
```

### Run Tests in Headed Mode (See the Browser)

By default, tests run in headless mode. To see the browser:

```bash
npx playwright test --headed
```

### Run in Debug Mode

Debug mode opens the Playwright Inspector for step-by-step debugging:

```bash
npx playwright test --debug
```

### Run Tests on Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Structure

### Available Tests

#### `portfolio.e2e.test.ts`

Tests the account creation flow:

1. **Account Creation Flow** - Full flow from login to creating a new investment account
2. **Field Validation** - Tests that required fields are validated
3. **Step Navigation** - Tests forward/backward navigation through the multi-step form
4. **Cancel Flow** - Tests canceling the account creation process
5. **Calculated Account** - Tests creating an account with calculated value control

### Test Anatomy

```typescript
test('should successfully create a new investment account', async () => {
  // 1. Setup - Navigate and login
  // 2. Action - Perform user interactions
  // 3. Assertion - Verify expected outcomes
});
```

## Writing New Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup code (login, navigation, etc.)
  });

  test('should do something', async ({ page }) => {
    // Test code
  });
});
```

### Common Patterns

#### Selecting Elements

```typescript
// By text
await page.click('text=Click me');

// By CSS selector
await page.click('button.submit-btn');

// By test ID (recommended)
await page.click('[data-testid="submit-button"]');

// By role
await page.click('button[role="button"]');
```

#### Filling Forms

```typescript
await page.fill('input[name="email"]', 'test@example.com');
await page.fill('input#password', 'password123');
```

#### Waiting for Elements

```typescript
// Wait for element to be visible
await page.waitForSelector('text=Success', { timeout: 5000 });

// Wait for navigation
await page.waitForURL(/.*dashboard.*/);
```

#### Assertions

```typescript
// Element visibility
await expect(page.locator('text=Welcome')).toBeVisible();

// Element text
await expect(page.locator('.title')).toHaveText('Dashboard');

// Input value
await expect(page.locator('input#name')).toHaveValue('John');

// Element count
await expect(page.locator('.account-card')).toHaveCount(3);
```

## Debugging Tests

### 1. Playwright Inspector

The Playwright Inspector allows you to step through your tests:

```bash
npx playwright test --debug
```

### 2. Screenshots and Videos

Failed tests automatically capture screenshots and videos (configured in `playwright.config.ts`).

View them in the `test-results` directory or the HTML report.

### 3. HTML Report

After running tests, generate an HTML report:

```bash
npx playwright show-report
```

### 4. Trace Viewer

For failed tests, view the trace:

```bash
npx playwright show-trace test-results/path-to-trace.zip
```

## Best Practices

### 1. Use Data Test IDs

Add `data-testid` attributes to important elements for stable selectors:

```tsx
<button data-testid="add-account-btn">Add Account</button>
```

```typescript
await page.click('[data-testid="add-account-btn"]');
```

### 2. Avoid Hard-Coded Waits

❌ Don't:
```typescript
await page.waitForTimeout(5000);
```

✅ Do:
```typescript
await page.waitForSelector('text=Loaded');
```

### 3. Use Test Fixtures

Create reusable setup code:

```typescript
test.beforeEach(async ({ page }) => {
  await loginAsTestUser(page);
});
```

### 4. Keep Tests Independent

Each test should be able to run independently without relying on the state from other tests.

### 5. Use Descriptive Test Names

```typescript
// ✅ Good
test('should display validation error when email is missing')

// ❌ Bad
test('test email validation')
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      
      - name: Run E2E tests
        run: npx playwright test
        env:
          CI: true
      
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Troubleshooting

### Tests Timing Out

- Increase the timeout in `playwright.config.ts`
- Check if the application is running and accessible
- Verify network requests aren't blocked

### Elements Not Found

- Use Playwright Inspector to see the actual page state
- Check if elements are rendered conditionally
- Verify selectors are correct

### Authentication Issues

- Ensure test user exists in the database
- Check if sessions are being maintained correctly
- Verify cookies and local storage

### Browser Launch Failed

```bash
# Reinstall browsers
npx playwright install --with-deps
```

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [API Reference](https://playwright.dev/docs/api/class-playwright)

## Test Coverage

As you add features, create corresponding E2E tests:

- ✅ Account creation flow
- ⬜ Account editing
- ⬜ Account deletion
- ⬜ Transaction recording
- ⬜ Value updates
- ⬜ Securities management
- ⬜ Goal setting
- ⬜ FIRE calculations
- ⬜ Chart interactions
- ⬜ Platform integrations


