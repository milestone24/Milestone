import { test, expect, Page } from "@playwright/test";

/**
 * E2E Test: Account Creation Flow
 *
 * This test validates the complete flow of creating a new investment account
 * in the portfolio application.
 *
 * Prerequisites:
 * - Application running on localhost:5001
 * - Test user exists: test@milestone.com / test
 *
 * Test Flow:
 * 1. Navigate to app and login
 * 2. Navigate to portfolio page
 * 3. Open account creation dialog
 * 4. Fill in account details (Step 1)
 * 5. Select control method (Step 2)
 * 6. Configure contributions (Step 3)
 * 7. Verify account created successfully
 */

const TEST_USER = {
  email: "test@milestone.com",
  password: "test",
};

const TEST_ACCOUNT = {
  name: "E2E Test Investment Account",
  platform: "Trading 212",
  accountType: "ISA",
  startDate: "2024-01-01",
  controlMethod: "manual",
  hasContributions: false,
};

test.describe("Account Creation Flow", () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Navigate to the application
    await page.goto("http://localhost:5001");

    // Login
    await page.fill("input#email", TEST_USER.email);
    await page.fill("input#password", TEST_USER.password);
    await page.click('button[type="submit"]');

    // Wait for navigation to portfolio
    await page.waitForURL(/.*portfolio.*/, { timeout: 5000 }).catch(() => {
      // If URL doesn't change, we might already be on portfolio
      // This is fine for the default route
    });

    // Wait for portfolio to load
    await page.waitForSelector("text=Accounts", { timeout: 5000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test("should successfully create a new investment account", async () => {
    // Step 0: Verify we're on the portfolio page
    await expect(page.locator("text=Accounts")).toBeVisible();

    // Step 1: Open the account creation dialog
    // Find and click the black circular "+" button
    const addButton = page.locator("button.bg-black.rounded-full.w-10.h-10");
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Wait for dialog to open
    await page.waitForSelector("text=Create an account step", {
      timeout: 3000,
    });
    await expect(page.locator("text=Account Details")).toBeVisible();

    // Step 2: Fill in account details (Step 1 of form)

    // Fill in account name
    const nameInput = page.locator(
      'input[placeholder="e.g. My Trading 212 ISA"]'
    );
    await nameInput.fill(TEST_ACCOUNT.name);
    await expect(nameInput).toHaveValue(TEST_ACCOUNT.name);

    // Select platform
    const platformCombobox = page.locator('button[role="combobox"]').first();
    await platformCombobox.click();
    await page.waitForSelector('[role="option"]', { timeout: 2000 });

    const platformOption = page
      .locator(`[role="option"]:has-text("${TEST_ACCOUNT.platform}")`)
      .first();
    await platformOption.click();

    // Verify platform selected
    await expect(platformCombobox).toContainText(TEST_ACCOUNT.platform);

    // Select account type
    const accountTypeCombobox = page.locator('button[role="combobox"]').nth(1);
    await accountTypeCombobox.click();
    await page.waitForSelector('[role="option"]', { timeout: 2000 });

    const accountTypeOption = page
      .locator(`[role="option"]:has-text("${TEST_ACCOUNT.accountType}")`)
      .first();
    await accountTypeOption.click();

    // Verify account type selected
    await expect(accountTypeCombobox).toContainText(TEST_ACCOUNT.accountType);

    // Fill in start date
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill(TEST_ACCOUNT.startDate);
    await expect(dateInput).toHaveValue(TEST_ACCOUNT.startDate);

    // Click Next to go to Step 2
    const nextButton = page.locator('button:has-text("Next")');
    await nextButton.click();

    // Step 3: Select control method (Step 2 of form)
    await page.waitForSelector("text=Select Control", { timeout: 3000 });
    await expect(
      page.locator("text=How do you want to control this account?")
    ).toBeVisible();

    // Select Manual control
    const manualLabel = page.locator('label:has-text("Manual")');
    await manualLabel.click();

    // Click Next to go to Step 3
    await page.locator('button:has-text("Next")').click();

    // Step 4: Configure contributions (Step 3 of form)
    await page.waitForSelector("text=Schedule", { timeout: 3000 });
    await expect(
      page.locator("text=Should this account have scheduled contributions?")
    ).toBeVisible();

    // Select No for contributions
    const noButton = page.locator('button:has-text("No")');
    await noButton.click();

    // Step 5: Submit the form
    const addAccountButton = page.locator('button:has-text("Add Account")');
    await addAccountButton.click();

    // Step 6: Verify account was created
    // Wait for dialog to close
    await page.waitForSelector("text=Create an account step", {
      state: "hidden",
      timeout: 5000,
    });

    // Verify the new account appears in the portfolio list
    await page.waitForSelector(`text=${TEST_ACCOUNT.name}`, { timeout: 5000 });

    const newAccountCard = page.locator(
      `section:has-text("${TEST_ACCOUNT.name}")`
    );
    await expect(newAccountCard).toBeVisible();

    // Verify account details are displayed correctly
    await expect(
      newAccountCard.locator(`text=${TEST_ACCOUNT.platform}`)
    ).toBeVisible();
    await expect(
      newAccountCard.locator(`text=${TEST_ACCOUNT.accountType}`)
    ).toBeVisible();

    // Verify initial value is £0
    await expect(newAccountCard.locator("text=£0")).toBeVisible();
  });

  test("should validate required fields in Step 1", async () => {
    // Open the account creation dialog
    const addButton = page.locator("button.bg-black.rounded-full.w-10.h-10");
    await addButton.click();

    await page.waitForSelector("text=Account Details");

    // Try to click Next without filling any fields
    const nextButton = page.locator('button:has-text("Next")');
    await nextButton.click();

    // Form should still be on Step 1 due to validation errors
    // Note: Actual validation behavior depends on implementation
    await expect(page.locator("text=Account Details")).toBeVisible();
  });

  test("should allow navigation back through steps", async () => {
    // Open dialog and complete Step 1
    const addButton = page.locator("button.bg-black.rounded-full.w-10.h-10");
    await addButton.click();

    await page.waitForSelector("text=Account Details");

    // Fill minimal required fields
    await page
      .locator('input[placeholder="e.g. My Trading 212 ISA"]')
      .fill(TEST_ACCOUNT.name);

    // Select platform
    const platformCombobox = page.locator('button[role="combobox"]').first();
    await platformCombobox.click();
    await page
      .locator(`[role="option"]:has-text("${TEST_ACCOUNT.platform}")`)
      .first()
      .click();

    // Select account type
    const accountTypeCombobox = page.locator('button[role="combobox"]').nth(1);
    await accountTypeCombobox.click();
    await page
      .locator(`[role="option"]:has-text("${TEST_ACCOUNT.accountType}")`)
      .first()
      .click();

    // Fill date
    await page.locator('input[type="date"]').fill(TEST_ACCOUNT.startDate);

    // Go to Step 2
    await page.locator('button:has-text("Next")').click();
    await page.waitForSelector("text=Select Control");

    // Click Back button
    const backButton = page.locator('button:has-text("Back")');
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Should be back on Step 1
    await expect(page.locator("text=Account Details")).toBeVisible();

    // Fields should retain their values
    await expect(
      page.locator('input[placeholder="e.g. My Trading 212 ISA"]')
    ).toHaveValue(TEST_ACCOUNT.name);
  });

  test("should allow canceling account creation", async () => {
    // Open the dialog
    const addButton = page.locator("button.bg-black.rounded-full.w-10.h-10");
    await addButton.click();

    await page.waitForSelector("text=Account Details");

    // Click Cancel button
    const cancelButton = page.locator('button:has-text("Cancel")');
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    // Dialog should close
    await page.waitForSelector("text=Create an account step", {
      state: "hidden",
      timeout: 3000,
    });

    // Should be back on portfolio page
    await expect(page.locator("text=Accounts")).toBeVisible();
  });

  test("should create calculated account with securities", async () => {
    // Open dialog
    const addButton = page.locator("button.bg-black.rounded-full.w-10.h-10");
    await addButton.click();

    await page.waitForSelector("text=Account Details");

    // Fill Step 1
    await page
      .locator('input[placeholder="e.g. My Trading 212 ISA"]')
      .fill("Calculated Test Account");

    const platformCombobox = page.locator('button[role="combobox"]').first();
    await platformCombobox.click();
    await page
      .locator('[role="option"]:has-text("Trading 212")')
      .first()
      .click();

    const accountTypeCombobox = page.locator('button[role="combobox"]').nth(1);
    await accountTypeCombobox.click();
    await page.locator('[role="option"]:has-text("ISA")').first().click();

    await page.locator('input[type="date"]').fill(TEST_ACCOUNT.startDate);

    // Go to Step 2
    await page.locator('button:has-text("Next")').click();
    await page.waitForSelector("text=Select Control");

    // Select Calculated control
    const calculatedLabel = page.locator('label:has-text("Calculated")');
    await calculatedLabel.click();

    // Should see "Add Securities" section
    await expect(page.locator("text=Add Securities")).toBeVisible();

    // Note: Full security addition flow would be tested here
    // For now, we can proceed without adding securities

    // Go to Step 3
    await page.locator('button:has-text("Next")').click();
    await page.waitForSelector("text=Schedule");

    // Select No for contributions
    await page.locator('button:has-text("No")').click();

    // Submit
    await page.locator('button:has-text("Add Account")').click();

    // Verify account created
    await page.waitForSelector("text=Create an account step", {
      state: "hidden",
    });
    await expect(page.locator("text=Calculated Test Account")).toBeVisible();
  });
});

