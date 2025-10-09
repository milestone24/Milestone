import { Page, expect } from "@playwright/test";

/**
 * E2E Test Helper Functions
 *
 * Common utilities and helpers for end-to-end testing with Playwright.
 */

export const TEST_USERS = {
  default: {
    email: "test@milestone.com",
    password: "test",
  },
};

export const TEST_TIMEOUT = {
  short: 3000,
  medium: 5000,
  long: 10000,
};

/**
 * Login helper - logs in a user and waits for successful authentication
 */
export async function loginAsUser(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  // Navigate to login page if not already there
  const currentUrl = page.url();
  if (!currentUrl.includes("localhost:5001")) {
    await page.goto("http://localhost:5001");
  }

  // Fill in credentials
  await page.fill("input#email", email);
  await page.fill("input#password", password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for successful login (portfolio page loads)
  await page.waitForSelector("text=Accounts", { timeout: TEST_TIMEOUT.medium });
}

/**
 * Login as default test user
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  await loginAsUser(
    page,
    TEST_USERS.default.email,
    TEST_USERS.default.password
  );
}

/**
 * Navigate to a specific page in the app
 */
export async function navigateToPage(
  page: Page,
  pageName: "portfolio" | "goals" | "record" | "track" | "fire"
): Promise<void> {
  const navButton = page.locator(
    `[aria-label="${pageName.charAt(0).toUpperCase() + pageName.slice(1)}"]`
  );
  await expect(navButton).toBeVisible();
  await navButton.click();

  // Wait for page to load based on common element for each page
  const waitSelectors: Record<string, string> = {
    portfolio: "text=Accounts",
    goals: "text=Goals",
    record: "text=Record Account Updates",
    track: "text=Track",
    fire: "text=FIRE",
  };

  await page.waitForSelector(waitSelectors[pageName], {
    timeout: TEST_TIMEOUT.medium,
  });
}

/**
 * Open the account creation dialog
 */
export async function openAddAccountDialog(page: Page): Promise<void> {
  const addButton = page.locator("button.bg-black.rounded-full.w-10.h-10");
  await expect(addButton).toBeVisible();
  await addButton.click();

  // Wait for dialog to open
  await page.waitForSelector("text=Create an account step", {
    timeout: TEST_TIMEOUT.short,
  });
  await expect(page.locator("text=Account Details")).toBeVisible();
}

/**
 * Fill in account details (Step 1 of account creation)
 */
export async function fillAccountDetails(
  page: Page,
  details: {
    name: string;
    platform: string;
    accountType: string;
    startDate: string;
  }
): Promise<void> {
  // Fill in account name
  const nameInput = page.locator(
    'input[placeholder="e.g. My Trading 212 ISA"]'
  );
  await nameInput.fill(details.name);
  await expect(nameInput).toHaveValue(details.name);

  // Select platform
  const platformCombobox = page.locator('button[role="combobox"]').first();
  await platformCombobox.click();
  await page.waitForSelector('[role="option"]', {
    timeout: TEST_TIMEOUT.short,
  });

  const platformOption = page
    .locator(`[role="option"]:has-text("${details.platform}")`)
    .first();
  await platformOption.click();
  await expect(platformCombobox).toContainText(details.platform);

  // Select account type
  const accountTypeCombobox = page.locator('button[role="combobox"]').nth(1);
  await accountTypeCombobox.click();
  await page.waitForSelector('[role="option"]', {
    timeout: TEST_TIMEOUT.short,
  });

  const accountTypeOption = page
    .locator(`[role="option"]:has-text("${details.accountType}")`)
    .first();
  await accountTypeOption.click();
  await expect(accountTypeCombobox).toContainText(details.accountType);

  // Fill in start date
  const dateInput = page.locator('input[type="date"]');
  await dateInput.fill(details.startDate);
  await expect(dateInput).toHaveValue(details.startDate);
}

/**
 * Select control method (Step 2 of account creation)
 */
export async function selectControlMethod(
  page: Page,
  method: "manual" | "calculated"
): Promise<void> {
  await page.waitForSelector("text=Select Control", {
    timeout: TEST_TIMEOUT.short,
  });

  const labelText = method === "manual" ? "Manual" : "Calculated";
  const label = page.locator(`label:has-text("${labelText}")`);
  await label.click();
}

/**
 * Configure contributions (Step 3 of account creation)
 */
export async function configureContributions(
  page: Page,
  hasContributions: boolean
): Promise<void> {
  await page.waitForSelector("text=Schedule", { timeout: TEST_TIMEOUT.short });

  const buttonText = hasContributions ? "Yes" : "No";
  const button = page.locator(`button:has-text("${buttonText}")`);
  await button.click();
}

/**
 * Complete account creation by clicking the final submit button
 */
export async function submitAccountCreation(page: Page): Promise<void> {
  const addAccountButton = page.locator('button:has-text("Add Account")');
  await addAccountButton.click();

  // Wait for dialog to close
  await page.waitForSelector("text=Create an account step", {
    state: "hidden",
    timeout: TEST_TIMEOUT.medium,
  });
}

/**
 * Verify an account exists in the portfolio list
 */
export async function verifyAccountExists(
  page: Page,
  accountDetails: {
    name: string;
    platform: string;
    accountType: string;
  }
): Promise<void> {
  // Wait for account to appear
  await page.waitForSelector(`text=${accountDetails.name}`, {
    timeout: TEST_TIMEOUT.medium,
  });

  const accountCard = page.locator(
    `section:has-text("${accountDetails.name}")`
  );
  await expect(accountCard).toBeVisible();

  // Verify platform and account type
  await expect(
    accountCard.locator(`text=${accountDetails.platform}`)
  ).toBeVisible();
  await expect(
    accountCard.locator(`text=${accountDetails.accountType}`)
  ).toBeVisible();
}

/**
 * Delete an account (if in edit mode)
 */
export async function deleteAccount(
  page: Page,
  accountName: string
): Promise<void> {
  // Enable edit mode if not already enabled
  const editButton = page.locator("button:has(svg.lucide-pencil)");
  await editButton.click();

  // Find the account card
  const accountCard = page.locator(`section:has-text("${accountName}")`);

  // Click delete button within the account card
  const deleteButton = accountCard.locator("button:has(svg.lucide-trash)");
  await deleteButton.click();

  // Confirm deletion in alert dialog
  const confirmButton = page.locator('button:has-text("Yes")');
  await confirmButton.click();

  // Verify account is removed
  await expect(accountCard).not.toBeVisible({ timeout: TEST_TIMEOUT.medium });
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await page.screenshot({
    path: `test-results/screenshots/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

/**
 * Wait for loading to complete
 */
export async function waitForLoading(page: Page): Promise<void> {
  // Wait for any loading spinners or skeletons to disappear
  await page
    .waitForSelector('[data-testid="loading"], .skeleton', {
      state: "hidden",
      timeout: TEST_TIMEOUT.long,
    })
    .catch(() => {
      // If no loading indicators found, that's fine
    });
}

/**
 * Get the current portfolio value from the page
 */
export async function getPortfolioValue(page: Page): Promise<string> {
  const valueElement = page.locator(".text-2xl.font-bold").first();
  return (await valueElement.textContent()) || "";
}

/**
 * Count the number of accounts in the portfolio
 */
export async function countAccounts(page: Page): Promise<number> {
  const accountCards = page.locator(
    'section:has(div:has-text("ISA"), div:has-text("GIA"), div:has-text("SIPP"))'
  );
  return await accountCards.count();
}

/**
 * Check if an element is visible on the page
 */
export async function isElementVisible(
  page: Page,
  selector: string
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { state: "visible", timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fill a form field by label text
 */
export async function fillFieldByLabel(
  page: Page,
  labelText: string,
  value: string
): Promise<void> {
  const label = page.locator(`label:has-text("${labelText}")`);
  const fieldId = await label.getAttribute("for");

  if (fieldId) {
    await page.fill(`#${fieldId}`, value);
  } else {
    // Fallback: find input near the label
    const input = label.locator("..").locator("input, textarea").first();
    await input.fill(value);
  }
}

/**
 * Click a button by its text content
 */
export async function clickButtonByText(
  page: Page,
  text: string
): Promise<void> {
  const button = page.locator(`button:has-text("${text}")`);
  await expect(button).toBeVisible();
  await button.click();
}

