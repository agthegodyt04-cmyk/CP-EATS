import { test, expect } from './fixtures';

test.describe('Smoke Tests', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CP EATS/i);
    await expect(page.locator('[data-testid="app-landing"]')).toBeVisible();
  });

  test('should toggle theme on customer dashboard', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForSelector('[data-testid="customer-dashboard"], [data-testid="app-landing"]', { timeout: 10000 });
    const landing = authenticatedPage.locator('[data-testid="app-landing"]');
    if (await landing.isVisible()) {
      throw new Error('User is not authenticated - check global-setup.ts and Supabase credentials');
    }
    await expect(authenticatedPage.locator('[data-testid="customer-dashboard"]')).toBeVisible();

    const themeToggle = authenticatedPage.locator('[data-testid="theme-toggle"]');
    await expect(themeToggle).toBeVisible();

    const initialTheme = await authenticatedPage.evaluate(() => document.documentElement.classList.contains('dark'));

    await themeToggle.click();
    await authenticatedPage.waitForTimeout(500);

    const newTheme = await authenticatedPage.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(newTheme).toBe(!initialTheme);
  });

  test('should show dashboard for authenticated user', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.waitForSelector('[data-testid="customer-dashboard"], [data-testid="app-landing"]', { timeout: 10000 });
    const landing = authenticatedPage.locator('[data-testid="app-landing"]');
    if (await landing.isVisible()) {
      throw new Error('User is not authenticated - check global-setup.ts and Supabase credentials');
    }
    await expect(authenticatedPage.locator('[data-testid="customer-dashboard"]')).toBeVisible();
  });
});
