import { test, expect } from "@playwright/test";
import {
  loginAsTestUser,
  openAddAccountDialog,
  fillAccountDetails,
  selectControlMethod,
  configureContributions,
  submitAccountCreation,
  verifyAccountExists,
  navigateToPage,
  clickButtonByText,
} from "../test-utils/e2e-helpers";

/**
 * Simplified E2E Test: Account Creation Flow
 *
 * This test uses helper functions for cleaner, more maintainable tests.
 */

const TEST_ACCOUNT = {
  name: "Helper Test Account",
  platform: "Trading 212",
  accountType: "ISA",
  startDate: "2024-01-01",
};

test.describe("Account Creation Flow (Using Helpers)", () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to portfolio
    await loginAsTestUser(page);
  });

  test("should create a manual account", async ({ page }) => {
    // Open account creation dialog
    await openAddAccountDialog(page);

    // Fill in account details (Step 1)
    await fillAccountDetails(page, TEST_ACCOUNT);
    await clickButtonByText(page, "Next");

    // Select control method (Step 2)
    await selectControlMethod(page, "manual");
    await clickButtonByText(page, "Next");

    // Configure contributions (Step 3)
    await configureContributions(page, false);

    // Submit
    await submitAccountCreation(page);

    // Verify account was created
    await verifyAccountExists(page, TEST_ACCOUNT);
  });

  test("should create a calculated account", async ({ page }) => {
    await openAddAccountDialog(page);

    await fillAccountDetails(page, {
      ...TEST_ACCOUNT,
      name: "Calculated Test Account",
    });
    await clickButtonByText(page, "Next");

    await selectControlMethod(page, "calculated");
    await clickButtonByText(page, "Next");

    await configureContributions(page, false);
    await submitAccountCreation(page);

    await verifyAccountExists(page, {
      ...TEST_ACCOUNT,
      name: "Calculated Test Account",
    });
  });

  test("should navigate back and forth through steps", async ({ page }) => {
    await openAddAccountDialog(page);

    // Fill Step 1
    await fillAccountDetails(page, TEST_ACCOUNT);
    await clickButtonByText(page, "Next");

    // Verify on Step 2
    await expect(page.locator("text=Select Control")).toBeVisible();

    // Go back to Step 1
    await clickButtonByText(page, "Back");
    await expect(page.locator("text=Account Details")).toBeVisible();

    // Verify form retained values
    const nameInput = page.locator(
      'input[placeholder="e.g. My Trading 212 ISA"]'
    );
    await expect(nameInput).toHaveValue(TEST_ACCOUNT.name);
  });

  test("should cancel account creation", async ({ page }) => {
    await openAddAccountDialog(page);
    await clickButtonByText(page, "Cancel");

    // Dialog should close
    await page.waitForSelector("text=Create an account step", {
      state: "hidden",
    });
    await expect(page.locator("text=Accounts")).toBeVisible();
  });
});

